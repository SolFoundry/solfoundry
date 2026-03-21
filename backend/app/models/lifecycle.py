"""Bounty lifecycle log models.

Records every state transition in the bounty lifecycle for full auditability.
Covers bounty status changes, submission events, review events, and payouts.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field
from sqlalchemy import Column, String, DateTime, Text, JSON, Index
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class LifecycleEventType(str, Enum):
    BOUNTY_CREATED = "bounty_created"
    BOUNTY_STATUS_CHANGED = "bounty_status_changed"
    BOUNTY_CANCELLED = "bounty_cancelled"
    SUBMISSION_CREATED = "submission_created"
    SUBMISSION_STATUS_CHANGED = "submission_status_changed"
    AI_REVIEW_STARTED = "ai_review_started"
    AI_REVIEW_COMPLETED = "ai_review_completed"
    CREATOR_APPROVED = "creator_approved"
    CREATOR_DISPUTED = "creator_disputed"
    AUTO_APPROVED = "auto_approved"
    PAYOUT_INITIATED = "payout_initiated"
    PAYOUT_CONFIRMED = "payout_confirmed"
    PAYOUT_FAILED = "payout_failed"
    DISPUTE_OPENED = "dispute_opened"
    DISPUTE_RESOLVED = "dispute_resolved"


class BountyLifecycleLogDB(Base):
    """Immutable audit log for all bounty state transitions."""

    __tablename__ = "bounty_lifecycle_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bounty_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    submission_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    event_type = Column(String(50), nullable=False)
    previous_state = Column(String(50), nullable=True)
    new_state = Column(String(50), nullable=True)
    actor_id = Column(String(255), nullable=True)
    actor_type = Column(String(20), nullable=True)  # user, system, auto
    details = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    __table_args__ = (
        Index("ix_lifecycle_bounty_created", bounty_id, created_at),
        Index("ix_lifecycle_event_type", event_type),
    )


# Pydantic models


class LifecycleLogEntry(BaseModel):
    """A single lifecycle log entry."""

    id: str
    bounty_id: str
    submission_id: Optional[str] = None
    event_type: str
    previous_state: Optional[str] = None
    new_state: Optional[str] = None
    actor_id: Optional[str] = None
    actor_type: Optional[str] = None
    details: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class LifecycleLogResponse(BaseModel):
    """Paginated lifecycle log response."""

    items: List[LifecycleLogEntry]
    total: int
    bounty_id: str
