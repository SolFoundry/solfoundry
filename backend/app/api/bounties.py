"""Bounty CRUD, submission, and search API router.

Endpoints: create, list, get, update, delete, submit solution, list submissions,
search, autocomplete, hot bounties, recommended bounties.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.errors import ErrorResponse, HTTPValidationError
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
    SubmissionStatusUpdate,
)
from app.api.auth import get_current_user
from app.models.user import UserResponse
from app.services import auth_service
from app.services import bounty_service
from app.services.bounty_search_service import BountySearchService

async def _verify_bounty_ownership(bounty_id: str, user: UserResponse):
    """Check that the authenticated user owns the bounty before modification.

    Args:
        bounty_id: The UUID string of the bounty to verify.
        user: The authenticated user from the JWT token.

    Returns:
        The BountyResponse if ownership is confirmed.

    Raises:
        HTTPException 404: Bounty not found.
        HTTPException 403: User is not the bounty owner.
    """
    bounty = await bounty_service.get_bounty(bounty_id)
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    if bounty.created_by not in (str(user.id), user.wallet_address):
        raise HTTPException(status_code=403, detail="Not authorized to modify this bounty")
    return bounty

router = APIRouter(prefix="/bounties", tags=["bounties"])


@router.post(
    "",
    response_model=BountyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new bounty",
    description="""
    Register a new bounty task in the marketplace.

    The requesting user will be recorded as the `created_by` owner.
    Funds must be available in the user's linked wallet (if using web3 auth).
    """,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid bounty data"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def create_bounty(
    data: BountyCreate,
    user: UserResponse = Depends(get_current_user)
) -> BountyResponse:
    """Validate input and create a new bounty owned by the authenticated user."""
    data.created_by = user.wallet_address or str(user.id)
    return await bounty_service.create_bounty(data)


@router.get(
    "",
    response_model=BountyListResponse,
    summary="List bounties (Basic Filtering)",
    description="""
    Retrieve a paginated list of bounties with optional simple filters.
    For complex queries, use the `/search` endpoint.
    """,
)
async def list_bounties(
    status: Optional[BountyStatus] = Query(None, description="Filter by current lifecycle status"),
    tier: Optional[BountyTier] = Query(None, description="Filter by difficulty tier (1, 2, or 3)"),
    skills: Optional[str] = Query(
        None, description="Comma-separated list of skills (e.g., 'python,rust')"
    ),
    created_by: Optional[str] = Query(None, description="Filter by creator's username or wallet"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of items to return"),
) -> BountyListResponse:
    """Return a filtered paginated list of bounties from the database."""
    skill_list = (
        [s.strip().lower() for s in skills.split(",") if s.strip()] if skills else None
    )
    return await bounty_service.list_bounties(
        status=status, tier=tier, skills=skill_list, created_by=created_by, skip=skip, limit=limit
    )


# ---------------------------------------------------------------------------
# Search endpoints (placed before /{bounty_id} to avoid route conflicts)
# ---------------------------------------------------------------------------


async def _get_search_service(
    session: AsyncSession = Depends(get_db),
) -> BountySearchService:
    """FastAPI dependency that provides a BountySearchService bound to the request session."""
    return BountySearchService(session)


@router.get(
    "/search",
    response_model=BountySearchResponse,
    summary="Full-text search",
    description="""
    Perform a high-performance full-text search across bounty titles and descriptions.
    Supports PostgreSQL-backed indexing for speed and relevance.
    """,
    responses={
        200: {"description": "Search results (ordered by relevance unless sort provided)"},
    },
)
async def search_bounties(
    q: str = Query("", max_length=200, description="Keyword search query"),
    status: Optional[BountyStatus] = Query(None),
    tier: Optional[int] = Query(None, ge=1, le=3),
    skills: Optional[str] = Query(None, description="Comma-separated skills"),
    category: Optional[str] = Query(None),
    creator_type: Optional[str] = Query(None, pattern=r"^(platform|community)$"),
    creator_id: Optional[str] = Query(None, description="Filter by creator ID/wallet"),
    reward_min: Optional[float] = Query(None, ge=0),
    reward_max: Optional[float] = Query(None, ge=0),
    deadline_before: Optional[str] = Query(None, description="ISO datetime"),
    sort: str = Query("newest"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    svc: BountySearchService = Depends(_get_search_service),
) -> BountySearchResponse:
    """Execute a full-text search with filters and return ranked results."""
    skill_list = (
        [s.strip().lower() for s in skills.split(",") if s.strip()] if skills else []
    )
    params = BountySearchParams(
        q=q,
        status=status,
        tier=tier,
        skills=skill_list,
        category=category,
        creator_type=creator_type,
        creator_id=creator_id,
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
    """Return title and skill autocomplete suggestions for the query prefix."""
    return await svc.autocomplete(q, limit)


@router.get(
    "/hot",
    response_model=list[BountySearchResult],
    summary="Hot bounties -- highest activity in last 24h",
)
async def hot_bounties(
    limit: int = Query(6, ge=1, le=20),
    svc: BountySearchService = Depends(_get_search_service),
) -> list[BountySearchResult]:
    """Return trending bounties from recent activity."""
    return await svc.hot_bounties(limit)


@router.get(
    "/recommended",
    response_model=list[BountySearchResult],
    summary="Recommended bounties based on user skills",
)
async def recommended_bounties(
    skills: str = Query(..., description="Comma-separated user skills"),
    exclude: Optional[str] = Query(
        None, description="Comma-separated bounty IDs to exclude"
    ),
    limit: int = Query(6, ge=1, le=20),
    svc: BountySearchService = Depends(_get_search_service),
) -> list[BountySearchResult]:
    """Return bounties matching the user's skills, excluding completed ones."""
    skill_list = [s.strip().lower() for s in skills.split(",") if s.strip()]
    excluded = [e.strip() for e in exclude.split(",") if e.strip()] if exclude else []
    return await svc.recommended(skill_list, excluded, limit)


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/creator/{wallet_address}/stats",
    summary="Get escrow stats for a creator",
)
async def get_creator_stats(wallet_address: str):
    """Aggregate escrow statistics (staked, paid, refunded) for a creator."""
    bounties_resp = await bounty_service.list_bounties(created_by=wallet_address, limit=1000)
    staked, paid, refunded = 0, 0, 0
    for b in bounties_resp.items:
        if b.status in (BountyStatus.OPEN, BountyStatus.IN_PROGRESS, BountyStatus.UNDER_REVIEW, BountyStatus.DISPUTED, BountyStatus.COMPLETED):
            staked += b.reward_amount
        elif b.status == BountyStatus.PAID:
            paid += b.reward_amount
        elif b.status == BountyStatus.CANCELLED:
            refunded += b.reward_amount
    return {"staked": staked, "paid": paid, "refunded": refunded}


