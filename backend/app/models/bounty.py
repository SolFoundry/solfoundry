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

    DRAFT = "draft"
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    UNDER_REVIEW = "under_review"
    COMPLETED = "completed"
    DISPUTED = "disputed"
    PAID = "paid"
    CANCELLED = "cancelled"


VALID_STATUS_TRANSITIONS: dict[BountyStatus, set[BountyStatus]] = {
    BountyStatus.DRAFT: {BountyStatus.OPEN, BountyStatus.CANCELLED},
    BountyStatus.OPEN: {BountyStatus.IN_PROGRESS, BountyStatus.CANCELLED},
    BountyStatus.IN_PROGRESS: {BountyStatus.COMPLETED, BountyStatus.OPEN, BountyStatus.UNDER_REVIEW, BountyStatus.CANCELLED},
    BountyStatus.UNDER_REVIEW: {BountyStatus.COMPLETED, BountyStatus.IN_PROGRESS, BountyStatus.DISPUTED, BountyStatus.CANCELLED},
    BountyStatus.COMPLETED: {BountyStatus.PAID, BountyStatus.IN_PROGRESS, BountyStatus.DISPUTED},
    BountyStatus.DISPUTED: {BountyStatus.COMPLETED, BountyStatus.CANCELLED, BountyStatus.IN_PROGRESS},
    BountyStatus.PAID: set(),  # terminal
    BountyStatus.CANCELLED: set(),  # terminal
}

class SubmissionStatus(str, Enum):
    """Lifecycle status of a solution submission."""

    PENDING = "pending"
    APPROVED = "approved"
    DISPUTED = "disputed"
    PAID = "paid"
    REJECTED = "rejected"

