"""Leaderboard Pydantic models."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TimePeriod(str, Enum):
    """TimePeriod."""

    week = "week"
    month = "month"
    all = "all"


class TierFilter(str, Enum):
    """TierFilter."""

    t1 = "1"
    t2 = "2"
    t3 = "3"


class CategoryFilter(str, Enum):
    """CategoryFilter."""

    frontend = "frontend"
    backend = "backend"
    security = "security"
    docs = "docs"
    devops = "devops"


class LeaderboardEntry(BaseModel):
    """Single row on the leaderboard."""

    rank: int = Field(..., description="Current rank (1-indexed)", examples=[1])
    username: str = Field(..., description="GitHub username", examples=["codemaster"])
    display_name: str = Field(..., description="Display name", examples=["Code Master"])
    avatar_url: Optional[str] = Field(
        None,
        description="URL to user avatar",
        examples=["https://github.com/avatar.png"],
    )
    total_earned: float = Field(
        0.0, description="Total $FNDRY earned", examples=[1250.5]
    )
    bounties_completed: int = Field(
        0, description="Number of bounties completed", examples=[12]
    )
    reputation_score: int = Field(
        0, description="Internal reputation score based on quality", examples=[450]
    )
    wallet_address: Optional[str] = Field(
        None, description="Linked Solana wallet", examples=["BSz85..."]
    )

    model_config = {"from_attributes": True}


class TopContributorMeta(BaseModel):
    """Extra metadata for the top-3 podium."""

    medal: str  # 🥇 🥈 🥉
    join_date: Optional[datetime] = None
    best_bounty_title: Optional[str] = None
    best_bounty_earned: float = 0.0


class TopContributor(LeaderboardEntry):
    """Top-3 entry with extra metadata."""

    meta: TopContributorMeta


class LeaderboardResponse(BaseModel):
    """Full leaderboard API response."""

    period: str
    total: int
    offset: int
    limit: int
    top3: list[TopContributor] = []
    entries: list[LeaderboardEntry] = []
