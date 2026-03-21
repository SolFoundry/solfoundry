"""Dispute resolution API endpoints.

Endpoints:
    POST   /api/disputes                      — Open a new dispute
    GET    /api/disputes                       — List disputes (with filters)
    GET    /api/disputes/stats                 — Aggregate dispute statistics
    GET    /api/disputes/{dispute_id}          — Get dispute detail with evidence & history
    POST   /api/disputes/{dispute_id}/evidence — Submit evidence (contributor or creator)
    POST   /api/disputes/{dispute_id}/mediate  — Trigger AI mediation
    POST   /api/disputes/{dispute_id}/resolve  — Admin manual resolution
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import UserResponse
from app.models.dispute import (
    DisputeCreate,
    DisputeResolve,
    DisputeResponse,
    DisputeDetailResponse,
    DisputeListResponse,
    DisputeStats,
    EvidenceResponse,
    EvidenceSubmit,
)
from app.services.dispute_service import DisputeService

router = APIRouter(prefix="/api/disputes", tags=["disputes"])


def _user_id(user: UserResponse) -> str:
    return user.wallet_address or str(user.id)


# ── CREATE ────────────────────────────────────────────────────────────────


@router.post(
    "",
    response_model=DisputeResponse,
    status_code=201,
    summary="Open a new dispute on a rejected submission",
)
async def create_dispute(
    data: DisputeCreate,
    user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DisputeResponse:
    svc = DisputeService(db)
    try:
        return await svc.create_dispute(data, _user_id(user))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── LIST ──────────────────────────────────────────────────────────────────


@router.get(
    "",
    response_model=DisputeListResponse,
    summary="List disputes with optional filters",
)
async def list_disputes(
    bounty_id: Optional[str] = Query(None, description="Filter by bounty ID"),
    contributor_id: Optional[str] = Query(None, description="Filter by contributor"),
    creator_id: Optional[str] = Query(None, description="Filter by creator"),
    status: Optional[str] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> DisputeListResponse:
    svc = DisputeService(db)
    return await svc.list_disputes(
        bounty_id=bounty_id,
        contributor_id=contributor_id,
        creator_id=creator_id,
        status=status,
        skip=skip,
        limit=limit,
    )


# ── STATS ─────────────────────────────────────────────────────────────────


@router.get(
    "/stats",
    response_model=DisputeStats,
    summary="Get aggregate dispute statistics",
)
async def get_dispute_stats(
    db: AsyncSession = Depends(get_db),
) -> DisputeStats:
    svc = DisputeService(db)
    return await svc.get_stats()


# ── DETAIL ────────────────────────────────────────────────────────────────


@router.get(
    "/{dispute_id}",
    response_model=DisputeDetailResponse,
    summary="Get full dispute details with evidence and audit history",
)
async def get_dispute(
    dispute_id: str,
    db: AsyncSession = Depends(get_db),
) -> DisputeDetailResponse:
    svc = DisputeService(db)
    result = await svc.get_dispute(dispute_id)
    if not result:
        raise HTTPException(status_code=404, detail="Dispute not found")
    return result


# ── EVIDENCE ──────────────────────────────────────────────────────────────


@router.post(
    "/{dispute_id}/evidence",
    response_model=list[EvidenceResponse],
    status_code=201,
    summary="Submit evidence for a dispute (contributor or creator)",
)
async def submit_evidence(
    dispute_id: str,
    data: EvidenceSubmit,
    user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[EvidenceResponse]:
    svc = DisputeService(db)
    try:
        return await svc.submit_evidence(dispute_id, data, _user_id(user))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── AI MEDIATION ──────────────────────────────────────────────────────────


@router.post(
    "/{dispute_id}/mediate",
    response_model=DisputeResponse,
    summary="Trigger AI mediation — auto-resolves if score >= 7/10",
)
async def trigger_ai_mediation(
    dispute_id: str,
    user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DisputeResponse:
    svc = DisputeService(db)
    try:
        return await svc.trigger_ai_mediation(dispute_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── MANUAL RESOLUTION ────────────────────────────────────────────────────


@router.post(
    "/{dispute_id}/resolve",
    response_model=DisputeResponse,
    summary="Resolve a dispute manually (admin action)",
)
async def resolve_dispute(
    dispute_id: str,
    data: DisputeResolve,
    user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DisputeResponse:
    svc = DisputeService(db)
    try:
        return await svc.resolve_dispute(dispute_id, data, _user_id(user))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
