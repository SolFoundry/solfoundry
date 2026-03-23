"""Webhook event log database model.

Stores records of all processed webhook events for audit and idempotency.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Text, Index
from app.database import Base, GUID


class WebhookEventLogDB(Base):
    """
    Webhook event log for idempotency and audit.

    Ensures each delivery is processed exactly once.
    """

    __tablename__ = "webhook_event_logs"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    delivery_id = Column(String(100), nullable=False, unique=True, index=True)
    event_type = Column(String(50), nullable=False)
    payload_hash = Column(String(64), nullable=False)  # SHA256 hash
    status = Column(
        String(20), nullable=False, default="processed"
    )  # processed, failed, skipped
    error_message = Column(Text, nullable=True)
    processed_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    __table_args__ = (Index("ix_webhook_event_logs_event_type", event_type),)
