from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, HttpUrl
import uuid
from datetime import datetime

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Bounty, Submission, BountyStatus, SubmissionStatus
from app.services.github import GitHubService
from app.services.ai_review import AIReviewService
from app.services.notifications import NotificationService

router = APIRouter(prefix="/submissions", tags=["submissions"])


class SubmissionCreate(BaseModel):
    pr_url: HttpUrl
    bounty_id: uuid.UUID
    notes: Optional[str] = None


class SubmissionResponse(BaseModel):
    id: uuid.UUID
    pr_url: str
    bounty_id: uuid.UUID
    contributor_id: uuid.UUID
    status: SubmissionStatus
    ai_review_score: Optional[float] = None
    review_details: Optional[dict] = None
    notes: Optional[str] = None
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubmissionApproval(BaseModel):
    decision: str  # "approve" or "dispute"
    feedback: Optional[str] = None


@router.post("/", response_model=SubmissionResponse)
async def submit_pr(
    submission_data: SubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit a PR for bounty completion."""
    # Validate bounty exists and is active
    bounty = db.query(Bounty).filter(
        Bounty.id == submission_data.bounty_id,
        Bounty.status == BountyStatus.ACTIVE
    ).first()

    if not bounty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bounty not found or not active"
        )

    # Check if user already submitted for this bounty
    existing = db.query(Submission).filter(
        Submission.bounty_id == submission_data.bounty_id,
        Submission.contributor_id == current_user.id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted for this bounty"
        )

    # Validate PR URL format
    github_service = GitHubService()
    try:
        pr_info = github_service.parse_pr_url(str(submission_data.pr_url))
        if not pr_info:
            raise ValueError("Invalid PR URL")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid GitHub PR URL format"
        )

    # Create submission
    submission = Submission(
        id=uuid.uuid4(),
        pr_url=str(submission_data.pr_url),
        bounty_id=submission_data.bounty_id,
        contributor_id=current_user.id,
        status=SubmissionStatus.UNDER_REVIEW,
        notes=submission_data.notes,
        submitted_at=datetime.utcnow()
    )

    db.add(submission)
    db.commit()
    db.refresh(submission)

    # Trigger AI review asynchronously
    ai_service = AIReviewService()
    try:
        ai_service.queue_review(submission.id, str(submission_data.pr_url))
    except Exception as e:
        print(f"Failed to queue AI review: {e}")

    # Notify bounty creator
    notification_service = NotificationService()
    notification_service.send_submission_notification(
        bounty.creator_id,
        bounty.id,
        submission.id,
        current_user.username
    )

    return submission


@router.get("/{submission_id}", response_model=SubmissionResponse)
async def get_submission(
    submission_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get submission details."""
    submission = db.query(Submission).filter(
        Submission.id == submission_id
    ).first()

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )

    # Check permissions - contributor, bounty creator, or admin
    bounty = db.query(Bounty).filter(Bounty.id == submission.bounty_id).first()
    if not (
        submission.contributor_id == current_user.id or
        bounty.creator_id == current_user.id or
        current_user.is_admin
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this submission"
        )

    return submission


@router.post("/{submission_id}/approve")
async def approve_submission(
    submission_id: uuid.UUID,
    approval_data: SubmissionApproval,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bounty creator approves or disputes submission."""
    submission = db.query(Submission).filter(
        Submission.id == submission_id
    ).first()

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )

    # Verify user is bounty creator
    bounty = db.query(Bounty).filter(Bounty.id == submission.bounty_id).first()
    if bounty.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only bounty creator can approve submissions"
        )

    # Check submission is in reviewable state
    if submission.status not in [SubmissionStatus.UNDER_REVIEW, SubmissionStatus.AI_REVIEWED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submission cannot be reviewed in current state"
        )

    # Update submission status
    if approval_data.decision == "approve":
        submission.status = SubmissionStatus.APPROVED
        bounty.status = BountyStatus.COMPLETED

        # Trigger payout
        from app.services.payment import PaymentService
        payment_service = PaymentService()
        try:
            payment_service.release_escrow(
                bounty.id,
                submission.contributor_id,
                bounty.amount
            )
        except Exception as e:
            print(f"Payment failed: {e}")
            submission.status = SubmissionStatus.PAYMENT_PENDING

    elif approval_data.decision == "dispute":
        submission.status = SubmissionStatus.DISPUTED

        # Create dispute record
        from app.models import Dispute
        dispute = Dispute(
            id=uuid.uuid4(),
            submission_id=submission.id,
            creator_feedback=approval_data.feedback,
            created_at=datetime.utcnow()
        )
        db.add(dispute)

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision must be 'approve' or 'dispute'"
        )

    submission.reviewed_at = datetime.utcnow()
    db.commit()

    # Send notification to contributor
    notification_service = NotificationService()
    notification_service.send_review_notification(
        submission.contributor_id,
        submission.id,
        approval_data.decision,
        approval_data.feedback
    )

    return {"status": "success", "decision": approval_data.decision}


@router.post("/{submission_id}/dispute")
async def dispute_submission(
    submission_id: uuid.UUID,
    dispute_reason: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Contributor disputes bounty creator's rejection."""
    submission = db.query(Submission).filter(
        Submission.id == submission_id
    ).first()

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )

    # Verify user is the contributor
    if submission.contributor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only submission author can file disputes"
        )

    # Check submission was rejected/disputed
    if submission.status != SubmissionStatus.DISPUTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only dispute rejected submissions"
        )

    # Update existing dispute with contributor response
    from app.models import Dispute
    dispute = db.query(Dispute).filter(
        Dispute.submission_id == submission.id
    ).first()

    if dispute:
        dispute.contributor_response = dispute_reason
        dispute.status = "escalated"
    else:
        # Create new dispute if none exists
        dispute = Dispute(
            id=uuid.uuid4(),
            submission_id=submission.id,
            contributor_response=dispute_reason,
            status="escalated",
            created_at=datetime.utcnow()
        )
        db.add(dispute)

    submission.status = SubmissionStatus.ESCALATED
    db.commit()

    # Notify admins for resolution
    notification_service = NotificationService()
    notification_service.send_escalation_notification(submission.id, dispute_reason)

    return {"status": "escalated", "message": "Dispute escalated to admin review"}


@router.get("/bounty/{bounty_id}", response_model=List[SubmissionResponse])
async def get_bounty_submissions(
    bounty_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all submissions for a bounty (creator only)."""
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()

    if not bounty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bounty not found"
        )

    # Only creator or admin can view all submissions
    if bounty.creator_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only bounty creator can view submissions"
        )

    submissions = db.query(Submission).filter(
        Submission.bounty_id == bounty_id
    ).order_by(Submission.submitted_at.desc()).all()

    return submissions
