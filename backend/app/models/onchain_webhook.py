"""Pydantic schemas and SQLAlchemy ORM models for on-chain event webhooks.

Covers:
- Subscription management (per-user, per-event-type filtering)
- Delivery log for each HTTP attempt (batch_id, latency, status)
- Pydantic request/response schemas
- Event catalog with payload field definitions
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import AnyHttpUrl, BaseModel, Field, field_validator
from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base

# ── event types ────────────────────────────────────────────────────────────────

ON_CHAIN_EVENT_TYPES: frozenset[str] = frozenset(
    {
        "escrow.locked",
        "escrow.released",
        "reputation.updated",
        "stake.deposited",
        "stake.withdrawn",
    }
)

EVENT_CATALOG: dict[str, dict[str, Any]] = {
    "escrow.locked": {
        "description": "Fired when bounty funds are locked into the escrow program on-chain.",
        "fields": {
            "escrow_id": "UUID of the escrow record",
            "bounty_id": "UUID of the associated bounty",
            "creator_wallet": "Solana public key of the bounty creator",
            "amount_lamports": "Amount locked in lamports",
        },
    },
    "escrow.released": {
        "description": "Fired when escrow funds are released to the winning contributor.",
        "fields": {
            "escrow_id": "UUID of the escrow record",
            "bounty_id": "UUID of the associated bounty",
            "winner_wallet": "Solana public key of the payout recipient",
            "amount_lamports": "Amount released in lamports",
        },
    },
    "reputation.updated": {
        "description": "Fired when a contributor's reputation score changes on-chain.",
        "fields": {
            "contributor_id": "UUID of the contributor",
            "wallet": "Solana public key of the contributor",
            "old_score": "Previous reputation score",
            "new_score": "New reputation score after update",
            "delta": "Score change (positive = improved)",
            "tier": "Resulting tier (T1, T2, T3)",
        },
    },
    "stake.deposited": {
        "description": "Fired when a contributor deposits stake tokens on-chain.",
        "fields": {
            "wallet": "Solana public key of the staker",
            "amount_lamports": "Amount deposited in lamports",
            "stake_account": "Public key of the stake account",
        },
    },
    "stake.withdrawn": {
        "description": "Fired when a contributor withdraws staked tokens.",
        "fields": {
            "wallet": "Solana public key of the staker",
            "amount_lamports": "Amount withdrawn in lamports",
            "stake_account": "Public key of the stake account",
        },
    },
}


# ── SQLAlchemy models ──────────────────────────────────────────────────────────


class OnChainWebhookSubscriptionDB(Base):
    """On-chain webhook subscription registered by a contributor."""

    __tablename__ = "onchain_webhook_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    url = Column(Text, nullable=False)
    # HMAC-SHA256 secret supplied by the contributor at registration time.
    # Stored as plaintext (contributor's choice); used to sign outgoing payloads.
    secret = Column(String(256), nullable=False)
    # NULL = subscribed to all event types; CSV list = filtered subset
    event_filter = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    # Delivery stats (updated on each batch dispatch)
    last_delivery_at = Column(DateTime(timezone=True), nullable=True)
    last_delivery_status = Column(String(20), nullable=True)  # success | failed
    failure_count = Column(Integer, default=0, nullable=False)
    total_deliveries = Column(Integer, default=0, nullable=False)
    success_deliveries = Column(Integer, default=0, nullable=False)

    __table_args__ = (
        Index("ix_onchain_webhook_sub_user", "user_id"),
        Index("ix_onchain_webhook_sub_active", "active"),
    )


class OnChainDeliveryLogDB(Base):
    """Individual delivery attempt log for on-chain webhook batches."""

    __tablename__ = "onchain_webhook_delivery_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    batch_id = Column(String(36), nullable=False)
    event_type = Column(String(50), nullable=False)
    tx_signature = Column(String(100), nullable=False)
    attempt = Column(Integer, default=1, nullable=False)
    status_code = Column(Integer, nullable=True)
    success = Column(Boolean, default=False, nullable=False)
    error_message = Column(Text, nullable=True)
    attempted_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    latency_ms = Column(Integer, nullable=True)

    __table_args__ = (
        Index(
            "ix_onchain_delivery_sub_batch",
            "subscription_id",
            "batch_id",
        ),
        Index("ix_onchain_delivery_event", "event_type"),
        Index("ix_onchain_delivery_attempted_at", "attempted_at"),
    )


# ── Pydantic schemas ───────────────────────────────────────────────────────────


class OnChainWebhookRegisterRequest(BaseModel):
    """Request body for POST /api/onchain-webhooks/register."""

    url: AnyHttpUrl = Field(
        ...,
        description="HTTPS URL that will receive batched on-chain event notifications",
    )
    secret: str = Field(
        ...,
        min_length=16,
        max_length=256,
        description="Secret used for HMAC-SHA256 payload signing",
    )
    event_types: Optional[list[str]] = Field(
        default=None,
        description=(
            "List of event types to subscribe to. "
            "If omitted, subscribes to all supported events."
        ),
    )

    @field_validator("url")
    @classmethod
    def must_be_https(cls, v: AnyHttpUrl) -> AnyHttpUrl:
        """Reject non-HTTPS URLs."""
        if str(v).startswith("http://"):
            raise ValueError("Webhook URL must use HTTPS")
        return v

    def validate_event_types(self) -> None:
        """Raise ValueError for unknown event types."""
        if self.event_types is None:
            return
        unknown = set(self.event_types) - ON_CHAIN_EVENT_TYPES
        if unknown:
            raise ValueError(
                f"Unknown event types: {sorted(unknown)}. "
                f"Supported: {sorted(ON_CHAIN_EVENT_TYPES)}"
            )


class OnChainWebhookResponse(BaseModel):
    """On-chain webhook subscription returned to callers."""

    id: str
    url: str
    active: bool
    event_filter: Optional[str] = None
    created_at: datetime
    last_delivery_at: Optional[datetime] = None
    last_delivery_status: Optional[str] = None
    failure_count: int
    total_deliveries: int
    success_deliveries: int

    model_config = {"from_attributes": True}


class OnChainEventPayload(BaseModel):
    """Single on-chain event included in a webhook batch delivery."""

    event: str = Field(..., description="Event type identifier (e.g. 'escrow.locked')")
    tx_signature: str = Field(..., description="Base58 on-chain transaction signature")
    slot: int = Field(..., description="Solana slot number")
    block_time: int = Field(..., description="Unix timestamp of the block")
    timestamp: str = Field(..., description="ISO 8601 timestamp string")
    data: dict[str, Any] = Field(default_factory=dict, description="Event-specific data")


class OnChainEventBatch(BaseModel):
    """HTTP POST body sent to subscriber endpoints (batched delivery)."""

    events: list[OnChainEventPayload]
    batch_size: int
    window_start: str
    window_end: str


class DeliveryLogEntry(BaseModel):
    """Single delivery attempt record for the dashboard."""

    id: str
    batch_id: str
    event_type: str
    tx_signature: str
    attempt: int
    status_code: Optional[int] = None
    success: bool
    error_message: Optional[str] = None
    attempted_at: datetime
    latency_ms: Optional[int] = None


class WebhookDashboardResponse(BaseModel):
    """Aggregated delivery statistics + recent log entries."""

    subscription_id: str
    total_deliveries: int
    success_deliveries: int
    failure_count: int
    success_rate: float
    last_delivery_at: Optional[datetime] = None
    last_delivery_status: Optional[str] = None
    recent_logs: list[DeliveryLogEntry] = Field(default_factory=list)


class TestEventRequest(BaseModel):
    """Request body for POST /api/onchain-webhooks/{id}/test."""

    event_type: str = Field(
        default="escrow.locked",
        description="Event type to use for the synthetic test event",
    )


class TestEventResponse(BaseModel):
    """Result of a test event delivery attempt."""

    delivered: bool
    status_code: Optional[int] = None
    latency_ms: int
    error: Optional[str] = None
