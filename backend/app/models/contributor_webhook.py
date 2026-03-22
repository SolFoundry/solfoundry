"""SQLAlchemy ORM model and Pydantic schemas for contributor webhooks.

Contributor webhooks allow users to register HTTP endpoints that receive
HMAC-signed event payloads when bounty lifecycle events occur.

Security design:
    - Raw webhook secret is generated once and returned to the user.
    - The raw secret is Fernet-encrypted before storage so the signing key
      is never exposed as plaintext in the database.
    - sha256(raw_secret) is stored as secret_hash for integrity verification.
    - After creation the raw secret is never returned again.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Boolean, Column, DateTime, Index, String, Text

from app.database import Base, GUID


class ContributorWebhookDB(Base):
    """Persistent contributor webhook registration."""

    __tablename__ = "contributor_webhooks"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), nullable=False, index=True)
    url = Column(String(2048), nullable=False)
    secret_encrypted = Column(Text, nullable=False)
    secret_hash = Column(String(64), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_contributor_webhooks_user_id", "user_id"),
        Index("ix_contributor_webhooks_user_active", "user_id", "is_active"),
    )


class WebhookEventType(str, Enum):
    BOUNTY_CLAIMED = "bounty.claimed"
    REVIEW_STARTED = "review.started"
    REVIEW_PASSED = "review.passed"
    REVIEW_FAILED = "review.failed"
    BOUNTY_PAID = "bounty.paid"


class WebhookRegisterRequest(BaseModel):
    url: str = Field(..., description="HTTPS endpoint to receive webhook payloads")

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        if len(v) > 2048:
            raise ValueError("URL must not exceed 2048 characters")
        return v


class WebhookResponse(BaseModel):
    id: str
    url: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class WebhookCreateResponse(WebhookResponse):
    """Returned only on creation — includes the raw secret (shown once)."""

    secret: str = Field(
        ...,
        description="Webhook signing secret. Store this securely — it will not be shown again.",
    )


class WebhookListResponse(BaseModel):
    items: list[WebhookResponse]
    total: int


class WebhookEventPayload(BaseModel):
    event: str
    bounty_id: str
    timestamp: str
    data: dict
