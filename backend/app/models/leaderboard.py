"""Leaderboard SQLAlchemy and Pydantic models."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Float, Integer, String, func
from sqlalchemy.orm import DeclarativeBase


# ---------------------------------------------------------------------------
# SQLAlchemy models
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


class Contributor(Base):
    __tablename__ = "contributors"

    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String, unique=True, index=True, nullable=False)
    display_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    total_contributions = Column(Integer, default=0)
    total_earnings = Column(Float, default=0.0)
    rank = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Contribution(Base):
    __tablename__ = "contributions"

    id = Column(Integer, primary_key=True, index=True)
    contributor_id = Column(Integer, index=True, nullable=False)
    task_id = Column(String, nullable=True)
    type = Column(String, nullable=False)  # pr, issue, review, code
    amount = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class TimeFilter(str, Enum):
    weekly = "weekly"
    monthly = "monthly"
    all_time = "all_time"


class SortField(str, Enum):
    rank = "rank"
    contributions = "contributions"
    earnings = "earnings"


class ContributorBrief(BaseModel):
    id: int
    wallet_address: str
    display_name: str
    avatar_url: Optional[str] = None
    total_contributions: int
    total_earnings: float
    rank: int

    model_config = {"from_attributes": True}


class LeaderboardResponse(BaseModel):
    items: list[ContributorBrief]
    total: int
    page: int
    limit: int
    pages: int


class ContributionDetail(BaseModel):
    id: int
    task_id: Optional[str] = None
    type: str
    amount: float
    created_at: datetime

    model_config = {"from_attributes": True}


class ContributorDetail(BaseModel):
    id: int
    wallet_address: str
    display_name: str
    avatar_url: Optional[str] = None
    total_contributions: int
    total_earnings: float
    rank: int
    contributions: list[ContributionDetail] = Field(default_factory=list)

    model_config = {"from_attributes": True}
