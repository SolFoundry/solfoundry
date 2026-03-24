"""API endpoints for on-chain event indexing via Helius/Shyft webhooks.

Provides endpoints for:
    - Receiving Helius/Shyft webhook deliveries (``POST /webhooks/helius``,
      ``POST /webhooks/shyft``)
    - Querying indexed events with filtering and pagination
      (``GET /indexed-events``, ``GET /indexed-events/{signature}``)
    - Indexer health monitoring (``GET /indexed-events/health``)
    - Historical backfill (``POST /indexed-events/backfill``)

Webhook endpoints respond immediately (HTTP 200) and enqueue events
for async processing to avoid blocking webhook retries. Query endpoints
read directly from PostgreSQL.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse

from app.auth import get_current_user_id
from app.models.indexed_event import (
    BackfillRequest,
    BackfillResponse,
    IndexedEventListResponse,
    IndexedEventResponse,
    IndexerHealthListResponse,
)
from app.services.event_indexer_service import (
    backfill_events,
    enqueue_events,
    get_event_by_signature,
    get_indexer_health,
    parse_helius_webhook,
    parse_shyft_webhook,
    query_events,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["event-indexer"])

# Webhook secrets for HMAC verification
HELIUS_WEBHOOK_SECRET = os.getenv("HELIUS_WEBHOOK_SECRET", "")
SHYFT_WEBHOOK_SECRET = os.getenv("SHYFT_WEBHOOK_SECRET", "")


def _verify_helius_signature(
    payload: bytes, authorization_header: Optional[str],
) -> bool:
    """Verify the Helius webhook HMAC-SHA256 signature.

    Helius sends the signature in the Authorization header as a
    raw HMAC-SHA256 hex digest. When no secret is configured, the
    signature check is skipped (development mode).

    Args:
        payload: Raw request body bytes.
        authorization_header: Value of the Authorization header.

    Returns:
        True if the signature is valid or verification is disabled.
    """
    if not HELIUS_WEBHOOK_SECRET:
        logger.debug("Helius webhook secret not configured, skipping verification")
        return True

    if not authorization_header:
        return False

    expected = hmac.new(
        HELIUS_WEBHOOK_SECRET.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, authorization_header)


def _verify_shyft_signature(
    payload: bytes, signature_header: Optional[str],
) -> bool:
    """Verify the Shyft webhook signature.

    Shyft uses an x-shyft-signature header containing an HMAC-SHA256
    hex digest of the payload. When no secret is configured, the
    signature check is skipped (development mode).

    Args:
        payload: Raw request body bytes.
        signature_header: Value of the x-shyft-signature header.

    Returns:
        True if the signature is valid or verification is disabled.
    """
    if not SHYFT_WEBHOOK_SECRET:
        logger.debug("Shyft webhook secret not configured, skipping verification")
        return True

    if not signature_header:
        return False

    expected = hmac.new(
        SHYFT_WEBHOOK_SECRET.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature_header)


# ---------------------------------------------------------------------------
# Webhook receiver endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/webhooks/helius",
    summary="Receive Helius enhanced transaction webhook",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"description": "Invalid webhook signature"},
    },
)
async def receive_helius_webhook(
    request: Request,
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> JSONResponse:
    """Receive and enqueue on-chain events from a Helius webhook.

    Verifies the webhook signature, parses the enhanced transaction
    payload, and enqueues events for async persistence. Responds
    immediately with HTTP 200 to prevent Helius from retrying.

    The request body is expected to be a JSON array of enhanced
    transaction objects as documented by Helius:
    https://docs.helius.dev/webhooks/enhanced-webhooks

    Args:
        request: The incoming FastAPI request.
        authorization: Optional Helius webhook HMAC signature.

    Returns:
        JSON response with the number of events enqueued.
    """
    payload = await request.body()

    if not _verify_helius_signature(payload, authorization):
        logger.warning("Helius webhook signature verification failed")
        return JSONResponse(
            status_code=401, content={"error": "Invalid webhook signature"},
        )

    try:
        import json
        body = json.loads(payload)
    except Exception as exc:
        logger.error("Failed to parse Helius webhook payload: %s", exc)
        return JSONResponse(
            status_code=400, content={"error": "Invalid JSON payload"},
        )

    # Helius sends an array of transactions
    transactions = body if isinstance(body, list) else [body]

    events = parse_helius_webhook(transactions)
    enqueued = await enqueue_events(events)

    logger.info(
        "Helius webhook: received %d transactions, enqueued %d events",
        len(transactions),
        enqueued,
    )

    return JSONResponse(
        status_code=200,
        content={
            "status": "accepted",
            "transactions_received": len(transactions),
            "events_enqueued": enqueued,
        },
    )


@router.post(
    "/webhooks/shyft",
    summary="Receive Shyft transaction webhook",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"description": "Invalid webhook signature"},
    },
)
async def receive_shyft_webhook(
    request: Request,
    x_shyft_signature: Optional[str] = Header(None, alias="x-shyft-signature"),
) -> JSONResponse:
    """Receive and enqueue on-chain events from a Shyft webhook.

    Verifies the webhook signature, parses the transaction payload,
    and enqueues events for async persistence. Responds immediately
    with HTTP 200 to prevent Shyft from retrying.

    Args:
        request: The incoming FastAPI request.
        x_shyft_signature: Optional Shyft webhook HMAC signature.

    Returns:
        JSON response with the number of events enqueued.
    """
    payload = await request.body()

    if not _verify_shyft_signature(payload, x_shyft_signature):
        logger.warning("Shyft webhook signature verification failed")
        return JSONResponse(
            status_code=401, content={"error": "Invalid webhook signature"},
        )

    try:
        import json
        body = json.loads(payload)
    except Exception as exc:
        logger.error("Failed to parse Shyft webhook payload: %s", exc)
        return JSONResponse(
            status_code=400, content={"error": "Invalid JSON payload"},
        )

    events = parse_shyft_webhook(body)
    enqueued = await enqueue_events(events)

    logger.info(
        "Shyft webhook: enqueued %d events", enqueued,
    )

    return JSONResponse(
        status_code=200,
        content={
            "status": "accepted",
            "events_enqueued": enqueued,
        },
    )


# ---------------------------------------------------------------------------
# Query endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/indexed-events",
    response_model=IndexedEventListResponse,
    summary="Query indexed on-chain events",
)
async def list_events(
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    user_wallet: Optional[str] = Query(None, description="Filter by user wallet"),
    bounty_id: Optional[str] = Query(None, description="Filter by bounty ID"),
    start_date: Optional[datetime] = Query(
        None, description="Events on or after this ISO 8601 timestamp",
    ),
    end_date: Optional[datetime] = Query(
        None, description="Events on or before this ISO 8601 timestamp",
    ),
    status: Optional[str] = Query(None, description="Filter by processing status"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=100, description="Events per page"),
) -> IndexedEventListResponse:
    """Query indexed on-chain events with optional filters.

    Supports filtering by event type, user wallet, bounty ID, date
    range, and processing status. Results are ordered by block_time
    descending (newest first) and paginated.

    Args:
        event_type: Filter by on-chain event type (e.g., escrow_created).
        user_wallet: Filter by the primary user wallet address.
        bounty_id: Filter by associated bounty UUID.
        start_date: Only include events on or after this timestamp.
        end_date: Only include events on or before this timestamp.
        status: Filter by processing status (confirmed, processing, failed).
        page: Page number for pagination (default 1).
        page_size: Number of events per page (default 50, max 100).

    Returns:
        Paginated list of matching indexed events with total count.
    """
    return await query_events(
        event_type=event_type,
        user_wallet=user_wallet,
        bounty_id=bounty_id,
        start_date=start_date,
        end_date=end_date,
        status=status,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/indexed-events/health",
    response_model=IndexerHealthListResponse,
    summary="Get indexer health status",
)
async def indexer_health() -> IndexerHealthListResponse:
    """Return the health status of all event indexing sources.

    Reports per-source metrics including latest processed slot,
    events processed, time since last webhook, and error status.
    A source is considered unhealthy if no webhooks have been
    received within the configured staleness threshold (default
    300 seconds) or if there are recent errors.

    Returns:
        Aggregated health status with per-source details.
    """
    return await get_indexer_health()


@router.get(
    "/indexed-events/{transaction_signature}",
    response_model=IndexedEventResponse,
    summary="Get a single indexed event by transaction signature",
    responses={
        404: {"description": "Event not found"},
    },
)
async def get_event(
    transaction_signature: str,
    log_index: int = Query(0, ge=0, description="Log index within the transaction"),
) -> IndexedEventResponse:
    """Retrieve a single indexed event by its transaction signature.

    Each event is uniquely identified by the combination of its
    Solana transaction signature and log index within that
    transaction.

    Args:
        transaction_signature: The Solana transaction signature (base-58).
        log_index: Position within the transaction logs (default 0).

    Returns:
        The matching indexed event.

    Raises:
        HTTPException: 404 if no event matches the given signature and log index.
    """
    event = await get_event_by_signature(transaction_signature, log_index)
    if event is None:
        raise HTTPException(
            status_code=404,
            detail=f"No indexed event found for signature '{transaction_signature}' "
            f"at log_index {log_index}",
        )
    return event


# ---------------------------------------------------------------------------
# Backfill endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/indexed-events/backfill",
    response_model=BackfillResponse,
    summary="Backfill historical on-chain events",
    status_code=status.HTTP_200_OK,
)
async def trigger_backfill(
    body: BackfillRequest,
    user_id: str = Depends(get_current_user_id),
) -> BackfillResponse:
    """Trigger a historical backfill of on-chain events.

    Fetches transactions from the specified provider API for the
    given slot range and indexes them. This operation is idempotent
    due to the deduplication constraint.

    Requires authentication as this is a mutation that consumes
    provider API quota.

    Args:
        body: Backfill parameters including slot range and provider.
        user_id: Authenticated user ID (from auth dependency).

    Returns:
        BackfillResponse with counts of events indexed and any errors.
    """
    logger.info(
        "Backfill requested by user %s: slots %d-%d via %s",
        user_id,
        body.start_slot,
        body.end_slot,
        body.source.value,
    )
    return await backfill_events(
        start_slot=body.start_slot,
        end_slot=body.end_slot,
        source=body.source.value,
    )
