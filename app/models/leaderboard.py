from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class LeaderboardType(str, Enum):
    GLOBAL = "global"
    MONTHLY = "monthly"
    WEEKLY = "weekly"
    DAILY = "daily"


class SortOrder(str, Enum):
    ASC = "asc"
    DESC = "desc"


class LeaderboardQueryParams(BaseModel):
    type: LeaderboardType = Field(default=LeaderboardType.GLOBAL, description="Type of leaderboard")
    limit: int = Field(default=10, ge=1, le=100, description="Number of results to return")
    offset: int = Field(default=0, ge=0, description="Number of results to skip")
    sort_by: str = Field(default="score", description="Field to sort by")
    sort_order: SortOrder = Field(default=SortOrder.DESC, description="Sort order")
    user_id: Optional[int] = Field(default=None, description="Specific user to highlight in results")


class UserRanking(BaseModel):
    user_id: int
    username: str
    score: float
    rank: int
    avatar_url: Optional[str] = None
    level: Optional[int] = None
    achievements_count: Optional[int] = None
    last_activity: Optional[datetime] = None


class LeaderboardResponse(BaseModel):
    type: LeaderboardType
    rankings: List[UserRanking]
    total_users: int
    current_user_rank: Optional[UserRanking] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    last_updated: datetime


class LeaderboardStats(BaseModel):
    total_participants: int
    average_score: float
    highest_score: float
    lowest_score: float
    score_distribution: dict


class UserLeaderboardPosition(BaseModel):
    user_id: int
    global_rank: int
    monthly_rank: Optional[int] = None
    weekly_rank: Optional[int] = None
    daily_rank: Optional[int] = None
    percentile: float
    score: float
    score_change_24h: Optional[float] = None
    rank_change_24h: Optional[int] = None