"""Payouts, buybacks, reputation_history. Rev 002_full_pg."""
from alembic import op
import sqlalchemy as sa
revision = "002_full_pg"
down_revision = None
branch_labels = depends_on = None
_ts = sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now())

def upgrade() -> None:
    op.create_table("payouts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("recipient", sa.String(100), nullable=False),
        sa.Column("recipient_wallet", sa.String(64)),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("token", sa.String(20), server_default="FNDRY"),
        sa.Column("bounty_id", sa.String(64)),
        sa.Column("bounty_title", sa.String(200)),
        sa.Column("tx_hash", sa.String(128), unique=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("solscan_url", sa.String(256)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.create_index("ix_po_recip", "payouts", ["recipient"])
    op.create_index("ix_po_ts", "payouts", ["created_at"])
    op.create_table("buybacks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("amount_sol", sa.Float(), nullable=False),
        sa.Column("amount_fndry", sa.Float(), nullable=False),
        sa.Column("price_per_fndry", sa.Float(), nullable=False),
        sa.Column("tx_hash", sa.String(128), unique=True),
        sa.Column("solscan_url", sa.String(256)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.create_index("ix_bb_ts", "buybacks", ["created_at"])
    op.create_table("reputation_history",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("contributor_id", sa.String(64), nullable=False),
        sa.Column("bounty_id", sa.String(64), nullable=False),
        sa.Column("bounty_title", sa.String(200), nullable=False),
        sa.Column("bounty_tier", sa.Integer(), nullable=False),
        sa.Column("review_score", sa.Float(), nullable=False),
        sa.Column("earned_reputation", sa.Float(), server_default="0"),
        sa.Column("anti_farming_applied", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.create_index("ix_rh_cid", "reputation_history", ["contributor_id"])
    op.create_index("ix_rh_ts", "reputation_history", ["created_at"])
    op.create_index("ix_rh_cid_bid", "reputation_history",
                    ["contributor_id", "bounty_id"], unique=True)

def downgrade() -> None:
    for t in ("reputation_history", "buybacks", "payouts"): op.drop_table(t)
