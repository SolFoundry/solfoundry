"""Anti-sybil: audit log, alerts, appeals, T1 cooldown, wallet clusters, user IP/GitHub fields.

Revision ID: 005_anti_gaming
Revises: 004_contributor_webhooks
Create Date: 2026-03-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005_anti_gaming"
down_revision: Union[str, None] = "004_contributor_webhooks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("registration_ip", sa.String(45), nullable=True))
    op.add_column("users", sa.Column("last_seen_ip", sa.String(45), nullable=True))
    op.add_column(
        "users",
        sa.Column("github_account_created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("users", sa.Column("github_public_repos", sa.Integer(), nullable=True))
    op.add_column(
        "users", sa.Column("github_commit_count_snapshot", sa.Integer(), nullable=True)
    )
    op.create_index("ix_users_registration_ip", "users", ["registration_ip"])

    op.create_table(
        "anti_gaming_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("decision", sa.String(20), nullable=False),
        sa.Column("rule_name", sa.String(80), nullable=False),
        sa.Column("outcome", sa.String(20), nullable=False),
        sa.Column("subject_user_id", sa.String(36), nullable=True),
        sa.Column("subject_key", sa.String(200), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_anti_gaming_audit_log_decision", "anti_gaming_audit_log", ["decision"]
    )
    op.create_index(
        "ix_anti_gaming_audit_log_rule_name", "anti_gaming_audit_log", ["rule_name"]
    )
    op.create_index(
        "ix_anti_gaming_audit_log_created_at",
        "anti_gaming_audit_log",
        ["created_at"],
    )

    op.create_table(
        "sybil_admin_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("alert_type", sa.String(64), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="warning"),
        sa.Column("summary", sa.String(500), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_by", sa.String(200), nullable=True),
    )
    op.create_index(
        "ix_sybil_admin_alerts_alert_type", "sybil_admin_alerts", ["alert_type"]
    )
    op.create_index(
        "ix_sybil_admin_alerts_created_at", "sybil_admin_alerts", ["created_at"]
    )

    op.create_table(
        "anti_gaming_appeals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="pending"
        ),
        sa.Column("related_audit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_anti_gaming_appeals_user_id", "anti_gaming_appeals", ["user_id"]
    )
    op.create_index(
        "ix_anti_gaming_appeals_status", "anti_gaming_appeals", ["status"]
    )

    op.create_table(
        "t1_completion_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("actor_key", sa.String(200), nullable=False),
        sa.Column("bounty_id", sa.String(64), nullable=False),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_t1_completion_log_actor_key", "t1_completion_log", ["actor_key"])
    op.create_index(
        "ix_t1_completion_log_completed_at", "t1_completion_log", ["completed_at"]
    )

    op.create_table(
        "wallet_cluster_membership",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("cluster_key", sa.String(64), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_wallet_cluster_membership_user_id",
        "wallet_cluster_membership",
        ["user_id"],
        unique=True,
    )
    op.create_index(
        "ix_wallet_cluster_membership_cluster_key",
        "wallet_cluster_membership",
        ["cluster_key"],
    )


def downgrade() -> None:
    op.drop_table("wallet_cluster_membership")
    op.drop_table("t1_completion_log")
    op.drop_table("anti_gaming_appeals")
    op.drop_table("sybil_admin_alerts")
    op.drop_table("anti_gaming_audit_log")
    op.drop_index("ix_users_registration_ip", table_name="users")
    op.drop_column("users", "github_commit_count_snapshot")
    op.drop_column("users", "github_public_repos")
    op.drop_column("users", "github_account_created_at")
    op.drop_column("users", "last_seen_ip")
    op.drop_column("users", "registration_ip")
