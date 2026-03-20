"""Bounty Pydantic models for CRUD API (Issue #3).

Covers: create, read, update, delete, and solution submission.
Claim lifecycle is out of scope (see Issue #16).
"""

import re
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, List

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
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    PAID = "paid"


class BountyCategory(str, Enum):
    """Bounty work category."""
    FRONTEND = "frontend"
    BACKEND = "backend"
    SMART_CONTRACT = "smart_contract"
    DOCUMENTATION = "documentation"
    TESTING = "testing"
    INFRASTRUCTURE = "infrastructure"
    OTHER = "other"


VALID_STATUS_TRANSITIONS: dict[BountyStatus, set[BountyStatus]] = {
    BountyStatus.OPEN: {BountyStatus.IN_PROGRESS},
    BountyStatus.IN_PROGRESS: {BountyStatus.COMPLETED, BountyStatus.OPEN},
    BountyStatus.COMPLETED: {BountyStatus.PAID, BountyStatus.IN_PROGRESS},
    BountyStatus.PAID: set(),  # terminal
}

VALID_CATEGORIES = frozenset({c.value for c in BountyCategory})
VALID_SORTS = frozenset({"newest", "reward_high", "reward_low", "deadline", "popularity"})


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
    category: str = Field("other", description="Bounty category")
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
    category: Optional[str] = None
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
    category: str = "other"
    reward_amount: float
    status: BountyStatus = BountyStatus.OPEN
    github_issue_url: Optional[str] = None
    required_skills: list[str] = Field(default_factory=list)
    deadline: Optional[datetime] = None
    created_by: str = "system"
    submissions: list[SubmissionRecord] = Field(default_factory=list)
    popularity: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BountyResponse(BaseModel):
    """Full bounty detail returned by GET /bounties/{id} and mutations."""
    id: str
    title: str
    description: str
    tier: BountyTier
    category: str = "other"
    reward_amount: float
    status: BountyStatus
    github_issue_url: Optional[str] = None
    required_skills: list[str] = Field(default_factory=list)
    deadline: Optional[datetime] = None
    created_by: str
    submissions: list[SubmissionResponse] = Field(default_factory=list)
    submission_count: int = 0
    popularity: int = 0
    created_at: datetime
    updated_at: datetime


class BountyListItem(BaseModel):
    """Compact bounty representation for list endpoints."""
    id: str
    title: str
    description: str = ""
    tier: BountyTier
    category: str = "other"
    reward_amount: float
    status: BountyStatus
    required_skills: list[str] = Field(default_factory=list)
    deadline: Optional[datetime] = None
    created_by: str
    submission_count: int = 0
    popularity: int = 0
    created_at: datetime


class BountyListResponse(BaseModel):
    """Paginated list of bounties."""
    items: list[BountyListItem]
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
        """Parse comma-separated skills string into list."""
        if not self.skills:
            return None
        return [s.strip() for s in self.skills.split(",") if s.strip()]


class AutocompleteSuggestion(BaseModel):
    """Single autocomplete suggestion."""
    text: str
    type: str  # "title" or "skill"


class AutocompleteResponse(BaseModel):
    """Response for autocomplete endpoint."""
    suggestions: List[AutocompleteSuggestion]