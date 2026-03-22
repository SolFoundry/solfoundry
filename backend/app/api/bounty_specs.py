"""Bounty spec validation and template API router.

Provides endpoints for:
- Listing tier-specific bounty spec templates
- Validating a bounty spec (dry-run, no creation)
- Creating a bounty from a validated spec (integrated with bounty creation flow)
- Looking up the spec associated with an existing bounty

All mutation endpoints require authentication via Depends(get_current_user_id).
Validation is fail-closed: specs with any error are rejected entirely.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_id
from app.database import get_db
from app.models.bounty_spec import (
    BountySpecCreateResponse,
    BountySpecInput,
    BountySpecTemplateListResponse,
    SpecValidationResult,
)
from app.services.bounty_spec_service import (
    create_bounty_from_spec,
    get_spec_by_bounty_id,
    get_templates,
    validate_spec,
)

router = APIRouter(prefix="/api/bounty-specs", tags=["bounty-specs"])


@router.get(
    "/templates",
    response_model=BountySpecTemplateListResponse,
    summary="List bounty spec templates for all tiers",
)
async def list_templates() -> BountySpecTemplateListResponse:
    """Return tier-specific bounty spec templates with examples.

    Each template includes required fields, optional fields, reward ranges,
    minimum description lengths, minimum requirements counts, and a
    complete example spec for that tier.

    Returns:
        BountySpecTemplateListResponse with templates for T1, T2, and T3
        plus the full list of valid bounty categories.
    """
    return get_templates()


@router.post(
    "/validate",
    response_model=SpecValidationResult,
    summary="Validate a bounty spec (dry-run, no creation)",
)
async def validate_bounty_spec(
    spec: BountySpecInput,
) -> SpecValidationResult:
    """Validate a bounty spec without creating a bounty.

    Performs fail-closed validation against tier-specific rules including
    reward range checks, required field presence, description length,
    requirements count, and deadline validity.

    Args:
        spec: The bounty spec to validate.

    Returns:
        SpecValidationResult indicating whether the spec is valid, with
        all findings (errors and warnings) and auto-generated labels.
    """
    return validate_spec(spec)


@router.post(
    "/create",
    response_model=BountySpecCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a bounty from a validated spec",
)
async def create_bounty_from_validated_spec(
    spec: BountySpecInput,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> BountySpecCreateResponse:
    """Validate a spec and create a bounty if all checks pass.

    This is the primary endpoint for creating bounties from specs. It
    integrates with the existing bounty creation flow by first validating
    the spec (fail-closed), then persisting the spec record in PostgreSQL,
    and finally creating the bounty via the bounty service.

    Requires authentication. The authenticated user becomes the bounty creator.

    Args:
        spec: The bounty spec to validate and create a bounty from.
        user_id: The authenticated user ID (injected by auth dependency).
        session: Async database session (injected by DB dependency).

    Returns:
        BountySpecCreateResponse with the created bounty ID, spec ID,
        auto-generated labels, and the full validation result.

    Raises:
        HTTPException 422: If spec validation fails (fail-closed).
    """
    response, error = await create_bounty_from_spec(spec, session, user_id)

    if error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error,
        )

    assert response is not None
    return response


@router.get(
    "/bounty/{bounty_id}",
    response_model=Optional[dict],
    summary="Get the spec that created a bounty",
)
async def get_bounty_spec(
    bounty_id: str,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Look up the spec record associated with an existing bounty.

    Returns the persisted spec metadata including validation findings
    at the time of creation. Useful for auditing and understanding
    what spec produced a given bounty.

    Args:
        bounty_id: The bounty ID to look up.
        session: Async database session (injected by DB dependency).

    Returns:
        Dict with spec metadata, or raises 404 if no spec found.

    Raises:
        HTTPException 404: If no spec record exists for the given bounty ID.
    """
    record = await get_spec_by_bounty_id(bounty_id, session)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No spec found for bounty '{bounty_id}'.",
        )

    return {
        "id": str(record.id),
        "bounty_id": record.bounty_id,
        "title": record.title,
        "tier": record.tier,
        "reward": str(record.reward),
        "category": record.category,
        "requirements": record.requirements,
        "skills": record.skills,
        "labels": record.labels,
        "deadline": record.deadline.isoformat() if record.deadline else None,
        "created_by": record.created_by,
        "is_valid": record.is_valid,
        "validation_errors": record.validation_errors,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }
