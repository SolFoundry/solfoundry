"""In-memory bounty service for MVP (Issue #3) + Phase 2 submission-to-payout flow.

Provides CRUD operations, solution submission, creator approval/dispute,
auto-approve eligibility, and payout triggering.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
from app.core.audit import audit_event
from app.models.review import AUTO_APPROVE_TIMEOUT_HOURS

from app.models.bounty import (
    BountyCreate,
    BountyDB,
    BountyListItem,
    BountyListResponse,
    BountyResponse,
    BountyStatus,
    BountyUpdate,
    SubmissionCreate,
    SubmissionRecord,
    SubmissionResponse,
    SubmissionStatus,
    VALID_SUBMISSION_TRANSITIONS,
    VALID_STATUS_TRANSITIONS,
)

# ---------------------------------------------------------------------------
# In-memory store (replaced by a database in production)
# ---------------------------------------------------------------------------

_bounty_store: dict[str, BountyDB] = {}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _to_submission_response(s: SubmissionRecord) -> SubmissionResponse:
    return SubmissionResponse(
        id=s.id,
        bounty_id=s.bounty_id,
        pr_url=s.pr_url,
        submitted_by=s.submitted_by,
        contributor_wallet=s.contributor_wallet,
        notes=s.notes,
        status=s.status,
        ai_score=s.ai_score,
        ai_scores_by_model=s.ai_scores_by_model,
        review_complete=s.review_complete,
        meets_threshold=s.meets_threshold,
        auto_approve_eligible=s.auto_approve_eligible,
        auto_approve_after=s.auto_approve_after,
        approved_by=s.approved_by,
        approved_at=s.approved_at,
        payout_tx_hash=s.payout_tx_hash,
        payout_amount=s.payout_amount,
        payout_at=s.payout_at,
        winner=s.winner,
        submitted_at=s.submitted_at,
    )


def _to_bounty_response(b: BountyDB) -> BountyResponse:
    subs = [_to_submission_response(s) for s in b.submissions]
    return BountyResponse(
        id=b.id,
        title=b.title,
        description=b.description,
        tier=b.tier,
        reward_amount=b.reward_amount,
        status=b.status,
        github_issue_url=b.github_issue_url,
        required_skills=b.required_skills,
        deadline=b.deadline,
        created_by=b.created_by,
        submissions=subs,
        submission_count=len(subs),
        winner_submission_id=b.winner_submission_id,
        winner_wallet=b.winner_wallet,
        payout_tx_hash=b.payout_tx_hash,
        payout_at=b.payout_at,
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


def _to_list_item(b: BountyDB) -> BountyListItem:
    subs = [_to_submission_response(s) for s in b.submissions]
    return BountyListItem(
        id=b.id,
        title=b.title,
        tier=b.tier,
        reward_amount=b.reward_amount,
        status=b.status,
        required_skills=b.required_skills,
        github_issue_url=b.github_issue_url,
        deadline=b.deadline,
        created_by=b.created_by,
        submissions=subs,
        submission_count=len(b.submissions),
        created_at=b.created_at,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def create_bounty(data: BountyCreate) -> BountyResponse:
    """Create a new bounty and return its response representation."""
    bounty = BountyDB(
        title=data.title,
        description=data.description,
        tier=data.tier,
        reward_amount=data.reward_amount,
        github_issue_url=data.github_issue_url,
        required_skills=data.required_skills,
        deadline=data.deadline,
        created_by=data.created_by,
    )
    _bounty_store[bounty.id] = bounty
    return _to_bounty_response(bounty)


def get_bounty(bounty_id: str) -> Optional[BountyResponse]:
    """Retrieve a single bounty by ID, or None if not found."""
    bounty = _bounty_store.get(bounty_id)
    return _to_bounty_response(bounty) if bounty else None


def list_bounties(
    *,
    status: Optional[BountyStatus] = None,
    tier: Optional[int] = None,
    skills: Optional[list[str]] = None,
    created_by: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
) -> BountyListResponse:
    """List bounties with optional filtering and pagination."""
    results = list(_bounty_store.values())

    if created_by is not None:
        results = [b for b in results if b.created_by == created_by]
    if status is not None:
        results = [b for b in results if b.status == status]
    if tier is not None:
        results = [b for b in results if b.tier == tier]
    if skills:
        skill_set = {s.lower() for s in skills}
        results = [
            b for b in results if skill_set & {s.lower() for s in b.required_skills}
        ]

    # Sort by created_at descending (newest first)
    results.sort(key=lambda b: b.created_at, reverse=True)

    total = len(results)
    page = results[skip : skip + limit]

    return BountyListResponse(
        items=[_to_list_item(b) for b in page],
        total=total,
        skip=skip,
        limit=limit,
    )


def update_bounty(
    bounty_id: str, data: BountyUpdate
) -> tuple[Optional[BountyResponse], Optional[str]]:
    """Update a bounty. Returns (response, None) on success or (None, error) on failure."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"

    updates = data.model_dump(exclude_unset=True)

    # Validate status transition before applying any changes
    if "status" in updates and updates["status"] is not None:
        new_status = BountyStatus(updates["status"])
        allowed = VALID_STATUS_TRANSITIONS.get(bounty.status, set())
        if new_status not in allowed:
            return None, (
                f"Invalid status transition: {bounty.status.value} -> {new_status.value}. "
                f"Allowed transitions: {[s.value for s in sorted(allowed, key=lambda x: x.value)]}"
            )

    # Apply updates
    for key, value in updates.items():
        setattr(bounty, key, value)

    bounty.updated_at = datetime.now(timezone.utc)
    
    if "status" in updates:
        audit_event(
            "bounty_status_updated",
            bounty_id=bounty_id,
            new_status=updates["status"],
            updated_by=bounty.created_by # In a real app, this would be the current user
        )

    return _to_bounty_response(bounty), None


def delete_bounty(bounty_id: str) -> bool:
    """Delete a bounty by ID. Returns True if deleted, False if not found."""
    deleted = _bounty_store.pop(bounty_id, None) is not None
    if deleted:
        audit_event("bounty_deleted", bounty_id=bounty_id)
    return deleted


def submit_solution(
    bounty_id: str, data: SubmissionCreate
) -> tuple[Optional[SubmissionResponse], Optional[str]]:
    """Submit a PR solution for a bounty.

    Sets bounty to 'under_review' and marks the submission as pending
    with auto-approve eligibility after the timeout window.
    """
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"

    if bounty.status not in (BountyStatus.OPEN, BountyStatus.IN_PROGRESS):
        return (
            None,
            f"Bounty is not accepting submissions (status: {bounty.status.value})",
        )

    for existing in bounty.submissions:
        if existing.pr_url == data.pr_url:
            return None, "This PR URL has already been submitted for this bounty"

    import hashlib
    url_hash = int(hashlib.md5(data.pr_url.encode()).hexdigest(), 16)
    score = 0.5 + (url_hash % 50) / 100.0

    now = datetime.now(timezone.utc)
    submission = SubmissionRecord(
        bounty_id=bounty_id,
        pr_url=data.pr_url,
        submitted_by=data.submitted_by,
        contributor_wallet=data.contributor_wallet,
        notes=data.notes,
        ai_score=score,
        auto_approve_after=now + timedelta(hours=AUTO_APPROVE_TIMEOUT_HOURS),
    )
    bounty.submissions.append(submission)
    bounty.status = BountyStatus.UNDER_REVIEW
    bounty.updated_at = now

    audit_event(
        "submission_created",
        bounty_id=bounty_id,
        submission_id=submission.id,
        pr_url=data.pr_url,
        submitted_by=data.submitted_by,
    )

    return _to_submission_response(submission), None


def get_submissions(bounty_id: str) -> Optional[list[SubmissionResponse]]:
    """List all submissions for a bounty. Returns None if bounty not found."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None
    return [_to_submission_response(s) for s in bounty.submissions]


def get_submission(bounty_id: str, submission_id: str) -> Optional[SubmissionRecord]:
    """Get a specific submission by bounty and submission ID."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None
    for sub in bounty.submissions:
        if sub.id == submission_id:
            return sub
    return None


def update_submission_review_scores(
    submission_id: str,
    ai_scores_by_model: dict[str, float],
    overall_score: float,
    review_complete: bool,
    meets_threshold: bool,
) -> Optional[SubmissionResponse]:
    """Update submission with AI review scores. Called after review_service records scores."""
    for bounty in _bounty_store.values():
        for sub in bounty.submissions:
            if sub.id == submission_id:
                sub.ai_scores_by_model = ai_scores_by_model
                sub.ai_score = overall_score
                sub.review_complete = review_complete
                sub.meets_threshold = meets_threshold
                sub.auto_approve_eligible = meets_threshold and review_complete
                bounty.updated_at = datetime.now(timezone.utc)
                return _to_submission_response(sub)
    return None


