"""Bounty spec validation and creation service.

This service provides the core business logic for validating bounty specs
against tier-specific rules, generating auto-labels, and creating bounties
from validated specs. It integrates with the existing bounty creation flow
by validating specs before they become bounties.

Key features:
- Fail-closed validation: specs with ANY error are rejected entirely
- Tier-specific reward range enforcement
- Required field checks per tier
- Auto-label generation from tier and category
- PostgreSQL persistence of spec audit records
- Batch creation from multiple YAML files

PostgreSQL migration path:
    CREATE TABLE bounty_specs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bounty_id VARCHAR(100),
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        tier INTEGER NOT NULL,
        reward NUMERIC(18,2) NOT NULL,
        category VARCHAR(50) NOT NULL,
        requirements JSONB NOT NULL DEFAULT '[]',
        skills JSONB NOT NULL DEFAULT '[]',
        labels JSONB NOT NULL DEFAULT '[]',
        deadline TIMESTAMPTZ,
        created_by VARCHAR(100) NOT NULL DEFAULT 'system',
        is_valid BOOLEAN NOT NULL DEFAULT true,
        validation_errors JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX ix_bounty_specs_tier ON bounty_specs(tier);
    CREATE INDEX ix_bounty_specs_category ON bounty_specs(category);
    CREATE INDEX ix_bounty_specs_created_by ON bounty_specs(created_by);
    CREATE INDEX ix_bounty_specs_is_valid ON bounty_specs(is_valid);
"""

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Optional

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bounty import BountyCreate, BountyTier
from app.models.bounty_spec import (
    TIER_MIN_DESCRIPTION_LENGTH,
    TIER_MIN_REQUIREMENTS_COUNT,
    TIER_OPTIONAL_FIELDS,
    TIER_REQUIRED_FIELDS,
    TIER_REWARD_RANGES,
    VALID_SPEC_CATEGORIES,
    BatchCreateResponse,
    BatchSpecResult,
    BountySpecCreateResponse,
    BountySpecInput,
    BountySpecTable,
    BountySpecTemplate,
    BountySpecTemplateListResponse,
    SpecValidationFinding,
    SpecValidationResult,
    SpecValidationSeverity,
)
from app.services import bounty_service

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Template definitions
# ---------------------------------------------------------------------------

TIER_EXAMPLES: dict[int, dict[str, Any]] = {
    1: {
        "title": "Fix typo in README contributing section",
        "description": (
            "The CONTRIBUTING.md file has a typo in the setup instructions. "
            "The command `npm instal` should be `npm install`. Fix the typo "
            "and verify the instructions work end-to-end."
        ),
        "tier": 1,
        "reward": 100000,
        "category": "documentation",
        "requirements": [
            "Fix the typo in CONTRIBUTING.md",
            "Verify instructions work by following them",
        ],
        "skills": ["documentation"],
    },
    2: {
        "title": "Bounty spec templates + CI validation",
        "description": (
            "Create bounty specification templates and a CI validation pipeline "
            "that ensures all bounty issues meet quality standards before going live. "
            "Includes YAML spec format, tier-specific templates, a spec linter CLI, "
            "batch creation scripts, and comprehensive tests."
        ),
        "tier": 2,
        "reward": 300000,
        "category": "devops",
        "deadline": "2026-04-01T23:59:59Z",
        "requirements": [
            "YAML bounty spec format with required fields",
            "Templates for each tier",
            "CI validation workflow config",
            "Reward-within-tier-range checks",
            "Auto-labels from spec (tier, category)",
            "Spec linter: python3 scripts/lint-bounty.py bounty.yaml",
            "Batch creation: python3 scripts/create-bounties.py specs/",
            "Documentation on writing bounty specs",
            "Tests for validation logic",
        ],
        "skills": ["python", "yaml", "devops"],
    },
    3: {
        "title": "Multi-agent bounty review pipeline with consensus scoring",
        "description": (
            "Build a production-grade multi-LLM review pipeline that scores "
            "bounty PR submissions across 6 quality dimensions. Must support "
            "GPT-5.4, Gemini 3.1 Pro, and Grok 4 with configurable weights. "
            "Includes consensus algorithm, outlier dampening, retry logic, "
            "and a dashboard view for review results. Scores determine "
            "auto-merge eligibility per tier threshold."
        ),
        "tier": 3,
        "reward": 750000,
        "category": "backend",
        "deadline": "2026-04-15T23:59:59Z",
        "requirements": [
            "Multi-LLM review endpoint accepting PR diff + spec",
            "Scoring across 6 dimensions (correctness, completeness, etc.)",
            "Consensus algorithm with outlier dampening",
            "Per-tier auto-merge thresholds",
            "Retry logic with exponential backoff",
            "Review results dashboard component",
            "PostgreSQL persistence of all review records",
            "Comprehensive tests with mocked LLM responses",
        ],
        "skills": ["python", "fastapi", "react", "typescript", "postgresql"],
    },
}

