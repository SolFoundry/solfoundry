"""Add siws_nonces and wallet_sessions tables for SIWS auth.

Revision ID: 003_siws
Revises: 002_disputes
Create Date: 2026-03-23

Adds two tables required for Sign-In With Solana:
  - siws_nonces   : one-time challenge nonces with 10-minute TTL
  - wallet_sessions: per-token session rows enabling revocation
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_siws"
down_revision: Union[str, None] = "002_disputes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "siws_nonces",
        sa.Column("nonce", sa.String(64), primary_key=True, nullable=False),
        sa.Column("wallet_address", sa.String(64), nullable=False, index=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean, nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_siws_nonces_expires_at", "siws_nonces", ["expires_at"])

    op.create_table(
        "wallet_sessions",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("wallet_address", sa.String(64), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("token_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("token_type", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean, nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_wallet_sessions_wallet", "wallet_sessions", ["wallet_address"])
    op.create_index("ix_wallet_sessions_user", "wallet_sessions", ["user_id"])
    op.create_index("ix_wallet_sessions_token_hash", "wallet_sessions", ["token_hash"])
    op.create_index("ix_wallet_sessions_expires_at", "wallet_sessions", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_wallet_sessions_expires_at", "wallet_sessions")
    op.drop_index("ix_wallet_sessions_token_hash", "wallet_sessions")
    op.drop_index("ix_wallet_sessions_user", "wallet_sessions")
    op.drop_index("ix_wallet_sessions_wallet", "wallet_sessions")
    op.drop_table("wallet_sessions")

    op.drop_index("ix_siws_nonces_expires_at", "siws_nonces")
    op.drop_table("siws_nonces")
