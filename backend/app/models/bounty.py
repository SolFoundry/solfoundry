"""Bounty Pydantic models for CRUD API (Issue #3).

Covers: create, read, update, delete, and solution submission.
Claim lifecycle is out of scope (see Issue #16).
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
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    PAID = "paid"


class CreatorType(str, Enum):
    """Distinguishes platform-created bounties from community-created ones."""

    PLATFORM = "platform"
    COMMUNITY = "community"


VALID_STATUS_TRANSITIONS: dict[BountyStatus, set[BountyStatus]] = {
    BountyStatus.OPEN: {BountyStatus.IN_PROGRESS},
    BountyStatus.IN_PROGRESS: {BountyStatus.COMPLETED, BountyStatus.OPEN},
    BountyStatus.COMPLETED: {BountyStatus.PAID, BountyStatus.IN_PROGRESS},
    BountyStatus.PAID: set(),  # terminal
}

# Valid status values for webhook processor
VALID_STATUSES: set[str] = {status.value for status in BountyStatus}


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
WALLET_PATTERN = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")


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
    reward_amount: float = Field(..., ge=REWARD_MIN, le=REWARD_MAX)
    github_issue_url: Optional[str] = None
    required_skills: list[str] = Field(default_factory=list)
    deadline: Optional[datetime] = None
    created_by: str = Field("system", min_length=1, max_length=100)
    creator_wallet: Optional[str] = Field(
        None, description="Solana wallet address of the bounty creator"
    )
    creator_type: CreatorType = Field(
        CreatorType.COMMUNITY,
        description="Whether this bounty was created by the platform or community",
    )

    @field_validator("required_skills")
    @classmethod
    def normalise_skills(cls, v: list[str]) -> list[str]:
        return _validate_skills(v)

    @field_validator("github_issue_url")
    @classmethod
    def validate_github_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.startswith(
            ("https://github.com/", "http://github.com/")
        ):
            raise ValueError("github_issue_url must be a GitHub URL")
        return v

    @field_validator("creator_wallet")
    @classmethod
    def validate_wallet_address(cls, v: Optional[str]) -> Optional[str]:
        """Validate Solana wallet address format (base58, 32-44 chars)."""
        if v is not None and not WALLET_PATTERN.match(v):
            raise ValueError("creator_wallet must be a valid Solana address (base58)")
        return v


class BountyUpdate(BaseModel):
    """Payload for partially updating a bounty (PATCH semantics)."""

    title: Optional[str] = Field(
        None, min_length=TITLE_MIN_LENGTH, max_length=TITLE_MAX_LENGTH
    )
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
    creator_wallet: Optional[str] = None
    creator_type: CreatorType = CreatorType.COMMUNITY
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
    creator_wallet: Optional[str] = None
    creator_type: str = "community"
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
    github_issue_url: Optional[str] = None
    deadline: Optional[datetime] = None
    created_by: str
    creator_wallet: Optional[str] = None
    creator_type: str = "community"
    submission_count: int = 0
    created_at: datetime


class BountyListResponse(BaseModel):
    """Paginated list of bounties."""

    items: list[BountyListItem]
    total: int
    skip: int
    limit: int


# ---------------------------------------------------------------------------
# Search models
# ---------------------------------------------------------------------------

VALID_SORT_FIELDS = {
    "newest",
    "reward_high",
    "reward_low",
    "deadline",
    "submissions",
    "best_match",
}

VALID_CATEGORIES = {
    "smart-contract",
    "frontend",
    "backend",
    "design",
    "content",
    "security",
    "devops",
    "documentation",
}


class BountySearchParams(BaseModel):
    """Parameters for the bounty search endpoint."""

    q: str = Field("", max_length=200, description="Full-text search query")
    status: Optional[BountyStatus] = None
    tier: Optional[int] = Field(None, ge=1, le=3)
    skills: list[str] = Field(default_factory=list)
    category: Optional[str] = None
    creator_type: Optional[str] = Field(
        None, pattern=r"^(platform|community)$", description="platform or community"
    )
    reward_min: Optional[float] = Field(None, ge=0)
    reward_max: Optional[float] = Field(None, ge=0)
    deadline_before: Optional[datetime] = None
    sort: str = Field("newest", description="Sort order")
    page: int = Field(1, ge=1)
    per_page: int = Field(20, ge=1, le=100)

    @field_validator("sort")
    @classmethod
    def validate_sort(cls, v: str) -> str:
        if v not in VALID_SORT_FIELDS:
            raise ValueError(f"Invalid sort. Must be one of: {VALID_SORT_FIELDS}")
        return v

    @field_validator("reward_max")
    @classmethod
    def validate_reward_range(cls, v: Optional[float], info) -> Optional[float]:
        reward_min = info.data.get("reward_min")
        if v is not None and reward_min is not None and v < reward_min:
            raise ValueError("reward_max must be >= reward_min")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_CATEGORIES:
            raise ValueError(f"Invalid category. Must be one of: {VALID_CATEGORIES}")
        return v


class BountySearchResult(BountyListItem):
    """A single search result with relevance metadata."""

    description: str = ""
    relevance_score: float = 0.0
    skill_match_count: int = 0


class BountySearchResponse(BaseModel):
    """Paginated search results."""

    items: list[BountySearchResult]
    total: int
    page: int
    per_page: int
    query: str = ""


class AutocompleteItem(BaseModel):
    """A single autocomplete suggestion."""

    text: str
    type: str  # "title" or "skill"
    bounty_id: Optional[str] = None


class AutocompleteResponse(BaseModel):
    """Autocomplete suggestions."""

    suggestions: list[AutocompleteItem]
