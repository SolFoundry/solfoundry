"""Disputes API endpoints."""

from typing import List, Any
from uuid import UUID
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db

from app.api.auth import get_current_user_id, get_admin_user_id
from app.models.dispute import (
    DisputeCreate,
    DisputeResponse,
    DisputeDetailResponse,
    DisputeResolve,
    EvidenceItem,
)
from app.services.dispute_service import DisputeError, dispute_service

router = APIRouter(prefix="/api/disputes", tags=["Disputes"])


class ErrorResponse(BaseModel):
    detail: str


@router.post(
    "",
    response_model=DisputeResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}},
)
async def create_dispute(
    data: DisputeCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Initiate a dispute for a rejected bounty submission. Must be within 72 hours of rejection."""
    try:
        dispute = await dispute_service.create_dispute(db, data, submitter_id=current_user_id)
        return dispute
    except DisputeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/{dispute_id}",
    response_model=DisputeDetailResponse,
    responses={404: {"model": ErrorResponse}},
)
async def get_dispute(
    dispute_id: UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve full details and history for a dispute. Only participants can view."""
    try:
        return await dispute_service.get_dispute(db, dispute_id, actor_id=current_user_id)
    except DisputeError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/{dispute_id}/evidence",
    response_model=DisputeResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def submit_evidence(
    dispute_id: UUID,
    evidence: List[EvidenceItem],
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Submit new evidence for an open dispute. Only participants can call this."""
    try:
        return await dispute_service.add_evidence(db, dispute_id, evidence, actor_id=current_user_id)
    except DisputeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/{dispute_id}/resolve",
    response_model=DisputeResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
async def resolve_dispute(
    dispute_id: UUID,
    data: DisputeResolve,
    admin_id: str = Depends(get_admin_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Resolve a dispute. Reserved for platform admins (manual mediation)."""
    try:
        return await dispute_service.resolve_dispute(db, dispute_id, data, actor_id=admin_id)
    except DisputeError as e:
        raise HTTPException(status_code=400, detail=str(e))
