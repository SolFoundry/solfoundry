from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import logging

from ..auth.dependencies import get_current_user_id
from ..services.bounty_lifecycle_engine import BountyLifecycleEngine
from ..models.bounty import BountyStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bounty-lifecycle", tags=["bounty-lifecycle"])


class ClaimRequest(BaseModel):
    estimated_hours: Optional[int] = None
    approach_notes: Optional[str] = None


class ClaimResponse(BaseModel):
    success: bool
    message: str
    deadline: Optional[datetime] = None
    bounty_id: str


class ReleaseRequest(BaseModel):
    reason: Optional[str] = None


class ReleaseResponse(BaseModel):
    success: bool
    message: str
    bounty_id: str


class SubmitReviewRequest(BaseModel):
    pull_request_url: str
    submission_notes: Optional[str] = None


class SubmitReviewResponse(BaseModel):
    success: bool
    message: str
    bounty_id: str


class ApprovalRequest(BaseModel):
    feedback: Optional[str] = None
    bonus_amount: Optional[float] = None


class ApprovalResponse(BaseModel):
    success: bool
    message: str
    bounty_id: str
    payment_initiated: bool = False


class RejectionRequest(BaseModel):
    feedback: str
    allow_resubmission: bool = True


class RejectionResponse(BaseModel):
    success: bool
    message: str
    bounty_id: str


class BountyStatusResponse(BaseModel):
    bounty_id: str
    status: BountyStatus
    claimed_by: Optional[str] = None
    claimed_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    time_remaining_hours: Optional[float] = None
    can_claim: bool
    can_release: bool
    can_submit: bool
    last_updated: datetime


class AuditLogEntry(BaseModel):
    timestamp: datetime
    action: str
    user_id: Optional[str] = None
    details: dict
    previous_status: Optional[BountyStatus] = None
    new_status: Optional[BountyStatus] = None


class AuditLogResponse(BaseModel):
    bounty_id: str
    entries: List[AuditLogEntry]
    total_count: int


@router.post("/claim/{bounty_id}", response_model=ClaimResponse)
async def claim_bounty(
    bounty_id: str,
    request: ClaimRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Claim an available bounty with tier-specific validation."""
    try:
        lifecycle = BountyLifecycleEngine()
        result = await lifecycle.claim_bounty(
            bounty_id=bounty_id,
            user_id=user_id,
            estimated_hours=request.estimated_hours,
            approach_notes=request.approach_notes
        )

        if not result.success:
            raise HTTPException(status_code=400, detail=result.message)

        return ClaimResponse(
            success=True,
            message=result.message,
            deadline=result.deadline,
            bounty_id=bounty_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error claiming bounty {bounty_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/release/{bounty_id}", response_model=ReleaseResponse)
async def release_bounty(
    bounty_id: str,
    request: ReleaseRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Release a claimed bounty back to open status."""
    try:
        lifecycle = BountyLifecycleEngine()
        result = await lifecycle.release_bounty(
            bounty_id=bounty_id,
            user_id=user_id,
            reason=request.reason
        )

        if not result.success:
            raise HTTPException(status_code=400, detail=result.message)

        return ReleaseResponse(
            success=True,
            message=result.message,
            bounty_id=bounty_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error releasing bounty {bounty_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/submit-review/{bounty_id}", response_model=SubmitReviewResponse)
async def submit_for_review(
    bounty_id: str,
    request: SubmitReviewRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Submit completed work for review."""
    try:
        lifecycle = BountyLifecycleEngine()
        result = await lifecycle.submit_for_review(
            bounty_id=bounty_id,
            user_id=user_id,
            pull_request_url=request.pull_request_url,
            submission_notes=request.submission_notes
        )

        if not result.success:
            raise HTTPException(status_code=400, detail=result.message)

        return SubmitReviewResponse(
            success=True,
            message=result.message,
            bounty_id=bounty_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting bounty {bounty_id} for review: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/approve/{bounty_id}", response_model=ApprovalResponse)
async def approve_bounty(
    bounty_id: str,
    request: ApprovalRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Approve completed bounty work (admin/maintainer only)."""
    try:
        lifecycle = BountyLifecycleEngine()
        result = await lifecycle.approve_bounty(
            bounty_id=bounty_id,
            approver_id=user_id,
            feedback=request.feedback,
            bonus_amount=request.bonus_amount
        )

        if not result.success:
            raise HTTPException(status_code=400, detail=result.message)

        return ApprovalResponse(
            success=True,
            message=result.message,
            bounty_id=bounty_id,
            payment_initiated=result.payment_initiated
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving bounty {bounty_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/reject/{bounty_id}", response_model=RejectionResponse)
async def reject_bounty(
    bounty_id: str,
    request: RejectionRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Reject bounty submission (admin/maintainer only)."""
    try:
        lifecycle = BountyLifecycleEngine()
        result = await lifecycle.reject_bounty(
            bounty_id=bounty_id,
            reviewer_id=user_id,
            feedback=request.feedback,
            allow_resubmission=request.allow_resubmission
        )

        if not result.success:
            raise HTTPException(status_code=400, detail=result.message)

        return RejectionResponse(
            success=True,
            message=result.message,
            bounty_id=bounty_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting bounty {bounty_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/status/{bounty_id}", response_model=BountyStatusResponse)
async def get_bounty_status(
    bounty_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Get detailed status information for a bounty."""
    try:
        lifecycle = BountyLifecycleEngine()
        status_info = await lifecycle.get_bounty_status(bounty_id)

        if not status_info:
            raise HTTPException(status_code=404, detail="Bounty not found")

        permissions = await lifecycle.get_user_permissions(bounty_id, user_id)

        return BountyStatusResponse(
            bounty_id=bounty_id,
            status=status_info.status,
            claimed_by=status_info.claimed_by,
            claimed_at=status_info.claimed_at,
            deadline=status_info.deadline,
            time_remaining_hours=status_info.time_remaining_hours,
            can_claim=permissions.can_claim,
            can_release=permissions.can_release,
            can_submit=permissions.can_submit,
            last_updated=status_info.last_updated
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting bounty status {bounty_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/audit-log/{bounty_id}", response_model=AuditLogResponse)
async def get_audit_log(
    bounty_id: str,
    offset: int = 0,
    limit: int = 50,
    user_id: str = Depends(get_current_user_id)
):
    """Get immutable audit log for bounty lifecycle events."""
    try:
        lifecycle = BountyLifecycleEngine()
        audit_data = await lifecycle.get_audit_log(
            bounty_id=bounty_id,
            offset=offset,
            limit=limit
        )

        if not audit_data:
            raise HTTPException(status_code=404, detail="Bounty not found")

        entries = [
            AuditLogEntry(
                timestamp=entry.timestamp,
                action=entry.action,
                user_id=entry.user_id,
                details=entry.details,
                previous_status=entry.previous_status,
                new_status=entry.new_status
            )
            for entry in audit_data.entries
        ]

        return AuditLogResponse(
            bounty_id=bounty_id,
            entries=entries,
            total_count=audit_data.total_count
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting audit log for bounty {bounty_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
