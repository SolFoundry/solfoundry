"""Create contributor_webhooks table.

Revision ID: 003_contributor_webhooks
Revises: 002_disputes
Create Date: 2026-03-22

Adds persistent storage for contributor webhook registrations (Issue #475).
Each row stores the endpoint URL, per-webhook HMAC-SHA256 secret, the
event-type filter (JSON array or NULL for all events), and an active flag
used for soft-deletes.

An index on user_id supports the common query pattern of listing all
webhooks for a given contributor.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003_contributor_webhooks"
down_revision: Union[str, None] = "002_disputes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the contributor_webhooks table."""
    op.create_table(
        "contributor_webhooks",
        sa.Column(
            "id",
            sa.String(36),
            primary_key=True,
            comment="UUID primary key",
        ),
        sa.Column(
            "user_id",
            sa.String(255),
            nullable=False,
            comment="Owning contributor identifier (wallet address or user UUID)",
        ),
        sa.Column(
            "url",
            sa.String(2048),
            nullable=False,
            comment="HTTPS endpoint that receives event payloads",
        ),
        sa.Column(
            "secret",
            sa.String(64),
            nullable=False,
            comment="64-char hex HMAC-SHA256 secret for payload signing",
        ),
        sa.Column(
            "events",
            sa.JSON,
            nullable=True,
            comment="JSON array of subscribed event types; NULL means all events",
        ),
        sa.Column(
            "active",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("1"),
            comment="Soft-delete flag; False = deactivated",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            comment="UTC timestamp of webhook registration",
        ),
    )
    op.create_index(
        "ix_contributor_webhooks_user_id",
        "contributor_webhooks",
        ["user_id"],
    )


def downgrade() -> None:
    """Drop the contributor_webhooks table."""
    op.drop_index("ix_contributor_webhooks_user_id", table_name="contributor_webhooks")
    op.drop_table("contributor_webhooks")
