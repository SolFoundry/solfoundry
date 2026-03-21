"""ORM models for payouts, buybacks, and reputation_history tables.

These models represent the financial and reputation tracking tables in PostgreSQL.
All monetary columns use sa.Numeric for precision. Boolean defaults use sa.false()
for cross-database compatibility.
"""

import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy import Column, DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


def _now() -> datetime:
    """Return the current UTC timestamp for column defaults."""
    return datetime.now(timezone.utc)


class PayoutTable(Base):
    """Stores individual payout records for bounty completions.

    Each row represents a single token transfer to a contributor. The
    tx_hash column is unique to prevent duplicate recording of the same
    on-chain transaction.
    """

    __tablename__ = "payouts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipient = Column(String(100), nullable=False, index=True)
    recipient_wallet = Column(String(64))
    amount = Column(sa.Numeric(precision=20, scale=6), nullable=False)
    token = Column(String(20), nullable=False, server_default="FNDRY")
    bounty_id = Column(
        UUID(as_uuid=True),
        sa.ForeignKey("bounties.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    bounty_title = Column(String(200))
    tx_hash = Column(String(128), unique=True, index=True)
    status = Column(String(20), nullable=False, server_default="pending")
    solscan_url = Column(String(256))
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )


class BuybackTable(Base):
    """Stores FNDRY token buyback events from the treasury.

    Records the SOL spent and FNDRY acquired in each buyback, along
    with the on-chain transaction hash for auditability.
    """

    __tablename__ = "buybacks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    amount_sol = Column(sa.Numeric(precision=20, scale=6), nullable=False)
    amount_fndry = Column(sa.Numeric(precision=20, scale=6), nullable=False)
    price_per_fndry = Column(sa.Numeric(precision=20, scale=10), nullable=False)
    tx_hash = Column(String(128), unique=True, index=True)
    solscan_url = Column(String(256))
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )


class ReputationHistoryTable(Base):
    """Stores per-bounty reputation events for contributors.

    Each row records the reputation earned (or not) from a single
    bounty completion. The (contributor_id, bounty_id) pair is unique
    to prevent duplicate reputation awards.
    """

    __tablename__ = "reputation_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contributor_id = Column(String(64), nullable=False, index=True)
    bounty_id = Column(String(64), nullable=False, index=True)
    bounty_title = Column(String(200), nullable=False)
    bounty_tier = Column(Integer, nullable=False)
    review_score = Column(sa.Numeric(precision=5, scale=2), nullable=False)
    earned_reputation = Column(
        sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"
    )
    anti_farming_applied = Column(
        sa.Boolean, nullable=False, server_default=sa.false()
    )
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )

    __table_args__ = (
        Index(
            "ix_rep_cid_bid", "contributor_id", "bounty_id", unique=True
        ),
    )
