"""Add bounty_boosts table for community reward boosting.

Revision ID: 005_bounty_boosts
Revises: 004_contributor_webhooks
Create Date: 2026-03-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_bounty_boosts"
down_revision: Union[str, None] = "004_contributor_webhooks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bounty_boosts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "bounty_id",
            sa.String(36),
            sa.ForeignKey("bounties.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("booster_wallet", sa.String(64), nullable=False),
        sa.Column("amount", sa.Numeric(precision=20, scale=6), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("tx_hash", sa.String(128), unique=True, nullable=True),
        sa.Column("refund_tx_hash", sa.String(128), unique=True, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_bounty_boosts_bounty_id", "bounty_boosts", ["bounty_id"])
    op.create_index(
        "ix_bounty_boosts_booster_wallet", "bounty_boosts", ["booster_wallet"]
    )
    op.create_index("ix_bounty_boosts_created_at", "bounty_boosts", ["created_at"])
    op.create_index(
        "ix_bounty_boosts_bounty_status",
        "bounty_boosts",
        ["bounty_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_bounty_boosts_bounty_status", table_name="bounty_boosts")
    op.drop_index("ix_bounty_boosts_created_at", table_name="bounty_boosts")
    op.drop_index("ix_bounty_boosts_booster_wallet", table_name="bounty_boosts")
    op.drop_index("ix_bounty_boosts_bounty_id", table_name="bounty_boosts")
    op.drop_table("bounty_boosts")
