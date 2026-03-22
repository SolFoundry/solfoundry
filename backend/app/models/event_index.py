"""ORM model for the unified event index.

Stores real-time events from both on-chain (Solana) and off-chain (GitHub)
sources in a partitioned time-series table for efficient querying and
analytics. Partitioned by month on the ``timestamp`` column to support
high write throughput and fast time-range queries.

Supports filters by event_type, source, bounty_id, contributor_id, and
time windows.  Payload is stored as JSONB for flexibility.
"""

import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy import Column, DateTime, Index, Integer, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import declarative_base

from app.database import Base as DeclarativeBase


def _now() -> datetime:
    """Return current UTC timestamp with tzinfo."""
    return datetime.now(timezone.utc)


class EventDB(DeclarativeBase):
    """Indexed event record.

    This model uses PostgreSQL declarative partitioning by range on
    ``timestamp``.  The parent table is declared with
    ``postgresql_partition_by='RANGE (timestamp)'`` and individual
    monthly partitions must be created via migration.

    Indexes:
    - ``ix_event_timestamp`` on timestamp (included by partition key)
    - ``ix_event_type`` on event_type
    - ``ix_event_source`` on source
    - ``ix_event_bounty_id`` on bounty_id
    - ``ix_event_contributor_id`` on contributor_id
    - ``ix_event_timestamp_source`` composite on timestamp DESC, source

    Note: The primary key is globally unique across all partitions.
    """

    __tablename__ = "events"
    __table_args__ = {
        "postgresql_partition_by": "RANGE (timestamp)",
        # Additional indexes defined separately below
    }

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(50), nullable=False, index=True)
    source = Column(String(20), nullable=False, index=True)  # 'solana' or 'github'
    channel = Column(String(100), nullable=True)  # optional channel for WS routing
    timestamp = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )
    payload = Column(JSONB, nullable=False, default=dict)
    # Foreign keys (optional, for linking to domain objects)
    bounty_id = Column(
        UUID(as_uuid=True), ForeignKey("bounties.id", ondelete="SET NULL"), nullable=True, index=True
    )
    contributor_id = Column(String(64), nullable=True, index=True)
    # Solana-specific fields
    tx_hash = Column(String(128), nullable=True, index=True)
    block_slot = Column(Integer, nullable=True)
    # GitHub-specific fields
    github_event_type = Column(String(50), nullable=True)  # e.g., 'pull_request', 'issues'
    delivery_id = Column(String(100), nullable=True, unique=True, index=True)  # for idempotency

    # Composite index for common queries: recent events with source filter
    __table_args__ = (
        Index("ix_event_timestamp_desc", timestamp.desc()),
        Index("ix_event_source_timestamp", source, timestamp.desc()),
        Index("ix_event_bounty_timestamp", bounty_id, timestamp.desc()),
        Index("ix_event_contributor_timestamp", contributor_id, timestamp.desc()),
    )
