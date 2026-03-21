"""Full PostgreSQL persistence for all tables.

Revision ID: 002_full_pg
Revises: None
Create Date: 2026-03-21

Creates tables: users, bounties, contributors, submissions, payouts,
buybacks, reputation_history. Uses Numeric for monetary columns and
sa.false() for cross-DB boolean defaults. Foreign keys link submissions
and payouts to bounties.
"""

from alembic import op
import sqlalchemy as sa

revision = "002_full_pg"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create all application tables with proper types and constraints."""
    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("github_id", sa.String(64), unique=True, nullable=False),
        sa.Column("username", sa.String(128), nullable=False),
        sa.Column("email", sa.String(256), nullable=True),
        sa.Column("avatar_url", sa.String(512), nullable=True),
        sa.Column("wallet_address", sa.String(64), unique=True, nullable=True),
        sa.Column("wallet_verified", sa.Boolean(), server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_github_id", "users", ["github_id"])
    op.create_index("ix_users_wallet", "users", ["wallet_address"])

    # --- bounties ---
    op.create_table(
        "bounties",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("tier", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("reward_amount", sa.Numeric(precision=20, scale=6), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("creator_type", sa.String(20), server_default="platform"),
        sa.Column("github_issue_url", sa.String(512), nullable=True),
        sa.Column("skills", sa.JSON(), server_default="[]"),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(100), server_default="system"),
        sa.Column("submission_count", sa.Integer(), server_default="0"),
        sa.Column("popularity", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("search_vector", sa.Text(), nullable=True),
    )
    op.create_index("ix_bounties_tier_status", "bounties", ["tier", "status"])
    op.create_index("ix_bounties_category_status", "bounties", ["category", "status"])
    op.create_index("ix_bounties_reward", "bounties", ["reward_amount"])
    op.create_index("ix_bounties_deadline", "bounties", ["deadline"])
    op.create_index("ix_bounties_popularity", "bounties", ["popularity"])
    op.create_index("ix_bounties_created_at", "bounties", ["created_at"])

    # --- contributors ---
    op.create_table(
        "contributors",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("username", sa.String(50), unique=True, nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("skills", sa.JSON(), server_default="[]"),
        sa.Column("badges", sa.JSON(), server_default="[]"),
        sa.Column("social_links", sa.JSON(), server_default="{}"),
        sa.Column("total_contributions", sa.Integer(), server_default="0"),
        sa.Column("total_bounties_completed", sa.Integer(), server_default="0"),
        sa.Column("total_earnings", sa.Numeric(precision=20, scale=6), server_default="0"),
        sa.Column("reputation_score", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_contributors_username", "contributors", ["username"])

    # --- submissions ---
    op.create_table(
        "submissions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("contributor_id", sa.Uuid(), nullable=False),
        sa.Column("contributor_wallet", sa.String(64), nullable=False),
        sa.Column("pr_url", sa.String(500), nullable=False),
        sa.Column("pr_number", sa.Integer(), nullable=True),
        sa.Column("pr_repo", sa.String(255), nullable=True),
        sa.Column("pr_status", sa.String(50), nullable=True),
        sa.Column("pr_merged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "bounty_id",
            sa.Uuid(),
            sa.ForeignKey("bounties.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("match_confidence", sa.String(20), nullable=True),
        sa.Column("match_score", sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column("match_reasons", sa.JSON(), server_default="[]"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("reviewer_id", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reward_amount", sa.Numeric(precision=20, scale=6), nullable=True),
        sa.Column("reward_token", sa.String(20), nullable=True),
        sa.Column("payout_tx_hash", sa.String(128), nullable=True),
        sa.Column("payout_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("evidence", sa.JSON(), server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_submissions_contributor", "submissions", ["contributor_id"])
    op.create_index("ix_submissions_bounty", "submissions", ["bounty_id"])
    op.create_index("ix_submissions_status", "submissions", ["status"])
    op.create_index("ix_submissions_wallet", "submissions", ["contributor_wallet"])
    op.create_index(
        "ix_submissions_contributor_status",
        "submissions",
        ["contributor_id", "status"],
    )
    op.create_index(
        "ix_submissions_bounty_status",
        "submissions",
        ["bounty_id", "status"],
    )

    # --- payouts ---
    op.create_table(
        "payouts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("recipient", sa.String(100), nullable=False),
        sa.Column("recipient_wallet", sa.String(64), nullable=True),
        sa.Column("amount", sa.Numeric(precision=20, scale=6), nullable=False),
        sa.Column("token", sa.String(20), server_default="FNDRY"),
        sa.Column(
            "bounty_id",
            sa.Uuid(),
            sa.ForeignKey("bounties.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("bounty_title", sa.String(200), nullable=True),
        sa.Column("tx_hash", sa.String(128), unique=True, nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("solscan_url", sa.String(256), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_payouts_recipient", "payouts", ["recipient"])
    op.create_index("ix_payouts_tx_hash", "payouts", ["tx_hash"])
    op.create_index("ix_payouts_created_at", "payouts", ["created_at"])

    # --- buybacks ---
    op.create_table(
        "buybacks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("amount_sol", sa.Numeric(precision=20, scale=6), nullable=False),
        sa.Column("amount_fndry", sa.Numeric(precision=20, scale=6), nullable=False),
        sa.Column("price_per_fndry", sa.Numeric(precision=20, scale=10), nullable=False),
        sa.Column("tx_hash", sa.String(128), unique=True, nullable=True),
        sa.Column("solscan_url", sa.String(256), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_buybacks_created_at", "buybacks", ["created_at"])

    # --- reputation_history ---
    op.create_table(
        "reputation_history",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("contributor_id", sa.String(64), nullable=False),
        sa.Column("bounty_id", sa.String(64), nullable=False),
        sa.Column("bounty_title", sa.String(200), nullable=False),
        sa.Column("bounty_tier", sa.Integer(), nullable=False),
        sa.Column("review_score", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column(
            "earned_reputation",
            sa.Numeric(precision=10, scale=2),
            server_default="0",
        ),
        sa.Column(
            "anti_farming_applied",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_rh_contributor", "reputation_history", ["contributor_id"])
    op.create_index("ix_rh_bounty", "reputation_history", ["bounty_id"])
    op.create_index("ix_rh_created_at", "reputation_history", ["created_at"])
    op.create_index(
        "ix_rh_cid_bid",
        "reputation_history",
        ["contributor_id", "bounty_id"],
        unique=True,
    )


def downgrade() -> None:
    """Drop all application tables in reverse dependency order."""
    for table in (
        "reputation_history",
        "buybacks",
        "payouts",
        "submissions",
        "contributors",
        "bounties",
        "users",
    ):
        op.drop_table(table)
