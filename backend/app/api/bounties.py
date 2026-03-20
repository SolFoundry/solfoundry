"""Bounty CRUD and submission API router (Issue #3).

This module defines the FastAPI router for bounty management endpoints.
It provides create, list, get, update, delete operations for bounties,
as well as solution submission and submission listing.

Claim lifecycle endpoints belong to Issue #16 and are not included here.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.bounty import (
    BountyCreate,
    BountyListResponse,
    BountyResponse,
    BountyStatus,
    BountyTier,
    BountyUpdate,
    SubmissionCreate,
    SubmissionResponse,
)
from app.services import bounty_service

router = APIRouter(prefix="/api/bounties", tags=["bounties"])


@router.post(
    "",
    response_model=BountyResponse,
    status_code=201,
    summary="Create a new bounty",
)
async def create_bounty(data: BountyCreate) -> BountyResponse:
    """Create a new bounty and return its full representation.

    Args:
        data: Validated bounty creation payload containing title,
            description, tier, reward amount, and optional fields.

    Returns:
        The newly created bounty with generated ID and timestamps.
    """
    return bounty_service.create_bounty(data)


@router.get(
    "",
    response_model=BountyListResponse,
    summary="List bounties with optional filters",
)
async def list_bounties(
    status: Optional[BountyStatus] = Query(None, description="Filter by status"),
    tier: Optional[BountyTier] = Query(None, description="Filter by tier"),
    skills: Optional[str] = Query(
        None, description="Comma-separated skill filter (case-insensitive)"
    ),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
) -> BountyListResponse:
    """List bounties with optional filtering by status, tier, and skills.

    Supports pagination via skip/limit parameters. Skills are matched
    case-insensitively against the bounty's required_skills list.

    Args:
        status: Optional filter to return only bounties with this status.
        tier: Optional filter to return only bounties with this tier.
        skills: Comma-separated list of skills to filter by (case-insensitive).
        skip: Number of results to skip for pagination.
        limit: Maximum number of results to return (1-100).

    Returns:
        Paginated list of bounties matching the filter criteria.
    """
    skill_list = (
        [s.strip().lower() for s in skills.split(",") if s.strip()]
        if skills
        else None
    )
    return bounty_service.list_bounties(
        status=status, tier=tier, skills=skill_list, skip=skip, limit=limit
    )


@router.get(
    "/{bounty_id}",
    response_model=BountyResponse,
    summary="Get a single bounty by ID",
)
async def get_bounty(bounty_id: str) -> BountyResponse:
    """Retrieve a single bounty by its unique identifier.

    Args:
        bounty_id: The UUID of the bounty to retrieve.

    Returns:
        The full bounty detail including submissions.

    Raises:
        HTTPException: 404 if the bounty does not exist.
    """
    result = bounty_service.get_bounty(bounty_id)
    if not result:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return result


@router.patch(
    "/{bounty_id}",
    response_model=BountyResponse,
    summary="Partially update a bounty",
)
async def update_bounty(bounty_id: str, data: BountyUpdate) -> BountyResponse:
    """Partially update a bounty using PATCH semantics.

    Only fields present in the request body are updated. Status transitions
    are validated against the allowed transition map.

    Args:
        bounty_id: The UUID of the bounty to update.
        data: Partial update payload with fields to change.

    Returns:
        The updated bounty with new values applied.

    Raises:
        HTTPException: 404 if the bounty is not found, 400 for invalid
            status transitions or other validation errors.
    """
    result, error = bounty_service.update_bounty(bounty_id, data)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)
    return result


@router.delete(
    "/{bounty_id}",
    status_code=204,
    summary="Delete a bounty",
)
async def delete_bounty(bounty_id: str) -> None:
    """Delete a bounty by its unique identifier.

    Args:
        bounty_id: The UUID of the bounty to delete.

    Raises:
        HTTPException: 404 if the bounty does not exist.
    """
    if not bounty_service.delete_bounty(bounty_id):
        raise HTTPException(status_code=404, detail="Bounty not found")


@router.post(
    "/{bounty_id}/submit",
    response_model=SubmissionResponse,
    status_code=201,
    summary="Submit a PR solution for a bounty",
)
async def submit_solution(bounty_id: str, data: SubmissionCreate) -> SubmissionResponse:
    """Submit a pull request as a solution for a bounty.

    The bounty must be in OPEN or IN_PROGRESS status to accept submissions.
    Duplicate PR URLs on the same bounty are rejected.

    Args:
        bounty_id: The UUID of the bounty to submit a solution for.
        data: Submission payload containing the GitHub PR URL, submitter
            identity, and optional notes.

    Returns:
        The created submission record with generated ID and timestamp.

    Raises:
        HTTPException: 404 if the bounty is not found, 400 if the bounty
            is not accepting submissions or the PR URL is a duplicate.
    """
    result, error = bounty_service.submit_solution(bounty_id, data)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)
    return result


@router.get(
    "/{bounty_id}/submissions",
    response_model=list[SubmissionResponse],
    summary="List submissions for a bounty",
)
async def get_submissions(bounty_id: str) -> list[SubmissionResponse]:
    """List all submissions for a specific bounty.

    Args:
        bounty_id: The UUID of the bounty whose submissions to list.

    Returns:
        A list of submission records for the specified bounty.

    Raises:
        HTTPException: 404 if the bounty does not exist.
    """
    result = bounty_service.get_submissions(bounty_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return result
