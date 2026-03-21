from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json
import logging

from ..database import get_db
from ..models.bounty import Bounty, BountyStatus, BountyTier
from ..models.user import User
from ..models.audit import AuditLog
from ..schemas.bounty import BountyCreate, BountyUpdate, BountyResponse
from ..core.auth import get_current_user, require_permissions
from ..core.webhooks import WebhookHandler
from ..core.notifications import NotificationService

router = APIRouter(prefix="/api/lifecycle", tags=["lifecycle"])
logger = logging.getLogger(__name__)


@router.post("/create-draft")
async def create_draft(
    bounty_data: BountyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new bounty in DRAFT state"""
    try:
        bounty = Bounty(
            title=bounty_data.title,
            description=bounty_data.description,
            tier=bounty_data.tier,
            reward_amount=bounty_data.reward_amount,
            deadline=bounty_data.deadline,
            creator_id=current_user.id,
            status=BountyStatus.DRAFT,
            created_at=datetime.utcnow()
        )

        db.add(bounty)
        db.commit()
        db.refresh(bounty)

        # Log audit entry
        audit_entry = AuditLog(
            bounty_id=bounty.id,
            user_id=current_user.id,
            action="DRAFT_CREATED",
            details={"initial_tier": bounty.tier.value},
            timestamp=datetime.utcnow()
        )
        db.add(audit_entry)
        db.commit()

        return {"id": bounty.id, "status": "draft", "message": "Draft created successfully"}

    except Exception as e:
        logger.error(f"Failed to create draft: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create draft bounty")


@router.post("/publish/{bounty_id}")
async def publish_bounty(
    bounty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Publish a draft bounty to OPEN state"""
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()

    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")

    if bounty.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only creator can publish bounty")

    if bounty.status != BountyStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Can only publish draft bounties")

    bounty.status = BountyStatus.OPEN
    bounty.published_at = datetime.utcnow()

    audit_entry = AuditLog(
        bounty_id=bounty.id,
        user_id=current_user.id,
        action="BOUNTY_PUBLISHED",
        details={"tier": bounty.tier.value, "reward": str(bounty.reward_amount)},
        timestamp=datetime.utcnow()
    )
    db.add(audit_entry)
    db.commit()

    return {"status": "open", "message": "Bounty published successfully"}


@router.post("/claim/{bounty_id}")
async def claim_bounty(
    bounty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Claim an open bounty (T2/T3 only)"""
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()

    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")

    if bounty.status != BountyStatus.OPEN:
        raise HTTPException(status_code=400, detail="Bounty is not available for claiming")

    if bounty.tier == BountyTier.T1:
        raise HTTPException(status_code=400, detail="T1 bounties cannot be claimed - submit PR directly")

    if bounty.assignee_id:
        raise HTTPException(status_code=400, detail="Bounty already claimed")

    # Calculate claim deadline based on tier
    deadline_hours = 72 if bounty.tier == BountyTier.T2 else 168  # 3 days for T2, 7 days for T3
    claim_deadline = datetime.utcnow() + timedelta(hours=deadline_hours)

    bounty.status = BountyStatus.CLAIMED
    bounty.assignee_id = current_user.id
    bounty.claim_deadline = claim_deadline

    audit_entry = AuditLog(
        bounty_id=bounty.id,
        user_id=current_user.id,
        action="BOUNTY_CLAIMED",
        details={"claim_deadline": claim_deadline.isoformat()},
        timestamp=datetime.utcnow()
    )
    db.add(audit_entry)
    db.commit()

    return {
        "status": "claimed",
        "claim_deadline": claim_deadline,
        "message": f"Bounty claimed - complete by {claim_deadline}"
    }


@router.post("/start-work/{bounty_id}")
async def start_work(
    bounty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark start of work on claimed bounty"""
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()

    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")

    if bounty.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not assigned to this bounty")

    if bounty.status != BountyStatus.CLAIMED:
        raise HTTPException(status_code=400, detail="Can only start work on claimed bounties")

    bounty.work_started_at = datetime.utcnow()

    audit_entry = AuditLog(
        bounty_id=bounty.id,
        user_id=current_user.id,
        action="WORK_STARTED",
        details={"started_at": datetime.utcnow().isoformat()},
        timestamp=datetime.utcnow()
    )
    db.add(audit_entry)
    db.commit()

    return {"status": "work_started", "message": "Work tracking started"}


@router.post("/submit-review/{bounty_id}")
async def submit_for_review(
    bounty_id: int,
    pr_url: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit bounty work for review"""
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()

    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")

    # T1 bounties can be submitted by anyone, others need claim
    if bounty.tier != BountyTier.T1 and bounty.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not assigned to this bounty")

    if bounty.tier == BountyTier.T1 and bounty.status != BountyStatus.OPEN:
        raise HTTPException(status_code=400, detail="T1 bounty no longer accepting submissions")

    if bounty.tier != BountyTier.T1 and bounty.status != BountyStatus.CLAIMED:
        raise HTTPException(status_code=400, detail="Bounty not in claimable state")

    bounty.status = BountyStatus.IN_REVIEW
    bounty.pr_url = pr_url
    bounty.submitted_at = datetime.utcnow()

    # For T1, assign to submitter
    if bounty.tier == BountyTier.T1:
        bounty.assignee_id = current_user.id

    audit_entry = AuditLog(
        bounty_id=bounty.id,
        user_id=current_user.id,
        action="SUBMITTED_FOR_REVIEW",
        details={"pr_url": pr_url, "tier": bounty.tier.value},
        timestamp=datetime.utcnow()
    )
    db.add(audit_entry)
    db.commit()

    return {"status": "in_review", "message": "Submission received for review"}


@router.post("/approve/{bounty_id}")
async def approve_completion(
    bounty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(["approve_bounties"]))
):
    """Approve completed bounty work"""
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()

    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")

    if bounty.status != BountyStatus.IN_REVIEW:
        raise HTTPException(status_code=400, detail="Bounty not in review state")

    bounty.status = BountyStatus.COMPLETED
    bounty.completed_at = datetime.utcnow()
    bounty.reviewer_id = current_user.id

    audit_entry = AuditLog(
        bounty_id=bounty.id,
        user_id=current_user.id,
        action="COMPLETION_APPROVED",
        details={"reviewer": current_user.username},
        timestamp=datetime.utcnow()
    )
    db.add(audit_entry)
    db.commit()

    return {"status": "completed", "message": "Bounty completion approved"}


@router.post("/process-payment/{bounty_id}")
async def process_payment(
    bounty_id: int,
    transaction_hash: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(["process_payments"]))
):
    """Process payment for completed bounty"""
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()

    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")

    if bounty.status != BountyStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Bounty not ready for payment")

    bounty.status = BountyStatus.PAID
    bounty.paid_at = datetime.utcnow()
    bounty.transaction_hash = transaction_hash

    audit_entry = AuditLog(
        bounty_id=bounty.id,
        user_id=current_user.id,
        action="PAYMENT_PROCESSED",
        details={"tx_hash": transaction_hash, "amount": str(bounty.reward_amount)},
        timestamp=datetime.utcnow()
    )
    db.add(audit_entry)
    db.commit()

    return {"status": "paid", "message": "Payment processed successfully"}


@router.post("/release-claim/{bounty_id}")
async def release_claim(
    bounty_id: int,
    reason: str = "deadline_exceeded",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Release claim on bounty (manual or deadline)"""
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()

    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")

    if bounty.status != BountyStatus.CLAIMED:
        raise HTTPException(status_code=400, detail="Bounty not in claimed state")

    # Only assignee or admin can release
    if bounty.assignee_id != current_user.id and not current_user.has_permission("release_claims"):
        raise HTTPException(status_code=403, detail="Not authorized to release claim")

    bounty.status = BountyStatus.OPEN
    bounty.assignee_id = None
    bounty.claim_deadline = None
    bounty.work_started_at = None

    audit_entry = AuditLog(
        bounty_id=bounty.id,
        user_id=current_user.id,
        action="CLAIM_RELEASED",
        details={"reason": reason},
        timestamp=datetime.utcnow()
    )
    db.add(audit_entry)
    db.commit()

    return {"status": "open", "message": "Claim released successfully"}


@router.post("/check-deadlines")
async def check_deadlines(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(["check_deadlines"]))
):
    """Check and enforce claim deadlines"""
    now = datetime.utcnow()

    # Find expired claims
    expired_bounties = db.query(Bounty).filter(
        Bounty.status == BountyStatus.CLAIMED,
        Bounty.claim_deadline < now
    ).all()

    # Find 80% warnings
    warning_time = now + timedelta(hours=24)  # 24h before deadline
    warning_bounties = db.query(Bounty).filter(
        Bounty.status == BountyStatus.CLAIMED,
        Bounty.claim_deadline > now,
        Bounty.claim_deadline < warning_time
    ).all()

    results = {"expired": 0, "warnings": 0, "released": []}

    # Release expired claims
    for bounty in expired_bounties:
        bounty.status = BountyStatus.OPEN
        old_assignee_id = bounty.assignee_id
        bounty.assignee_id = None
        bounty.claim_deadline = None

        audit_entry = AuditLog(
            bounty_id=bounty.id,
            user_id=current_user.id,
            action="AUTO_RELEASE_DEADLINE",
            details={"previous_assignee": old_assignee_id},
            timestamp=now
        )
        db.add(audit_entry)
        results["released"].append(bounty.id)
        results["expired"] += 1

    # Send warnings
    notification_service = NotificationService()
    for bounty in warning_bounties:
        background_tasks.add_task(
            notification_service.send_deadline_warning,
            bounty.assignee_id,
            bounty.id,
            bounty.claim_deadline
        )
        results["warnings"] += 1

    db.commit()

    return {
        "checked_at": now,
        "expired_claims": results["expired"],
        "warnings_sent": results["warnings"],
        "released_bounty_ids": results["released"]
    }


@router.get("/audit-log/{bounty_id}")
async def get_audit_log(
    bounty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get complete audit log for bounty"""
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()

    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")

    audit_entries = db.query(AuditLog).filter(
        AuditLog.bounty_id == bounty_id
    ).order_by(AuditLog.timestamp.desc()).all()

    return {
        "bounty_id": bounty_id,
        "total_entries": len(audit_entries),
        "entries": [
            {
                "action": entry.action,
                "user_id": entry.user_id,
                "timestamp": entry.timestamp,
                "details": entry.details
            }
            for entry in audit_entries
        ]
    }


@router.post("/webhook")
async def webhook_handler(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Handle GitHub webhook events"""
    try:
        payload = await request.json()
        event_type = request.headers.get("X-GitHub-Event")

        webhook_handler = WebhookHandler(db)

        if event_type == "pull_request":
            result = await webhook_handler.handle_pr_event(payload)
            if result.get("bounty_updated"):
                background_tasks.add_task(
                    webhook_handler.notify_status_change,
                    result["bounty_id"],
                    result["new_status"]
                )

        return {"status": "processed", "event": event_type}

    except Exception as e:
        logger.error(f"Webhook processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")


@router.get("/status/{bounty_id}")
async def get_lifecycle_status(
    bounty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed lifecycle status for bounty"""
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()

    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")

    status_info = {
        "id": bounty.id,
        "current_status": bounty.status.value,
        "tier": bounty.tier.value,
        "created_at": bounty.created_at,
        "published_at": bounty.published_at,
        "assignee_id": bounty.assignee_id,
        "claim_deadline": bounty.claim_deadline,
        "work_started_at": bounty.work_started_at,
        "submitted_at": bounty.submitted_at,
        "completed_at": bounty.completed_at,
        "paid_at": bounty.paid_at,
        "pr_url": bounty.pr_url,
        "transaction_hash": bounty.transaction_hash
    }

    # Add time remaining if claimed
    if bounty.status == BountyStatus.CLAIMED and bounty.claim_deadline:
        now = datetime.utcnow()
        if bounty.claim_deadline > now:
            status_info["time_remaining"] = str(bounty.claim_deadline - now)
        else:
            status_info["time_remaining"] = "EXPIRED"

    return status_info


@router.post("/bulk-status")
async def bulk_status_update(
    bounty_ids: List[int],
    target_status: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(["bulk_operations"]))
):
    """Bulk update status for multiple bounties"""
    try:
        target_status_enum = BountyStatus(target_status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")

    bounties = db.query(Bounty).filter(Bounty.id.in_(bounty_ids)).all()

    if len(bounties) != len(bounty_ids):
        found_ids = [b.id for b in bounties]
        missing = [bid for bid in bounty_ids if bid not in found_ids]
        raise HTTPException(status_code=404, detail=f"Bounties not found: {missing}")

    results = {"updated": 0, "skipped": 0, "errors": []}

    for bounty in bounties:
        try:
            old_status = bounty.status
            bounty.status = target_status_enum

            audit_entry = AuditLog(
                bounty_id=bounty.id,
                user_id=current_user.id,
                action="BULK_STATUS_UPDATE",
                details={
                    "old_status": old_status.value,
                    "new_status": target_status,
                    "reason": reason or "bulk_operation"
                },
                timestamp=datetime.utcnow()
            )
            db.add(audit_entry)
            results["updated"] += 1

        except Exception as e:
            results["errors"].append(f"Bounty {bounty.id}: {str(e)}")
            results["skipped"] += 1

    db.commit()

    return {
        "operation": "bulk_status_update",
        "target_status": target_status,
        "processed": len(bounty_ids),
        "results": results
    }
