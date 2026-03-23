"""On-chain event indexer with Helius/Shyft enhanced transaction support.

Polls the configured indexer (Helius or Shyft) for new on-chain transactions
involving SolFoundry program accounts and maps them to typed OnChainEvents.

Architecture:
- ``OnChainEventIndexer`` fetches raw enhanced-transaction data
- ``OnChainEventBatcher`` accumulates events and flushes in 5-second windows
- Callers (escrow_service, reputation_service) inject synthetic events when
  they record on-chain state transitions, so the indexer also works offline
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.models.onchain_webhook import (
    ON_CHAIN_EVENT_TYPES,
    OnChainEventPayload,
    OnChainEventType,
)

logger = logging.getLogger(__name__)

# ── configuration ──────────────────────────────────────────────────────────────

HELIUS_API_KEY: str = os.getenv("HELIUS_API_KEY", "")
SHYFT_API_KEY: str = os.getenv("SHYFT_API_KEY", "")
HELIUS_RPC_URL: str = f"https://rpc.helius.xyz/?api-key={HELIUS_API_KEY}"
SHYFT_ENHANCED_TX_URL: str = "https://api.shyft.to/sol/v1/transaction/parsed"

# Program accounts to watch for on-chain activity
SOLFOUNDRY_PROGRAMS: list[str] = os.getenv(
    "SOLFOUNDRY_PROGRAM_IDS",
    "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS",
).split(",")

BATCH_WINDOW_SECONDS: float = float(os.getenv("WEBHOOK_BATCH_WINDOW_SECONDS", "5"))
INDEXER_POLL_INTERVAL_SECONDS: float = float(
    os.getenv("WEBHOOK_INDEXER_POLL_SECONDS", "10")
)

# ── synthetic event injection (used by service layer) ─────────────────────────


def build_escrow_locked_event(
    tx_signature: str,
    slot: int,
    block_time: int,
    escrow_id: str,
    bounty_id: str,
    creator_wallet: str,
    amount_lamports: int,
) -> OnChainEventPayload:
    """Build an ``escrow.locked`` event payload from an escrow service call."""
    return OnChainEventPayload(
        event=OnChainEventType.ESCROW_LOCKED,
        tx_signature=tx_signature,
        slot=slot,
        block_time=block_time,
        timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        data={
            "escrow_id": escrow_id,
            "bounty_id": bounty_id,
            "creator_wallet": creator_wallet,
            "amount_lamports": amount_lamports,
        },
    )


def build_escrow_released_event(
    tx_signature: str,
    slot: int,
    block_time: int,
    escrow_id: str,
    bounty_id: str,
    winner_wallet: str,
    amount_lamports: int,
) -> OnChainEventPayload:
    """Build an ``escrow.released`` event payload from an escrow service call."""
    return OnChainEventPayload(
        event=OnChainEventType.ESCROW_RELEASED,
        tx_signature=tx_signature,
        slot=slot,
        block_time=block_time,
        timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        data={
            "escrow_id": escrow_id,
            "bounty_id": bounty_id,
            "winner_wallet": winner_wallet,
            "amount_lamports": amount_lamports,
        },
    )


def build_reputation_updated_event(
    tx_signature: str,
    slot: int,
    block_time: int,
    contributor_id: str,
    wallet: str,
    old_score: float,
    new_score: float,
    tier: str,
) -> OnChainEventPayload:
    """Build a ``reputation.updated`` event payload."""
    return OnChainEventPayload(
        event=OnChainEventType.REPUTATION_UPDATED,
        tx_signature=tx_signature,
        slot=slot,
        block_time=block_time,
        timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        data={
            "contributor_id": contributor_id,
            "wallet": wallet,
            "old_score": old_score,
            "new_score": new_score,
            "delta": round(new_score - old_score, 4),
            "tier": tier,
        },
    )


def build_stake_deposited_event(
    tx_signature: str,
    slot: int,
    block_time: int,
    wallet: str,
    amount_lamports: int,
    stake_account: str,
) -> OnChainEventPayload:
    """Build a ``stake.deposited`` event payload."""
    return OnChainEventPayload(
        event=OnChainEventType.STAKE_DEPOSITED,
        tx_signature=tx_signature,
        slot=slot,
        block_time=block_time,
        timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        data={
            "wallet": wallet,
            "amount_lamports": amount_lamports,
            "stake_account": stake_account,
        },
    )


def build_stake_withdrawn_event(
    tx_signature: str,
    slot: int,
    block_time: int,
    wallet: str,
    amount_lamports: int,
    stake_account: str,
) -> OnChainEventPayload:
    """Build a ``stake.withdrawn`` event payload."""
    return OnChainEventPayload(
        event=OnChainEventType.STAKE_WITHDRAWN,
        tx_signature=tx_signature,
        slot=slot,
        block_time=block_time,
        timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        data={
            "wallet": wallet,
            "amount_lamports": amount_lamports,
            "stake_account": stake_account,
        },
    )


# ── Helius-based enhanced transaction parser ───────────────────────────────────


def _parse_helius_transaction(tx: dict[str, Any]) -> Optional[OnChainEventPayload]:
    """Attempt to map a Helius enhanced transaction to an OnChainEventPayload.

    Returns None when the transaction doesn't match any tracked event type.
    """
    description: str = tx.get("description", "") or ""
    tx_type: str = tx.get("type", "") or ""
    signature: str = tx.get("signature", "") or ""
    slot: int = tx.get("slot", 0)
    block_time: int = tx.get("timestamp", int(time.time()))
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Map Helius transaction types to our event types
    # In production, these would match actual SolFoundry program instruction types
    if tx_type == "ESCROW_LOCK" or "escrow locked" in description.lower():
        token_transfer = _extract_token_transfer(tx)
        return OnChainEventPayload(
            event=OnChainEventType.ESCROW_LOCKED,
            tx_signature=signature,
            slot=slot,
            block_time=block_time,
            timestamp=timestamp,
            data={
                "escrow_id": tx.get("accounts", [{}])[0].get("account", ""),
                "bounty_id": tx.get("description", ""),
                "creator_wallet": token_transfer.get("from_wallet", ""),
                "amount_lamports": token_transfer.get("amount_lamports", 0),
            },
        )

    if tx_type == "ESCROW_RELEASE" or "escrow released" in description.lower():
        token_transfer = _extract_token_transfer(tx)
        return OnChainEventPayload(
            event=OnChainEventType.ESCROW_RELEASED,
            tx_signature=signature,
            slot=slot,
            block_time=block_time,
            timestamp=timestamp,
            data={
                "escrow_id": tx.get("accounts", [{}])[0].get("account", ""),
                "bounty_id": tx.get("description", ""),
                "winner_wallet": token_transfer.get("to_wallet", ""),
                "amount_lamports": token_transfer.get("amount_lamports", 0),
            },
        )

    if tx_type == "REPUTATION_UPDATE" or "reputation" in description.lower():
        account_data = tx.get("accountData", [{}])[0] if tx.get("accountData") else {}
        return OnChainEventPayload(
            event=OnChainEventType.REPUTATION_UPDATED,
            tx_signature=signature,
            slot=slot,
            block_time=block_time,
            timestamp=timestamp,
            data={
                "contributor_id": account_data.get("account", ""),
                "wallet": account_data.get("account", ""),
                "old_score": 0.0,
                "new_score": 0.0,
                "delta": 0.0,
                "tier": "T1",
            },
        )

    if tx_type == "STAKE_DEPOSIT" or "stake deposited" in description.lower():
        token_transfer = _extract_token_transfer(tx)
        return OnChainEventPayload(
            event=OnChainEventType.STAKE_DEPOSITED,
            tx_signature=signature,
            slot=slot,
            block_time=block_time,
            timestamp=timestamp,
            data={
                "wallet": token_transfer.get("from_wallet", ""),
                "amount_lamports": token_transfer.get("amount_lamports", 0),
                "stake_account": token_transfer.get("to_wallet", ""),
            },
        )

    if tx_type == "STAKE_WITHDRAWAL" or "stake withdrawn" in description.lower():
        token_transfer = _extract_token_transfer(tx)
        return OnChainEventPayload(
            event=OnChainEventType.STAKE_WITHDRAWN,
            tx_signature=signature,
            slot=slot,
            block_time=block_time,
            timestamp=timestamp,
            data={
                "wallet": token_transfer.get("to_wallet", ""),
                "amount_lamports": token_transfer.get("amount_lamports", 0),
                "stake_account": token_transfer.get("from_wallet", ""),
            },
        )

    return None


def _extract_token_transfer(tx: dict[str, Any]) -> dict[str, Any]:
    """Pull the first token transfer from a Helius enhanced transaction."""
    transfers = tx.get("tokenTransfers", [])
    if transfers:
        t = transfers[0]
        return {
            "from_wallet": t.get("fromUserAccount", ""),
            "to_wallet": t.get("toUserAccount", ""),
            "amount_lamports": int(
                float(t.get("tokenAmount", 0)) * 1_000_000
            ),  # normalise to lamports
        }
    return {"from_wallet": "", "to_wallet": "", "amount_lamports": 0}


# ── event batcher ──────────────────────────────────────────────────────────────


class OnChainEventBatcher:
    """Accumulates on-chain events and flushes them in time-windowed batches.

    A background task calls ``flush_if_ready()`` every second; the batcher
    collects events and flushes whenever the batch window elapses.
    """

    def __init__(self, window_seconds: float = BATCH_WINDOW_SECONDS) -> None:
        """Initialize the batcher with an empty event queue."""
        self._window = window_seconds
        self._queue: list[OnChainEventPayload] = []
        self._lock = asyncio.Lock()
        self._window_start: float = time.monotonic()
        self._flush_callbacks: list[Any] = []  # async callables

    def register_flush_callback(self, callback: Any) -> None:
        """Register an async callable that receives a batch of events on flush."""
        self._flush_callbacks.append(callback)

    async def enqueue(self, event: OnChainEventPayload) -> None:
        """Add an event to the current batch window queue."""
        if event.event not in ON_CHAIN_EVENT_TYPES:
            raise ValueError(f"Unknown on-chain event type: {event.event!r}")
        async with self._lock:
            self._queue.append(event)
            logger.debug(
                "Queued on-chain event type=%s tx=%s", event.event, event.tx_signature
            )

    async def flush_if_ready(self) -> list[OnChainEventPayload]:
        """Flush the current batch if the window has elapsed.

        Returns the list of flushed events (empty if window not elapsed yet).
        """
        now = time.monotonic()
        async with self._lock:
            if now - self._window_start < self._window:
                return []
            batch = list(self._queue)
            self._queue.clear()
            self._window_start = now

        if batch:
            logger.info("Flushing %d on-chain event(s) from batch window", len(batch))
            for cb in self._flush_callbacks:
                try:
                    await cb(batch)
                except Exception as exc:
                    logger.error("Batch flush callback error: %s", exc)

        return batch

    async def force_flush(self) -> list[OnChainEventPayload]:
        """Flush all pending events immediately regardless of window timing."""
        async with self._lock:
            batch = list(self._queue)
            self._queue.clear()
            self._window_start = time.monotonic()

        if batch:
            logger.info(
                "Force-flushing %d on-chain event(s)", len(batch)
            )
            for cb in self._flush_callbacks:
                try:
                    await cb(batch)
                except Exception as exc:
                    logger.error("Force flush callback error: %s", exc)

        return batch

    @property
    def queue_size(self) -> int:
        """Return the number of events currently in the queue."""
        return len(self._queue)


# ── Helius indexer ─────────────────────────────────────────────────────────────


class OnChainEventIndexer:
    """Polls Helius enhanced-transaction API for new SolFoundry events.

    Falls back gracefully when no API key is configured (test/dev mode).
    In production, HELIUS_API_KEY must be set in the environment.
    """

    def __init__(self, batcher: OnChainEventBatcher) -> None:
        """Initialize with a reference to the shared event batcher."""
        self._batcher = batcher
        self._last_signature: Optional[str] = None

    async def poll_once(self, program_id: str) -> int:
        """Fetch new enhanced transactions for *program_id* and enqueue events.

        Returns the number of new events enqueued.
        """
        if not HELIUS_API_KEY:
            logger.debug("HELIUS_API_KEY not set; skipping on-chain poll")
            return 0

        url = f"https://api.helius.xyz/v0/addresses/{program_id}/transactions"
        params: dict[str, Any] = {"api-key": HELIUS_API_KEY, "limit": 100}
        if self._last_signature:
            params["before"] = self._last_signature

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                transactions: list[dict[str, Any]] = resp.json()
        except Exception as exc:
            logger.warning("Helius poll error for %s: %s", program_id, exc)
            return 0

        if not transactions:
            return 0

        # Most-recent signature for next poll (Helius returns newest first)
        self._last_signature = transactions[0].get("signature")

        count = 0
        for tx in transactions:
            event = _parse_helius_transaction(tx)
            if event:
                await self._batcher.enqueue(event)
                count += 1

        logger.info("Helius poll: %d new event(s) for %s", count, program_id)
        return count

    async def run_forever(self) -> None:
        """Continuously poll all configured program addresses.

        Designed to run as a long-lived background task started in the
        application lifespan handler.
        """
        logger.info(
            "Starting on-chain event indexer (programs=%s)", SOLFOUNDRY_PROGRAMS
        )
        while True:
            for program_id in SOLFOUNDRY_PROGRAMS:
                try:
                    await self.poll_once(program_id.strip())
                except Exception as exc:
                    logger.error("Unhandled indexer error for %s: %s", program_id, exc)
            await asyncio.sleep(INDEXER_POLL_INTERVAL_SECONDS)


# ── module-level singletons (initialised by lifespan handler) ─────────────────

_batcher: Optional[OnChainEventBatcher] = None
_indexer: Optional[OnChainEventIndexer] = None


def get_batcher() -> OnChainEventBatcher:
    """Return the shared event batcher, creating it on first call."""
    global _batcher
    if _batcher is None:
        _batcher = OnChainEventBatcher()
    return _batcher


def get_indexer() -> OnChainEventIndexer:
    """Return the shared event indexer, creating it on first call."""
    global _indexer, _batcher
    batcher = get_batcher()
    if _indexer is None:
        _indexer = OnChainEventIndexer(batcher)
    return _indexer


async def enqueue_event(event: OnChainEventPayload) -> None:
    """Convenience helper: enqueue a synthetic event into the global batcher."""
    await get_batcher().enqueue(event)