TIER_LABELS: dict[int, str] = {
    1: "Tier 1 — Starter",
    2: "Tier 2 — Intermediate",
    3: "Tier 3 — Advanced",
}


def get_templates() -> BountySpecTemplateListResponse:
    """Build and return all tier-specific bounty spec templates.

    Generates template definitions for each tier (T1, T2, T3) including
    required fields, optional fields, reward ranges, and example specs.

    Returns:
        BountySpecTemplateListResponse containing all three tier templates
        and the list of valid categories.
    """
    templates = []
    for tier in (1, 2, 3):
        reward_min, reward_max = TIER_REWARD_RANGES[tier]
        template = BountySpecTemplate(
            tier=tier,
            tier_label=TIER_LABELS[tier],
            required_fields=sorted(TIER_REQUIRED_FIELDS[tier]),
            optional_fields=sorted(TIER_OPTIONAL_FIELDS[tier]),
            reward_range_min=reward_min,
            reward_range_max=reward_max,
            min_description_length=TIER_MIN_DESCRIPTION_LENGTH[tier],
            min_requirements_count=TIER_MIN_REQUIREMENTS_COUNT[tier],
            example=TIER_EXAMPLES[tier],
        )
        templates.append(template)

    return BountySpecTemplateListResponse(
        templates=templates,
        categories=sorted(VALID_SPEC_CATEGORIES),
    )


# ---------------------------------------------------------------------------
# Validation engine — fail-closed
# ---------------------------------------------------------------------------


