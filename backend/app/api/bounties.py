"""Bounty CRUD, submission, and search API router.

Endpoints: create, list, get, update, delete, submit solution, list submissions,
search, autocomplete, hot bounties, recommended bounties.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.bounty import (
    AutocompleteResponse,
    BountyCreate,
    BountyListResponse,
    BountyResponse,
    BountySearchParams,
    BountySearchResponse,
    BountySearchResult,
    BountyStatus,
    BountyTier,
    BountyUpdate,
    SubmissionCreate,
    SubmissionResponse,
)
from app.services import bounty_service
from app.services.bounty_search_service import BountySearchService

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
        [s.strip().lower() for s in skills.split(",") if s.strip()] if skills else None
    )
    return bounty_service.list_bounties(
        status=status, tier=tier, skills=skill_list, skip=skip, limit=limit
    )


# ---------------------------------------------------------------------------
# Search endpoints (placed before /{bounty_id} to avoid route conflicts)
# ---------------------------------------------------------------------------


async def _get_search_service(
    session: AsyncSession = Depends(get_db),
) -> BountySearchService:
    return BountySearchService(session)


@router.get(
    "/search",
    response_model=BountySearchResponse,
    summary="Full-text search with advanced filters",
)
async def search_bounties(
    q: str = Query("", max_length=200, description="Search query"),
    status: Optional[BountyStatus] = Query(None),
    tier: Optional[int] = Query(None, ge=1, le=3),
    skills: Optional[str] = Query(None, description="Comma-separated skills"),
    category: Optional[str] = Query(None),
    creator_type: Optional[str] = Query(None, pattern=r"^(platform|community)$"),
    reward_min: Optional[float] = Query(None, ge=0),
    reward_max: Optional[float] = Query(None, ge=0),
    deadline_before: Optional[str] = Query(None, description="ISO datetime"),
    sort: str = Query("newest"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    svc: BountySearchService = Depends(_get_search_service),
) -> BountySearchResponse:
    skill_list = (
        [s.strip().lower() for s in skills.split(",") if s.strip()]
        if skills
        else []
    )
    params = BountySearchParams(
        q=q,
        status=status,
        tier=tier,
        skills=skill_list,
        category=category,
        creator_type=creator_type,
        reward_min=reward_min,
        reward_max=reward_max,
        sort=sort,
        page=page,
        per_page=per_page,
    )
    return await svc.search(params)


@router.get(
    "/autocomplete",
    response_model=AutocompleteResponse,
    summary="Search autocomplete suggestions",
)
async def autocomplete(
    q: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(8, ge=1, le=20),
    svc: BountySearchService = Depends(_get_search_service),
) -> AutocompleteResponse:
    return await svc.autocomplete(q, limit)


@router.get(
    "/hot",
    response_model=list[BountySearchResult],
    summary="Hot bounties — highest activity in last 24h",
)
async def hot_bounties(
    limit: int = Query(6, ge=1, le=20),
    svc: BountySearchService = Depends(_get_search_service),
) -> list[BountySearchResult]:
    return await svc.hot_bounties(limit)


@router.get(
    "/recommended",
    response_model=list[BountySearchResult],
    summary="Recommended bounties based on user skills",
)
async def recommended_bounties(
    skills: str = Query(..., description="Comma-separated user skills"),
    exclude: Optional[str] = Query(None, description="Comma-separated bounty IDs to exclude"),
    limit: int = Query(6, ge=1, le=20),
    svc: BountySearchService = Depends(_get_search_service),
) -> list[BountySearchResult]:
    skill_list = [s.strip().lower() for s in skills.split(",") if s.strip()]
    excluded = (
        [e.strip() for e in exclude.split(",") if e.strip()] if exclude else []
    )
    return await svc.recommended(skill_list, excluded, limit)


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------


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
