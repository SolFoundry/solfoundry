"""Bounty database and API schemas."""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import DateTime, Float, Index, Integer, String, Text, Uuid
from sqlalchemy import JSON as SAJSON
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


VALID_CATEGORIES = frozenset(
    {
        "frontend",
        "backend",
        "smart_contract",
        "documentation",
        "testing",
        "infrastructure",
        "other",
    }
)

VALID_STATUSES = frozenset({"open", "claimed", "completed", "cancelled"})

JSON_LIST = SAJSON().with_variant(JSONB(), "postgresql")
SEARCH_VECTOR_TYPE = Text().with_variant(TSVECTOR(), "postgresql")


class BountyTier(int, Enum):
    """Bounty difficulty tier."""

    TIER_1 = 1
    TIER_2 = 2
    TIER_3 = 3


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
    """Bounty ORM model."""

    __tablename__ = "bounties"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    tier: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="other")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open", index=True)
    reward_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    reward_token: Mapped[str] = mapped_column(String(20), nullable=False, default="FNDRY")
    deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    skills: Mapped[List[str]] = mapped_column(JSON_LIST, default=list, nullable=False)
    github_issue_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    github_issue_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    github_repo: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    claimant_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(), nullable=True)
    winner_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(), nullable=True)
    popularity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    search_vector: Mapped[Optional[str]] = mapped_column(SEARCH_VECTOR_TYPE, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_bounties_search_vector", "search_vector", postgresql_using="gin"),
        Index("ix_bounties_status_tier", "status", "tier"),
        Index("ix_bounties_status_category", "status", "category"),
        Index("ix_bounties_reward", "reward_amount"),
        Index("ix_bounties_deadline", "deadline"),
        Index("ix_bounties_popularity", "popularity"),
        Index("ix_bounties_skills", "skills", postgresql_using="gin"),
    )


class BountyBase(BaseModel):
    """Base fields shared across bounty schemas."""

    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    tier: int = Field(1, ge=1, le=3)
    category: str = Field("other")
    reward_amount: float = Field(0.0, ge=0)
    reward_token: str = Field("FNDRY", min_length=1, max_length=20)
    deadline: Optional[datetime] = None
    skills: List[str] = Field(default_factory=list)

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        if value not in VALID_CATEGORIES:
            raise ValueError(f"Invalid category: {value}")
        return value

    @field_validator("reward_token")
    @classmethod
    def normalize_reward_token(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("skills")
    @classmethod
    def normalize_skills(cls, value: List[str]) -> List[str]:
        normalized: List[str] = []
        seen = set()
        for skill in value:
            cleaned = skill.strip()
            if not cleaned:
                continue
            if cleaned.lower() in seen:
                continue
            seen.add(cleaned.lower())
            normalized.append(cleaned)
        return normalized


class BountyCreate(BountyBase):
    """Schema for creating a new bounty."""

    github_issue_url: Optional[str] = None
    github_issue_number: Optional[int] = Field(None, ge=1)
    github_repo: Optional[str] = None


class BountyUpdate(BaseModel):
    """Schema for updating an existing bounty."""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, min_length=1)
    tier: Optional[int] = Field(None, ge=1, le=3)
    category: Optional[str] = None
    status: Optional[str] = None
    reward_amount: Optional[float] = Field(None, ge=0)
    reward_token: Optional[str] = Field(None, min_length=1, max_length=20)
    deadline: Optional[datetime] = None
    skills: Optional[List[str]] = None
    github_issue_url: Optional[str] = None
    github_issue_number: Optional[int] = Field(None, ge=1)
    github_repo: Optional[str] = None
    claimant_id: Optional[uuid.UUID] = None
    winner_id: Optional[uuid.UUID] = None
    popularity: Optional[int] = Field(None, ge=0)

    @field_validator("category")
    @classmethod
    def validate_optional_category(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_CATEGORIES:
            raise ValueError(f"Invalid category: {value}")
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_STATUSES:
            raise ValueError(f"Invalid status: {value}")
        return value

    @field_validator("reward_token")
    @classmethod
    def normalize_optional_reward_token(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip().upper()

    @field_validator("skills")
    @classmethod
    def normalize_optional_skills(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return None
        return BountyBase.normalize_skills(value)


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

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


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

    @field_validator("q", mode="before")
    @classmethod
    def normalize_query(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    def get_skills_list(self) -> Optional[List[str]]:
        if not self.skills:
            return None
        return [skill.strip() for skill in self.skills.split(",") if skill.strip()]


class AutocompleteSuggestion(BaseModel):
    """Single autocomplete item."""

    text: str
    type: str


class AutocompleteResponse(BaseModel):
    """Autocomplete response payload."""

    suggestions: List[AutocompleteSuggestion]