def validate_spec(spec: BountySpecInput) -> SpecValidationResult:
    """Validate a bounty spec against tier-specific rules.

    Performs fail-closed validation: if any ERROR-level finding is produced,
    the entire spec is rejected. Checks include:
    - Required fields present for the spec's tier
    - Reward amount within the tier's allowed range
    - Description meets minimum length for the tier
    - Requirements count meets minimum for the tier
    - Category is valid
    - Deadline is in the future (if provided or required)
    - Skills format is valid

    Args:
        spec: The parsed bounty spec to validate.

    Returns:
        SpecValidationResult with valid=True only if zero errors are found.
        Findings list contains all errors and warnings regardless.
    """
    findings: list[SpecValidationFinding] = []
    tier = spec.tier

    # --- Required field checks ---
    required = TIER_REQUIRED_FIELDS.get(tier, set())

    if "title" in required and (not spec.title or len(spec.title.strip()) < 3):
        findings.append(SpecValidationFinding(
            field="title",
            severity=SpecValidationSeverity.ERROR,
            message="Title is required and must be at least 3 characters.",
        ))

    if "description" in required:
        min_length = TIER_MIN_DESCRIPTION_LENGTH.get(tier, 20)
        if not spec.description or len(spec.description.strip()) < min_length:
            findings.append(SpecValidationFinding(
                field="description",
                severity=SpecValidationSeverity.ERROR,
                message=(
                    f"Description is required and must be at least "
                    f"{min_length} characters for Tier {tier}. "
                    f"Got {len(spec.description.strip()) if spec.description else 0}."
                ),
            ))

    # --- Reward range check (fail-closed: must be within tier range) ---
    if "reward" in required:
        reward_range = TIER_REWARD_RANGES.get(tier)
        if reward_range is None:
            findings.append(SpecValidationFinding(
                field="tier",
                severity=SpecValidationSeverity.ERROR,
                message=f"Unknown tier {tier}. Must be 1, 2, or 3.",
            ))
        else:
            range_min, range_max = reward_range
            if spec.reward < range_min or spec.reward > range_max:
                findings.append(SpecValidationFinding(
                    field="reward",
                    severity=SpecValidationSeverity.ERROR,
                    message=(
                        f"Reward {spec.reward} is outside the allowed range for "
                        f"Tier {tier}: {range_min}–{range_max} $FNDRY."
                    ),
                ))

    # --- Category check ---
    if "category" in required:
        if spec.category not in VALID_SPEC_CATEGORIES:
            findings.append(SpecValidationFinding(
                field="category",
                severity=SpecValidationSeverity.ERROR,
                message=(
                    f"Invalid category '{spec.category}'. "
                    f"Must be one of: {sorted(VALID_SPEC_CATEGORIES)}."
                ),
            ))

    # --- Requirements count check ---
    if "requirements" in required:
        min_count = TIER_MIN_REQUIREMENTS_COUNT.get(tier, 0)
        if len(spec.requirements) < min_count:
            findings.append(SpecValidationFinding(
                field="requirements",
                severity=SpecValidationSeverity.ERROR,
                message=(
                    f"Tier {tier} requires at least {min_count} acceptance criteria. "
                    f"Got {len(spec.requirements)}."
                ),
            ))

    # --- Deadline check ---
    if "deadline" in required:
        if spec.deadline is None:
            findings.append(SpecValidationFinding(
                field="deadline",
                severity=SpecValidationSeverity.ERROR,
                message=f"Deadline is required for Tier {tier} bounties.",
            ))
        else:
            now = datetime.now(timezone.utc)
            # Ensure deadline is timezone-aware for comparison
            deadline_aware = spec.deadline
            if deadline_aware.tzinfo is None:
                deadline_aware = deadline_aware.replace(tzinfo=timezone.utc)
            if deadline_aware <= now:
                findings.append(SpecValidationFinding(
                    field="deadline",
                    severity=SpecValidationSeverity.ERROR,
                    message="Deadline must be in the future.",
                ))
    elif spec.deadline is not None:
        # Deadline is optional but provided — still check it's in the future
        now = datetime.now(timezone.utc)
        deadline_aware = spec.deadline
        if deadline_aware.tzinfo is None:
            deadline_aware = deadline_aware.replace(tzinfo=timezone.utc)
        if deadline_aware <= now:
            findings.append(SpecValidationFinding(
                field="deadline",
                severity=SpecValidationSeverity.WARNING,
                message="Deadline is in the past. Consider updating it.",
            ))

    # --- Warnings (non-blocking) ---
    if not spec.skills:
        findings.append(SpecValidationFinding(
            field="skills",
            severity=SpecValidationSeverity.WARNING,
            message="No skills specified. Adding skills helps match contributors.",
        ))

    if spec.description and len(spec.description.strip()) > 5000:
        findings.append(SpecValidationFinding(
            field="description",
            severity=SpecValidationSeverity.WARNING,
            message="Description exceeds 5000 characters. Consider being more concise.",
        ))

    # Check for duplicate requirements
    seen_requirements: set[str] = set()
    for requirement in spec.requirements:
        normalized = requirement.strip().lower()
        if normalized in seen_requirements:
            findings.append(SpecValidationFinding(
                field="requirements",
                severity=SpecValidationSeverity.WARNING,
                message=f"Duplicate requirement detected: '{requirement}'.",
            ))
        seen_requirements.add(normalized)

    # --- Compute result ---
    error_count = sum(
        1 for f in findings if f.severity == SpecValidationSeverity.ERROR
    )
    warning_count = sum(
        1 for f in findings if f.severity == SpecValidationSeverity.WARNING
    )

    # Generate labels
    labels = generate_labels(spec)

    return SpecValidationResult(
        valid=(error_count == 0),
        findings=findings,
        error_count=error_count,
        warning_count=warning_count,
        spec=spec,
        labels=labels,
    )


def generate_labels(spec: BountySpecInput) -> list[str]:
    """Generate GitHub issue labels from a bounty spec.

    Auto-generates labels based on the spec's tier, category, and skills.
    These labels are used for filtering and auto-labeling on issue creation.

    Args:
        spec: The bounty spec to generate labels for.

    Returns:
        Sorted list of label strings (e.g., ['bounty', 'backend', 'tier-2']).
    """
    labels: list[str] = ["bounty"]

    # Tier label
    labels.append(f"tier-{spec.tier}")

    # Category label
    if spec.category in VALID_SPEC_CATEGORIES:
        labels.append(spec.category)

    # Skill labels (only well-known ones)
    known_skill_labels = {
        "python", "typescript", "react", "fastapi", "solana",
        "rust", "anchor", "postgresql", "redis", "websocket",
        "devops", "docker", "frontend", "backend",
    }
    for skill in spec.skills:
        if skill.lower() in known_skill_labels:
            labels.append(skill.lower())

    return sorted(set(labels))


