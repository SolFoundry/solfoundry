"""On-chain event indexing service for Helius/Shyft webhooks.

Provides the core logic for receiving, deduplicating, queuing, and
persisting Solana program events from Helius or Shyft webhook providers.
All data is stored in PostgreSQL as the primary source of truth.

Key capabilities:
    - Webhook payload parsing for both Helius and Shyft formats
    - Transaction signature + log_index deduplication
    - Async processing queue so webhook responses are not blocked
    - Historical backfill via provider APIs
    - Indexer health monitoring with staleness detection
    - Real-time WebSocket broadcast of newly indexed events

PostgreSQL is the primary datastore. The in-memory processing queue
is a bounded asyncio.Queue that buffers events between webhook receipt
and database persistence. On restart, unprocessed queue items are lost
but can be recovered via backfill.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import httpx
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.indexed_event import (
    BackfillResponse,
    EventSource,
    IndexedEventListResponse,
    IndexedEventResponse,
    IndexedEventStatus,
    IndexedEventTable,
    IndexerHealthListResponse,
    IndexerHealthResponse,
    IndexerHealthTable,
    OnChainEventType,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

HELIUS_API_KEY = os.getenv("HELIUS_API_KEY", "")
HELIUS_WEBHOOK_SECRET = os.getenv("HELIUS_WEBHOOK_SECRET", "")
SHYFT_API_KEY = os.getenv("SHYFT_API_KEY", "")

SOLFOUNDRY_PROGRAM_IDS = os.getenv(
    "SOLFOUNDRY_PROGRAM_IDS",
    "SFndryXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
).split(",")

QUEUE_MAX_SIZE = int(os.getenv("EVENT_QUEUE_MAX_SIZE", "10000"))
HEALTH_STALENESS_THRESHOLD_SECONDS = int(
    os.getenv("INDEXER_HEALTH_STALENESS_SECONDS", "300")
)

# ---------------------------------------------------------------------------
# Processing queue
# ---------------------------------------------------------------------------

_event_queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue(maxsize=QUEUE_MAX_SIZE)
_queue_worker_task: Optional[asyncio.Task] = None


# ---------------------------------------------------------------------------
# Webhook payload parsing
# ---------------------------------------------------------------------------

def classify_event_type(
    transaction_type: str,
    description: str,
    token_transfers: List[Dict[str, Any]],
    accounts: List[Dict[str, Any]],
) -> OnChainEventType:
    """Classify a transaction into a SolFoundry event type.

    Uses heuristics based on the transaction type string, description
    text, and token transfer patterns to determine which on-chain
    action occurred.

    Args:
        transaction_type: Provider-classified transaction type string.
        description: Human-readable transaction description.
        token_transfers: List of SPL token transfer details.
        accounts: List of account data changes.

    Returns:
        The most appropriate OnChainEventType for this transaction.
    """
    description_lower = description.lower()
    type_lower = transaction_type.lower()

    if "escrow" in description_lower and "create" in description_lower:
        return OnChainEventType.ESCROW_CREATED
    if "escrow" in description_lower and "release" in description_lower:
        return OnChainEventType.ESCROW_RELEASED
    if "escrow" in description_lower and "refund" in description_lower:
        return OnChainEventType.ESCROW_REFUNDED
    if "escrow" in description_lower and "fund" in description_lower:
        return OnChainEventType.ESCROW_FUNDED
    if "reputation" in description_lower or "reputation" in type_lower:
        return OnChainEventType.REPUTATION_UPDATED
    if "stake" in description_lower or "deposit" in description_lower:
        return OnChainEventType.STAKE_DEPOSITED

    # Fallback heuristics based on token transfers
    if token_transfers:
        return OnChainEventType.ESCROW_FUNDED

    return OnChainEventType.ESCROW_CREATED


def parse_helius_webhook(payload: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Parse a Helius enhanced transaction webhook payload.

    Helius sends an array of enriched transactions. Each transaction
    is normalized into the internal indexed event format with extracted
    accounts, token amounts, and classified event types.

    Args:
        payload: List of Helius enhanced transaction objects.

    Returns:
        List of normalized event dicts ready for database insertion.
    """
    events: List[Dict[str, Any]] = []

    for index, transaction in enumerate(payload):
        signature = transaction.get("signature", "")
        slot = transaction.get("slot", 0)
        block_time = transaction.get("blockTime", 0)
        tx_type = transaction.get("type", "UNKNOWN")
        description = transaction.get("description", "")
        account_data = transaction.get("accountData", [])
        token_transfers = transaction.get("tokenTransfers", [])
        native_transfers = transaction.get("nativeTransfers", [])

        if not signature:
            logger.warning("Helius event missing signature at index %d, skipping", index)
            continue

        event_type = classify_event_type(
            tx_type, description, token_transfers, account_data,
        )

        # Extract primary user wallet from native or token transfers
        user_wallet = None
        amount = None
        if token_transfers:
            first_transfer = token_transfers[0]
            user_wallet = first_transfer.get("fromUserAccount") or first_transfer.get(
                "toUserAccount"
            )
            raw_amount = first_transfer.get("tokenAmount")
            if raw_amount is not None:
                try:
                    amount = Decimal(str(raw_amount))
                except (ValueError, TypeError):
                    pass
        elif native_transfers:
            first_native = native_transfers[0]
            user_wallet = first_native.get("fromUserAccount") or first_native.get(
                "toUserAccount"
            )
            raw_amount = first_native.get("amount")
            if raw_amount is not None:
                try:
                    amount = Decimal(str(raw_amount))
                except (ValueError, TypeError):
                    pass

        # Build accounts mapping from accountData
        accounts_map: Dict[str, Any] = {}
        for account_entry in account_data:
            account_key = account_entry.get("account", "")
            if account_key:
                accounts_map[account_key] = {
                    "nativeBalanceChange": account_entry.get("nativeBalanceChange", 0),
                    "tokenBalanceChanges": account_entry.get("tokenBalanceChanges", []),
                }

        # Determine program ID from account data or default
        program_id = ""
        for pid in SOLFOUNDRY_PROGRAM_IDS:
            if pid in accounts_map:
                program_id = pid
                break
        if not program_id:
            program_id = SOLFOUNDRY_PROGRAM_IDS[0] if SOLFOUNDRY_PROGRAM_IDS else ""

        event = {
            "transaction_signature": signature,
            "log_index": 0,
            "event_type": event_type.value,
            "program_id": program_id,
            "block_slot": slot,
            "block_time": datetime.fromtimestamp(block_time, tz=timezone.utc)
            if block_time
            else datetime.now(timezone.utc),
            "source": EventSource.HELIUS.value,
            "accounts": accounts_map,
            "data": {
                "type": tx_type,
                "description": description,
                "tokenTransfers": token_transfers,
                "nativeTransfers": native_transfers,
            },
            "user_wallet": user_wallet,
            "amount": amount,
            "status": IndexedEventStatus.CONFIRMED.value,
        }
        events.append(event)

    return events


