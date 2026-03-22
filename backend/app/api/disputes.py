from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth import get_current_user_id
from app.constants import INTERNAL_SYSTEM_USER_ID
from app.models.dispute import (
    DisputeCreate, DisputeResponse, DisputeListResponse,
    DisputeEvidenceCreate, DisputeResolve, DisputeDetailResponse
)
from app.services import dispute_service

router = APIRouter(prefix="/disputes", tags=["disputes"])

@router.post("", response_model=DisputeResponse, status_code=201)
async def create_dispute(
    data: DisputeCreate,
    user_id: str = Depends(get_current_user_id)
):
    """Initiate a dispute for a rejected submission."""
    # Data has reason (enum) and description (str)
    dispute, error = await dispute_service.initiate_dispute(data, user_id)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    return dispute

@router.get("/{dispute_id}", response_model=DisputeDetailResponse)
async def get_dispute(
    dispute_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Retrieve full dispute details including audit history."""
    # Using get_dispute_detail to fetch history
    dispute_detail = await dispute_service.get_dispute_detail(dispute_id)
    if not dispute_detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found")
    
    # Access control
    if user_id not in [dispute_detail.contributor_id, dispute_detail.creator_id, INTERNAL_SYSTEM_USER_ID]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    
    return dispute_detail

@router.post("/{dispute_id}/evidence", status_code=200)
async def submit_evidence(
    dispute_id: str,
    data: DisputeEvidenceCreate,
    user_id: str = Depends(get_current_user_id)
):
    """Submit evidence for an open dispute."""
    success, error = await dispute_service.submit_evidence(
        dispute_id, user_id, data.type, data.content
    )
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    return {"status": "success", "message": "Evidence submitted"}

@router.post("/{dispute_id}/resolve", response_model=DisputeDetailResponse)
async def resolve_dispute(
    dispute_id: str,
    data: DisputeResolve,
    user_id: str = Depends(get_current_user_id)
):
    """Resolve a dispute (Admin only)."""
    if user_id != INTERNAL_SYSTEM_USER_ID:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can resolve disputes")
    
    success, error = await dispute_service.resolve_dispute(dispute_id, data, user_id)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    
    # Return updated detail including history
    return await dispute_service.get_dispute_detail(dispute_id)
