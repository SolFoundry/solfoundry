"""Bounty database and Pydantic models."""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class BountyTier(int, Enum):
    T1 = 1
    T2 = 2
    T3 = 3


class BountyStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    PAID = "paid"


class ClaimStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    EXPIRED = "expired"
    RELEASED = "released"
    REJECTED = "rejected"


VALID_STATUS_TRANSITIONS: dict[BountyStatus, set[BountyStatus]] = {
    BountyStatus.OPEN: {BountyStatus.IN_PROGRESS},
    BountyStatus.IN_PROGRESS: {BountyStatus.COMPLETED, BountyStatus.OPEN},
    BountyStatus.COMPLETED: {BountyStatus.PAID, BountyStatus.IN_PROGRESS},
    BountyStatus.PAID: set(),
}

TIER_REP_REQUIREMENTS: dict[BountyTier, int] = {
    BountyTier.T1: 0, BountyTier.T2: 10, BountyTier.T3: 50,
}
TIER_DEADLINE_DAYS: dict[BountyTier, int] = {
    BountyTier.T1: 0, BountyTier.T2: 7, BountyTier.T3: 14,
}


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


class ClaimRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bounty_id: str
    contributor_id: str
    status: ClaimStatus = ClaimStatus.ACTIVE
    application_text: Optional[str] = None
    claimed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deadline: Optional[datetime] = None
    released_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ClaimCreate(BaseModel):
    contributor_id: str
    application_text: Optional[str] = None


class ClaimResponse(BaseModel):
    id: str
    bounty_id: str
    contributor_id: str
    status: ClaimStatus
    application_text: Optional[str] = None
    claimed_at: datetime
    deadline: Optional[datetime] = None
    released_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class BountyBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field("", max_length=5000)
    tier: BountyTier = BountyTier.T2
    reward_amount: float = Field(..., gt=0)
    github_issue_url: Optional[str] = None
    required_skills: list[str] = []
    deadline: Optional[datetime] = None
    min_reputation: Optional[int] = None
    created_by: str = "system"


class BountyCreate(BountyBase):
    @field_validator("required_skills")
    @classmethod
    def normalise_skills(cls, v: list[str]) -> list[str]:
        return [s.strip().lower() for s in v if s.strip()]


class BountyUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    status: Optional[BountyStatus] = None
    reward_amount: Optional[float] = Field(None, gt=0)
    required_skills: Optional[list[str]] = None
    deadline: Optional[datetime] = None

    @field_validator("required_skills")
    @classmethod
    def normalise_skills(cls, v):
        if v is None:
            return v
        return [s.strip().lower() for s in v if s.strip()]


class BountyDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str = ""
    tier: BountyTier = BountyTier.T2
    reward_amount: float
    status: BountyStatus = BountyStatus.OPEN
    github_issue_url: Optional[str] = None
    required_skills: list[str] = []
    deadline: Optional[datetime] = None
    min_reputation: Optional[int] = None
    created_by: str = "system"
    active_claim_id: Optional[str] = None
    claim_history: list[ClaimRecord] = []
    submissions: list[SubmissionRecord] = []
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
    required_skills: list[str] = []
    deadline: Optional[datetime] = None
    min_reputation: int
    created_by: str
    active_claim: Optional[ClaimResponse] = None
    claim_count: int = 0
    submissions: list[SubmissionResponse] = []
    submission_count: int = 0
    created_at: datetime
    updated_at: datetime


class BountyListItem(BaseModel):
    id: str
    title: str
    tier: BountyTier
    reward_amount: float
    status: BountyStatus
    required_skills: list[str] = []
    deadline: Optional[datetime] = None
    created_by: str
    submission_count: int = 0
    claim_count: int = 0
    created_at: datetime


class BountyListResponse(BaseModel):
    items: list[BountyListItem]
    total: int
    skip: int
    limit: int
