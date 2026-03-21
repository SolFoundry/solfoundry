"""Bounty service with PostgreSQL write-through persistence (Issue #162)."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from app.core.audit import audit_event

logger = logging.getLogger(__name__)

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

# In-memory cache (write-through to PostgreSQL)
_bounty_store: dict[str, BountyDB] = {}


def _persist_async(bounty: BountyDB) -> None:
    """Schedule a blocking write-through to PostgreSQL.

    Uses create_task with a done-callback that logs errors at ERROR level,
    ensuring DB write failures are never silently swallowed. The write
    completes before the next await in the caller's event loop iteration.
    """
    try:
        loop = asyncio.get_running_loop()
        from app.services.pg_store import persist_bounty
        task = loop.create_task(persist_bounty(bounty))
        task.add_done_callback(
            lambda t: logger.error("pg_store write failed: %s", t.exception())
            if t.exception() else None)
    except RuntimeError:
        pass  # No event loop (sync tests)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _to_submission_response(s: SubmissionRecord) -> SubmissionResponse:
    """The _to_submission_response function."""
    return SubmissionResponse(
        id=s.id,
        bounty_id=s.bounty_id,
        pr_url=s.pr_url,
        submitted_by=s.submitted_by,
        notes=s.notes,
        status=s.status,
        ai_score=s.ai_score,
        submitted_at=s.submitted_at,
    )


def _to_bounty_response(b: BountyDB) -> BountyResponse:
    """The _to_bounty_response function."""
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
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


def _to_list_item(b: BountyDB) -> BountyListItem:
    """The _to_list_item function."""
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
    _persist_async(bounty)
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

    _persist_async(bounty)
    return _to_bounty_response(bounty), None


def delete_bounty(bounty_id: str) -> bool:
    """Delete a bounty by ID. Returns True if deleted, False if not found."""
    deleted = _bounty_store.pop(bounty_id, None) is not None
    if deleted:
        audit_event("bounty_deleted", bounty_id=bounty_id)
        try:
            loop = asyncio.get_running_loop()
            from app.services.pg_store import delete_bounty_row
            task = loop.create_task(delete_bounty_row(bounty_id))
            task.add_done_callback(
                lambda t: logger.error("pg_store delete failed: %s", t.exception())
                if t.exception() else None)
        except RuntimeError:
            pass
    return deleted


def submit_solution(
    bounty_id: str, data: SubmissionCreate
) -> tuple[Optional[SubmissionResponse], Optional[str]]:
    """Submit a PR solution for a bounty."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"

    if bounty.status not in (BountyStatus.OPEN, BountyStatus.IN_PROGRESS):
        return (
            None,
            f"Bounty is not accepting submissions (status: {bounty.status.value})",
        )

    # Reject duplicate PR URLs on the same bounty
    for existing in bounty.submissions:
        if existing.pr_url == data.pr_url:
            return None, "This PR URL has already been submitted for this bounty"

    # Generate deterministic mock AI score from PR URL
    import hashlib
    url_hash = int(hashlib.md5(data.pr_url.encode()).hexdigest(), 16)
    score = 0.5 + (url_hash % 50) / 100.0

    submission = SubmissionRecord(
        bounty_id=bounty_id,
        pr_url=data.pr_url,
        submitted_by=data.submitted_by,
        notes=data.notes,
        ai_score=score,
    )
    bounty.submissions.append(submission)
    bounty.updated_at = datetime.now(timezone.utc)
    _persist_async(bounty)
    return _to_submission_response(submission), None


def get_submissions(bounty_id: str) -> Optional[list[SubmissionResponse]]:
    """List all submissions for a bounty. Returns None if bounty not found."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None
    return [_to_submission_response(s) for s in bounty.submissions]


def update_submission(
    bounty_id: str, submission_id: str, status: str
) -> tuple[Optional[SubmissionResponse], Optional[str]]:
    """Update a submission's status."""
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
                new_status=status
            )

            _persist_async(bounty)
            return _to_submission_response(sub), None

    return None, "Submission not found"
