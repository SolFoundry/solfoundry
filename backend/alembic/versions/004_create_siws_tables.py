"""Create SIWS authentication tables.

Revision ID: 004_create_siws_tables
Revises: 003_create_contributor_webhooks_table
Create Date: 2026-03-23

Adds:
- siws_nonces: challenge-response nonces for SIWS flow
- wallet_sessions: persistent JWT session records
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic
revision = "004_create_siws_tables"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # siws_nonces — short-lived challenge records
    op.create_table(
        "siws_nonces",
        sa.Column("nonce", sa.String(64), primary_key=True),
        sa.Column("wallet_address", sa.String(64), nullable=False),
        sa.Column("domain", sa.String(256), nullable=False),
        sa.Column(
            "issued_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "expiration_time",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column("message_body", sa.String(2048), nullable=False),
        sa.Column("used", sa.Boolean, nullable=False, server_default="false"),
    )
    op.create_index(
        "ix_siws_nonces_wallet_address",
        "siws_nonces",
        ["wallet_address"],
    )

    # wallet_sessions — persistent JWT session records
    op.create_table(
        "wallet_sessions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("wallet_address", sa.String(64), nullable=False),
        sa.Column("access_token_hash", sa.String(64), nullable=False),
        sa.Column("refresh_token_hash", sa.String(64), nullable=True),
        sa.Column(
            "access_expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "refresh_expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("revoked", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("nonce", sa.String(64), nullable=True),
    )
    op.create_index(
        "ix_wallet_sessions_wallet_active",
        "wallet_sessions",
        ["wallet_address", "revoked"],
    )
    op.create_index(
        "ix_wallet_sessions_access_hash",
        "wallet_sessions",
        ["access_token_hash"],
    )
    op.create_index(
        "ix_wallet_sessions_refresh_hash",
        "wallet_sessions",
        ["refresh_token_hash"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_wallet_sessions_refresh_hash", table_name="wallet_sessions")
    op.drop_index("ix_wallet_sessions_access_hash", table_name="wallet_sessions")
    op.drop_index("ix_wallet_sessions_wallet_active", table_name="wallet_sessions")
    op.drop_table("wallet_sessions")

    op.drop_index("ix_siws_nonces_wallet_address", table_name="siws_nonces")
    op.drop_table("siws_nonces")
