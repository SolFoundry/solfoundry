"""Bounty CRUD and submission API router (Issue #3).

Endpoints: create, list, get, update, delete, submit solution, list submissions.
Claim lifecycle endpoints (Issue #16).
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.bounty import (
    BountyCreate, BountyListResponse, BountyResponse, BountyStatus, BountyTier,
    BountyUpdate, SubmissionCreate, SubmissionResponse,
    BountyClaimRequest, BountyUnclaimRequest, BountyClaimantResponse, BountyClaimHistoryResponse,
)
from app.services import bounty_service

router = APIRouter(prefix="/api/bounties", tags=["bounties"])


@router.post("", response_model=BountyResponse, status_code=201)
async def create_bounty(data: BountyCreate) -> BountyResponse:
    return bounty_service.create_bounty(data)


@router.get("", response_model=BountyListResponse)
async def list_bounties(
    status: Optional[BountyStatus] = Query(None),
    tier: Optional[BountyTier] = Query(None),
    skills: Optional[str] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
) -> BountyListResponse:
    skill_list = [s.strip().lower() for s in skills.split(",") if s.strip()] if skills else None
    return bounty_service.list_bounties(status=status, tier=tier, skills=skill_list, skip=skip, limit=limit)


@router.get("/{bounty_id}", response_model=BountyResponse)
async def get_bounty(bounty_id: str) -> BountyResponse:
    result = bounty_service.get_bounty(bounty_id)
    if not result:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return result


@router.patch("/{bounty_id}", response_model=BountyResponse)
async def update_bounty(bounty_id: str, data: BountyUpdate) -> BountyResponse:
    result, error = bounty_service.update_bounty(bounty_id, data)
    if error:
        raise HTTPException(status_code=404 if "not found" in error.lower() else 400, detail=error)
    return result


@router.delete("/{bounty_id}", status_code=204)
async def delete_bounty(bounty_id: str) -> None:
    if not bounty_service.delete_bounty(bounty_id):
        raise HTTPException(status_code=404, detail="Bounty not found")


@router.post("/{bounty_id}/submit", response_model=SubmissionResponse, status_code=201)
async def submit_solution(bounty_id: str, data: SubmissionCreate) -> SubmissionResponse:
    result, error = bounty_service.submit_solution(bounty_id, data)
    if error:
        raise HTTPException(status_code=404 if "not found" in error.lower() else 400, detail=error)
    return result


@router.get("/{bounty_id}/submissions", response_model=list[SubmissionResponse])
async def get_submissions(bounty_id: str) -> list[SubmissionResponse]:
    result = bounty_service.get_submissions(bounty_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return result


# Claim lifecycle endpoints (Issue #16)

@router.post("/{bounty_id}/claim", response_model=BountyResponse, status_code=200)
async def claim_bounty(bounty_id: str, data: BountyClaimRequest) -> BountyResponse:
    result, error = bounty_service.claim_bounty(bounty_id, data)
    if error:
        raise HTTPException(status_code=404 if "not found" in error.lower() else 400, detail=error)
    return result


@router.delete("/{bounty_id}/claim", response_model=BountyResponse)
async def unclaim_bounty(
    bounty_id: str,
    claimant_id: str = Query(..., description="ID of the current claimant"),
    reason: Optional[str] = Query(None, description="Optional reason for releasing"),
) -> BountyResponse:
    unclaim_data = BountyUnclaimRequest(reason=reason) if reason else None
    result, error = bounty_service.unclaim_bounty(bounty_id, claimant_id, unclaim_data)
    if error:
        raise HTTPException(status_code=404 if "not found" in error.lower() else 400, detail=error)
    return result


@router.get("/{bounty_id}/claimant", response_model=BountyClaimantResponse)
async def get_bounty_claimant(bounty_id: str) -> BountyClaimantResponse:
    result, error = bounty_service.get_claimant(bounty_id)
    if error:
        raise HTTPException(status_code=404 if "not found" in error.lower() else 400, detail=error)
    return result


@router.get("/{bounty_id}/claim-history", response_model=BountyClaimHistoryResponse)
async def get_bounty_claim_history(
    bounty_id: str,
    skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
) -> BountyClaimHistoryResponse:
    result, error = bounty_service.get_claim_history(bounty_id, skip, limit)
    if error:
        raise HTTPException(status_code=404 if "not found" in error.lower() else 400, detail=error)
    return result