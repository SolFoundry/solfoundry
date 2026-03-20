"""Bounty Pydantic models for CRUD API (Issue #3) and Claiming System (Issue #16).

Covers: create, read, update, delete, solution submission, and claim lifecycle.
"""

import re
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class BountyTier(int, Enum):
    """Bounty difficulty / reward tier."""
    T1 = 1
    T2 = 2
    T3 = 3


class BountyStatus(str, Enum):
    """Lifecycle status of a bounty."""
    OPEN = "open"
    CLAIMED = "claimed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    PAID = "paid"


# All valid status values
VALID_STATUSES = {BountyStatus.OPEN, BountyStatus.CLAIMED, BountyStatus.IN_PROGRESS, BountyStatus.COMPLETED, BountyStatus.PAID}

VALID_STATUS_TRANSITIONS: dict[BountyStatus, set[BountyStatus]] = {
    BountyStatus.OPEN: {BountyStatus.CLAIMED},
    BountyStatus.CLAIMED: {BountyStatus.OPEN, BountyStatus.IN_PROGRESS},
    BountyStatus.IN_PROGRESS: {BountyStatus.COMPLETED, BountyStatus.OPEN},
    BountyStatus.COMPLETED: {BountyStatus.PAID, BountyStatus.IN_PROGRESS},
    BountyStatus.PAID: set(),  # terminal
}


# ---------------------------------------------------------------------------
# Constraints
# ---------------------------------------------------------------------------

TITLE_MIN_LENGTH = 3
TITLE_MAX_LENGTH = 200
DESCRIPTION_MAX_LENGTH = 5000
REWARD_MIN = 0.01
REWARD_MAX = 1_000_000.0
MAX_SKILLS = 20
SKILL_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_.+-]{0,49}$")


# ---------------------------------------------------------------------------
# Claim configuration (Issue #16)
# ---------------------------------------------------------------------------

# Tier-specific claim rules
T2_CLAIM_DEADLINE_DAYS = 7
T3_CLAIM_DEADLINE_DAYS = 14

# Reputation gates
T2_MIN_REPUTATION = 10
T3_MIN_REPUTATION = 50


class ClaimStatus(str, Enum):
    """Status of a claim."""
    ACTIVE = "active"
    RELEASED = "released"
    COMPLETED = "completed"
    EXPIRED = "expired"


# ---------------------------------------------------------------------------
# Submission models
# ---------------------------------------------------------------------------

class SubmissionRecord(BaseModel):
    """Internal storage representation of a submission."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bounty_id: str
    pr_url: str
    submitted_by: str
    notes: Optional[str] = None
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SubmissionCreate(BaseModel):
    """Payload for submitting a solution."""
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
    """API response for a single submission."""
    id: str
    bounty_id: str
    pr_url: str
    submitted_by: str
    notes: Optional[str] = None
    submitted_at: datetime


# ---------------------------------------------------------------------------
# Claim models (Issue #16)
# ---------------------------------------------------------------------------

class ClaimHistoryRecord(BaseModel):
    """Record of a claim event in the bounty's history."""
    claimant_id: str
    claimed_at: datetime
    deadline: datetime
    status: ClaimStatus = ClaimStatus.ACTIVE
    released_at: Optional[datetime] = None
    release_reason: Optional[str] = None


class BountyClaimRequest(BaseModel):
    """Payload for claiming a bounty.
    
    Security: claimant_id and reputation are obtained from authentication context,
    not from client input to prevent forgery.
    """
    application: Optional[str] = Field(None, max_length=2000, description="Application plan (required for T3)")


class BountyUnclaimRequest(BaseModel):
    """Payload for releasing a claim."""
    reason: Optional[str] = Field(None, max_length=500, description="Optional reason for releasing")


class BountyClaimantResponse(BaseModel):
    """Response for getting current claimant info."""
    bounty_id: str
    claimant_id: str
    claimed_at: datetime
    deadline: datetime
    status: BountyStatus


