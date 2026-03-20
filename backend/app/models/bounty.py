"""Bounty Pydantic models for the CRUD API (Issue #3).

This module defines all data models used by the bounty endpoints:
create, read, update, delete, and solution submission schemas.

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
    """Bounty difficulty and reward tier.

    Attributes:
        T1: Tier 1 -- small tasks, lowest reward.
        T2: Tier 2 -- medium tasks, standard reward.
        T3: Tier 3 -- large tasks, highest reward.
    """

    T1 = 1
    T2 = 2
    T3 = 3


class BountyStatus(str, Enum):
    """Lifecycle status of a bounty.

    Attributes:
        OPEN: Bounty is open and accepting submissions.
        IN_PROGRESS: Work has begun on the bounty.
        COMPLETED: Work is done, pending payout.
        PAID: Bounty has been paid out (terminal state).
    """

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    PAID = "paid"


VALID_STATUS_TRANSITIONS: dict[BountyStatus, set[BountyStatus]] = {
    BountyStatus.OPEN: {BountyStatus.IN_PROGRESS},
    BountyStatus.IN_PROGRESS: {BountyStatus.COMPLETED, BountyStatus.OPEN},
    BountyStatus.COMPLETED: {BountyStatus.PAID, BountyStatus.IN_PROGRESS},
    BountyStatus.PAID: set(),  # terminal
}
"""Allowed status transitions enforced by the update endpoint."""


# ---------------------------------------------------------------------------
# Constraints
# ---------------------------------------------------------------------------

TITLE_MIN_LENGTH = 3
"""Minimum length for a bounty title."""

TITLE_MAX_LENGTH = 200
"""Maximum length for a bounty title."""

DESCRIPTION_MAX_LENGTH = 5000
"""Maximum length for a bounty description."""

REWARD_MIN = 0.01
"""Minimum reward amount in USD."""

REWARD_MAX = 1_000_000.0
"""Maximum reward amount in USD."""

MAX_SKILLS = 20
"""Maximum number of required skills per bounty."""

SKILL_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_.+-]{0,49}$")
"""Regex pattern for valid skill identifiers."""


# ---------------------------------------------------------------------------
# Submission models
# ---------------------------------------------------------------------------

class SubmissionRecord(BaseModel):
    """Internal storage representation of a bounty submission.

    Attributes:
        id: Unique identifier (UUID) for the submission.
        bounty_id: The ID of the bounty this submission belongs to.
        pr_url: GitHub pull request URL.
        submitted_by: Username or identifier of the submitter.
        notes: Optional notes from the submitter.
        submitted_at: UTC timestamp when the submission was created.
    """

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bounty_id: str
    pr_url: str
    submitted_by: str
    notes: Optional[str] = None
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SubmissionCreate(BaseModel):
    """Request payload for submitting a solution to a bounty.

    Attributes:
        pr_url: GitHub pull request URL (must start with https://github.com/).
        submitted_by: Username or identifier of the submitter (max 100 chars).
        notes: Optional notes from the submitter (max 1000 chars).
    """

    pr_url: str = Field(..., min_length=1)
    submitted_by: str = Field(..., min_length=1, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator("pr_url")
    @classmethod
    def validate_pr_url(cls, v: str) -> str:
        """Validate that the PR URL is a GitHub URL.

        Args:
            v: The PR URL string to validate.

        Returns:
            The validated URL string.

        Raises:
            ValueError: If the URL does not start with a GitHub domain.
        """
        if not v.startswith(("https://github.com/", "http://github.com/")):
            raise ValueError("pr_url must be a valid GitHub URL")
        return v


class SubmissionResponse(BaseModel):
    """API response schema for a single submission.

    Attributes:
        id: Unique submission identifier.
        bounty_id: The associated bounty ID.
        pr_url: GitHub pull request URL.
        submitted_by: Who submitted the solution.
        notes: Optional submitter notes.
        submitted_at: UTC timestamp of submission.
    """

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
    """Normalise and validate a list of skill identifiers.

    Skills are lowercased, stripped of whitespace, and checked against
    the SKILL_PATTERN regex. Empty strings are silently dropped.

    Args:
        skills: Raw list of skill strings from user input.

    Returns:
        List of normalised, validated skill strings.

    Raises:
        ValueError: If too many skills are provided or a skill does not
            match the allowed pattern.
    """
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
    """Request payload for creating a new bounty.

    Attributes:
        title: Short title for the bounty (3-200 chars).
        description: Detailed description of the work required.
        tier: Difficulty/reward tier (defaults to T2).
        reward_amount: Payment amount in USD (0.01 - 1,000,000).
        github_issue_url: Optional link to the related GitHub issue.
        required_skills: List of skill identifiers needed for this bounty.
        deadline: Optional deadline for the bounty.
        created_by: Identifier of the bounty creator (defaults to "system").
    """

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
        """Normalise and validate the required_skills list.

        Args:
            v: Raw list of skill strings.

        Returns:
            Normalised list of valid skill identifiers.
        """
        return _validate_skills(v)

    @field_validator("github_issue_url")
    @classmethod
    def validate_github_url(cls, v: Optional[str]) -> Optional[str]:
        """Validate that the GitHub issue URL points to github.com.

        Args:
            v: The URL to validate, or None.

        Returns:
            The validated URL, or None if not provided.

        Raises:
            ValueError: If the URL does not start with a GitHub domain.
        """
        if v is not None and not v.startswith(("https://github.com/", "http://github.com/")):
            raise ValueError("github_issue_url must be a GitHub URL")
        return v


class BountyUpdate(BaseModel):
    """Request payload for partially updating a bounty (PATCH semantics).

    All fields are optional. Only provided fields are applied.

    Attributes:
        title: Updated title (3-200 chars).
        description: Updated description.
        status: New status (validated against allowed transitions).
        reward_amount: Updated reward amount.
        required_skills: Replacement list of required skills.
        deadline: Updated deadline.
    """

    title: Optional[str] = Field(None, min_length=TITLE_MIN_LENGTH, max_length=TITLE_MAX_LENGTH)
    description: Optional[str] = Field(None, max_length=DESCRIPTION_MAX_LENGTH)
    status: Optional[BountyStatus] = None
    reward_amount: Optional[float] = Field(None, ge=REWARD_MIN, le=REWARD_MAX)
    required_skills: Optional[list[str]] = None
    deadline: Optional[datetime] = None

    @field_validator("required_skills")
    @classmethod
    def normalise_skills(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        """Normalise and validate the required_skills list if provided.

        Args:
            v: Raw list of skill strings, or None.

        Returns:
            Normalised list of valid skill identifiers, or None.
        """
        if v is None:
            return v
        return _validate_skills(v)


class BountyDB(BaseModel):
    """Internal in-memory storage model for a bounty.

    This model is used by the service layer to store bounties in memory.
    It is not exposed directly via the API.

    Attributes:
        id: Unique identifier (UUID) generated on creation.
        title: Bounty title.
        description: Detailed description.
        tier: Difficulty/reward tier.
        reward_amount: Payment amount in USD.
        status: Current lifecycle status.
        github_issue_url: Optional link to the GitHub issue.
        required_skills: List of required skill identifiers.
        deadline: Optional deadline.
        created_by: Identifier of the bounty creator.
        submissions: List of solution submissions.
        created_at: UTC timestamp of creation.
        updated_at: UTC timestamp of last update.
    """

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BountyResponse(BaseModel):
    """Full bounty detail returned by GET and mutation endpoints.

    Attributes:
        id: Unique bounty identifier.
        title: Bounty title.
        description: Detailed description.
        tier: Difficulty/reward tier.
        reward_amount: Payment amount in USD.
        status: Current lifecycle status.
        github_issue_url: Optional link to the GitHub issue.
        required_skills: List of required skill identifiers.
        deadline: Optional deadline.
        created_by: Identifier of the bounty creator.
        submissions: List of solution submissions.
        submission_count: Total number of submissions.
        created_at: UTC timestamp of creation.
        updated_at: UTC timestamp of last update.
    """

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
    submissions: list[SubmissionResponse] = Field(default_factory=list)
    submission_count: int = 0
    created_at: datetime
    updated_at: datetime


class BountyListItem(BaseModel):
    """Compact bounty representation used in list responses.

    Omits submissions and description to keep list payloads small.

    Attributes:
        id: Unique bounty identifier.
        title: Bounty title.
        tier: Difficulty/reward tier.
        reward_amount: Payment amount in USD.
        status: Current lifecycle status.
        required_skills: List of required skill identifiers.
        deadline: Optional deadline.
        created_by: Identifier of the bounty creator.
        submission_count: Total number of submissions.
        created_at: UTC timestamp of creation.
    """

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
    """Paginated list of bounties.

    Attributes:
        items: List of bounty summaries for the current page.
        total: Total number of bounties matching the query.
        skip: Number of items skipped (offset).
        limit: Maximum items per page.
    """

    items: list[BountyListItem]
    total: int
    skip: int
    limit: int
