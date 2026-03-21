"""Create contributors table with indexes for leaderboard queries.

Revision ID: 001_contributors
Revises: None
Create Date: 2026-03-21

Migrates contributor data from the in-memory dict to a persistent
PostgreSQL table.  Includes composite index on (total_earnings,
reputation_score) for fast leaderboard ORDER BY queries.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_contributors"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the contributors table and supporting indexes."""
    op.create_table(
        "contributors",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "username",
            sa.String(50),
            unique=True,
            nullable=False,
            index=True,
        ),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column(
            "skills",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
        sa.Column(
            "badges",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
        sa.Column(
            "social_links",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'::json"),
        ),
        sa.Column(
            "total_contributions",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "total_bounties_completed",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "total_earnings",
            sa.Numeric(precision=18, scale=2),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "reputation_score",
            sa.Float(),
            nullable=False,
            server_default=sa.text("0"),
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
    )

    # Composite index for leaderboard ORDER BY total_earnings DESC,
    # reputation_score DESC — covers the most common query pattern.
    op.create_index(
        "ix_contributors_reputation_earnings",
        "contributors",
        ["total_earnings", "reputation_score"],
    )


def downgrade() -> None:
    """Drop the contributors table and its indexes."""
    op.drop_index("ix_contributors_reputation_earnings", table_name="contributors")
    op.drop_table("contributors")
