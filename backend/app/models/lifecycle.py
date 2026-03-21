"""SQLAlchemy models for bounty lifecycle persistence (Issue #164).

Provides PostgreSQL-backed tables for lifecycle state, claims, and audit events.
Falls back to SQLite for local dev and CI (UUID columns degrade to String(36)).

Tables:
    lifecycle_states  - Current lifecycle state per bounty (one row each).
    lifecycle_claims  - Claim records with deadlines (one active per bounty).
    lifecycle_events  - Append-only audit log of every state transition.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


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
