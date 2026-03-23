"""ORM model and Pydantic schemas for bounty reward boosts.

Community members can boost a bounty's prize pool by contributing
$FNDRY. All boost amounts go into escrow alongside the original reward
and are refunded if the bounty expires without completion.

Boost lifecycle::

    PENDING → CONFIRMED (on-chain tx verified)
        |
        +→ REFUNDED  (bounty expired / cancelled)
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import Column, DateTime, Index, String
from app.database import Base, GUID
from pydantic import BaseModel, Field, field_validator

_BASE58_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
MINIMUM_BOOST_AMOUNT = 1_000.0


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Boost status enum
# ---------------------------------------------------------------------------


class BoostStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REFUNDED = "refunded"


# ---------------------------------------------------------------------------
# ORM model
# ---------------------------------------------------------------------------


class BountyBoostTable(Base):
    """One row per community boost contribution to a bounty's prize pool."""

    __tablename__ = "bounty_boosts"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    bounty_id = Column(
        GUID,
        sa.ForeignKey("bounties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    booster_wallet = Column(String(64), nullable=False, index=True)
    amount = Column(sa.Numeric(precision=20, scale=6), nullable=False)
    status = Column(
        String(20), nullable=False, server_default=BoostStatus.PENDING.value
    )
    tx_hash = Column(String(128), unique=True, nullable=True, index=True)
    refund_tx_hash = Column(String(128), unique=True, nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )
    updated_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    __table_args__ = (Index("ix_bounty_boosts_bounty_status", "bounty_id", "status"),)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class BoostRequest(BaseModel):
    """POST /bounties/{id}/boost request body."""

    booster_wallet: str = Field(..., min_length=32, max_length=44)
    amount: float = Field(..., gt=0)
    tx_hash: Optional[str] = Field(None, description="On-chain SPL transfer signature")

    @field_validator("booster_wallet")
    @classmethod
    def validate_wallet(cls, v: str) -> str:
        if not _BASE58_RE.match(v):
            raise ValueError("booster_wallet must be a valid Solana base-58 address")
        return v

    @field_validator("amount")
    @classmethod
    def validate_min_amount(cls, v: float) -> float:
        if v < MINIMUM_BOOST_AMOUNT:
            raise ValueError(f"Minimum boost is {MINIMUM_BOOST_AMOUNT:,.0f} $FNDRY")
        return v


class BoostResponse(BaseModel):
    """Single boost entry."""

    id: str
    bounty_id: str
    booster_wallet: str
    amount: float
    status: BoostStatus
    tx_hash: Optional[str] = None
    refund_tx_hash: Optional[str] = None
    created_at: datetime


class BoostListResponse(BaseModel):
    """Paginated list of boosts for a bounty."""

    boosts: list[BoostResponse]
    total: int
    total_boosted: float


class BoostSummary(BaseModel):
    """Reward summary shown on bounty detail: original + boosted amounts."""

    original_amount: float
    total_boosted: float
    total_amount: float
    boost_count: int


class BoosterLeaderboardEntry(BaseModel):
    """One entry in the per-bounty booster leaderboard."""

    rank: int
    booster_wallet: str
    total_boosted: float
    boost_count: int


class BoostLeaderboardResponse(BaseModel):
    """Top boosters for a single bounty."""

    leaderboard: list[BoosterLeaderboardEntry]
    total_boosted: float