VALID_SUBMISSION_TRANSITIONS: dict[SubmissionStatus, set[SubmissionStatus]] = {
    SubmissionStatus.PENDING: {SubmissionStatus.APPROVED, SubmissionStatus.DISPUTED, SubmissionStatus.REJECTED},
    SubmissionStatus.APPROVED: {SubmissionStatus.PAID, SubmissionStatus.DISPUTED},
    SubmissionStatus.DISPUTED: {SubmissionStatus.APPROVED, SubmissionStatus.REJECTED},
    SubmissionStatus.PAID: set(),
    SubmissionStatus.REJECTED: set(),
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


# ---------------------------------------------------------------------------
# Submission models
# ---------------------------------------------------------------------------


class SubmissionRecord(BaseModel):
    """Internal storage representation of a submission."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bounty_id: str
    pr_url: str
    submitted_by: str
    contributor_wallet: Optional[str] = None
    notes: Optional[str] = None
    status: SubmissionStatus = SubmissionStatus.PENDING
    ai_score: float = 0.0
    ai_scores_by_model: dict[str, float] = Field(default_factory=dict)
    review_complete: bool = False
    meets_threshold: bool = False
    auto_approve_eligible: bool = False
    auto_approve_after: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    payout_tx_hash: Optional[str] = None
    payout_amount: Optional[float] = None
    payout_at: Optional[datetime] = None
    winner: bool = False
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SubmissionCreate(BaseModel):
    """Payload for submitting a solution."""

    pr_url: str = Field(..., min_length=1)
    submitted_by: str = Field("system", min_length=1, max_length=100)
    contributor_wallet: Optional[str] = Field(None, min_length=32, max_length=64)
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator("pr_url")
    @classmethod
    def validate_pr_url(cls, v: str) -> str:
        """Ensure pr_url is a valid GitHub URL."""
        if not v.startswith(("https://github.com/", "http://github.com/")):
            raise ValueError("pr_url must be a valid GitHub URL")
        return v


class SubmissionResponse(BaseModel):
    """API response for a single submission."""

    id: str
    bounty_id: str
    pr_url: str
    submitted_by: str
    contributor_wallet: Optional[str] = None
    notes: Optional[str] = None
    status: SubmissionStatus = SubmissionStatus.PENDING
    ai_score: float = 0.0
    ai_scores_by_model: dict[str, float] = Field(default_factory=dict)
    review_complete: bool = False
    meets_threshold: bool = False
    auto_approve_eligible: bool = False
    auto_approve_after: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    payout_tx_hash: Optional[str] = None
    payout_amount: Optional[float] = None
    payout_at: Optional[datetime] = None
    winner: bool = False
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


class SubmissionStatusUpdate(BaseModel):
    """Request model for updating submission status."""

    status: str


class BountyBase(BaseModel):
    """Base fields for all bounty models."""

    title: str = Field(
        ...,
        min_length=TITLE_MIN_LENGTH,
        max_length=TITLE_MAX_LENGTH,
        description="Clear, concise title for the bounty",
        examples=["Implement full-text search in FastAPI"],
    )
    description: str = Field(
        ...,
        max_length=DESCRIPTION_MAX_LENGTH,
        description="Detailed requirements and acceptance criteria (Markdown supported)",
        examples=["We need to add PostgreSQL-backed full-text search to our existing bounty API..."],
    )
    tier: BountyTier = Field(
        ...,
        description="Bounty difficulty and reward tier (T1, T2, or T3)",
        examples=[BountyTier.T1],
    )
    category: Optional[str] = Field(
        None,
        description="Broad category for the task (e.g., backend, frontend, docs)",
        examples=["backend"],
    )
    reward_amount: float = Field(
        ...,
        ge=REWARD_MIN,
        le=REWARD_MAX,
        description="Reward amount in USD-equivalent (Solana/FNDRY tokens)",
        examples=[500.0],
    )
    required_skills: list[str] = Field(
        default_factory=list,
        max_length=MAX_SKILLS,
        description="List of required technical skills",
        examples=[["python", "postgresql", "fastapi"]],
    )
    github_issue_url: Optional[str] = Field(
        None,
        description="Direct link to the tracking GitHub issue",
        examples=["https://github.com/codebestia/solfoundry/issues/123"],
    )
    deadline: Optional[datetime] = Field(
        None,
        description="Optional deadline for the bounty",
        examples=[datetime(2024, 12, 31, 23, 59, 59, tzinfo=timezone.utc)],
    )
    created_by: str = Field(
        "system",
        min_length=1,
        max_length=100,
        description="Identifier of the user or system that created the bounty",
        examples=["user_123", "platform_admin"],
    )

    @field_validator("required_skills")
    @classmethod
    def normalise_skills(cls, v: list[str]) -> list[str]:
        """Normalise skill strings to lowercase, trimmed format."""
        return _validate_skills(v)

    @field_validator("github_issue_url")
    @classmethod
    def validate_github_url(cls, v: Optional[str]) -> Optional[str]:
        """Ensure github_issue_url is a valid GitHub URL."""
        if v is not None and not v.startswith(
            ("https://github.com/", "http://github.com/")
        ):
            raise ValueError("github_issue_url must be a GitHub URL")
        return v


class BountyCreate(BountyBase):
    """Payload for creating a new bounty."""

    description: str = Field("", max_length=DESCRIPTION_MAX_LENGTH) # Override default for creation
    tier: BountyTier = BountyTier.T2 # Override default for creation


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
        """Normalise skill strings to lowercase, trimmed format."""
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
    submissions: list[SubmissionRecord] = Field(default_factory=list)
    winner_submission_id: Optional[str] = None
    winner_wallet: Optional[str] = None
    payout_tx_hash: Optional[str] = None
    payout_at: Optional[datetime] = None
    # Claim fields (T2/T3)
    claimed_by: Optional[str] = None
    claimed_at: Optional[datetime] = None
    claim_deadline: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BountyResponse(BountyBase):
    """Full details of a bounty for API responses."""

    id: str = Field(..., description="Unique UUID for the bounty", examples=["550e8400-e29b-41d4-a716-446655440000"])
    status: BountyStatus = Field(..., description="Current state of the bounty", examples=[BountyStatus.OPEN])
    created_at: datetime = Field(..., description="Timestamp when the bounty was created")
    updated_at: datetime = Field(..., description="Timestamp of the last update")
    github_issue_number: Optional[int] = Field(None, description="The GitHub issue number", examples=[123])
    github_repo: Optional[str] = Field(None, description="The full repository name (org/repo)", examples=["codebestia/solfoundry"])
    winner_submission_id: Optional[str] = Field(None, description="ID of the winning submission")
    winner_wallet: Optional[str] = Field(None, description="Wallet address of the winner")
    payout_tx_hash: Optional[str] = Field(None, description="Solana transaction hash for the payout")
    payout_at: Optional[datetime] = Field(None, description="When the payout was made")
    # Claim fields
    claimed_by: Optional[str] = Field(None, description="Who claimed this bounty (T2/T3)")
    claimed_at: Optional[datetime] = Field(None, description="When the bounty was claimed")
    claim_deadline: Optional[datetime] = Field(None, description="Deadline for the claim")

    model_config = {"from_attributes": True}
    submissions: list[SubmissionResponse] = Field(default_factory=list)
    submission_count: int = 0


class BountyListItem(BaseModel):
    """Compact bounty representation for list endpoints."""

    id: str
    title: str
    tier: BountyTier
    reward_amount: float
    status: BountyStatus
    category: Optional[str] = None
    required_skills: list[str] = Field(default_factory=list)
    github_issue_url: Optional[str] = None
    deadline: Optional[datetime] = None
    created_by: str
    submissions: list[SubmissionResponse] = Field(default_factory=list)
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
    creator_id: Optional[str] = Field(None, description="Filter by creator's ID/wallet")
    reward_min: Optional[float] = Field(None, ge=0)
    reward_max: Optional[float] = Field(None, ge=0)
    deadline_before: Optional[datetime] = None
    sort: str = Field("newest", description="Sort order")
    page: int = Field(1, ge=1)
    per_page: int = Field(20, ge=1, le=100)

    @field_validator("sort")
    @classmethod
    def validate_sort(cls, v: str) -> str:
        """Ensure sort value is one of the allowed sort fields."""
        if v not in VALID_SORT_FIELDS:
            raise ValueError(f"Invalid sort. Must be one of: {VALID_SORT_FIELDS}")
        return v

    @field_validator("reward_max")
    @classmethod
    def validate_reward_range(cls, v: Optional[float], info) -> Optional[float]:
        """Ensure reward_max is >= reward_min."""
        reward_min = info.data.get("reward_min")
        if v is not None and reward_min is not None and v < reward_min:
            raise ValueError("reward_max must be >= reward_min")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        """Ensure category is one of the allowed values."""
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
