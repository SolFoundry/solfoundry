"""Event indexing service: ingest, store, and broadcast events.

Provides a single entry point `ingest_event` for persisting events to
PostgreSQL and optionally broadcasting them to WebSocket subscribers.
Used by GitHub webhook receiver and Solana event listener.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event_index import EventDB
from app.services.websocket_manager import manager as ws_manager

logger = logging.getLogger(__name__)


async def ingest_event(
    *,
    event_type: str,
    source: str,
    payload: Dict[str, Any],
    channel: Optional[str] = None,
    timestamp: Optional[datetime] = None,
    bounty_id: Optional[str] = None,
    contributor_id: Optional[str] = None,
    tx_hash: Optional[str] = None,
    block_slot: Optional[int] = None,
    github_event_type: Optional[str] = None,
    delivery_id: Optional[str] = None,
    broadcast: bool = True,
    db: Optional[AsyncSession] = None,
) -> Optional[EventDB]:
    """Store an event in PostgreSQL and optionally broadcast via WebSocket.

    Args:
        event_type: Type of event (e.g., `pull_request`, `payout_sent`).
        source: Origin system: 'github' or 'solana'.
        payload: Arbitrary JSON-serializable event data.
        channel: Optional WebSocket channel to broadcast to.
        timestamp: Event occurrence time (defaults to now).
        bounty_id: Optional linked bounty UUID.
        contributor_id: Optional contributor identifier (wallet or username).
        tx_hash: Optional Solana transaction signature.
        block_slot: Optional Solana slot number.
        github_event_type: The raw GitHub event type (when source='github').
        delivery_id: Optional GitHub delivery ID for idempotency.
        broadcast: If True, emit to WebSocket channel (if channel provided).
        db: Optional AsyncSession. If not provided, a new session is created
            and committed. If provided, caller should commit.

    Returns:
        The created EventDB instance, or None on failure.
    """
    if timestamp is None:
        timestamp = datetime.now(timezone.utc)

    event = EventDB(
        event_type=event_type,
        source=source,
        channel=channel,
        timestamp=timestamp,
        payload=payload,
        bounty_id=bounty_id,
        contributor_id=contributor_id,
        tx_hash=tx_hash,
        block_slot=block_slot,
        github_event_type=github_event_type,
        delivery_id=delivery_id,
    )

    created = False
    if db is not None:
        # Caller-managed session; they must commit after.
        db.add(event)
        created = True
    else:
        # Create a new session, add, commit, close.
        from app.database import get_db_session

        async with get_db_session() as session:
            session.add(event)
            try:
                await session.commit()
                created = True
            except Exception as exc:
                await session.rollback()
                logger.error("Failed to store event: %s", exc)
                return None

    if created and broadcast:
        try:
            # Build a dict representation for WebSocket
            event_dict = {
                "event_id": str(event.id),
                "event_type": event.event_type,
                "source": event.source,
                "timestamp": event.timestamp.isoformat(),
                "payload": event.payload,
                "channel": event.channel,
                "bounty_id": str(event.bounty_id) if event.bounty_id else None,
                "contributor_id": event.contributor_id,
                "tx_hash": event.tx_hash,
                "block_slot": event.block_slot,
                "github_event_type": event.github_event_type,
                "delivery_id": event.delivery_id,
            }
            # Determine target channels
            targets = set()
            if channel:
                targets.add(channel)
            if bounty_id:
                targets.add(f"bounty:{bounty_id}")
            targets.add("global")  # always available

            # Fire-and-forget broadcasts; don't block ingestion on WS errors
            async def _broadcast_to_targets():
                await asyncio.gather(
                    *[ws_manager.broadcast(ch, {"event": event_dict}) for ch in targets],
                    return_exceptions=True,
                )
            asyncio.create_task(_broadcast_to_targets())
        except Exception as exc:
            logger.warning("Failed to schedule broadcast: %s", exc)

    return event


# Convenience wrappers for common sources

async def ingest_github_event(
    *,
    event_type: str,
    payload: Dict[str, Any],
    delivery_id: str,
    repo: str,
    sender: str,
    channel: str = "github",
    bounty_id: Optional[str] = None,
    db: Optional[AsyncSession] = None,
) -> Optional[EventDB]:
    """Ingest a GitHub webhook event."""
    return await ingest_event(
        event_type=event_type,
        source="github",
        payload=payload,
        channel=channel,
        timestamp=datetime.now(timezone.utc),
        bounty_id=bounty_id,
        contributor_id=sender,
        github_event_type=event_type,
        delivery_id=delivery_id,
        db=db,
    )


async def ingest_solana_event(
    *,
    event_type: str,
    payload: Dict[str, Any],
    tx_hash: str,
    slot: int,
    channel: str = "solana",
    bounty_id: Optional[str] = None,
    block_time: Optional[datetime] = None,
    db: Optional[AsyncSession] = None,
) -> Optional[EventDB]:
    """Ingest a Solana on-chain event."""
    timestamp = block_time if block_time else datetime.now(timezone.utc)
    return await ingest_event(
        event_type=event_type,
        source="solana",
        payload=payload,
        channel=channel,
        timestamp=timestamp,
        bounty_id=bounty_id,
        tx_hash=tx_hash,
        block_slot=slot,
        db=db,
    )
