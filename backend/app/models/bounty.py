"""Bounty database and Pydantic models.

This module defines the data models for the bounty system including
database models (ORM) and API models (Pydantic schemas).

The search_vector column is automatically maintained by a database trigger,
ensuring consistency between the bounty data and the search index.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Column, String, DateTime, JSON, Float, Integer, Text, Index
from sqlalchemy.dialects.postgresql import UUID, TSVECTOR

from app.database import Base


# Constants for validation
VALID_CATEGORIES = frozenset({
    "frontend", "backend", "smart_contract", 
    "documentation", "testing", "infrastructure", "other"
})

VALID_STATUSES = frozenset({
    "open", "claimed", "completed", "cancelled"
})


class BountyTier(int, Enum):
    """Bounty difficulty tier."""
    TIER_1 = 1  # Simple tasks, 72-hour deadline
    TIER_2 = 2  # Medium tasks, 7-day deadline
    TIER_3 = 3  # Complex tasks, 30-day deadline


class BountyStatus(str, Enum):
    """Bounty lifecycle status."""
    OPEN = "open"
    CLAIMED = "claimed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class BountyCategory(str, Enum):
    """Bounty work category."""
    FRONTEND = "frontend"
    BACKEND = "backend"
    SMART_CONTRACT = "smart_contract"
    DOCUMENTATION = "documentation"
    TESTING = "testing"
    INFRASTRUCTURE = "infrastructure"
    OTHER = "other"


class BountyDB(Base):
    """
    Bounty database model with full-text search support.
    
    The search_vector column is automatically populated by a database trigger
    whenever title or description changes. This ensures the search index
    is always in sync with the data.
    """
    __tablename__ = "bounties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    tier = Column(Integer, nullable=False, default=1)
    category = Column(String(50), nullable=False, default="other")
    status = Column(String(20), nullable=False, default="open", index=True)
    reward_amount = Column(Float, nullable=False, default=0.0)
    reward_token = Column(String(20), nullable=False, default="FNDRY")
    deadline = Column(DateTime(timezone=True), nullable=True)
    skills = Column(JSON, default=list, nullable=False)
    github_issue_url = Column(String(500), nullable=True)
    github_issue_number = Column(Integer, nullable=True)
    github_repo = Column(String(255), nullable=True)
    claimant_id = Column(UUID(as_uuid=True), nullable=True)
    winner_id = Column(UUID(as_uuid=True), nullable=True)
    popularity = Column(Integer, default=0, nullable=False)
    search_vector = Column(TSVECTOR, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index('ix_bounties_search_vector', search_vector, postgresql_using='gin'),
        Index('ix_bounties_status_tier', status, tier),
        Index('ix_bounties_status_category', status, category),
        Index('ix_bounties_reward', reward_amount),
        Index('ix_bounties_deadline', deadline),
        Index('ix_bounties_popularity', popularity),
    )


# Pydantic models

class BountyBase(BaseModel):
    """Base fields shared across bounty schemas."""
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    tier: int = Field(1, ge=1, le=3)
    category: str = Field("other")
    reward_amount: float = Field(0.0, ge=0)
    reward_token: str = Field("FNDRY")
    deadline: Optional[datetime] = None
    skills: List[str] = Field(default_factory=list)

    @field_validator('category')
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in VALID_CATEGORIES:
            raise ValueError(f"Invalid category: {v}")
        return v


class BountyCreate(BountyBase):
    """Schema for creating a new bounty."""
    github_issue_url: Optional[str] = None
    github_issue_number: Optional[int] = None
    github_repo: Optional[str] = None


class BountyUpdate(BaseModel):
    """Schema for updating an existing bounty."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, min_length=1)
    tier: Optional[int] = Field(None, ge=1, le=3)
    category: Optional[str] = None
    status: Optional[str] = None
    reward_amount: Optional[float] = Field(None, ge=0)
    deadline: Optional[datetime] = None
    skills: Optional[List[str]] = None

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"Invalid status: {v}")
        return v


class BountyResponse(BountyBase):
    """Full bounty response."""
    id: str
    status: str
    github_issue_url: Optional[str] = None
    github_issue_number: Optional[int] = None
    github_repo: Optional[str] = None
    claimant_id: Optional[str] = None
    winner_id: Optional[str] = None
    popularity: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class BountyListItem(BaseModel):
    """Brief bounty info for list views."""
    id: str
    title: str
    description: str
    tier: int
    category: str
    status: str
    reward_amount: float
    reward_token: str
    deadline: Optional[datetime] = None
    skills: List[str] = Field(default_factory=list)
    popularity: int = 0
    created_at: datetime
    model_config = {"from_attributes": True}


class BountyListResponse(BaseModel):
    """Paginated bounty list response."""
    items: List[BountyListItem]
    total: int
    skip: int
    limit: int


class BountySearchParams(BaseModel):
    """Parameters for bounty search endpoint."""
    q: Optional[str] = None
    tier: Optional[int] = Field(None, ge=1, le=3)
    category: Optional[str] = None
    status: Optional[str] = None
    reward_min: Optional[float] = Field(None, ge=0)
    reward_max: Optional[float] = Field(None, ge=0)
    skills: Optional[str] = None
    sort: str = Field("newest", pattern="^(newest|reward_high|reward_low|deadline|popularity)$")
    skip: int = Field(0, ge=0)
    limit: int = Field(20, ge=1, le=100)
    
    def get_skills_list(self) -> Optional[List[str]]:
        if not self.skills:
            return None
        return [s.strip() for s in self.skills.split(",") if s.strip()]


class AutocompleteSuggestion(BaseModel):
    text: str
    type: str


class AutocompleteResponse(BaseModel):
    suggestions: List[AutocompleteSuggestion]