"""Contributor webhook database and Pydantic models.

This module defines the data models for the contributor webhook system.
Contributors can register webhook URLs to receive notifications when
bounty events occur.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import Boolean, Column, DateTime, Index, JSON, String

from app.database import Base, GUID


class ContributorWebhookDB(Base):
    """Contributor webhook database model.

    Stores webhook registrations for contributors. Each webhook has a
    unique HMAC secret used to sign outbound payloads so the recipient
    can verify authenticity.
    """

    __tablename__ = "contributor_webhooks"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(255), nullable=False)
    url = Column(String(2048), nullable=False)
    secret = Column(String(64), nullable=False)
    events = Column(JSON, nullable=True)  # None means all events
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (Index("ix_contributor_webhooks_user_id", "user_id"),)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class ContributorWebhookCreate(BaseModel):
    """Schema for registering a new contributor webhook."""

    url: str = Field(
        ...,
        max_length=2048,
        description="The HTTPS endpoint that will receive event payloads",
        examples=["https://example.com/hooks/solfoundry"],
    )
    events: Optional[List[str]] = Field(
        None,
        description=(
            "Event types to subscribe to. "
            "Omit or set to null to receive all events. "
            "Valid values: bounty.claimed, review.started, review.passed, "
            "review.failed, bounty.paid"
        ),
        examples=[["bounty.claimed", "bounty.paid"]],
    )


class ContributorWebhookResponse(BaseModel):
    """Public webhook representation — secret is intentionally omitted."""

    id: str = Field(..., description="Unique webhook identifier")
    url: str = Field(..., description="The registered endpoint URL")
    events: Optional[List[str]] = Field(
        None, description="Subscribed event types, or null for all events"
    )
    active: bool = Field(..., description="Whether this webhook is active")
    created_at: datetime = Field(..., description="Registration timestamp (UTC)")

    model_config = {"from_attributes": True}


class ContributorWebhookList(BaseModel):
    """Paginated list of contributor webhooks."""

    webhooks: List[ContributorWebhookResponse]
    total: int = Field(..., description="Total number of webhooks for this user")
