"""Ingest endpoint for Helius / Shyft (or any indexer) to push normalized chain events."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.models.contributor_webhook import ON_CHAIN_WEBHOOK_EVENTS
from app.services.chain_webhook_batcher import chain_webhook_batcher

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/internal", tags=["chain-webhook-indexer"])


class ChainEventIngestBody(BaseModel):
    """Payload from an indexer after parsing on-chain logs."""

    event: str = Field(
        ...,
        description="One of the on-chain webhook event types (e.g. escrow.locked).",
    )
    transaction_signature: str = Field(
        ...,
        min_length=32,
        max_length=128,
        description="Solana transaction signature (base58).",
    )
    slot: int = Field(..., ge=0, description="Slot containing the transaction.")
    block_time: Optional[str] = Field(
        None,
        description="ISO-8601 UTC timestamp from the block (optional).",
    )
    accounts: dict[str, Any] = Field(
        default_factory=dict,
        description="Relevant account pubkeys and parsed fields (indexer-specific).",
    )
    bounty_id: str = Field(
        default="",
        description="Optional bounty correlation id when applicable.",
    )
    extra: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional fields merged into the webhook ``data`` object.",
    )
    notify_user_id: Optional[str] = Field(
        None,
        description=(
            "If set, only webhooks owned by this user UUID receive the event. "
            "If omitted, all active subscriber URLs receive batched deliveries."
        ),
    )

    @field_validator("event")
    @classmethod
    def event_must_be_on_chain(cls, v: str) -> str:
        if v not in ON_CHAIN_WEBHOOK_EVENTS:
            raise ValueError(
                f"event must be one of: {', '.join(sorted(ON_CHAIN_WEBHOOK_EVENTS))}"
            )
        return v


def _verify_indexer_key(x_chain_indexer_key: str | None) -> None:
    expected = os.getenv("CHAIN_WEBHOOK_INDEXER_SECRET", "").strip()
    if not expected:
        logger.warning("CHAIN_WEBHOOK_INDEXER_SECRET unset — rejecting indexer ingest")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chain indexer ingest is not configured",
        )
    if not x_chain_indexer_key or x_chain_indexer_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid indexer credentials",
        )


@router.post(
    "/chain-events",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue an on-chain event for batched webhook delivery",
)
async def ingest_chain_event(
    body: ChainEventIngestBody,
    x_chain_indexer_key: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    """Accept a normalized chain event from Helius, Shyft, or an in-house indexer.

    Events are queued and delivered in batches every five seconds to reduce HTTP
    traffic. Authenticate with header ``X-Chain-Indexer-Key`` matching env
    ``CHAIN_WEBHOOK_INDEXER_SECRET``.
    """
    _verify_indexer_key(x_chain_indexer_key)

    ts = body.block_time or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    data: dict[str, Any] = {"accounts": body.accounts, **body.extra}
    event_dict = {
        "event": body.event,
        "bounty_id": body.bounty_id,
        "timestamp": ts,
        "data": data,
        "transaction_signature": body.transaction_signature,
        "slot": body.slot,
    }
    await chain_webhook_batcher.enqueue(event_dict, body.notify_user_id)
    return {"status": "accepted", "delivery": "batched"}
