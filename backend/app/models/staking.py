"""Staking ORM models and Pydantic schemas.

Tracks per-wallet staking positions, cooldown periods, and event history.
Tiers are determined by staked amount at query time (no separate tier column).

Tier configuration:
  Bronze  ≥ 1 000 $FNDRY   →  5 % APY, 1.00× rep boost
  Silver  ≥ 10 000 $FNDRY  →  8 % APY, 1.25× rep boost
  Gold    ≥ 50 000 $FNDRY  → 12 % APY, 1.50× rep boost
  Diamond ≥ 100 000 $FNDRY → 18 % APY, 2.00× rep boost
"""

import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Column, DateTime, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

UNSTAKE_COOLDOWN_DAYS = 7
_TIER_TABLE = [
    # (min_stake, tier_name, apy, rep_boost)
    (Decimal("100000"), "diamond", Decimal("0.18"), Decimal("2.00")),
    (Decimal("50000"),  "gold",    Decimal("0.12"), Decimal("1.50")),
    (Decimal("10000"),  "silver",  Decimal("0.08"), Decimal("1.25")),
    (Decimal("1000"),   "bronze",  Decimal("0.05"), Decimal("1.00")),
]


def get_tier(amount: Decimal) -> dict:
    """Return tier metadata for the given staked amount."""
    for min_stake, name, apy, boost in _TIER_TABLE:
        if amount >= min_stake:
            return {"tier": name, "apy": float(apy), "rep_boost": float(boost)}
    return {"tier": "none", "apy": 0.0, "rep_boost": 1.0}


def calculate_rewards(staked_amount: Decimal, apy: float, from_dt: datetime, to_dt: datetime) -> Decimal:
    """Accrue proportional rewards for the time window [from_dt, to_dt]."""
    if staked_amount <= 0 or from_dt >= to_dt:
        return Decimal("0")
    elapsed_days = (to_dt - from_dt).total_seconds() / 86_400
    annual_reward = staked_amount * Decimal(str(apy))
    return annual_reward * Decimal(str(elapsed_days)) / Decimal("365")


# ---------------------------------------------------------------------------
# SQLAlchemy ORM models
# ---------------------------------------------------------------------------


class StakingPositionTable(Base):
    """One row per wallet, upserted on every stake/unstake action."""

    __tablename__ = "staking_positions"

    wallet_address = Column(String(64), primary_key=True, index=True)
    staked_amount = Column(Numeric(precision=20, scale=6), nullable=False, default=Decimal("0"))
    staked_at = Column(DateTime(timezone=True), nullable=True)
    last_reward_claim = Column(DateTime(timezone=True), nullable=True)
    rewards_accrued = Column(Numeric(precision=20, scale=6), nullable=False, default=Decimal("0"))
    cooldown_started_at = Column(DateTime(timezone=True), nullable=True)
    unstake_amount = Column(Numeric(precision=20, scale=6), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class StakingEventTable(Base):
    """Immutable event log — one row per on-chain or lifecycle action."""

    __tablename__ = "staking_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_address = Column(String(64), nullable=False, index=True)
    event_type = Column(String(32), nullable=False)   # stake | unstake_initiated | unstake_completed | reward_claimed
    amount = Column(Numeric(precision=20, scale=6), nullable=False, default=Decimal("0"))
    rewards_amount = Column(Numeric(precision=20, scale=6), nullable=True)
    signature = Column(String(128), nullable=True)    # on-chain tx hash
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class StakeRequest(BaseModel):
    """Record an on-chain stake transaction."""

    wallet_address: str = Field(..., min_length=32, max_length=64)
    amount: float = Field(..., gt=0, description="FNDRY amount staked (UI units)")
    signature: str = Field(..., min_length=1, description="Confirmed on-chain tx signature")

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class UnstakeInitiateRequest(BaseModel):
    """Begin the 7-day unstake cooldown. No on-chain tx required."""

    wallet_address: str = Field(..., min_length=32, max_length=64)
    amount: float = Field(..., gt=0, description="Amount to unstake")


class UnstakeCompleteRequest(BaseModel):
    """Complete unstake after cooldown expires."""

    wallet_address: str = Field(..., min_length=32, max_length=64)
    signature: str = Field(..., min_length=1, description="On-chain withdrawal tx signature")


class ClaimRewardsRequest(BaseModel):
    """Claim all available rewards for this wallet."""

    wallet_address: str = Field(..., min_length=32, max_length=64)


class StakingPositionResponse(BaseModel):
    """Full staking position returned by the API."""

    wallet_address: str
    staked_amount: float
    tier: str
    apy: float
    rep_boost: float
    staked_at: Optional[str]
    last_reward_claim: Optional[str]
    rewards_earned: float         # lifetime rewards claimed
    rewards_available: float      # claimable right now
    cooldown_started_at: Optional[str]
    cooldown_ends_at: Optional[str]
    cooldown_active: bool
    unstake_ready: bool
    unstake_amount: float


class StakingEventResponse(BaseModel):
    """Single staking event for the history table."""

    id: str
    wallet_address: str
    event_type: str
    amount: float
    rewards_amount: Optional[float]
    signature: Optional[str]
    created_at: str


class StakingHistoryResponse(BaseModel):
    items: list[StakingEventResponse]
    total: int


class StakingStats(BaseModel):
    """Global platform staking statistics."""

    total_staked: float
    total_stakers: int
    total_rewards_paid: float
    avg_apy: float
    tier_distribution: dict[str, int]
