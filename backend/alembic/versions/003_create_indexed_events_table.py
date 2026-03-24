"""Create indexed_events table for the real-time event indexer.

Revision ID: 003_indexed_events
Revises: 002_create_disputes_tables
Create Date: 2026-03-22

This migration creates the ``indexed_events`` table with proper indexes
for time-series queries, contributor lookups, and bounty-specific
filtering.  Uses PostgreSQL-native UUID primary keys and JSONB for
flexible payload storage.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

# Revision identifiers
revision = "003_indexed_events"
down_revision = "002_create_disputes_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the indexed_events table with all indexes."""
    op.create_table(
        "indexed_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("contributor_username", sa.String(100), nullable=True),
        sa.Column("bounty_id", sa.String(100), nullable=True),
        sa.Column("bounty_number", sa.Integer(), nullable=True),
        sa.Column("transaction_hash", sa.String(128), nullable=True),
        sa.Column("github_url", sa.String(500), nullable=True),
        sa.Column("amount", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("payload", JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Individual column indexes for simple filters
    op.create_index(
        "ix_indexed_events_source",
        "indexed_events",
        ["source"],
    )
    op.create_index(
        "ix_indexed_events_category",
        "indexed_events",
        ["category"],
    )
    op.create_index(
        "ix_indexed_events_contributor_username",
        "indexed_events",
        ["contributor_username"],
    )
    op.create_index(
        "ix_indexed_events_bounty_id",
        "indexed_events",
        ["bounty_id"],
    )
    op.create_index(
        "ix_indexed_events_created_at",
        "indexed_events",
        ["created_at"],
    )

    # Composite indexes for common query patterns
    op.create_index(
        "ix_indexed_events_source_category_created",
        "indexed_events",
        ["source", "category", "created_at"],
    )
    op.create_index(
        "ix_indexed_events_contributor_created",
        "indexed_events",
        ["contributor_username", "created_at"],
    )
    op.create_index(
        "ix_indexed_events_bounty_created",
        "indexed_events",
        ["bounty_id", "created_at"],
    )


def downgrade() -> None:
    """Drop the indexed_events table and all associated indexes."""
    op.drop_index("ix_indexed_events_bounty_created", table_name="indexed_events")
    op.drop_index("ix_indexed_events_contributor_created", table_name="indexed_events")
    op.drop_index("ix_indexed_events_source_category_created", table_name="indexed_events")
    op.drop_index("ix_indexed_events_created_at", table_name="indexed_events")
    op.drop_index("ix_indexed_events_bounty_id", table_name="indexed_events")
    op.drop_index("ix_indexed_events_contributor_username", table_name="indexed_events")
    op.drop_index("ix_indexed_events_category", table_name="indexed_events")
    op.drop_index("ix_indexed_events_source", table_name="indexed_events")
    op.drop_table("indexed_events")
