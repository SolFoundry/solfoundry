"""Add staking_positions and staking_events tables.

Revision ID: 003_staking
Revises: 002_disputes
Create Date: 2026-03-22

Adds the staking subsystem tables:
- staking_positions: one row per wallet, upserted on every stake/unstake action
- staking_events: immutable event log for the full staking lifecycle
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "003_staking"
down_revision: Union[str, None] = "002_disputes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "staking_positions",
        sa.Column("wallet_address", sa.String(64), primary_key=True, index=True),
        sa.Column("staked_amount", sa.Numeric(precision=20, scale=6), nullable=False, server_default="0"),
        sa.Column("staked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_reward_claim", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rewards_accrued", sa.Numeric(precision=20, scale=6), nullable=False, server_default="0"),
        sa.Column("cooldown_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unstake_amount", sa.Numeric(precision=20, scale=6), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.text("NOW()"),
            onupdate=sa.text("NOW()"),
        ),
    )

    op.create_table(
        "staking_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("wallet_address", sa.String(64), nullable=False, index=True),
        sa.Column("event_type", sa.String(32), nullable=False),
        sa.Column("amount", sa.Numeric(precision=20, scale=6), nullable=False, server_default="0"),
        sa.Column("rewards_amount", sa.Numeric(precision=20, scale=6), nullable=True),
        sa.Column("signature", sa.String(128), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("staking_events")
    op.drop_table("staking_positions")
