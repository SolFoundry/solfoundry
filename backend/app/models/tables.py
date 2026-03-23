"""ORM models for payouts, buybacks, reputation_history, and bounty_submissions.

These models represent the financial, reputation tracking, and submission
tables in PostgreSQL. All monetary columns use sa.Numeric for precision.
Boolean defaults use sa.false() for cross-database compatibility.
"""

import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy import Column, DateTime, Index, Integer, String, Text
from app.database import Base, GUID


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

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    recipient = Column(String(100), nullable=False, index=True)
    recipient_wallet = Column(String(64))
    amount = Column(sa.Numeric(precision=20, scale=6), nullable=False)
    token = Column(String(20), nullable=False, server_default="FNDRY")
    bounty_id = Column(
        GUID,
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

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
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

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    contributor_id = Column(GUID, nullable=False, index=True)
    bounty_id = Column(GUID, nullable=False, index=True)
    bounty_title = Column(String(200), nullable=False)
    bounty_tier = Column(Integer, nullable=False)
    review_score = Column(sa.Numeric(precision=5, scale=2), nullable=False)
    earned_reputation = Column(
        sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"
    )
    anti_farming_applied = Column(sa.Boolean, nullable=False, server_default=sa.false())
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )

    __table_args__ = (
        Index("ix_rep_cid_bid", "contributor_id", "bounty_id", unique=True),
    )


class BountySubmissionTable(Base):
    """Stores PR submissions for bounties as first-class database rows.

    Each row tracks one PR submitted against a bounty, including its
    review status and AI score. The (bounty_id, pr_url) pair is
    unique to prevent duplicate submissions of the same PR.
    """

    __tablename__ = "bounty_submissions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    bounty_id = Column(
        GUID,
        sa.ForeignKey("bounties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pr_url = Column(String(512), nullable=False)
    submitted_by = Column(String(100), nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, server_default="pending")
    ai_score = Column(
        sa.Numeric(precision=5, scale=2), nullable=False, server_default="0"
    )
    submitted_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )

    __table_args__ = (Index("ix_bsub_bounty_pr", "bounty_id", "pr_url", unique=True),)


class AdminAuditLogTable(Base):
    """Persistent audit log for all admin actions.

    Replaces the in-memory deque so entries survive restarts and are
    queryable with time-range and event-type filters.
    """

    __tablename__ = "admin_audit_log"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    event = Column(String(100), nullable=False, index=True)
    actor = Column(String(200), nullable=False)
    role = Column(String(20), nullable=False, server_default="admin")
    details = Column(sa.JSON, nullable=False, default=dict)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )
