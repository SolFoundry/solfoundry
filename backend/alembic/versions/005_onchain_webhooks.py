"""Add on-chain webhook subscriptions and delivery log tables.

Revision ID: 005_onchain_webhooks
Revises: 004_contributor_webhooks
Create Date: 2026-03-23

Implements bounty #508: on-chain event webhooks (escrow.locked,
escrow.released, reputation.updated, stake.deposited, stake.withdrawn).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005_onchain_webhooks"
down_revision: Union[str, None] = "004_contributor_webhooks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create onchain_webhook_subscriptions and onchain_webhook_delivery_logs tables."""

    # ── subscriptions ──────────────────────────────────────────────────────────
    op.create_table(
        "onchain_webhook_subscriptions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("secret", sa.String(256), nullable=False),
        # NULL = subscribe to all event types
        sa.Column("event_filter", sa.Text, nullable=True),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("last_delivery_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_delivery_status", sa.String(20), nullable=True),
        sa.Column(
            "failure_count", sa.Integer, nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "total_deliveries",
            sa.Integer,
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "success_deliveries",
            sa.Integer,
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.create_index(
        "ix_onchain_webhook_sub_user", "onchain_webhook_subscriptions", ["user_id"]
    )
    op.create_index(
        "ix_onchain_webhook_sub_active", "onchain_webhook_subscriptions", ["active"]
    )

    # ── delivery logs ──────────────────────────────────────────────────────────
    op.create_table(
        "onchain_webhook_delivery_logs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("batch_id", sa.String(36), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("tx_signature", sa.String(100), nullable=False),
        sa.Column("attempt", sa.Integer, nullable=False, server_default=sa.text("1")),
        sa.Column("status_code", sa.Integer, nullable=True),
        sa.Column(
            "success", sa.Boolean, nullable=False, server_default=sa.text("false")
        ),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column(
            "attempted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("latency_ms", sa.Integer, nullable=True),
    )
    op.create_index(
        "ix_onchain_delivery_sub_batch",
        "onchain_webhook_delivery_logs",
        ["subscription_id", "batch_id"],
    )
    op.create_index(
        "ix_onchain_delivery_event",
        "onchain_webhook_delivery_logs",
        ["event_type"],
    )
    op.create_index(
        "ix_onchain_delivery_attempted_at",
        "onchain_webhook_delivery_logs",
        ["attempted_at"],
    )


def downgrade() -> None:
    """Drop on-chain webhook tables."""
    op.drop_index(
        "ix_onchain_delivery_attempted_at",
        table_name="onchain_webhook_delivery_logs",
    )
    op.drop_index(
        "ix_onchain_delivery_event", table_name="onchain_webhook_delivery_logs"
    )
    op.drop_index(
        "ix_onchain_delivery_sub_batch", table_name="onchain_webhook_delivery_logs"
    )
    op.drop_table("onchain_webhook_delivery_logs")

    op.drop_index(
        "ix_onchain_webhook_sub_active", table_name="onchain_webhook_subscriptions"
    )
    op.drop_index(
        "ix_onchain_webhook_sub_user", table_name="onchain_webhook_subscriptions"
    )
    op.drop_table("onchain_webhook_subscriptions")
