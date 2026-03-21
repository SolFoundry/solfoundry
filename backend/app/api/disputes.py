"""Dispute resolution API endpoints.

Endpoints:
    POST   /api/disputes                       — Open a new dispute
    GET    /api/disputes                        — List disputes (filterable)
    GET    /api/disputes/stats                  — Aggregate dispute statistics
    GET    /api/disputes/{dispute_id}           — Get dispute detail with evidence + audit trail
    POST   /api/disputes/{dispute_id}/evidence  — Submit evidence (contributor or creator)
    POST   /api/disputes/{dispute_id}/mediate   — Advance to mediation (triggers AI review)
    POST   /api/disputes/{dispute_id}/resolve   — Admin resolves the dispute
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user, get_current_user_id
from app.database import get_db
from app.models.dispute import (
    DisputeCreate,
    DisputeDetailResponse,
    DisputeListResponse,
    DisputeResolve,
    DisputeResponse,
    DisputeStats,
    EvidenceResponse,
    EvidenceSubmit,
)
from app.models.user import UserResponse
from app.services.dispute_service import DisputeService
from app.services import bounty_service

router = APIRouter(prefix="/api/disputes", tags=["disputes"])


def _get_service(db: AsyncSession = Depends(get_db)) -> DisputeService:
    return DisputeService(db)


@router.post("", response_model=DisputeResponse, status_code=201)
async def create_dispute(
    data: DisputeCreate,
    user: UserResponse = Depends(get_current_user),
    svc: DisputeService = Depends(_get_service),
) -> DisputeResponse:
    """
    Open a new dispute on a rejected submission.

    The contributor must be the submitter, and the rejection
    must have occurred within the last 72 hours.
    """
    bounty = bounty_service.get_bounty(data.bounty_id)
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")

    submission = None
    submissions = bounty_service.get_submissions(data.bounty_id)
    if submissions:
        for s in submissions:
            if s.id == data.submission_id:
                submission = s
                break

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if submission.status != "rejected":
        raise HTTPException(
            status_code=400,
            detail=f"Only rejected submissions can be disputed. Current status: {submission.status}",
        )

    contributor_id = str(user.id)
    creator_id = bounty.created_by

    rejection_ts = getattr(submission, "reviewed_at", None) or submission.submitted_at

    try:
        result = await svc.create_dispute(
            data=data,
            contributor_id=contributor_id,
            creator_id=creator_id,
            rejection_timestamp=rejection_ts,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=DisputeListResponse)
async def list_disputes(
    bounty_id: Optional[str] = Query(None, description="Filter by bounty ID"),
    contributor_id: Optional[str] = Query(None, description="Filter by contributor"),
    creator_id: Optional[str] = Query(None, description="Filter by creator"),
    state: Optional[str] = Query(None, description="Filter by state"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    svc: DisputeService = Depends(_get_service),
) -> DisputeListResponse:
    """List disputes with optional filters and pagination."""
    return await svc.list_disputes(
        bounty_id=bounty_id,
        contributor_id=contributor_id,
        creator_id=creator_id,
        state=state,
        skip=skip,
        limit=limit,
    )


@router.get("/stats", response_model=DisputeStats)
async def dispute_stats(
    svc: DisputeService = Depends(_get_service),
) -> DisputeStats:
    """Aggregate statistics across all disputes."""
    return await svc.get_stats()


@router.get("/{dispute_id}", response_model=DisputeDetailResponse)
async def get_dispute(
    dispute_id: str,
    svc: DisputeService = Depends(_get_service),
) -> DisputeDetailResponse:
    """Get full dispute details including evidence and audit trail."""
    result = await svc.get_dispute(dispute_id)
    if not result:
        raise HTTPException(status_code=404, detail="Dispute not found")
    return result


@router.post(
    "/{dispute_id}/evidence",
    response_model=list[EvidenceResponse],
    status_code=201,
)
async def submit_evidence(
    dispute_id: str,
    data: EvidenceSubmit,
    user: UserResponse = Depends(get_current_user),
    svc: DisputeService = Depends(_get_service),
) -> list[EvidenceResponse]:
    """
    Submit evidence for a dispute.

    Both the contributor and the bounty creator can submit evidence
    during the EVIDENCE phase. Each call can include up to 10 items.
    """
    try:
        return await svc.submit_evidence(
            dispute_id=dispute_id,
            items=data.items,
            user_id=str(user.id),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{dispute_id}/mediate", response_model=DisputeResponse)
async def advance_to_mediation(
    dispute_id: str,
    user_id: str = Depends(get_current_user_id),
    svc: DisputeService = Depends(_get_service),
) -> DisputeResponse:
    """
    Advance a dispute from EVIDENCE to MEDIATION.

    Triggers AI auto-mediation. If the AI score meets the threshold,
    the dispute is auto-resolved in the contributor's favor.
    Otherwise, the dispute awaits manual admin resolution.
    """
    try:
        return await svc.advance_to_mediation(dispute_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{dispute_id}/resolve", response_model=DisputeResponse)
async def resolve_dispute(
    dispute_id: str,
    data: DisputeResolve,
    user_id: str = Depends(get_current_user_id),
    svc: DisputeService = Depends(_get_service),
) -> DisputeResponse:
    """
    Admin resolves a dispute that is in MEDIATION state.

    Outcomes:
    - release_to_contributor: full payout to contributor
    - refund_to_creator: full refund to bounty creator
    - split: partial payout split between both parties

    Reputation impact is applied automatically based on outcome.
    A Telegram notification is sent to the admin channel.
    """
    try:
        return await svc.resolve_dispute(dispute_id, data, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
