"""Create events table with time-series partitioning for analytics.

Revision ID: 003_events
Revises: 002_create_esg_wallet_cache_table
Create Date: 2026-03-22

Stores unified real-time events from Solana on-chain and GitHub webhooks.
Partitioned by month on the timestamp column for write scalability and
fast time-range queries. Indexes support filtering by type, source,
bounty, contributor, and time.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "003_events"
down_revision: Union[str, None] = "002_disputes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _now_month() -> str:
    """Return current year-month string for partition naming."""
    now = datetime.now(timezone.utc)
    return f"{now.year}_{now.month:02d}"


def _partition_name(year: int, month: int) -> str:
    return f"events_{year}_{month:02d}"


def _create_partitions() -> None:
    """Create monthly partitions for the current and next 12 months, plus a default."""
    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    # Create partitions for the current month and the next 12 months
    for i in range(13):
        # For i=0: current month; i=1: next month, etc.
        year = now.year
        month = now.month + i
        while month > 12:
            month -= 12
            year += 1
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year+1}-01-01"
        else:
            end_date = f"{year}-{month+1:02d}-01"
        part_name = _partition_name(year, month)
        # Check if partition exists to make operation idempotent
        check_sql = sa.text(
            "SELECT EXISTS (SELECT 1 FROM pg_partition_tree WHERE partitionname = :pname)"
        )
        result = conn.execute(check_sql, {"pname": part_name}).scalar()
        if not result:
            create_sql = sa.text(
                f"CREATE TABLE {part_name} PARTITION OF events "
                f"FOR VALUES FROM ('{start_date}') TO ('{end_date}')"
            )
            conn.execute(create_sql)
    # Create a default partition to catch out-of-range rows
    default_name = "events_default"
    check_sql = sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_inherits WHERE inhparent = 'events'::regclass AND inhrelid = :pname::regclass)"
    )
    result = conn.execute(check_sql, {"pname": default_name}).scalar()
    if not result:
        op.execute(f"CREATE TABLE {default_name} PARTITION OF events DEFAULT")


def upgrade() -> None:
    """Create the events table with partitioning and indexes."""
    # Create the parent partitioned table. Note: PostgreSQL 11+
    op.execute(
        """
        CREATE TABLE events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_type VARCHAR(50) NOT NULL,
            source VARCHAR(20) NOT NULL,
            channel VARCHAR(100),
            timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            payload JSONB NOT NULL DEFAULT '{}',
            bounty_id UUID REFERENCES bounties(id) ON DELETE SET NULL,
            contributor_id VARCHAR(64),
            tx_hash VARCHAR(128),
            block_slot INTEGER,
            github_event_type VARCHAR(50),
            delivery_id VARCHAR(100) UNIQUE
        ) PARTITION BY RANGE (timestamp)
        """
    )

    # Create indexes on the parent table (they will automatically be created on new partitions)
    op.create_index("ix_event_timestamp_desc", "events", [sa.text("timestamp DESC")])
    op.create_index("ix_event_type", "events", ["event_type"])
    op.create_index("ix_event_source", "events", ["source"])
    op.create_index("ix_event_bounty_id", "events", ["bounty_id"])
    op.create_index("ix_event_contributor_id", "events", ["contributor_id"])
    op.create_index(
        "ix_event_source_timestamp", "events", ["source", sa.text("timestamp DESC")]
    )
    op.create_index(
        "ix_event_bounty_timestamp", "events", ["bounty_id", sa.text("timestamp DESC")]
    )
    op.create_index(
        "ix_event_contributor_timestamp",
        "events",
        ["contributor_id", sa.text("timestamp DESC")],
    )

    # Create initial monthly partitions and a default
    _create_partitions()


def downgrade() -> None:
    """Drop all events partitions and the parent table."""
    # Drop all child partitions first. For simplicity, drop all partitions with the naming pattern.
    conn = op.get_bind()
    # Find all partitions of events
    partitions = conn.execute(
        sa.text(
            """
            SELECT inhrelid::regclass::text
            FROM pg_inherits
            WHERE inhparent = 'events'::regclass
            """
        )
    ).fetchall()
    for (part,) in partitions:
        op.execute(f"DROP TABLE IF EXISTS {part} CASCADE")
    op.drop_table("events")
