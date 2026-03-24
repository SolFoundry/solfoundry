"""Add milestones table for T3 bounties.

Revision ID: 003_milestones
Revises: 002_disputes
Create Date: 2026-03-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "003_milestones"
down_revision: Union[str, None] = "002_disputes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the bounties_milestones table."""
    op.create_table(
        "bounties_milestones",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "bounty_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bounties.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("milestone_number", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("percentage", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payout_tx_hash", sa.String(100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_bounties_milestones_bounty_id",
        "bounties_milestones",
        ["bounty_id"],
    )
    op.create_index(
        "ix_bounties_milestones_status",
        "bounties_milestones",
        ["status"],
    )

    # Add missing claim fields to bounties table
    op.add_column("bounties", sa.Column("claimed_by", sa.String(length=100), nullable=True))
    op.add_column("bounties", sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("bounties", sa.Column("claim_deadline", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Drop the bounties_milestones table."""
    op.drop_index("ix_bounties_milestones_status", table_name="bounties_milestones")
    op.drop_index("ix_bounties_milestones_bounty_id", table_name="bounties_milestones")
    op.drop_table("bounties_milestones")
    
    op.drop_column("bounties", "claim_deadline")
    op.drop_column("bounties", "claimed_at")
    op.drop_column("bounties", "claimed_by")
