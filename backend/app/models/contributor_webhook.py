"""Contributor webhook subscription — database and Pydantic models.

Outbound webhooks let contributors receive HTTP POST notifications when
bounty-related events happen (bounty claimed, review started/passed/failed,
bounty paid).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import AnyHttpUrl, BaseModel, Field, field_validator
from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base

# ── event types ────────────────────────────────────────────────────────────────

WEBHOOK_EVENTS = (
    "bounty.claimed",
    "review.started",
    "review.passed",
    "review.failed",
    "bounty.paid",
    "webhook.test",
    "escrow.locked",
    "escrow.released",
    "reputation.updated",
    "stake.deposited",
    "stake.withdrawn",
)

ON_CHAIN_WEBHOOK_EVENTS = frozenset(
    {
        "escrow.locked",
        "escrow.released",
        "reputation.updated",
        "stake.deposited",
        "stake.withdrawn",
    }
)


class WebhookEvent(str, Enum):
    """Supported outbound webhook event types."""

    BOUNTY_CLAIMED = "bounty.claimed"
    REVIEW_STARTED = "review.started"
    REVIEW_PASSED = "review.passed"
    REVIEW_FAILED = "review.failed"
    BOUNTY_PAID = "bounty.paid"
    WEBHOOK_TEST = "webhook.test"
    ESCROW_LOCKED = "escrow.locked"
    ESCROW_RELEASED = "escrow.released"
    REPUTATION_UPDATED = "reputation.updated"
    STAKE_DEPOSITED = "stake.deposited"
    STAKE_WITHDRAWN = "stake.withdrawn"


# ── SQLAlchemy model ───────────────────────────────────────────────────────────


class ContributorWebhookDB(Base):
    """Outbound webhook subscription registered by a contributor."""

    __tablename__ = "contributor_webhooks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    url = Column(Text, nullable=False)
    # HMAC-SHA256 secret supplied by the contributor at registration time.
    # Stored as plaintext (contributor's choice); used to sign outgoing payloads.
    secret = Column(String(256), nullable=False)
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
    # Delivery stats (updated on each dispatch attempt)
    last_delivery_at = Column(DateTime(timezone=True), nullable=True)
    last_delivery_status = Column(String(20), nullable=True)  # success | failed
    failure_count = Column(Integer, default=0, nullable=False)

    __table_args__ = (
        Index("ix_contributor_webhooks_user_id", "user_id"),
        Index("ix_contributor_webhooks_active", "active"),
    )


# ── Pydantic schemas ───────────────────────────────────────────────────────────


class WebhookRegisterRequest(BaseModel):
    """Request body for POST /api/webhooks/register."""

    url: AnyHttpUrl = Field(..., description="HTTPS URL that will receive POST events")
    secret: str = Field(
        ...,
        min_length=16,
        max_length=256,
        description="Secret used to sign the HMAC-SHA256 payload signature",
    )

    @field_validator("url")
    @classmethod
    def must_be_https(cls, v: AnyHttpUrl) -> AnyHttpUrl:
        if str(v).startswith("http://"):
            raise ValueError("Webhook URL must use HTTPS")
        return v


class WebhookResponse(BaseModel):
    """Webhook subscription representation returned to callers."""

    id: str
    url: str
    active: bool
    created_at: datetime
    last_delivery_at: Optional[datetime] = None
    last_delivery_status: Optional[str] = None
    failure_count: int

    model_config = {"from_attributes": True}


class WebhookListResponse(BaseModel):
    """Paginated list of webhook subscriptions."""

    items: list[WebhookResponse]
    total: int


class WebhookPayload(BaseModel):
    """Shape of the JSON body POSTed to subscriber endpoints (single event)."""

    event: str
    bounty_id: str = ""
    timestamp: str
    data: dict[str, Any] = Field(default_factory=dict)
    transaction_signature: Optional[str] = None
    slot: Optional[int] = None


class WebhookBatchPayload(BaseModel):
    """Batched on-chain (and indexer) events within a delivery window."""

    delivery_mode: Literal["batch"] = "batch"
    batch_id: str
    window_seconds: int = 5
    timestamp: str
    events: list[WebhookPayload]


class WebhookDeliveryAttemptPublic(BaseModel):
    """Single delivery attempt row for dashboard / API consumers."""

    id: str
    webhook_id: str
    webhook_url: str
    batch_id: Optional[str] = None
    delivery_mode: str
    event_types: list[str]
    attempt_number: int
    success: bool
    http_status: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime


class WebhookDeliveryDashboard(BaseModel):
    """Webhook delivery health for the contributor dashboard."""

    period_days: int = 7
    total_attempts: int
    successful_attempts: int
    failure_rate: float
    active_webhooks: int
    last_webhook_status: Optional[str] = None
    recent_attempts: list[WebhookDeliveryAttemptPublic]
