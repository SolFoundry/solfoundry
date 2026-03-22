"""Add contributor_webhooks table for outbound event notifications.

Revision ID: 004_contributor_webhooks
Revises: 003_admin_audit_log
Create Date: 2026-03-23

Implements bounty #475: outbound contributor webhook subscriptions.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004_contributor_webhooks"
down_revision: Union[str, None] = "003_admin_audit_log"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create contributor_webhooks table."""
    op.create_table(
        "contributor_webhooks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("secret", sa.String(256), nullable=False),
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
    )
    op.create_index(
        "ix_contributor_webhooks_user_id", "contributor_webhooks", ["user_id"]
    )
    op.create_index(
        "ix_contributor_webhooks_active", "contributor_webhooks", ["active"]
    )


def downgrade() -> None:
    """Drop contributor_webhooks table."""
    op.drop_index("ix_contributor_webhooks_active", table_name="contributor_webhooks")
    op.drop_index("ix_contributor_webhooks_user_id", table_name="contributor_webhooks")
    op.drop_table("contributor_webhooks")
