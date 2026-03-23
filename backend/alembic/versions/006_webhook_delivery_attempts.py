"""Webhook delivery attempt log for dashboard and retry visibility.

Revision ID: 006_webhook_delivery_attempts
Revises: 005_bounty_boosts
Create Date: 2026-03-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006_webhook_delivery_attempts"
down_revision: Union[str, None] = "005_bounty_boosts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "webhook_delivery_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "webhook_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("contributor_webhooks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("delivery_mode", sa.String(16), nullable=False),
        sa.Column(
            "event_types", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_webhook_delivery_attempts_webhook_id",
        "webhook_delivery_attempts",
        ["webhook_id"],
    )
    op.create_index(
        "ix_webhook_delivery_attempts_batch_id",
        "webhook_delivery_attempts",
        ["batch_id"],
    )
    op.create_index(
        "ix_webhook_delivery_attempts_created_at",
        "webhook_delivery_attempts",
        ["created_at"],
    )
    op.create_index(
        "ix_webhook_delivery_webhook_created",
        "webhook_delivery_attempts",
        ["webhook_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_webhook_delivery_webhook_created", table_name="webhook_delivery_attempts"
    )
    op.drop_index(
        "ix_webhook_delivery_attempts_created_at",
        table_name="webhook_delivery_attempts",
    )
    op.drop_index(
        "ix_webhook_delivery_attempts_batch_id",
        table_name="webhook_delivery_attempts",
    )
    op.drop_index(
        "ix_webhook_delivery_attempts_webhook_id",
        table_name="webhook_delivery_attempts",
    )
    op.drop_table("webhook_delivery_attempts")
