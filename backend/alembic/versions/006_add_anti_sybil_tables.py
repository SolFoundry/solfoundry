"""Add anti-sybil tables: sybil_flags, sybil_appeals, ip_account_map, wallet_funding_map.

Revision ID: 006_add_anti_sybil_tables
Revises: 004_contributor_webhooks
Create Date: 2026-03-23

Implements bounty #XXX: anti-sybil and anti-gaming protection.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006_add_anti_sybil_tables"
down_revision: Union[str, None] = "004_contributor_webhooks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums (PostgreSQL only — SQLite uses VARCHAR)
    flag_type_enum = sa.Enum(
        "github_age",
        "github_activity",
        "wallet_cluster",
        "ip_cluster",
        "claim_rate",
        "t1_farming",
        name="flag_type_enum",
    )
    flag_severity_enum = sa.Enum("soft", "hard", name="flag_severity_enum")
    appeal_status_enum = sa.Enum(
        "pending", "approved", "rejected", name="appeal_status_enum"
    )

    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        flag_type_enum.create(bind, checkfirst=True)
        flag_severity_enum.create(bind, checkfirst=True)
        appeal_status_enum.create(bind, checkfirst=True)

    # sybil_flags
    op.create_table(
        "sybil_flags",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("user_id", sa.String(100), nullable=False),
        sa.Column(
            "flag_type",
            sa.Enum(
                "github_age",
                "github_activity",
                "wallet_cluster",
                "ip_cluster",
                "claim_rate",
                "t1_farming",
                name="flag_type_enum",
                create_constraint=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "severity",
            sa.Enum("soft", "hard", name="flag_severity_enum", create_constraint=False),
            nullable=False,
        ),
        sa.Column(
            "details",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("resolved_by", sa.String(100), nullable=True),
        sa.Column("resolved_note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_sybil_flags_user_id", "sybil_flags", ["user_id"])
    op.create_index("ix_sybil_flags_flag_type", "sybil_flags", ["flag_type"])
    op.create_index("ix_sybil_flags_user_type", "sybil_flags", ["user_id", "flag_type"])
    op.create_index("ix_sybil_flags_created_at", "sybil_flags", ["created_at"])

    # sybil_appeals
    op.create_table(
        "sybil_appeals",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("user_id", sa.String(100), nullable=False),
        sa.Column("flag_id", sa.CHAR(36), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "approved",
                "rejected",
                name="appeal_status_enum",
                create_constraint=False,
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("reviewer_note", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.String(100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_sybil_appeals_user_id", "sybil_appeals", ["user_id"])
    op.create_index("ix_sybil_appeals_flag_id", "sybil_appeals", ["flag_id"])
    op.create_index(
        "ix_sybil_appeals_user_flag", "sybil_appeals", ["user_id", "flag_id"]
    )

    # ip_account_map
    op.create_table(
        "ip_account_map",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("ip_hash", sa.String(64), nullable=False),
        sa.Column("user_id", sa.String(100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_ip_account_map_ip_hash", "ip_account_map", ["ip_hash"])
    op.create_index(
        "ix_ip_account_map_ip_user",
        "ip_account_map",
        ["ip_hash", "user_id"],
        unique=True,
    )

    # wallet_funding_map
    op.create_table(
        "wallet_funding_map",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("wallet", sa.String(64), nullable=False, unique=True),
        sa.Column("funding_source", sa.String(64), nullable=True),
        sa.Column("user_id", sa.String(100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_wallet_funding_map_wallet", "wallet_funding_map", ["wallet"])
    op.create_index(
        "ix_wallet_funding_map_funding_source",
        "wallet_funding_map",
        ["funding_source"],
    )
    op.create_index("ix_wallet_funding_map_user_id", "wallet_funding_map", ["user_id"])


def downgrade() -> None:
    op.drop_table("wallet_funding_map")
    op.drop_table("ip_account_map")
    op.drop_table("sybil_appeals")
    op.drop_table("sybil_flags")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        sa.Enum(name="appeal_status_enum").drop(bind, checkfirst=True)
        sa.Enum(name="flag_severity_enum").drop(bind, checkfirst=True)
        sa.Enum(name="flag_type_enum").drop(bind, checkfirst=True)