# ---------------------------------------------------------------------------
# YAML parsing
# ---------------------------------------------------------------------------


def parse_yaml_spec(yaml_content: str) -> tuple[Optional[BountySpecInput], Optional[str]]:
    """Parse a YAML string into a BountySpecInput model.

    Handles YAML parsing errors gracefully and returns structured error
    messages. This is the entry point for both the CLI linter and the
    batch creation script.

    Args:
        yaml_content: Raw YAML string to parse.

    Returns:
        Tuple of (parsed_spec, error_message). On success, error_message
        is None. On failure, parsed_spec is None and error_message describes
        the parsing failure.
    """
    try:
        data = yaml.safe_load(yaml_content)
    except yaml.YAMLError as yaml_error:
        return None, f"Invalid YAML syntax: {yaml_error}"

    if not isinstance(data, dict):
        return None, "YAML document must be a mapping (key-value pairs), not a scalar or list."

    # Map 'reward' field — support both 'reward' and 'reward_amount'
    if "reward_amount" in data and "reward" not in data:
        data["reward"] = data.pop("reward_amount")

    # Ensure reward is Decimal
    if "reward" in data:
        try:
            data["reward"] = Decimal(str(data["reward"]))
        except (InvalidOperation, ValueError, TypeError):
            return None, f"Invalid reward value: '{data['reward']}'. Must be a number."

    # Validate required top-level key exists
    if "tier" not in data:
        return None, "Missing required field: 'tier'."

    try:
        spec = BountySpecInput(**data)
        return spec, None
    except Exception as validation_error:
        return None, f"Spec validation failed: {validation_error}"


def parse_yaml_file(file_path: str) -> tuple[Optional[BountySpecInput], Optional[str]]:
    """Parse a YAML file from disk into a BountySpecInput model.

    Args:
        file_path: Path to the YAML file to parse.

    Returns:
        Tuple of (parsed_spec, error_message). On success, error_message
        is None. On failure, parsed_spec is None.
    """
    path = Path(file_path)
    if not path.exists():
        return None, f"File not found: {file_path}"
    if not path.suffix.lower() in (".yaml", ".yml"):
        return None, f"File must have .yaml or .yml extension: {file_path}"

    try:
        content = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as read_error:
        return None, f"Failed to read file: {read_error}"

    return parse_yaml_spec(content)


# ---------------------------------------------------------------------------
# Service layer — bounty creation from spec
# ---------------------------------------------------------------------------


async def create_bounty_from_spec(
    spec: BountySpecInput,
    session: AsyncSession,
    user_id: str,
) -> tuple[Optional[BountySpecCreateResponse], Optional[str]]:
    """Validate a spec and create a bounty from it if valid.

    This is the primary integration point with the existing bounty creation
    flow. It validates the spec (fail-closed), persists the spec record in
    PostgreSQL, and then creates the actual bounty via the bounty service.

    Args:
        spec: The parsed bounty spec input.
        session: Async database session for persisting the spec record.
        user_id: The authenticated user creating the bounty.

    Returns:
        Tuple of (response, error). On success, error is None. On failure,
        response is None and error describes the validation failure.
    """
    # Validate spec — fail-closed
    validation = validate_spec(spec)

    if not validation.valid:
        # Persist the failed spec for audit
        await _persist_spec_record(
            spec=spec,
            bounty_id=None,
            labels=validation.labels,
            is_valid=False,
            findings=validation.findings,
            session=session,
        )
        await session.commit()

        error_messages = [
            f.message for f in validation.findings
            if f.severity == SpecValidationSeverity.ERROR
        ]
        return None, f"Spec validation failed with {validation.error_count} error(s): " + "; ".join(error_messages)

    # Create the bounty via existing bounty service
    tier_map = {1: BountyTier.T1, 2: BountyTier.T2, 3: BountyTier.T3}
    bounty_data = BountyCreate(
        title=spec.title,
        description=spec.description,
        tier=tier_map[spec.tier],
        reward_amount=float(spec.reward),
        github_issue_url=spec.github_issue_url,
        required_skills=spec.skills,
        deadline=spec.deadline,
        created_by=user_id,
    )
    bounty_response = bounty_service.create_bounty(bounty_data)

    # Persist the validated spec record
    spec_id = await _persist_spec_record(
        spec=spec,
        bounty_id=bounty_response.id,
        labels=validation.labels,
        is_valid=True,
        findings=validation.findings,
        session=session,
    )
    await session.commit()

    return BountySpecCreateResponse(
        bounty_id=bounty_response.id,
        spec_id=str(spec_id),
        labels=validation.labels,
        validation=validation,
    ), None


