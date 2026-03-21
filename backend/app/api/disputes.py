"""Dispute resolution API endpoints.

Endpoints:
    POST   /api/disputes                       — Open a new dispute
    GET    /api/disputes                        — List disputes (authenticated, scoped)
    GET    /api/disputes/stats                  — Aggregate dispute statistics (admin)
    GET    /api/disputes/{dispute_id}           — Get dispute detail (parties or admin)
    POST   /api/disputes/{dispute_id}/evidence  — Submit evidence (contributor or creator)
    POST   /api/disputes/{dispute_id}/mediate   — Advance to mediation (parties or admin)
    POST   /api/disputes/{dispute_id}/resolve   — Admin resolves the dispute
"""

import uuid as _uuid
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


def _require_admin(user: UserResponse) -> None:
    """Raise 403 unless the user has an admin role on the platform."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )


def _validate_uuid(value: str, field_name: str = "ID") -> str:
    try:
        _uuid.UUID(value)
        return value
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {field_name} format: must be a valid UUID",
        )


def _get_service(db: AsyncSession = Depends(get_db)) -> DisputeService:
    return DisputeService(db)


# ── Create ────────────────────────────────────────────────────────────────


@router.post("", response_model=DisputeResponse, status_code=201)
async def create_dispute(
    data: DisputeCreate,
    user: UserResponse = Depends(get_current_user),
    svc: DisputeService = Depends(_get_service),
) -> DisputeResponse:
    """
    Open a new dispute on a rejected submission.

    Only the original submitter can open a dispute, and the rejection
    must have occurred within the last 72 hours.
    """
    _validate_uuid(data.bounty_id, "bounty_id")
    _validate_uuid(data.submission_id, "submission_id")

    bounty = bounty_service.get_bounty(data.bounty_id)
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")

    submission = bounty_service.get_submission(data.bounty_id, data.submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if submission.status != "rejected":
        raise HTTPException(
            status_code=400,
            detail=f"Only rejected submissions can be disputed. Current status: {submission.status}",
        )

    submitter_identity = str(user.id)
    submitted_by = getattr(submission, "submitted_by", None)

    if submitted_by != submitter_identity:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the original submitter can dispute a rejection",
        )

    contributor_id = submitter_identity
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


# ── List ──────────────────────────────────────────────────────────────────


@router.get("", response_model=DisputeListResponse)
async def list_disputes(
    bounty_id: Optional[str] = Query(None, description="Filter by bounty ID"),
    contributor_id: Optional[str] = Query(None, description="Filter by contributor"),
    creator_id: Optional[str] = Query(None, description="Filter by creator"),
    state: Optional[str] = Query(None, description="Filter by state"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: UserResponse = Depends(get_current_user),
    svc: DisputeService = Depends(_get_service),
) -> DisputeListResponse:
    """
    List disputes with optional filters and pagination.

    Non-admin users can only see disputes they are a party to.
    Admins can see all disputes.
    """
    user_id = str(user.id)
    is_admin = user.role == "admin"

    if bounty_id:
        _validate_uuid(bounty_id, "bounty_id")
    if contributor_id:
        _validate_uuid(contributor_id, "contributor_id")
    if creator_id:
        _validate_uuid(creator_id, "creator_id")

    if not is_admin and not contributor_id and not creator_id:
        contributor_id = user_id

    try:
        return await svc.list_disputes(
            bounty_id=bounty_id,
            contributor_id=contributor_id,
            creator_id=creator_id,
            state=state,
            skip=skip,
            limit=limit,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Stats ─────────────────────────────────────────────────────────────────


@router.get("/stats", response_model=DisputeStats)
async def dispute_stats(
    user: UserResponse = Depends(get_current_user),
    svc: DisputeService = Depends(_get_service),
) -> DisputeStats:
    """Aggregate statistics across all disputes. Admin only."""
    _require_admin(user)
    return await svc.get_stats()


# ── Detail ────────────────────────────────────────────────────────────────


@router.get("/{dispute_id}", response_model=DisputeDetailResponse)
async def get_dispute(
    dispute_id: str,
    user: UserResponse = Depends(get_current_user),
    svc: DisputeService = Depends(_get_service),
) -> DisputeDetailResponse:
    """
    Get full dispute details including evidence and audit trail.

    Only the contributor, creator, or an admin can view a dispute.
    """
    _validate_uuid(dispute_id, "dispute_id")

    result = await svc.get_dispute(dispute_id)
    if not result:
        raise HTTPException(status_code=404, detail="Dispute not found")

    user_id = str(user.id)
    is_party = user_id in (result.contributor_id, result.creator_id)
    if not is_party and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this dispute",
        )

    return result


# ── Evidence ──────────────────────────────────────────────────────────────


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
    _validate_uuid(dispute_id, "dispute_id")

    try:
        return await svc.submit_evidence(
            dispute_id=dispute_id,
            items=data.items,
            user_id=str(user.id),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Mediate ───────────────────────────────────────────────────────────────


@router.post("/{dispute_id}/mediate", response_model=DisputeResponse)
async def advance_to_mediation(
    dispute_id: str,
    user: UserResponse = Depends(get_current_user),
    svc: DisputeService = Depends(_get_service),
) -> DisputeResponse:
    """
    Advance a dispute from EVIDENCE to MEDIATION.

    Only the contributor, creator, or an admin can trigger mediation.
    Runs AI auto-mediation. If the AI score meets the threshold,
    the dispute is auto-resolved in the contributor's favor.
    """
    _validate_uuid(dispute_id, "dispute_id")

    user_id = str(user.id)
    dispute = await svc.get_dispute_by_id(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    is_party = user_id in (str(dispute.contributor_id), str(dispute.creator_id))
    if not is_party and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only dispute parties or admins can advance to mediation",
        )

    try:
        return await svc.advance_to_mediation(dispute_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Resolve ───────────────────────────────────────────────────────────────


@router.post("/{dispute_id}/resolve", response_model=DisputeResponse)
async def resolve_dispute(
    dispute_id: str,
    data: DisputeResolve,
    user: UserResponse = Depends(get_current_user),
    svc: DisputeService = Depends(_get_service),
) -> DisputeResponse:
    """
    Admin resolves a dispute that is in MEDIATION state.

    Requires admin role. Outcomes:
    - release_to_contributor: full payout to contributor
    - refund_to_creator: full refund to bounty creator
    - split: partial payout split between both parties

    Reputation impact is applied automatically based on outcome and
    pushed to the contributor service for immediate profile updates.
    """
    _validate_uuid(dispute_id, "dispute_id")
    _require_admin(user)

    try:
        return await svc.resolve_dispute(dispute_id, data, str(user.id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
