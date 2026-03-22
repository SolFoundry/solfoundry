"""Create contributor_webhooks table.

Revision ID: 003_contributor_webhooks
Revises: 002_disputes
Create Date: 2026-03-22

Adds webhook registration storage for Issue #T1-Bounty-Webhooks:
    - contributor_webhooks: per-user webhook endpoint registrations
      with Fernet-encrypted signing secrets and soft-delete support.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003_contributor_webhooks"
down_revision: Union[str, None] = "002_disputes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "contributor_webhooks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("user_id", sa.String(100), nullable=False),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("secret_encrypted", sa.Text(), nullable=False),
        sa.Column("secret_hash", sa.String(64), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_contributor_webhooks_user_id", "contributor_webhooks", ["user_id"]
    )
    op.create_index(
        "ix_contributor_webhooks_user_active",
        "contributor_webhooks",
        ["user_id", "is_active"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_contributor_webhooks_user_active", table_name="contributor_webhooks"
    )
    op.drop_index("ix_contributor_webhooks_user_id", table_name="contributor_webhooks")
    op.drop_table("contributor_webhooks")