def parse_shyft_webhook(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Parse a Shyft transaction webhook payload.

    Shyft sends a single object (or array) per webhook delivery.
    Each transaction is normalized into the internal indexed event
    format.

    Args:
        payload: Shyft webhook payload (single transaction or wrapped).

    Returns:
        List of normalized event dicts ready for database insertion.
    """
    events: List[Dict[str, Any]] = []

    # Shyft may wrap in a list or send a single object
    transactions = payload if isinstance(payload, list) else [payload]

    for index, transaction in enumerate(transactions):
        signature = transaction.get("signature", transaction.get("txn_signature", ""))
        slot = transaction.get("slot", 0)
        block_time = transaction.get("blockTime", transaction.get("block_time", 0))
        tx_type = transaction.get("type", "UNKNOWN")
        actions = transaction.get("actions", [])

        if not signature:
            logger.warning("Shyft event missing signature at index %d, skipping", index)
            continue

        description = ""
        token_transfers: List[Dict[str, Any]] = []
        user_wallet = None
        amount = None

        for action in actions:
            if "info" in action:
                info = action["info"]
                if "sender" in info:
                    user_wallet = info["sender"]
                elif "authority" in info:
                    user_wallet = info["authority"]
                if "amount" in info:
                    try:
                        amount = Decimal(str(info["amount"]))
                    except (ValueError, TypeError):
                        pass
                token_transfers.append(info)

        event_type = classify_event_type(tx_type, description, token_transfers, [])

        program_id = SOLFOUNDRY_PROGRAM_IDS[0] if SOLFOUNDRY_PROGRAM_IDS else ""

        event = {
            "transaction_signature": signature,
            "log_index": 0,
            "event_type": event_type.value,
            "program_id": program_id,
            "block_slot": slot,
            "block_time": datetime.fromtimestamp(block_time, tz=timezone.utc)
            if block_time
            else datetime.now(timezone.utc),
            "source": EventSource.SHYFT.value,
            "accounts": {},
            "data": {
                "type": tx_type,
                "actions": actions,
                "raw": transaction.get("raw"),
            },
            "user_wallet": user_wallet,
            "amount": amount,
            "status": IndexedEventStatus.CONFIRMED.value,
        }
        events.append(event)

    return events


# ---------------------------------------------------------------------------
# Database operations
# ---------------------------------------------------------------------------

async def _persist_event(
    db: AsyncSession, event_data: Dict[str, Any],
) -> Optional[IndexedEventTable]:
    """Insert a single event into the database with deduplication.

    Uses the unique constraint on (transaction_signature, log_index)
    to detect duplicates. If a duplicate is detected, the existing
    row is returned unchanged.

    Args:
        db: Async database session.
        event_data: Normalized event dictionary to persist.

    Returns:
        The persisted IndexedEventTable row, or None if deduplication
        prevented insertion.
    """
    row = IndexedEventTable(**event_data)
    db.add(row)
    try:
        await db.flush()
        return row
    except IntegrityError:
        await db.rollback()
        logger.debug(
            "Duplicate event skipped: tx=%s log_index=%d",
            event_data["transaction_signature"],
            event_data.get("log_index", 0),
        )
        return None


async def persist_events(events: List[Dict[str, Any]]) -> Tuple[int, int]:
    """Persist a batch of events to PostgreSQL with deduplication.

    Processes events one at a time within a single session to handle
    individual duplicate detection gracefully. Updates the indexer
    health record after successful persistence.

    Args:
        events: List of normalized event dicts to persist.

    Returns:
        Tuple of (inserted_count, duplicate_count).
    """
    inserted = 0
    duplicates = 0

    async with get_db_session() as db:
        for event_data in events:
            try:
                row = IndexedEventTable(**event_data)
                db.add(row)
                await db.flush()
                inserted += 1
            except IntegrityError:
                await db.rollback()
                duplicates += 1
                logger.debug(
                    "Duplicate event skipped: tx=%s log_index=%d",
                    event_data.get("transaction_signature", "?"),
                    event_data.get("log_index", 0),
                )

        if inserted > 0:
            await db.commit()

    # Update health tracking for the source
    if events:
        source = events[0].get("source", EventSource.HELIUS.value)
        max_slot = max(e.get("block_slot", 0) for e in events)
        max_block_time = max(
            (e.get("block_time", datetime.min.replace(tzinfo=timezone.utc)) for e in events),
            default=None,
        )
        await _update_health(
            source=source,
            latest_slot=max_slot,
            latest_block_time=max_block_time,
            events_count=inserted,
        )

    logger.info(
        "Persisted %d events (%d duplicates skipped)", inserted, duplicates,
    )
    return inserted, duplicates


async def _update_health(
    source: str,
    latest_slot: int,
    latest_block_time: Optional[datetime],
    events_count: int,
    error: Optional[str] = None,
) -> None:
    """Update the indexer health record for a given source.

    Creates the health row if it does not exist (upsert pattern).

    Args:
        source: Indexing source name (helius, shyft, backfill).
        latest_slot: Highest slot number processed in this batch.
        latest_block_time: Block time of the highest slot.
        events_count: Number of events processed in this batch.
        error: Optional error message to record.
    """
    now = datetime.now(timezone.utc)
    async with get_db_session() as db:
        result = await db.execute(
            select(IndexerHealthTable).where(IndexerHealthTable.source == source)
        )
        health_row = result.scalar_one_or_none()

        if health_row is None:
            health_row = IndexerHealthTable(
                source=source,
                latest_slot=latest_slot,
                latest_block_time=latest_block_time,
                events_processed=events_count,
                last_webhook_received_at=now,
                last_error=error,
            )
            db.add(health_row)
        else:
            if latest_slot > health_row.latest_slot:
                health_row.latest_slot = latest_slot
                health_row.latest_block_time = latest_block_time
            health_row.events_processed = (health_row.events_processed or 0) + events_count
            health_row.last_webhook_received_at = now
            if error:
                health_row.last_error = error

        await db.commit()


# ---------------------------------------------------------------------------
# Queue worker
# ---------------------------------------------------------------------------

async def enqueue_events(events: List[Dict[str, Any]]) -> int:
    """Add parsed events to the async processing queue.

    Non-blocking: if the queue is full, events are logged and dropped.
    This ensures webhook responses are never delayed by database I/O.

    Args:
        events: List of normalized event dicts to enqueue.

    Returns:
        Number of events successfully enqueued.
    """
    enqueued = 0
    for event in events:
        try:
            _event_queue.put_nowait(event)
            enqueued += 1
        except asyncio.QueueFull:
            logger.warning(
                "Event queue full (max=%d), dropping event tx=%s",
                QUEUE_MAX_SIZE,
                event.get("transaction_signature", "?"),
            )
            break
    return enqueued


async def _process_queue_batch() -> int:
    """Drain up to 100 events from the queue and persist them.

    Called by the queue worker loop. Groups events into a batch
    for efficient database insertion.

    Returns:
        Number of events successfully persisted.
    """
    batch: List[Dict[str, Any]] = []
    batch_size = 100

    while len(batch) < batch_size:
        try:
            event = _event_queue.get_nowait()
            batch.append(event)
        except asyncio.QueueEmpty:
            break

    if not batch:
        return 0

    try:
        inserted, _ = await persist_events(batch)

        # Broadcast newly indexed events via WebSocket
        try:
            from app.services.websocket_manager import manager as ws_manager

            for event_data in batch[:inserted] if inserted > 0 else []:
                await ws_manager.emit_event(
                    event_type="bounty_update",
                    channel="indexed_events",
                    payload={
                        "bounty_id": event_data.get("bounty_id", "system"),
                        "title": f"On-chain event: {event_data.get('event_type', 'unknown')}",
                        "previous_status": None,
                        "new_status": event_data.get("event_type", "unknown"),
                    },
                )
        except Exception as ws_error:
            logger.debug("WebSocket broadcast failed (non-fatal): %s", ws_error)

        return inserted
    except Exception as exc:
        logger.error("Failed to persist event batch: %s", exc)
        source = batch[0].get("source", "unknown") if batch else "unknown"
        await _update_health(
            source=source,
            latest_slot=0,
            latest_block_time=None,
            events_count=0,
            error=str(exc),
        )
        return 0


async def queue_worker(poll_interval: float = 1.0) -> None:
    """Background task that continuously drains the event queue.

    Runs in an infinite loop, processing batches of events from
    the queue and persisting them to PostgreSQL. Sleeps briefly
    when the queue is empty to avoid busy-waiting.

    Args:
        poll_interval: Seconds to sleep when the queue is empty.
    """
    logger.info("Event indexer queue worker started (poll_interval=%.1fs)", poll_interval)
    while True:
        try:
            processed = await _process_queue_batch()
            if processed == 0:
                await asyncio.sleep(poll_interval)
        except asyncio.CancelledError:
            logger.info("Event indexer queue worker shutting down")
            # Drain remaining events before exiting
            remaining = await _process_queue_batch()
            if remaining > 0:
                logger.info("Flushed %d remaining events on shutdown", remaining)
            break
        except Exception as exc:
            logger.error("Queue worker error: %s", exc)
            await asyncio.sleep(poll_interval)


def start_queue_worker() -> asyncio.Task:
    """Start the background queue worker task.

    Returns:
        The asyncio Task running the queue worker.
    """
    global _queue_worker_task
    _queue_worker_task = asyncio.create_task(queue_worker())
    return _queue_worker_task


def stop_queue_worker() -> None:
    """Cancel the background queue worker task."""
    global _queue_worker_task
    if _queue_worker_task and not _queue_worker_task.done():
        _queue_worker_task.cancel()


# ---------------------------------------------------------------------------
# Query API
# ---------------------------------------------------------------------------

def _row_to_response(row: IndexedEventTable) -> IndexedEventResponse:
    """Convert an ORM row to a Pydantic response model.

    Args:
        row: IndexedEventTable ORM instance.

    Returns:
        IndexedEventResponse with all fields populated.
    """
    return IndexedEventResponse(
        id=str(row.id),
        transaction_signature=row.transaction_signature,
        log_index=row.log_index,
        event_type=row.event_type,
        program_id=row.program_id,
        block_slot=row.block_slot,
        block_time=row.block_time,
        source=row.source,
        accounts=row.accounts or {},
        data=row.data or {},
        user_wallet=row.user_wallet,
        bounty_id=row.bounty_id,
        amount=float(row.amount) if row.amount is not None else None,
        status=row.status,
        indexed_at=row.indexed_at,
    )


async def query_events(
    event_type: Optional[str] = None,
    user_wallet: Optional[str] = None,
    bounty_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> IndexedEventListResponse:
    """Query indexed events with filtering and pagination.

    All filters are optional and combined with AND logic. Results
    are ordered by block_time descending (newest first).

    Args:
        event_type: Filter by on-chain event type.
        user_wallet: Filter by the primary user wallet address.
        bounty_id: Filter by associated bounty UUID.
        start_date: Only include events on or after this timestamp.
        end_date: Only include events on or before this timestamp.
        status: Filter by processing status.
        page: Page number (1-indexed).
        page_size: Number of events per page (max 100).

    Returns:
        Paginated list of matching indexed events.
    """
    page_size = min(page_size, 100)
    offset = (page - 1) * page_size

    async with get_db_session() as db:
        query = select(IndexedEventTable)
        count_query = select(func.count(IndexedEventTable.id))

        # Apply filters
        if event_type:
            query = query.where(IndexedEventTable.event_type == event_type)
            count_query = count_query.where(IndexedEventTable.event_type == event_type)
        if user_wallet:
            query = query.where(IndexedEventTable.user_wallet == user_wallet)
            count_query = count_query.where(
                IndexedEventTable.user_wallet == user_wallet
            )
        if bounty_id:
            query = query.where(IndexedEventTable.bounty_id == bounty_id)
            count_query = count_query.where(IndexedEventTable.bounty_id == bounty_id)
        if start_date:
            query = query.where(IndexedEventTable.block_time >= start_date)
            count_query = count_query.where(
                IndexedEventTable.block_time >= start_date
            )
        if end_date:
            query = query.where(IndexedEventTable.block_time <= end_date)
            count_query = count_query.where(IndexedEventTable.block_time <= end_date)
        if status:
            query = query.where(IndexedEventTable.status == status)
            count_query = count_query.where(IndexedEventTable.status == status)

        # Get total count
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Get page of results
        query = (
            query.order_by(IndexedEventTable.block_time.desc())
            .offset(offset)
            .limit(page_size)
        )
        result = await db.execute(query)
        rows = result.scalars().all()

        return IndexedEventListResponse(
            events=[_row_to_response(row) for row in rows],
            total=total,
            page=page,
            page_size=page_size,
            has_more=(offset + page_size) < total,
        )


async def get_event_by_signature(
    transaction_signature: str, log_index: int = 0,
) -> Optional[IndexedEventResponse]:
    """Retrieve a single indexed event by transaction signature and log index.

    Args:
        transaction_signature: Solana transaction signature to look up.
        log_index: Log index within the transaction (default 0).

    Returns:
        The matching IndexedEventResponse, or None if not found.
    """
    async with get_db_session() as db:
        result = await db.execute(
            select(IndexedEventTable).where(
                IndexedEventTable.transaction_signature == transaction_signature,
                IndexedEventTable.log_index == log_index,
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None
        return _row_to_response(row)


# ---------------------------------------------------------------------------
# Health monitoring
# ---------------------------------------------------------------------------

async def get_indexer_health() -> IndexerHealthListResponse:
    """Retrieve health status for all indexing sources.

    Evaluates staleness by comparing the last webhook received
    timestamp against the configured threshold. A source is
    considered unhealthy if no webhooks have been received within
    the staleness threshold or if there are recent errors.

    Returns:
        Aggregated health status across all indexing sources.
    """
    now = datetime.now(timezone.utc)
    sources: List[IndexerHealthResponse] = []

    async with get_db_session() as db:
        result = await db.execute(select(IndexerHealthTable))
        rows = result.scalars().all()

        for row in rows:
            seconds_behind: Optional[float] = None
            is_healthy = True

            if row.last_webhook_received_at:
                last_received = row.last_webhook_received_at
                # Ensure timezone-aware comparison (SQLite stores naive datetimes)
                if last_received.tzinfo is None:
                    last_received = last_received.replace(tzinfo=timezone.utc)
                seconds_behind = (now - last_received).total_seconds()
                if seconds_behind > HEALTH_STALENESS_THRESHOLD_SECONDS:
                    is_healthy = False

            if row.last_error:
                is_healthy = False

            sources.append(
                IndexerHealthResponse(
                    source=row.source,
                    latest_slot=row.latest_slot or 0,
                    latest_block_time=row.latest_block_time,
                    events_processed=row.events_processed or 0,
                    last_webhook_received_at=row.last_webhook_received_at,
                    last_error=row.last_error,
                    is_healthy=is_healthy,
                    seconds_behind=seconds_behind,
                )
            )

    # If no sources registered yet, report as healthy (initial state)
    overall_healthy = all(s.is_healthy for s in sources) if sources else True

    return IndexerHealthListResponse(
        sources=sources,
        overall_healthy=overall_healthy,
    )


async def check_indexer_health_and_alert() -> bool:
    """Check indexer health and log warnings for unhealthy sources.

    Called by the periodic health monitor to detect when the indexer
    falls behind real-time. Returns False and logs a warning when
    any source exceeds the staleness threshold.

    Returns:
        True if all sources are healthy, False otherwise.
    """
    health = await get_indexer_health()
    if not health.overall_healthy:
        for source in health.sources:
            if not source.is_healthy:
                logger.warning(
                    "Indexer source '%s' is unhealthy: "
                    "seconds_behind=%.1f, last_error=%s",
                    source.source,
                    source.seconds_behind or 0,
                    source.last_error or "none",
                )
    return health.overall_healthy


async def periodic_health_check(interval_seconds: int = 60) -> None:
    """Background task that periodically checks indexer health.

    Runs in an infinite loop, checking all indexing sources against
    the staleness threshold and logging warnings when issues are
    detected.

    Args:
        interval_seconds: Seconds between health check runs.
    """
    logger.info("Indexer health monitor started (interval=%ds)", interval_seconds)
    while True:
        try:
            await check_indexer_health_and_alert()
        except asyncio.CancelledError:
            logger.info("Indexer health monitor shutting down")
            break
        except Exception as exc:
            logger.error("Health check error: %s", exc)
        await asyncio.sleep(interval_seconds)


# ---------------------------------------------------------------------------
# Backfill
# ---------------------------------------------------------------------------

async def backfill_events(
    start_slot: int,
    end_slot: int,
    source: str = EventSource.HELIUS.value,
) -> BackfillResponse:
    """Fetch and index historical transactions from a provider API.

    Queries the Helius or Shyft API for transactions involving the
    SolFoundry program IDs within the specified slot range, then
    indexes them through the normal persistence pipeline.

    This is an idempotent operation thanks to the deduplication
    constraint on (transaction_signature, log_index).

    Args:
        start_slot: First Solana slot to backfill from.
        end_slot: Last Solana slot to backfill (inclusive).
        source: Provider to use for historical data (helius or shyft).

    Returns:
        BackfillResponse with counts of events indexed and any errors.
    """
    events_indexed = 0
    errors: List[str] = []

    if source == EventSource.HELIUS.value:
        if not HELIUS_API_KEY:
            return BackfillResponse(
                status="failed",
                events_indexed=0,
                start_slot=start_slot,
                end_slot=end_slot,
                errors=["HELIUS_API_KEY not configured"],
            )

        for program_id in SOLFOUNDRY_PROGRAM_IDS:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        f"https://api.helius.xyz/v0/addresses/{program_id}/transactions",
                        params={"api-key": HELIUS_API_KEY},
                        json={
                            "type": "PROGRAM_INTERACTION",
                            "slotRange": {
                                "firstSlot": start_slot,
                                "lastSlot": end_slot,
                            },
                        },
                    )

                    if response.status_code == 200:
                        transactions = response.json()
                        parsed_events = parse_helius_webhook(transactions)
                        # Mark source as backfill
                        for event in parsed_events:
                            event["source"] = EventSource.BACKFILL.value
                        inserted, _ = await persist_events(parsed_events)
                        events_indexed += inserted
                    else:
                        error_msg = (
                            f"Helius API returned {response.status_code} "
                            f"for program {program_id}"
                        )
                        errors.append(error_msg)
                        logger.warning(error_msg)
            except Exception as exc:
                error_msg = f"Backfill error for {program_id}: {exc}"
                errors.append(error_msg)
                logger.error(error_msg)

    elif source == EventSource.SHYFT.value:
        if not SHYFT_API_KEY:
            return BackfillResponse(
                status="failed",
                events_indexed=0,
                start_slot=start_slot,
                end_slot=end_slot,
                errors=["SHYFT_API_KEY not configured"],
            )

        for program_id in SOLFOUNDRY_PROGRAM_IDS:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(
                        "https://api.shyft.to/sol/v1/transaction/history",
                        params={
                            "network": "mainnet-beta",
                            "account": program_id,
                            "tx_num": 100,
                        },
                        headers={"x-api-key": SHYFT_API_KEY},
                    )

                    if response.status_code == 200:
                        data = response.json()
                        transactions = data.get("result", [])
                        parsed_events = parse_shyft_webhook(
                            {"transactions": transactions}
                            if not isinstance(transactions, list)
                            else transactions
                        )
                        for event in parsed_events:
                            event["source"] = EventSource.BACKFILL.value
                        inserted, _ = await persist_events(parsed_events)
                        events_indexed += inserted
                    else:
                        error_msg = (
                            f"Shyft API returned {response.status_code} "
                            f"for program {program_id}"
                        )
                        errors.append(error_msg)
                        logger.warning(error_msg)
            except Exception as exc:
                error_msg = f"Backfill error for {program_id}: {exc}"
                errors.append(error_msg)
                logger.error(error_msg)

    status = "completed" if not errors else "completed_with_errors"
    if events_indexed == 0 and errors:
        status = "failed"

    return BackfillResponse(
        status=status,
        events_indexed=events_indexed,
        start_slot=start_slot,
        end_slot=end_slot,
        errors=errors,
    )
