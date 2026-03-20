"""Leaderboard Pydantic models."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TimePeriod(str, Enum):
    week = "week"
    month = "month"
    all = "all"


class TierFilter(str, Enum):
    t1 = "1"
    t2 = "2"
    t3 = "3"


class CategoryFilter(str, Enum):
    frontend = "frontend"
    backend = "backend"
    security = "security"
    docs = "docs"
    devops = "devops"


class LeaderboardEntry(BaseModel):
    """Single row on the leaderboard."""

    rank: int
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    total_earned: float = 0.0
    bounties_completed: int = 0
    reputation_score: int = 0
    wallet_address: Optional[str] = None

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