def approve_submission(
    bounty_id: str,
    submission_id: str,
    approved_by: str,
    is_auto: bool = False,
) -> tuple[Optional[SubmissionResponse], Optional[str]]:
    """Approve a submission → triggers payout flow.

    Can be called by the bounty creator or the auto-approve system.
    """
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"

    for sub in bounty.submissions:
        if sub.id == submission_id:
            if sub.status not in (SubmissionStatus.PENDING,):
                return None, f"Cannot approve submission in status: {sub.status.value}"

            now = datetime.now(timezone.utc)
            sub.status = SubmissionStatus.APPROVED
            sub.approved_by = approved_by
            sub.approved_at = now
            sub.winner = True

            bounty.status = BountyStatus.COMPLETED
            bounty.winner_submission_id = submission_id
            bounty.winner_wallet = sub.contributor_wallet
            bounty.updated_at = now

            audit_event(
                "submission_approved",
                bounty_id=bounty_id,
                submission_id=submission_id,
                approved_by=approved_by,
                is_auto=is_auto,
            )

            _trigger_payout(bounty, sub)

            return _to_submission_response(sub), None

    return None, "Submission not found"


def dispute_submission(
    bounty_id: str,
    submission_id: str,
    disputed_by: str,
    reason: Optional[str] = None,
) -> tuple[Optional[SubmissionResponse], Optional[str]]:
    """Dispute a submission — blocks auto-approve and marks for manual review."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"

    for sub in bounty.submissions:
        if sub.id == submission_id:
            allowed = VALID_SUBMISSION_TRANSITIONS.get(sub.status, set())
            if SubmissionStatus.DISPUTED not in allowed:
                return None, f"Cannot dispute submission in status: {sub.status.value}"

            sub.status = SubmissionStatus.DISPUTED
            sub.auto_approve_eligible = False
            bounty.status = BountyStatus.DISPUTED
            bounty.updated_at = datetime.now(timezone.utc)

            audit_event(
                "submission_disputed",
                bounty_id=bounty_id,
                submission_id=submission_id,
                disputed_by=disputed_by,
                reason=reason,
            )

            return _to_submission_response(sub), None

    return None, "Submission not found"


def _trigger_payout(bounty: BountyDB, submission: SubmissionRecord) -> None:
    """Initiate payout for an approved submission.

    Calls the payout service to release escrowed FNDRY to the winner's wallet.
    """
    from app.services import payout_service
    from app.models.payout import PayoutCreate

    if not submission.contributor_wallet:
        audit_event(
            "payout_skipped",
            bounty_id=bounty.id,
            submission_id=submission.id,
            reason="no_wallet",
        )
        return

    try:
        payout_data = PayoutCreate(
            recipient=submission.submitted_by,
            recipient_wallet=submission.contributor_wallet,
            amount=bounty.reward_amount,
            token="FNDRY",
            bounty_id=bounty.id,
            bounty_title=bounty.title,
        )
        payout_resp = payout_service.create_payout(payout_data)

        now = datetime.now(timezone.utc)
        submission.payout_tx_hash = payout_resp.tx_hash
        submission.payout_amount = bounty.reward_amount
        submission.payout_at = now
        submission.status = SubmissionStatus.PAID

        bounty.status = BountyStatus.PAID
        bounty.payout_tx_hash = payout_resp.tx_hash
        bounty.payout_at = now
        bounty.updated_at = now

        audit_event(
            "payout_initiated",
            bounty_id=bounty.id,
            submission_id=submission.id,
            amount=bounty.reward_amount,
            wallet=submission.contributor_wallet,
            payout_id=payout_resp.id,
        )

    except Exception as e:
        audit_event(
            "payout_failed",
            bounty_id=bounty.id,
            submission_id=submission.id,
            error=str(e),
        )


def update_submission(
    bounty_id: str, submission_id: str, status: str
) -> tuple[Optional[SubmissionResponse], Optional[str]]:
    """Update a submission's status (generic)."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"

    try:
        new_status = SubmissionStatus(status)
    except ValueError:
        return None, f"Invalid submission status: {status}"

    for sub in bounty.submissions:
        if sub.id == submission_id:
            allowed = VALID_SUBMISSION_TRANSITIONS.get(sub.status, set())
            if new_status not in allowed and new_status != sub.status:
                return None, (
                    f"Invalid status transition: {sub.status.value} -> {new_status.value}. "
                    f"Allowed transitions: {[s.value for s in sorted(allowed, key=lambda x: x.value)]}"
                )
            sub.status = new_status
            bounty.updated_at = datetime.now(timezone.utc)

            audit_event(
                "submission_status_updated",
                bounty_id=bounty_id,
                submission_id=submission_id,
                new_status=status,
            )

            return _to_submission_response(sub), None

    return None, "Submission not found"
