"""Dispute resolution API (Issue #192).

POST /disputes, GET /disputes/{id}, GET /disputes, POST /disputes/{id}/evidence,
POST /disputes/{id}/mediate, POST /disputes/{id}/resolve, GET /disputes/stats
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth import get_current_user_id
from app.database import get_db
from app.exceptions import (
    BountyNotFoundError, DisputeNotFoundError, DisputeWindowExpiredError,
    DuplicateDisputeError, InvalidDisputeTransitionError,
    SubmissionNotFoundError, UnauthorizedDisputeAccessError,
)
from app.models.dispute import (
    DisputeCreate, DisputeDetailResponse, DisputeEvidenceSubmit,
    DisputeListResponse, DisputeResolve, DisputeResponse,
)
from app.services.dispute_service import DisputeService

router = APIRouter(prefix="/disputes", tags=["disputes"])
_svc = lambda db=Depends(get_db): DisputeService(db)

@router.post("", response_model=DisputeResponse, status_code=201, summary="Open dispute")
async def create_dispute(data: DisputeCreate, uid: str = Depends(get_current_user_id),
                         svc: DisputeService = Depends(_svc)) -> DisputeResponse:
    """Initiate a dispute on a rejected submission within 72h."""
    try: return await svc.create_dispute(data, uid)
    except (BountyNotFoundError, SubmissionNotFoundError) as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    except (DuplicateDisputeError, DisputeWindowExpiredError) as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

@router.get("", response_model=DisputeListResponse, summary="List disputes")
async def list_disputes(
    dispute_status: Optional[str] = Query(None, alias="status"),
    bounty_id: Optional[str] = Query(None), contributor_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
    uid: str = Depends(get_current_user_id), svc: DisputeService = Depends(_svc),
) -> DisputeListResponse:
    """List disputes with optional filters and pagination."""
    return await svc.list_disputes(dispute_status, bounty_id, contributor_id, skip, limit)

@router.get("/{dispute_id}", response_model=DisputeDetailResponse, summary="Get dispute")
async def get_dispute(dispute_id: str, uid: str = Depends(get_current_user_id),
                      svc: DisputeService = Depends(_svc)) -> DisputeDetailResponse:
    """Get dispute with full audit trail."""
    try: return await svc.get_dispute(dispute_id)
    except DisputeNotFoundError as e: raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))

@router.post("/{dispute_id}/evidence", response_model=DisputeResponse, summary="Submit evidence")
async def submit_evidence(dispute_id: str, data: DisputeEvidenceSubmit,
    uid: str = Depends(get_current_user_id), svc: DisputeService = Depends(_svc)) -> DisputeResponse:
    """Submit evidence. Transitions OPENED->EVIDENCE on first call."""
    try: return await svc.submit_evidence(dispute_id, data, uid)
    except DisputeNotFoundError as e: raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    except InvalidDisputeTransitionError as e: raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

@router.post("/{dispute_id}/mediate", response_model=DisputeResponse, summary="AI mediation")
async def mediate(dispute_id: str, uid: str = Depends(get_current_user_id),
                  svc: DisputeService = Depends(_svc)) -> DisputeResponse:
    """Move to mediation. Auto-resolves if AI score >= 7/10."""
    try: return await svc.move_to_mediation(dispute_id, uid)
    except DisputeNotFoundError as e: raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    except InvalidDisputeTransitionError as e: raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

@router.post("/{dispute_id}/resolve", response_model=DisputeResponse, summary="Resolve (admin)")
async def resolve(dispute_id: str, data: DisputeResolve, uid: str = Depends(get_current_user_id),
                  svc: DisputeService = Depends(_svc)) -> DisputeResponse:
    """Admin-only resolution. Outcomes: release_to_contributor, refund_to_creator, split."""
    try: return await svc.resolve_dispute(dispute_id, data, uid)
    except UnauthorizedDisputeAccessError as e: raise HTTPException(status.HTTP_403_FORBIDDEN, str(e))
    except DisputeNotFoundError as e: raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    except InvalidDisputeTransitionError as e: raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