async def _persist_spec_record(
    spec: BountySpecInput,
    bounty_id: Optional[str],
    labels: list[str],
    is_valid: bool,
    findings: list[SpecValidationFinding],
    session: AsyncSession,
) -> uuid.UUID:
    """Persist a bounty spec record to PostgreSQL for auditing.

    Args:
        spec: The bounty spec to persist.
        bounty_id: The created bounty ID (None if validation failed).
        labels: Auto-generated labels.
        is_valid: Whether the spec passed validation.
        findings: All validation findings.
        session: Async database session.

    Returns:
        The UUID of the persisted spec record.
    """
    spec_id = uuid.uuid4()
    record = BountySpecTable(
        id=spec_id,
        bounty_id=bounty_id,
        title=spec.title,
        description=spec.description,
        tier=spec.tier,
        reward=spec.reward,
        category=spec.category,
        requirements=spec.requirements,
        skills=spec.skills,
        labels=labels,
        deadline=spec.deadline,
        created_by=spec.created_by,
        is_valid=is_valid,
        validation_errors=[
            {"field": f.field, "severity": f.severity.value, "message": f.message}
            for f in findings
        ],
    )
    session.add(record)
    return spec_id


async def batch_create_from_directory(
    directory_path: str,
    session: AsyncSession,
    user_id: str,
) -> BatchCreateResponse:
    """Create bounties from all YAML spec files in a directory.

    Processes each .yaml/.yml file in the directory, validates it, and
    creates a bounty if valid. Failed specs are reported but do not block
    other specs from being created.

    Args:
        directory_path: Path to the directory containing YAML spec files.
        session: Async database session for persisting spec records.
        user_id: The authenticated user creating the bounties.

    Returns:
        BatchCreateResponse with per-file results and aggregate counts.
    """
    path = Path(directory_path)
    if not path.is_dir():
        return BatchCreateResponse(
            total=0,
            created=0,
            failed=0,
            results=[BatchSpecResult(
                filename=directory_path,
                success=False,
                error=f"Directory not found: {directory_path}",
            )],
        )

    yaml_files = sorted(
        f for f in path.iterdir()
        if f.suffix.lower() in (".yaml", ".yml") and f.is_file()
    )

    if not yaml_files:
        return BatchCreateResponse(
            total=0,
            created=0,
            failed=0,
            results=[BatchSpecResult(
                filename=directory_path,
                success=False,
                error="No YAML files found in directory.",
            )],
        )

    results: list[BatchSpecResult] = []
    created_count = 0
    failed_count = 0

    for yaml_file in yaml_files:
        spec, parse_error = parse_yaml_file(str(yaml_file))
        if parse_error:
            results.append(BatchSpecResult(
                filename=yaml_file.name,
                success=False,
                error=parse_error,
            ))
            failed_count += 1
            continue

        assert spec is not None  # parse succeeded
        response, create_error = await create_bounty_from_spec(spec, session, user_id)

        if create_error:
            # Get validation findings for the error report
            validation = validate_spec(spec)
            results.append(BatchSpecResult(
                filename=yaml_file.name,
                success=False,
                error=create_error,
                findings=validation.findings,
            ))
            failed_count += 1
        else:
            assert response is not None
            results.append(BatchSpecResult(
                filename=yaml_file.name,
                success=True,
                bounty_id=response.bounty_id,
                spec_id=response.spec_id,
                labels=response.labels,
            ))
            created_count += 1

    return BatchCreateResponse(
        total=len(yaml_files),
        created=created_count,
        failed=failed_count,
        results=results,
    )


async def get_spec_by_bounty_id(
    bounty_id: str,
    session: AsyncSession,
) -> Optional[BountySpecTable]:
    """Retrieve a persisted spec record by the bounty it created.

    Args:
        bounty_id: The bounty ID to look up.
        session: Async database session.

    Returns:
        The BountySpecTable record, or None if not found.
    """
    result = await session.execute(
        select(BountySpecTable).where(BountySpecTable.bounty_id == bounty_id)
    )
    return result.scalar_one_or_none()
