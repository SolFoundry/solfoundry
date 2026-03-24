"""Bounty specification models for YAML-based bounty templates and validation.

This module defines the data models for bounty spec templates, validation rules,
and the database table for persisting validated specs. Bounty specs are YAML
documents that define all required fields for a bounty issue before it goes live.

Spec format enforces:
- Required fields per tier (title, description, tier, reward, requirements, category, deadline)
- Reward ranges per tier (T1: 50K-200K, T2: 200K-500K, T3: 500K-1M $FNDRY)
- Valid categories from the SolFoundry taxonomy
- Deadline must be in the future
- Auto-generated labels from tier and category
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
    Boolean,
    Index,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.database import Base


# ---------------------------------------------------------------------------
# Constants — tier reward ranges and valid categories
# ---------------------------------------------------------------------------

VALID_SPEC_CATEGORIES: set[str] = {
    "smart-contract",
    "frontend",
    "backend",
    "design",
    "content",
    "security",
    "devops",
    "documentation",
}

TIER_REWARD_RANGES: dict[int, tuple[Decimal, Decimal]] = {
    1: (Decimal("50000"), Decimal("200000")),
    2: (Decimal("200001"), Decimal("500000")),
    3: (Decimal("500001"), Decimal("1000000")),
}

TIER_REQUIRED_FIELDS: dict[int, set[str]] = {
    1: {"title", "description", "tier", "reward", "category"},
    2: {"title", "description", "tier", "reward", "requirements", "category", "deadline"},
    3: {"title", "description", "tier", "reward", "requirements", "category", "deadline"},
}

TIER_OPTIONAL_FIELDS: dict[int, set[str]] = {
    1: {"requirements", "deadline", "skills", "github_issue_url", "created_by"},
    2: {"skills", "github_issue_url", "created_by"},
    3: {"skills", "github_issue_url", "created_by"},
}

# Minimum description lengths per tier (higher tiers need more detail)
TIER_MIN_DESCRIPTION_LENGTH: dict[int, int] = {
    1: 20,
    2: 50,
    3: 100,
}

# Minimum requirements count per tier
TIER_MIN_REQUIREMENTS_COUNT: dict[int, int] = {
    1: 0,  # optional for T1
    2: 2,
    3: 3,
}


class SpecValidationSeverity(str, Enum):
    """Severity level for spec validation findings.

    Used to distinguish between hard failures that block issue creation
    and warnings that should be addressed but do not prevent creation.
    """

    ERROR = "error"
    WARNING = "warning"


# ---------------------------------------------------------------------------
# Pydantic models — request/response schemas
# ---------------------------------------------------------------------------


class SpecValidationFinding(BaseModel):
    """A single validation finding (error or warning) from spec linting.

    Attributes:
        field: The spec field that triggered the finding, or 'general' for cross-field issues.
        severity: Whether this is a blocking error or an advisory warning.
        message: Human-readable description of the issue and how to fix it.
    """

    field: str = Field(..., description="The spec field that triggered this finding")
    severity: SpecValidationSeverity = Field(
        ..., description="Whether this is a blocking error or advisory warning"
    )
    message: str = Field(
        ..., description="Human-readable description of the issue and fix"
    )


class BountySpecInput(BaseModel):
    """Input model for a bounty spec YAML document.

    This represents the parsed contents of a bounty spec YAML file.
    All fields that could appear in a spec are defined here; required-ness
    depends on the tier and is validated by the spec service.

    Attributes:
        title: Short descriptive title for the bounty (3-200 chars).
        description: Detailed description of what the bounty requires.
        tier: Bounty difficulty tier (1, 2, or 3).
        reward: Reward amount in $FNDRY tokens (must fall within tier range).
        requirements: List of acceptance criteria / checkboxes.
        category: One of the valid SolFoundry bounty categories.
        deadline: ISO 8601 deadline for submissions (must be in the future).
        skills: Optional list of required skills/technologies.
        github_issue_url: Optional link to an existing GitHub issue.
        created_by: Identity of the spec author (defaults to 'system').
    """

    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=1)
    tier: int = Field(..., ge=1, le=3)
    reward: Decimal = Field(..., gt=0)
    requirements: list[str] = Field(default_factory=list)
    category: str = Field(...)
    deadline: Optional[datetime] = None
    skills: list[str] = Field(default_factory=list)
    github_issue_url: Optional[str] = None
    created_by: str = Field(default="system", min_length=1, max_length=100)

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        """Validate that category is one of the allowed SolFoundry categories.

        Args:
            value: The category string to validate.

        Returns:
            The lowercase-normalized category string.

        Raises:
            ValueError: If category is not in the allowed set.
        """
        normalized = value.strip().lower()
        if normalized not in VALID_SPEC_CATEGORIES:
            raise ValueError(
                f"Invalid category '{value}'. Must be one of: "
                f"{sorted(VALID_SPEC_CATEGORIES)}"
            )
        return normalized

    @field_validator("requirements")
    @classmethod
    def validate_requirements_not_empty_strings(cls, value: list[str]) -> list[str]:
        """Filter out empty requirement strings.

        Args:
            value: List of requirement strings to validate.

        Returns:
            Filtered list with only non-empty requirement strings.
        """
        return [r.strip() for r in value if r.strip()]

    @field_validator("skills")
    @classmethod
    def validate_skills_format(cls, value: list[str]) -> list[str]:
        """Normalize and validate skill tags.

        Args:
            value: List of skill strings to validate.

        Returns:
            Normalized list of lowercase skill strings.
        """
        return [s.strip().lower() for s in value if s.strip()]

    @field_validator("github_issue_url")
    @classmethod
    def validate_github_url(cls, value: Optional[str]) -> Optional[str]:
        """Validate that github_issue_url points to GitHub if provided.

        Args:
            value: Optional GitHub URL to validate.

        Returns:
            The validated URL or None.

        Raises:
            ValueError: If URL does not start with a GitHub domain.
        """
        if value is not None and not value.startswith(
            ("https://github.com/", "http://github.com/")
        ):
            raise ValueError("github_issue_url must be a valid GitHub URL")
        return value


class SpecValidationResult(BaseModel):
    """Result of validating a bounty spec against tier-specific rules.

    Attributes:
        valid: Whether the spec passes all required validation checks (no errors).
        findings: List of all validation findings (errors and warnings).
        error_count: Number of blocking errors found.
        warning_count: Number of advisory warnings found.
        spec: The original spec input that was validated (echoed back).
        labels: Auto-generated GitHub labels based on tier and category.
    """

    valid: bool = Field(
        ..., description="Whether the spec passes all required checks"
    )
    findings: list[SpecValidationFinding] = Field(
        default_factory=list, description="All validation findings"
    )
    error_count: int = Field(
        0, description="Number of blocking errors"
    )
    warning_count: int = Field(
        0, description="Number of advisory warnings"
    )
    spec: Optional[BountySpecInput] = Field(
        None, description="The validated spec (echoed back)"
    )
    labels: list[str] = Field(
        default_factory=list, description="Auto-generated GitHub labels"
    )


class BountySpecTemplate(BaseModel):
    """Template definition for a bounty spec at a specific tier.

    Provides example values and documents which fields are required vs optional
    for the given tier.

    Attributes:
        tier: The bounty tier this template is for (1, 2, or 3).
        tier_label: Human-readable tier label (e.g., 'Tier 1 — Starter').
        required_fields: Set of field names that must be present.
        optional_fields: Set of field names that may be included.
        reward_range_min: Minimum allowed reward for this tier.
        reward_range_max: Maximum allowed reward for this tier.
        min_description_length: Minimum description character count.
        min_requirements_count: Minimum number of acceptance criteria.
        example: A complete example spec for this tier.
    """

    tier: int = Field(..., ge=1, le=3)
    tier_label: str
    required_fields: list[str]
    optional_fields: list[str]
    reward_range_min: Decimal
    reward_range_max: Decimal
    min_description_length: int
    min_requirements_count: int
    example: dict[str, Any]


class BountySpecTemplateListResponse(BaseModel):
    """Response containing all available bounty spec templates.

    Attributes:
        templates: List of tier-specific bounty spec templates.
        categories: All valid bounty categories.
    """

    templates: list[BountySpecTemplate]
    categories: list[str]


class BountySpecCreateResponse(BaseModel):
    """Response after creating a bounty from a validated spec.

    Attributes:
        bounty_id: The ID of the newly created bounty.
        spec_id: The ID of the persisted spec record.
        labels: Auto-generated labels applied to the bounty.
        validation: The validation result for the spec.
    """

    bounty_id: str
    spec_id: str
    labels: list[str]
    validation: SpecValidationResult


class BatchSpecResult(BaseModel):
    """Result of processing a single spec in a batch creation operation.

    Attributes:
        filename: The source YAML filename.
        success: Whether the spec was successfully created as a bounty.
        bounty_id: The created bounty ID (if successful).
        spec_id: The persisted spec ID (if successful).
        labels: Auto-generated labels (if successful).
        error: Error message (if validation failed).
        findings: Validation findings (if validation failed).
    """

    filename: str
    success: bool
    bounty_id: Optional[str] = None
    spec_id: Optional[str] = None
    labels: list[str] = Field(default_factory=list)
    error: Optional[str] = None
    findings: list[SpecValidationFinding] = Field(default_factory=list)


class BatchCreateResponse(BaseModel):
    """Response from batch bounty creation.

    Attributes:
        total: Total number of specs processed.
        created: Number of bounties successfully created.
        failed: Number of specs that failed validation.
        results: Per-spec detailed results.
    """

    total: int
    created: int
    failed: int
    results: list[BatchSpecResult]


# ---------------------------------------------------------------------------
# SQLAlchemy model — persisted bounty specs
# ---------------------------------------------------------------------------


class BountySpecTable(Base):
    """SQLAlchemy model for persisting validated bounty specs.

    Stores the original spec YAML content alongside validation metadata,
    enabling audit trails and spec versioning. Each spec is linked to the
    bounty it created via bounty_id.
    """

    __tablename__ = "bounty_specs"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Unique spec identifier",
    )
    bounty_id = Column(
        String(100),
        nullable=True,
        index=True,
        comment="ID of the bounty created from this spec",
    )
    title = Column(
        String(200), nullable=False, comment="Bounty title from spec"
    )
    description = Column(
        Text, nullable=False, comment="Full bounty description from spec"
    )
    tier = Column(
        Integer, nullable=False, comment="Bounty tier (1, 2, or 3)"
    )
    reward = Column(
        Numeric(precision=18, scale=2),
        nullable=False,
        comment="Reward amount in $FNDRY",
    )
    category = Column(
        String(50), nullable=False, comment="Bounty category"
    )
    requirements = Column(
        JSONB,
        nullable=False,
        server_default="[]",
        comment="List of acceptance criteria",
    )
    skills = Column(
        JSONB,
        nullable=False,
        server_default="[]",
        comment="Required skills/technologies",
    )
    labels = Column(
        JSONB,
        nullable=False,
        server_default="[]",
        comment="Auto-generated labels",
    )
    deadline = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Submission deadline",
    )
    created_by = Column(
        String(100),
        nullable=False,
        server_default="system",
        comment="Spec author identity",
    )
    is_valid = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="Whether spec passed validation",
    )
    validation_errors = Column(
        JSONB,
        nullable=False,
        server_default="[]",
        comment="Validation findings at time of creation",
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="When the spec was first validated",
    )

    __table_args__ = (
        Index("ix_bounty_specs_tier", tier),
        Index("ix_bounty_specs_category", category),
        Index("ix_bounty_specs_created_by", created_by),
        Index("ix_bounty_specs_is_valid", is_valid),
    )
