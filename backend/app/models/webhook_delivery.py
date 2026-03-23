"""Per-attempt log of outbound contributor webhook deliveries (audit + dashboard)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class WebhookDeliveryAttemptDB(Base):
    """One row per HTTP attempt (including retries) for a webhook delivery."""

    __tablename__ = "webhook_delivery_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    webhook_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contributor_webhooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    batch_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    delivery_mode = Column(String(16), nullable=False)  # single | batch
    event_types = Column(JSON, nullable=False)
    attempt_number = Column(Integer, nullable=False)
    success = Column(Boolean, nullable=False)
    http_status = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_utcnow, index=True
    )

    __table_args__ = (
        Index("ix_webhook_delivery_webhook_created", "webhook_id", "created_at"),
    )
