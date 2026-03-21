"""ORM: payouts, buybacks, reputation_history (Issue #162)."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
_now = lambda: datetime.now(timezone.utc)  # noqa: E731
_pk = lambda: Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # noqa: E731
_ts = lambda: Column(DateTime(timezone=True), nullable=False, default=_now, index=True)  # noqa: E731

class PayoutTable(Base):
    __tablename__ = "payouts"
    id = _pk(); recipient = Column(String(100), nullable=False, index=True)
    recipient_wallet = Column(String(64)); amount = Column(Float, nullable=False)
    token = Column(String(20), nullable=False, server_default="FNDRY")
    bounty_id = Column(String(64), index=True); bounty_title = Column(String(200))
    tx_hash = Column(String(128), unique=True, index=True)
    status = Column(String(20), nullable=False, server_default="pending")
    solscan_url = Column(String(256)); created_at = _ts()

class BuybackTable(Base):
    __tablename__ = "buybacks"
    id = _pk(); amount_sol = Column(Float, nullable=False)
    amount_fndry = Column(Float, nullable=False); price_per_fndry = Column(Float, nullable=False)
    tx_hash = Column(String(128), unique=True, index=True)
    solscan_url = Column(String(256)); created_at = _ts()

class ReputationHistoryTable(Base):
    __tablename__ = "reputation_history"
    id = _pk(); contributor_id = Column(String(64), nullable=False, index=True)
    bounty_id = Column(String(64), nullable=False, index=True)
    bounty_title = Column(String(200), nullable=False); bounty_tier = Column(Integer, nullable=False)
    review_score = Column(Float, nullable=False)
    earned_reputation = Column(Float, nullable=False, server_default="0")
    anti_farming_applied = Column(Boolean, nullable=False, server_default="false")
    created_at = _ts()
    __table_args__ = (Index("ix_rep_cid_bid", "contributor_id", "bounty_id", unique=True),)