class BountyClaimHistoryResponse(BaseModel):
    """Response for claim history endpoint."""
    bounty_id: str
    items: list[ClaimHistoryRecord]
    total: int


# ---------------------------------------------------------------------------
# Bounty models
# ---------------------------------------------------------------------------

def _validate_skills(skills: list[str]) -> list[str]:
    """Normalise and validate a skill list."""
    normalised = [s.strip().lower() for s in skills if s.strip()]
    if len(normalised) > MAX_SKILLS:
        raise ValueError(f"Too many skills (max {MAX_SKILLS})")
    for s in normalised:
        if not SKILL_PATTERN.match(s):
            raise ValueError(
                f"Invalid skill format: '{s}'. "
                "Skills must be lowercase alphanumeric, may contain . + - _"
            )
    return normalised


class BountyCreate(BaseModel):
    """Payload for creating a new bounty."""
    title: str = Field(..., min_length=TITLE_MIN_LENGTH, max_length=TITLE_MAX_LENGTH)
    description: str = Field("", max_length=DESCRIPTION_MAX_LENGTH)
    tier: BountyTier = BountyTier.T2
    reward_amount: float = Field(..., ge=REWARD_MIN, le=REWARD_MAX)
    github_issue_url: Optional[str] = None
    required_skills: list[str] = Field(default_factory=list)
    deadline: Optional[datetime] = None
    created_by: str = Field("system", min_length=1, max_length=100)

    @field_validator("required_skills")
    @classmethod
    def normalise_skills(cls, v: list[str]) -> list[str]:
        return _validate_skills(v)

    @field_validator("github_issue_url")
    @classmethod
    def validate_github_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.startswith(("https://github.com/", "http://github.com/")):
            raise ValueError("github_issue_url must be a GitHub URL")
        return v


class BountyUpdate(BaseModel):
    """Payload for partially updating a bounty (PATCH semantics)."""
    title: Optional[str] = Field(None, min_length=TITLE_MIN_LENGTH, max_length=TITLE_MAX_LENGTH)
    description: Optional[str] = Field(None, max_length=DESCRIPTION_MAX_LENGTH)
    status: Optional[BountyStatus] = None
    reward_amount: Optional[float] = Field(None, ge=REWARD_MIN, le=REWARD_MAX)
    required_skills: Optional[list[str]] = None
    deadline: Optional[datetime] = None

    @field_validator("required_skills")
    @classmethod
    def normalise_skills(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is None:
            return v
        return _validate_skills(v)


class BountyDB(BaseModel):
    """Internal in-memory storage model. Not exposed directly via API."""
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
    # Claim fields (Issue #16)
    claimant_id: Optional[str] = None
    claimed_at: Optional[datetime] = None
    claim_deadline: Optional[datetime] = None
    claim_history: list[ClaimHistoryRecord] = Field(default_factory=list)
    # Submissions
    submissions: list[SubmissionRecord] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BountyResponse(BaseModel):
    """Full bounty detail returned by GET /bounties/{id} and mutations."""
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
    # Claim fields (Issue #16)
    claimant_id: Optional[str] = None
    claimed_at: Optional[datetime] = None
    claim_deadline: Optional[datetime] = None
    submissions: list[SubmissionResponse] = Field(default_factory=list)
    submission_count: int = 0
    created_at: datetime
    updated_at: datetime


class BountyListItem(BaseModel):
    """Compact bounty representation for list endpoints."""
    id: str
    title: str
    tier: BountyTier
    reward_amount: float
    status: BountyStatus
    required_skills: list[str] = Field(default_factory=list)
    deadline: Optional[datetime] = None
    created_by: str
    claimant_id: Optional[str] = None
    submission_count: int = 0
    created_at: datetime


class BountyListResponse(BaseModel):
    """Paginated list of bounties."""
    items: list[BountyListItem]
    total: int
    skip: int
    limit: int