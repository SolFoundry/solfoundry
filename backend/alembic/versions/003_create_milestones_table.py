"""Create milestones table for multi-stage bounty payouts.

Revision ID: 003
Revises: 002_create_disputes_tables
Create Date: 2026-03-22

Adds the ``milestones`` table to support milestone-based partial $FNDRY
payouts on T3 bounties.  Each milestone carries a percentage of the total
bounty reward and must be approved sequentially.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "003"
down_revision = "002_create_disputes_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the milestones table with indexes and constraints."""
    op.create_table(
        "milestones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("bounty_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("bounties.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("milestone_number", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("percentage", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("submitted_by", sa.String(100), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by", sa.String(100), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payout_tx_hash", sa.String(128), nullable=True),
        sa.Column("payout_amount", sa.Numeric(precision=20, scale=6), nullable=True),
        sa.Column("payout_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )

    # Composite unique index on (bounty_id, milestone_number)
    op.create_index(
        "ix_milestone_bounty_number",
        "milestones",
        ["bounty_id", "milestone_number"],
        unique=True,
    )

    # Index on bounty_id for fast lookups
    op.create_index(
        "ix_milestones_bounty_id",
        "milestones",
        ["bounty_id"],
    )

    # Index on status for filtering
    op.create_index(
        "ix_milestones_status",
        "milestones",
        ["status"],
    )

    # Index on created_at for ordering
    op.create_index(
        "ix_milestones_created_at",
        "milestones",
        ["created_at"],
    )


def downgrade() -> None:
    """Drop the milestones table and its indexes."""
    op.drop_index("ix_milestones_created_at", table_name="milestones")
    op.drop_index("ix_milestones_status", table_name="milestones")
    op.drop_index("ix_milestones_bounty_id", table_name="milestones")
    op.drop_index("ix_milestone_bounty_number", table_name="milestones")
    op.drop_table("milestones")
