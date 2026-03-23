"""Contributor webhook subscription — database and Pydantic models.

Outbound webhooks let contributors receive HTTP POST notifications when
bounty-related events happen (bounty claimed, review started/passed/failed,
bounty paid).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import AnyHttpUrl, BaseModel, Field, field_validator
from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String, Text
from app.database import Base, GUID

# ── event types ────────────────────────────────────────────────────────────────

WEBHOOK_EVENTS = (
    "bounty.claimed",
    "review.started",
    "review.passed",
    "review.failed",
    "bounty.paid",
)


class WebhookEvent(str, Enum):
    """Supported outbound webhook event types."""

    BOUNTY_CLAIMED = "bounty.claimed"
    REVIEW_STARTED = "review.started"
    REVIEW_PASSED = "review.passed"
    REVIEW_FAILED = "review.failed"
    BOUNTY_PAID = "bounty.paid"


# ── SQLAlchemy model ───────────────────────────────────────────────────────────


class ContributorWebhookDB(Base):
    """Outbound webhook subscription registered by a contributor."""

    __tablename__ = "contributor_webhooks"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, nullable=False, index=True)
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

    __table_args__ = (Index("ix_contributor_webhooks_active", "active"),)


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
    """Shape of the JSON body POSTed to subscriber endpoints."""

    event: str
    bounty_id: str
    timestamp: str
    data: dict[str, Any]
