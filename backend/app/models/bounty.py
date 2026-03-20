"""Bounty Pydantic models for CRUD API (Issue #3)."""

import re
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Column, String, DateTime, JSON, Float, Integer, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class BountyTier(int, Enum):
    T1 = 1
    T2 = 2
    T3 = 3


class BountyStatus(str, Enum):
    OPEN = "open"
    CLAIMED = "claimed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    PAID = "paid"


VALID_STATUS_TRANSITIONS = {
    BountyStatus.OPEN: {BountyStatus.CLAIMED, BountyStatus.IN_PROGRESS},
    BountyStatus.CLAIMED: {BountyStatus.IN_PROGRESS, BountyStatus.OPEN},
    BountyStatus.IN_PROGRESS: {BountyStatus.COMPLETED, BountyStatus.OPEN},
    BountyStatus.COMPLETED: {BountyStatus.PAID, BountyStatus.IN_PROGRESS},
    BountyStatus.PAID: set(),
}

TITLE_MIN_LENGTH = 3
TITLE_MAX_LENGTH = 200
REWARD_MIN = 0.01
REWARD_MAX = 1_000_000.0
MAX_SKILLS = 20
SKILL_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_.+-]{0,49}$")
VALID_STATUSES = frozenset({"open", "claimed", "in_progress", "completed", "paid"})


class ClaimHistoryRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bounty_id: str
    claimant_id: str
    action: str
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BountyClaimRequest(BaseModel):
    claimant_id: str = Field(..., min_length=1, max_length=100)


class BountyUnclaimRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=1000)


class BountyClaimantResponse(BaseModel):
    bounty_id: str
    claimant_id: str
    claimed_at: datetime
    status: str


class BountyClaimHistoryItem(BaseModel):
    id: str
    bounty_id: str
    claimant_id: str
    action: str
    reason: Optional[str] = None
    created_at: datetime


class BountyClaimHistoryResponse(BaseModel):
    items: list[BountyClaimHistoryItem]
    total: int
    skip: int
    limit: int


class SubmissionRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bounty_id: str
    pr_url: str
    submitted_by: str
    notes: Optional[str] = None
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SubmissionCreate(BaseModel):
    pr_url: str = Field(..., min_length=1)
    submitted_by: str = Field(..., min_length=1, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator("pr_url")
    @classmethod
    def validate_pr_url(cls, v: str) -> str:
        if not v.startswith(("https://github.com/", "http://github.com/")):
            raise ValueError("pr_url must be a valid GitHub URL")
        return v


class SubmissionResponse(BaseModel):
    id: str
    bounty_id: str
    pr_url: str
    submitted_by: str
    notes: Optional[str] = None
    submitted_at: datetime


def _validate_skills(skills: list[str]) -> list[str]:
    normalised = [s.strip().lower() for s in skills if s.strip()]
    if len(normalised) > MAX_SKILLS:
        raise ValueError(f"Too many skills (max {MAX_SKILLS})")
    for s in normalised:
        if not SKILL_PATTERN.match(s):
            raise ValueError(f"Invalid skill format: '{s}'")
    return normalised


class BountyCreate(BaseModel):
    title: str = Field(..., min_length=TITLE_MIN_LENGTH, max_length=TITLE_MAX_LENGTH)
    description: str = Field("")
    tier: BountyTier = BountyTier.T2
    reward_amount: float = Field(..., ge=REWARD_MIN, le=REWARD_MAX)
    github_issue_url: Optional[str] = None
    required_skills: list[str] = Field(default_factory=list)
    deadline: Optional[datetime] = None
    created_by: str = Field("system")

    @field_validator("required_skills")
    @classmethod
    def normalise_skills(cls, v: list[str]) -> list[str]:
        return _validate_skills(v)


class BountyUpdate(BaseModel):
    title: Optional[str] = Field(None)
    description: Optional[str] = Field(None)
    status: Optional[BountyStatus] = None
    reward_amount: Optional[float] = Field(None)
    required_skills: Optional[list[str]] = None
    deadline: Optional[datetime] = None

    @field_validator("required_skills")
    @classmethod
    def normalise_skills(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        return _validate_skills(v) if v else v


class BountyDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str = ""
    tier: BountyTier = BountyTier.T2
    reward_amount: float
    status: BountyStatus = BountyStatus.OPEN
    github_issue_url: Optional[str] = None
    required_skills: list[str] = Field(default_factory=list)
    deadline: Optional[datetime] = None
    created_by: str = "system"
    claimant_id: Optional[str] = None
    claim_history: list[ClaimHistoryRecord] = Field(default_factory=list)
    submissions: list[SubmissionRecord] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BountyResponse(BaseModel):
    id: str
    title: str
    description: str
    tier: BountyTier
    reward_amount: float
    status: BountyStatus
    github_issue_url: Optional[str] = None
    required_skills: list[str] = Field(default_factory=list)
    deadline: Optional[datetime] = None
    created_by: str
    claimant_id: Optional[str] = None
    claimed_at: Optional[datetime] = None
    submissions: list[SubmissionResponse] = Field(default_factory=list)
    submission_count: int = 0
    created_at: datetime
    updated_at: datetime


class BountyListItem(BaseModel):
    id: str
    title: str
    tier: BountyTier
    reward_amount: float
    status: BountyStatus
    required_skills: list[str] = Field(default_factory=list)
    deadline: Optional[datetime] = None
    created_by: str
    submission_count: int = 0
    created_at: datetime


class BountyListResponse(BaseModel):
    items: list[BountyListItem]
    total: int
    skip: int
    limit: int


# =============================================================================
# SQLAlchemy ORM Models (for database persistence)
# =============================================================================

class BountyDBORM(Base):
    """
    Bounty database model for persistent storage.
    
    This SQLAlchemy ORM model maps to the 'bounties' table in PostgreSQL.
    It is used by the webhook processor and other services that require
    persistent storage.
    """
    __tablename__ = "bounties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False, default="")
    tier = Column(Integer, nullable=False, default=2)
    status = Column(String(20), nullable=False, default="open", index=True)
    reward_amount = Column(Float, nullable=False)
    github_issue_url = Column(String(500), nullable=True)
    required_skills = Column(JSON, default=list, nullable=False)
    deadline = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(100), nullable=False, default="system")
    claimant_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))