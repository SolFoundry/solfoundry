"""Add admin_audit_log table for persistent admin action tracking.

Revision ID: 003_admin_audit_log
Revises: 002_disputes
Create Date: 2026-03-22

Replaces the in-memory deque in admin.py with a persistent PostgreSQL
table so audit entries survive restarts and are queryable with filters.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003_admin_audit_log"
down_revision: Union[str, None] = "002_disputes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "admin_audit_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("event", sa.String(100), nullable=False, index=True),
        sa.Column("actor", sa.String(200), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="admin"),
        sa.Column("details", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
            index=True,
        ),
    )


def downgrade() -> None:
    op.drop_table("admin_audit_log")
