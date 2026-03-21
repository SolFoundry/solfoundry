"""Contributor database and Pydantic models."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import Column, String, DateTime, JSON, Float, Integer, Text, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class ContributorDB(Base):
    __tablename__ = "contributors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    bio = Column(Text, nullable=True)
    skills = Column(JSON, default=list, nullable=False)
    badges = Column(JSON, default=list, nullable=False)
    social_links = Column(JSON, default=dict, nullable=False)
    total_contributions = Column(Integer, default=0, nullable=False)
    total_bounties_completed = Column(Integer, default=0, nullable=False)
    total_earnings = Column(Float, default=0.0, nullable=False)
    reputation_score = Column(Float, default=0.0, nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    reputation_history = relationship("ReputationHistoryDB", back_populates="contributor", cascade="all, delete-orphan")


class ReputationHistoryDB(Base):
    """SQLAlchemy model for contributor reputation events."""

    __tablename__ = "reputation_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contributor_id = Column(UUID(as_uuid=True), ForeignKey("contributors.id"), nullable=False, index=True)
    bounty_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    bounty_title = Column(String(255), nullable=False)
    bounty_tier = Column(Integer, nullable=False)
    review_score = Column(Float, nullable=False)
    earned_reputation = Column(Float, nullable=False)
    anti_farming_applied = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    contributor = relationship("ContributorDB", back_populates="reputation_history")


class ContributorBase(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    skills: list[str] = []
    badges: list[str] = []
    social_links: dict = {}


class ContributorCreate(ContributorBase):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")


class ContributorUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[list[str]] = None
    badges: Optional[list[str]] = None
    social_links: Optional[dict] = None


class ContributorStats(BaseModel):
    total_contributions: int = 0
    total_bounties_completed: int = 0
    total_earnings: float = 0.0
    reputation_score: int = 0


class ContributorResponse(ContributorBase):
    id: str
    username: str
    stats: ContributorStats
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ContributorListItem(BaseModel):
    id: str
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    skills: list[str] = []
    badges: list[str] = []
    stats: ContributorStats
    model_config = {"from_attributes": True}


class ContributorListResponse(BaseModel):
    items: list[ContributorListItem]
    total: int
    skip: int
    limit: int