@router.get(
    "/{bounty_id}",
    response_model=BountyResponse,
    summary="Get bounty details",
    description="Retrieve comprehensive information about a specific bounty, including its status and submissions.",
    responses={
        404: {"model": ErrorResponse, "description": "Bounty not found"},
    },
)
async def get_bounty_detail(bounty_id: str) -> BountyResponse:
    """Fetch a single bounty from PostgreSQL by its UUID."""
    bounty = await bounty_service.get_bounty(bounty_id)
    if not bounty:
        raise HTTPException(status_code=404, detail=f"Bounty '{bounty_id}' not found")
    return bounty


@router.patch(
    "/{bounty_id}",
    response_model=BountyResponse,
    summary="Partially update a bounty",
)
async def update_bounty(
    bounty_id: str,
    data: BountyUpdate,
    user: UserResponse = Depends(get_current_user)
) -> BountyResponse:
    """Apply partial updates to a bounty after verifying ownership."""
    await _verify_bounty_ownership(bounty_id, user)
    result, error = await bounty_service.update_bounty(bounty_id, data)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)
    return result


@router.delete(
    "/{bounty_id}",
    status_code=204,
    summary="Delete a bounty",
)
async def delete_bounty(
    bounty_id: str,
    user: UserResponse = Depends(get_current_user)
) -> None:
    """Delete a bounty by ID after verifying ownership."""
    await _verify_bounty_ownership(bounty_id, user)
    if not await bounty_service.delete_bounty(bounty_id):
        raise HTTPException(status_code=404, detail="Bounty not found")


@router.post("/{bounty_id}/submit", include_in_schema=False, status_code=status.HTTP_201_CREATED)
@router.post(
    "/{bounty_id}/submissions",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a solution",
    description="""
    Submit a Pull Request link as a solution for an open bounty.
    The status must be 'open' or 'in_progress'.
    Submitting a solution moves the bounty to 'under_review'.
    """,
    responses={
        400: {"model": ErrorResponse, "description": "Bounty is not accepting submissions"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
        404: {"model": ErrorResponse, "description": "Bounty not found"},
    },
)
async def submit_solution(
    bounty_id: str,
    data: SubmissionCreate,
    user: UserResponse = Depends(get_current_user)
) -> SubmissionResponse:
    """Attach a PR submission to an open bounty for review."""
    data.submitted_by = user.wallet_address or str(user.id)
    result, error = await bounty_service.submit_solution(bounty_id, data)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)
    return result


@router.get(
    "/{bounty_id}/submissions",
    response_model=list[SubmissionResponse],
    summary="List submissions for a bounty",
    description="Retrieve all solutions submitted for a specific bounty. Reserved for bounty creators.",
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
        404: {"model": ErrorResponse, "description": "Bounty not found"},
    },
)
async def get_submissions(bounty_id: str) -> list[SubmissionResponse]:
    """Return all PR submissions attached to a bounty."""
    result = await bounty_service.get_submissions(bounty_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return result


@router.patch(
    "/{bounty_id}/submissions/{submission_id}",
    response_model=SubmissionResponse,
    summary="Update a submission's status",
    description="Approve, reject, or request changes on a submission. Approving triggers the payout flow.",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid status transition"},
        403: {"model": ErrorResponse, "description": "Not authorized (not the bounty creator)"},
        404: {"model": ErrorResponse, "description": "Bounty or submission not found"},
    },
)
async def update_submission(
    bounty_id: str,
    submission_id: str,
    data: SubmissionStatusUpdate,
    user: UserResponse = Depends(get_current_user)
) -> SubmissionResponse:
    """Transition a submission's status after verifying bounty ownership."""
    await _verify_bounty_ownership(bounty_id, user)
    result, error = await bounty_service.update_submission(bounty_id, submission_id, data.status)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)
    return result


@router.post(
    "/{bounty_id}/cancel",
    response_model=BountyResponse,
    summary="Cancel a bounty and trigger refund",
    description="Withdraw a bounty from the marketplace. Only possible if there are no approved submissions.",
    responses={
        400: {"model": ErrorResponse, "description": "Cannot cancel (e.g., already paid)"},
        403: {"model": ErrorResponse, "description": "Not authorized"},
    },
)
async def cancel_bounty(
    bounty_id: str,
    user: UserResponse = Depends(get_current_user)
) -> BountyResponse:
    """Cancel a bounty and trigger a refund to the creator's wallet."""
    await _verify_bounty_ownership(bounty_id, user)
    result, error = await bounty_service.update_bounty(
        bounty_id, BountyUpdate(status=BountyStatus.CANCELLED)
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result
