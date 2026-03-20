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
    BountySearchParams,
    AutocompleteResponse,
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
    "/search",
    response_model=BountyListResponse,
    summary="Full-text search and filter for bounties",
)
async def search_bounties(
    q: Optional[str] = Query(None, description="Search query for title and description"),
    tier: Optional[int] = Query(None, ge=1, le=3, description="Filter by tier (1/2/3)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by status"),
    reward_min: Optional[float] = Query(None, ge=0, description="Minimum reward amount"),
    reward_max: Optional[float] = Query(None, ge=0, description="Maximum reward amount"),
    skills: Optional[str] = Query(None, description="Comma-separated list of skills"),
    sort: str = Query("newest", pattern="^(newest|reward_high|reward_low|deadline|popularity)$", description="Sort order"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of results per page"),
) -> BountyListResponse:
    """
    Full-text search and filter for bounties.
    
    - **q**: Search query for full-text search across title and description
    - **tier**: Filter by bounty tier (1, 2, or 3)
    - **category**: Filter by category (frontend, backend, smart_contract, documentation, testing, infrastructure, other)
    - **status**: Filter by status (open, in_progress, completed, paid)
    - **reward_min**: Minimum reward amount
    - **reward_max**: Maximum reward amount
    - **skills**: Comma-separated list of required skills
    - **sort**: Sort order (newest, reward_high, reward_low, deadline, popularity)
    - **skip**: Pagination offset
    - **limit**: Number of results per page
    """
    params = BountySearchParams(
        q=q,
        tier=tier,
        category=category,
        status=status,
        reward_min=reward_min,
        reward_max=reward_max,
        skills=skills,
        sort=sort,
        skip=skip,
        limit=limit,
    )
    
    try:
        return bounty_service.search_bounties(params)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/autocomplete",
    response_model=AutocompleteResponse,
    summary="Get autocomplete suggestions for bounty search",
)
async def get_autocomplete(
    q: str = Query(..., min_length=2, description="Search query for autocomplete"),
    limit: int = Query(10, ge=1, le=20, description="Number of suggestions"),
) -> AutocompleteResponse:
    """
    Get autocomplete suggestions for bounty search.
    
    Returns matching bounty titles and skills.
    Minimum query length is 2 characters.
    """
    return bounty_service.get_autocomplete_suggestions(q, limit)


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