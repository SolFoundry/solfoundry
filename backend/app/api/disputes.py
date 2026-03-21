"""Dispute resolution API endpoints. All require authentication."""

import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from app.auth import get_current_user_id
from app.models.dispute import (
    DisputeCreate, DisputeDetailResponse, DisputeListResponse,
    DisputeResolve, DisputeResponse, DisputeStats, DisputeStatus,
    EvidenceSubmit,
)
from app.services import dispute_service

router = APIRouter(prefix="/disputes", tags=["disputes"])


class DisputeNotFoundError(Exception):
    """Dispute or entity not found."""
class DisputeConflictError(Exception):
    """Duplicate or conflicting action."""
class DisputeForbiddenError(Exception):
    """User lacks permission."""
class DisputeValidationError(Exception):
    """Input validation failed."""

_EXCEPTION_STATUS_MAP: dict[type, int] = {
    DisputeNotFoundError: 404, DisputeConflictError: 409,
    DisputeForbiddenError: 403, DisputeValidationError: 400,
}

def _raise(error: str) -> None:
    """Raise HTTPException mapped from structured exception types."""
    el = error.lower()
    if "not found" in el: et = DisputeNotFoundError
    elif "already exists" in el: et = DisputeConflictError
    elif any(kw in el for kw in ("admin", "participants", "forbidden")): et = DisputeForbiddenError
    else: et = DisputeValidationError
    raise HTTPException(status_code=_EXCEPTION_STATUS_MAP[et], detail=error)


@router.post("", response_model=DisputeResponse, status_code=201)
async def create_dispute(
    data: DisputeCreate,
    user_id: str = Depends(get_current_user_id),
):
    """File a new dispute against a bounty rejection.

    The authenticated user is the submitter. The bounty creator is
    looked up server-side from the bounty record.
    """
    result, error = await asyncio.to_thread(dispute_service.create_dispute, data, user_id)
    if error:
        _raise(error)
    return result


@router.get("", response_model=DisputeListResponse)
async def list_disputes(
    dispute_status: Optional[DisputeStatus] = Query(None, alias="status"),
    bounty_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
):
    """List disputes visible to the current user with optional filters."""
    return await asyncio.to_thread(dispute_service.list_disputes,
        user_id=user_id, status=dispute_status,
        bounty_id=bounty_id, skip=skip, limit=limit)


@router.get("/stats", response_model=DisputeStats)
async def get_stats(user_id: str = Depends(get_current_user_id)):
    """Get aggregate dispute statistics scoped to the current user.

    Admins see platform-wide stats. Regular users see stats for disputes
    they participate in (as submitter or creator).
    """
    return await asyncio.to_thread(dispute_service.get_dispute_stats, user_id)


@router.get("/{dispute_id}", response_model=DisputeDetailResponse)
async def get_dispute(
    dispute_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Get dispute details with audit history. Access restricted to participants and admins."""
    result, error = await asyncio.to_thread(dispute_service.get_dispute, dispute_id, user_id=user_id)
    if error == "not_found":
        raise HTTPException(404, detail="Dispute not found")
    if error == "forbidden":
        raise HTTPException(403, detail="Access denied")
    return result


@router.post("/{dispute_id}/evidence", response_model=DisputeResponse)
async def submit_evidence(
    dispute_id: str,
    data: EvidenceSubmit,
    user_id: str = Depends(get_current_user_id),
):
    """Submit evidence. Both sides can submit during OPENED/EVIDENCE phases."""
    result, error = await asyncio.to_thread(dispute_service.submit_evidence, dispute_id, data, user_id)
    if error:
        _raise(error)
    return result


@router.post("/{dispute_id}/resolve", response_model=DisputeResponse)
async def resolve_dispute(
    dispute_id: str,
    data: DisputeResolve,
    user_id: str = Depends(get_current_user_id),
):
    """Admin resolves a dispute. AI mediation runs automatically as part of the flow."""
    result, error = await asyncio.to_thread(dispute_service.resolve_dispute, dispute_id, data, user_id)
    if error:
        _raise(error)
    return result
