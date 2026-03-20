"""Bounty CRUD and submission API router (Issue #3).

Endpoints: create, list, get, update, delete, submit solution, list submissions.
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
    if not bounty_service.delete_bounty(bounty_id):
        raise HTTPException(status_code=404, detail="Bounty not found")


@router.post(
    "/{bounty_id}/submit",
    response_model=SubmissionResponse,
    status_code=201,
    summary="Submit a PR solution for a bounty",
)
async def submit_solution(bounty_id: str, data: SubmissionCreate) -> SubmissionResponse:
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
    result = bounty_service.get_submissions(bounty_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return result
