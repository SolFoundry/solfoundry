"""Dispute Resolution API router.

Endpoints:
    POST   /disputes                    — File a new dispute
    GET    /disputes/{dispute_id}       — Get dispute details
    POST   /disputes/{dispute_id}/evidence  — Submit evidence
    POST   /disputes/{dispute_id}/resolve   — Resolve dispute (admin)
    GET    /disputes                    — List disputes (admin)
    GET    /disputes/stats              — Aggregate stats (admin)

Lifecycle: PENDING → UNDER_REVIEW → RESOLVED
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.auth import get_current_user_id
from app.models.dispute import (
    DisputeCreate,
    DisputeDetailResponse,
    DisputeListResponse,
    DisputeResolve,
    DisputeResponse,
    DisputeStats,
    EvidenceItem,
)
from app.services import dispute_service

router = APIRouter(prefix="/disputes", tags=["disputes"])


def _validate_dispute_uuid(dispute_id: str) -> str:
    """Validate that *dispute_id* is a well-formed UUID.

    Raises HTTPException 400 on invalid format so callers receive a
    meaningful error rather than a 500 from a downstream ValueError.
    """
    try:
        uuid.UUID(dispute_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid dispute_id format: '{dispute_id}'",
        )
    return dispute_id


# ---------------------------------------------------------------------------
# File a dispute
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=DisputeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="File a dispute",
    description="""
    File a dispute for a rejected bounty submission.

    The authenticated user must be the contributor whose submission was
    rejected.  A dispute may only be filed within 72 hours of rejection.
    """,
    responses={
        400: {"description": "Invalid payload or duplicate dispute"},
        401: {"description": "Authentication required"},
    },
)
async def create_dispute(
    data: DisputeCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> DisputeResponse:
    """File a new dispute."""
    try:
        return await dispute_service.initiate_dispute(
            db=db,
            data=data,
            submitter_id=user_id,
            submission_rejected_at=None,  # Caller may supply via query param in future
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ---------------------------------------------------------------------------
# Get dispute details
# ---------------------------------------------------------------------------


@router.get(
    "/stats",
    response_model=DisputeStats,
    summary="Dispute statistics",
    description="Aggregate dispute statistics (admin use).",
)
async def get_stats(
    db: AsyncSession = Depends(get_db),
) -> DisputeStats:
    """Return aggregate dispute statistics."""
    return await dispute_service.get_dispute_stats(db)


@router.get(
    "",
    response_model=DisputeListResponse,
    summary="List disputes",
    description="List disputes with optional filters.",
)
async def list_disputes(
    bounty_id: Optional[str] = Query(None, description="Filter by bounty ID"),
    submitter_id: Optional[str] = Query(None, description="Filter by submitter ID"),
    dispute_status: Optional[str] = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> DisputeListResponse:
    """List disputes."""
    return await dispute_service.list_disputes(
        db=db,
        bounty_id=bounty_id,
        submitter_id=submitter_id,
        status=dispute_status,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{dispute_id}",
    response_model=DisputeDetailResponse,
    summary="Get dispute details",
    description="""
    Retrieve full dispute details including audit history.

    Access is restricted to the dispute submitter and assigned reviewer.
    Admins may pass `admin=true` to bypass the restriction.
    """,
    responses={
        400: {"description": "Invalid dispute_id format"},
        404: {"description": "Dispute not found"},
    },
)
async def get_dispute(
    dispute_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> DisputeDetailResponse:
    """Get full dispute details."""
    _validate_dispute_uuid(dispute_id)

    detail = await dispute_service.get_dispute_detail(
        db=db,
        dispute_id=dispute_id,
        requesting_user_id=user_id,
    )
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found")
    return detail


# ---------------------------------------------------------------------------
# Submit evidence
# ---------------------------------------------------------------------------


class EvidenceSubmission(DisputeCreate.__class__):
    """Payload for submitting evidence to an existing dispute."""
    pass


from pydantic import BaseModel


class EvidencePayload(BaseModel):
    """Request body for evidence submission."""
    items: list[EvidenceItem]
    notes: Optional[str] = None


@router.post(
    "/{dispute_id}/evidence",
    response_model=DisputeResponse,
    summary="Submit evidence",
    description="""
    Append evidence to an open dispute.

    Only the contributor who filed the dispute may submit evidence.
    The dispute must not yet be resolved.
    """,
    responses={
        400: {"description": "Invalid dispute_id or dispute already resolved"},
        401: {"description": "Authentication required"},
        403: {"description": "Not the dispute submitter"},
        404: {"description": "Dispute not found"},
    },
)
async def submit_evidence(
    dispute_id: str,
    payload: EvidencePayload,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> DisputeResponse:
    """Submit evidence to an open dispute."""
    _validate_dispute_uuid(dispute_id)

    try:
        return await dispute_service.submit_evidence(
            db=db,
            dispute_id=dispute_id,
            actor_id=user_id,
            items=payload.items,
            notes=payload.notes,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ---------------------------------------------------------------------------
# Resolve dispute (admin)
# ---------------------------------------------------------------------------


@router.post(
    "/{dispute_id}/resolve",
    response_model=DisputeResponse,
    summary="Resolve a dispute (admin)",
    description="""
    Manually resolve an open dispute.

    This endpoint is restricted to platform administrators.
    The resolution outcome must be one of: `approved`, `rejected`, `cancelled`.
    """,
    responses={
        400: {"description": "Invalid dispute_id or dispute already resolved"},
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        404: {"description": "Dispute not found"},
    },
)
async def resolve_dispute(
    dispute_id: str,
    resolution: DisputeResolve,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> DisputeResponse:
    """Resolve a dispute (admin only).

    NOTE: In production this should verify that *user_id* has the admin
    role.  The admin role check is omitted here because the user model
    does not yet carry a ``role`` field; wire in ``is_admin(user_id)``
    once the role system is implemented.
    """
    _validate_dispute_uuid(dispute_id)

    try:
        return await dispute_service.resolve_dispute(
            db=db,
            dispute_id=dispute_id,
            resolution=resolution,
            admin_id=user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ---------------------------------------------------------------------------
# AI auto-mediation trigger (internal / system use)
# ---------------------------------------------------------------------------


class AIMediationRequest(BaseModel):
    """Request body for triggering AI mediation."""
    ai_review_score: float


@router.post(
    "/{dispute_id}/ai-mediate",
    response_model=Optional[DisputeResponse],
    summary="Trigger AI auto-mediation",
    description="""
    Attempt AI-powered auto-mediation.

    If the AI review score is ≥ 7.0/10 the dispute is automatically
    resolved in the contributor's favour.  Returns null if the threshold
    is not met.
    """,
    responses={
        400: {"description": "Invalid dispute_id"},
        401: {"description": "Authentication required"},
    },
)
async def ai_mediate(
    dispute_id: str,
    payload: AIMediationRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Optional[DisputeResponse]:
    """Trigger AI auto-mediation for a dispute."""
    _validate_dispute_uuid(dispute_id)

    return await dispute_service.try_ai_auto_mediation(
        db=db,
        dispute_id=dispute_id,
        ai_review_score=payload.ai_review_score,
        system_actor_id=user_id,
    )
