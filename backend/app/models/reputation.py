"""Pydantic models for the contributor reputation system.

PostgreSQL migration path: reputation_history table (contributor_id FK,
bounty_id, tier, review_score, earned_reputation, anti_farming_applied).
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ReputationBadge(str, Enum):
    """Badge awarded based on cumulative reputation score."""

    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    DIAMOND = "diamond"


class ContributorTier(str, Enum):
    """Access tier for bounty participation."""

    T1 = "T1"
    T2 = "T2"
    T3 = "T3"


BADGE_THRESHOLDS = {
    ReputationBadge.BRONZE: 10.0,
    ReputationBadge.SILVER: 30.0,
    ReputationBadge.GOLD: 60.0,
    ReputationBadge.DIAMOND: 90.0,
}

TIER_REQUIREMENTS = {
    ContributorTier.T1: {"merged_bounties": 0, "required_tier": None},
    ContributorTier.T2: {"merged_bounties": 4, "required_tier": ContributorTier.T1},
    ContributorTier.T3: {"merged_bounties": 3, "required_tier": ContributorTier.T2},
}

ANTI_FARMING_THRESHOLD = 4
VETERAN_SCORE_BUMP = 0.5


class ReputationHistoryEntry(BaseModel):
    """Single reputation event tied to a completed bounty."""

    entry_id: str
    contributor_id: str
    bounty_id: str
    bounty_title: str
    bounty_tier: int = Field(..., ge=1, le=3)
    review_score: float = Field(..., ge=0.0, le=10.0)
    earned_reputation: float = Field(..., ge=0)
    anti_farming_applied: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    model_config = {"from_attributes": True}


class TierProgressionDetail(BaseModel):
    """Breakdown of tier progression status."""

    current_tier: ContributorTier
    tier1_completions: int = 0
    tier2_completions: int = 0
    tier3_completions: int = 0
    next_tier: Optional[ContributorTier] = None
    bounties_until_next_tier: int = 0
    model_config = {"from_attributes": True}


class ReputationSummary(BaseModel):
    """Full reputation profile for GET /contributors/{id}/reputation."""

    contributor_id: str
    username: str
    display_name: str
    reputation_score: float = 0.0
    badge: Optional[ReputationBadge] = None
    tier_progression: TierProgressionDetail
    is_veteran: bool = False
    total_bounties_completed: int = 0
    average_review_score: float = 0.0
    history: list[ReputationHistoryEntry] = Field(default_factory=list)
    model_config = {"from_attributes": True}


class ReputationRecordCreate(BaseModel):
    """Payload to record reputation for a completed bounty."""

    contributor_id: str = Field(..., min_length=1)
    bounty_id: str = Field(..., min_length=1)
    bounty_title: str = Field(..., min_length=1, max_length=200)
    bounty_tier: int = Field(..., ge=1, le=3)
    review_score: float = Field(..., ge=0.0, le=10.0)
