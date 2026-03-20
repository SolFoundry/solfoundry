"""Bounty CRUD, submission, and claim API router (Issue #3, Issue #16)."""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends

from app.auth import get_current_user_id
from app.models.bounty import (
    BountyCreate,
    BountyListResponse,
    BountyResponse,
    BountyStatus,
    BountyTier,
    BountyUpdate,
    SubmissionCreate,
    SubmissionResponse,
    BountyClaimRequest,
    BountyUnclaimRequest,
    BountyClaimantResponse,
    BountyClaimHistoryResponse,
)
from app.services import bounty_service
from app.services import contributor_service

router = APIRouter(prefix="/api/bounties", tags=["bounties"])


@router.post(
    "", response_model=BountyResponse, status_code=201, summary="Create a new bounty"
)
async def create_bounty(data: BountyCreate) -> BountyResponse:
    return bounty_service.create_bounty(data)


@router.get(
    "", response_model=BountyListResponse, summary="List bounties with optional filters"
)
async def list_bounties(
    status: Optional[BountyStatus] = Query(None, description="Filter by status"),
    tier: Optional[BountyTier] = Query(None, description="Filter by tier"),
    skills: Optional[str] = Query(None, description="Comma-separated skill filter"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
) -> BountyListResponse:
    skill_list = (
        [s.strip().lower() for s in skills.split(",") if s.strip()] if skills else None
    )
    return bounty_service.list_bounties(
        status=status, tier=tier, skills=skill_list, skip=skip, limit=limit
    )


@router.get(
    "/{bounty_id}", response_model=BountyResponse, summary="Get a single bounty by ID"
)
async def get_bounty(bounty_id: str) -> BountyResponse:
    result = bounty_service.get_bounty(bounty_id)
    if not result:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return result


@router.patch(
    "/{bounty_id}", response_model=BountyResponse, summary="Partially update a bounty"
)
async def update_bounty(bounty_id: str, data: BountyUpdate) -> BountyResponse:
    result, error = bounty_service.update_bounty(bounty_id, data)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)
    return result


@router.delete("/{bounty_id}", status_code=204, summary="Delete a bounty")
async def delete_bounty(bounty_id: str) -> None:
    if not bounty_service.delete_bounty(bounty_id):
        raise HTTPException(status_code=404, detail="Bounty not found")


@router.post(
    "/{bounty_id}/submit",
    response_model=SubmissionResponse,
    status_code=201,
    summary="Submit a PR solution",
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
    summary="List submissions",
)
async def get_submissions(bounty_id: str) -> list[SubmissionResponse]:
    result = bounty_service.get_submissions(bounty_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return result


# Claim Lifecycle Endpoints (Issue #16)


@router.post(
    "/{bounty_id}/claim",
    response_model=BountyResponse,
    summary="Claim a bounty (T2/T3 only)",
)
async def claim_bounty(
    bounty_id: str,
    data: BountyClaimRequest,
    user_id: str = Depends(get_current_user_id),
) -> BountyResponse:
    """Claim a bounty.

    Security:
    - claimant_id is obtained from authentication context, not client input
    - reputation is fetched from server-side contributor data, not client input
    """
    # Get user's reputation from contributor service
    contributor = contributor_service.get_contributor(user_id)
    reputation = contributor.stats.reputation_score if contributor else 0

    result, error = bounty_service.claim_bounty(
        bounty_id=bounty_id,
        claimant_id=user_id,
        reputation=reputation,
        application=data.application,
    )
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)
    return result


@router.delete(
    "/{bounty_id}/claim", response_model=BountyResponse, summary="Release a claim"
)
async def unclaim_bounty(
    bounty_id: str,
    reason: Optional[str] = Query(None, description="Optional reason for releasing"),
    user_id: str = Depends(get_current_user_id),
) -> BountyResponse:
    """Release a claim on a bounty.

    Security: claimant_id is obtained from authentication context, not client input.
    Only the authenticated user who made the claim can release it.
    """
    unclaim_data = BountyUnclaimRequest(reason=reason) if reason else None
    result, error = bounty_service.unclaim_bounty(
        bounty_id=bounty_id,
        claimant_id=user_id,
        data=unclaim_data,
    )
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)
    return result


@router.get(
    "/{bounty_id}/claimant",
    response_model=BountyClaimantResponse,
    summary="Get current claimant",
)
async def get_bounty_claimant(bounty_id: str) -> BountyClaimantResponse:
    result, error = bounty_service.get_claimant(bounty_id)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)
    return result


@router.get(
    "/{bounty_id}/claim-history",
    response_model=BountyClaimHistoryResponse,
    summary="Get claim history",
)
async def get_bounty_claim_history(
    bounty_id: str,
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
) -> BountyClaimHistoryResponse:
    result, error = bounty_service.get_claim_history(bounty_id, skip, limit)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)
    return result
