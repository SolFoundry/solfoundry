"""Create disputes and dispute_history tables.

Revision ID: 002_disputes
Revises: 001_contributors
Create Date: 2026-03-21

Adds the dispute resolution tables for Issue #192:
- disputes: Main dispute records with state machine tracking
- dispute_history: Audit trail of all dispute state changes

PostgreSQL migration path:
- disputes table supports the OPENED -> EVIDENCE -> MEDIATION -> RESOLVED
  state machine with full evidence, AI mediation scores, and resolution data.
- dispute_history provides a complete audit trail of every action taken
  on a dispute, enabling timeline reconstruction in the frontend.

Schema supports concurrent access via SELECT ... FOR UPDATE row locking.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002_disputes"
down_revision: Union[str, None] = "001_contributors"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the disputes and dispute_history tables with indexes."""
    # -- disputes table --------------------------------------------------------
    op.create_table(
        "disputes",
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
        sa.Column(
            "submission_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "contributor_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "creator_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("reason", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "evidence_links",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="opened",
        ),
        sa.Column("outcome", sa.String(30), nullable=True),
        sa.Column("ai_review_score", sa.Float(), nullable=True),
        sa.Column("ai_recommendation", sa.Text(), nullable=True),
        sa.Column(
            "resolver_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column(
            "reputation_impact_creator",
            sa.Float(),
            nullable=True,
            server_default=sa.text("0.0"),
        ),
        sa.Column(
            "reputation_impact_contributor",
            sa.Float(),
            nullable=True,
            server_default=sa.text("0.0"),
        ),
        sa.Column(
            "rejection_timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
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
        sa.Column(
            "resolved_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # Indexes for common query patterns
    op.create_index("ix_disputes_bounty_id", "disputes", ["bounty_id"])
    op.create_index("ix_disputes_status", "disputes", ["status"])
    op.create_index("ix_disputes_contributor_id", "disputes", ["contributor_id"])
    op.create_index("ix_disputes_creator_id", "disputes", ["creator_id"])

    # -- dispute_history table -------------------------------------------------
    op.create_table(
        "dispute_history",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "dispute_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("disputes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("previous_status", sa.String(20), nullable=True),
        sa.Column("new_status", sa.String(20), nullable=True),
        sa.Column(
            "actor_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_dispute_history_dispute_id",
        "dispute_history",
        ["dispute_id"],
    )


def downgrade() -> None:
    """Drop the dispute_history and disputes tables."""
    op.drop_index("ix_dispute_history_dispute_id", table_name="dispute_history")
    op.drop_table("dispute_history")

    op.drop_index("ix_disputes_creator_id", table_name="disputes")
    op.drop_index("ix_disputes_contributor_id", table_name="disputes")
    op.drop_index("ix_disputes_status", table_name="disputes")
    op.drop_index("ix_disputes_bounty_id", table_name="disputes")
    op.drop_table("disputes")
