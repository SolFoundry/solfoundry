"""Bounty lifecycle models (Issue #164).

Provides SQLAlchemy models for lifecycle state, claims, and audit events
(PostgreSQL-backed, falls back to SQLite for local dev and CI).

Tables:
    lifecycle_states       - Current lifecycle state per bounty (one row each).
    lifecycle_claims       - Claim records with deadlines (one active per bounty).
    lifecycle_events       - Append-only audit log of every state transition.
    bounty_lifecycle_logs  - Immutable audit log for all bounty state transitions
                             (submissions, reviews, payouts, disputes).
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Index, String, Text, JSON
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


# ---------------------------------------------------------------------------
# Our lifecycle models (state machine tables)
# ---------------------------------------------------------------------------

class LifecycleStateDB(Base):
    """Current lifecycle state for a bounty (upserted on every transition)."""

    __tablename__ = "lifecycle_states"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bounty_id = Column(String(36), nullable=False, unique=True, index=True)
    state = Column(String(20), nullable=False, default="draft")
    creator_id = Column(String(100), nullable=False, default="system")
    updated_at = Column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (Index("ix_lifecycle_states_state", state),)


class LifecycleClaimDB(Base):
    """Claim record: one active (released_at IS NULL) per bounty at a time."""

    __tablename__ = "lifecycle_claims"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bounty_id = Column(String(36), nullable=False, index=True)
    contributor_id = Column(String(100), nullable=False, index=True)
    claimed_at = Column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    deadline = Column(DateTime(timezone=True), nullable=False)
    released_at = Column(DateTime(timezone=True), nullable=True)
    release_reason = Column(String(50), nullable=True)

    __table_args__ = (
        Index("ix_lifecycle_claims_bounty_active", bounty_id, released_at),
    )


class LifecycleEventDB(Base):
    """Append-only audit log entry for every lifecycle state transition."""

    __tablename__ = "lifecycle_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bounty_id = Column(String(36), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)
    actor = Column(String(100), nullable=False)
    old_state = Column(String(20), nullable=False)
    new_state = Column(String(20), nullable=False)
    metadata_json = Column(Text, nullable=False, default="{}")
    created_at = Column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc), index=True,
    )

    __table_args__ = (
        Index("ix_lifecycle_events_actor", actor),
        Index("ix_lifecycle_events_bounty_created", bounty_id, created_at),
    )


# ---------------------------------------------------------------------------
# Upstream lifecycle log model (broader event types for submissions/reviews)
# ---------------------------------------------------------------------------

class LifecycleEventType(str, Enum):
    BOUNTY_CREATED = "bounty_created"
    BOUNTY_PUBLISHED = "bounty_published"
    BOUNTY_STATUS_CHANGED = "bounty_status_changed"
    BOUNTY_CANCELLED = "bounty_cancelled"
    BOUNTY_CLAIMED = "bounty_claimed"
    BOUNTY_UNCLAIMED = "bounty_unclaimed"
    BOUNTY_CLAIM_DEADLINE_WARNING = "bounty_claim_deadline_warning"
    BOUNTY_CLAIM_AUTO_RELEASED = "bounty_claim_auto_released"
    BOUNTY_T1_AUTO_WON = "bounty_t1_auto_won"
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
