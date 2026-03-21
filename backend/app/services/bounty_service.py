"""In-memory bounty service (MVP). PostgreSQL migration: bounties/submissions tables with FK.

Provides CRUD operations and solution submission.
Claim lifecycle is out of scope (see Issue #16).
"""

import threading
from datetime import datetime, timezone
from typing import Optional

from app.models.bounty import (
    BountyCreate,
    BountyDB,
    BountyListItem,
    BountyListResponse,
    BountyResponse,
    BountyStatus,
    BountyUpdate,
    CreatorType,
    SubmissionCreate,
    SubmissionRecord,
    SubmissionResponse,
    VALID_STATUS_TRANSITIONS,
)

# Typed service exceptions
class BountyNotFoundError(Exception):
    """Raised when a bounty lookup fails."""

class InvalidStatusTransitionError(Exception):
    """Raised on invalid status transition."""

class DuplicateSubmissionError(Exception):
    """Raised on duplicate PR URL submission."""

class SubmissionNotAllowedError(Exception):
    """Raised when submissions are closed."""

ADMIN_WALLET_IDS: frozenset[str] = frozenset({"97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF"})

# In-memory store  (PostgreSQL migration: bounties/submissions tables with FK)
# ---------------------------------------------------------------------------

_bounty_store: dict[str, BountyDB] = {}
_store_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _to_submission_response(s: SubmissionRecord) -> SubmissionResponse:
    return SubmissionResponse(
        id=s.id,
        bounty_id=s.bounty_id,
        pr_url=s.pr_url,
        submitted_by=s.submitted_by,
        notes=s.notes,
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
        creator_wallet=b.creator_wallet,
        creator_type=b.creator_type.value,
        submissions=subs,
        submission_count=len(subs),
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


def _to_list_item(b: BountyDB) -> BountyListItem:
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
        creator_wallet=b.creator_wallet,
        creator_type=b.creator_type.value,
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
        creator_wallet=data.creator_wallet,
        creator_type=data.creator_type,
    )
    with _store_lock:
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
    creator_type: Optional[str] = None,
    reward_min: Optional[float] = None,
    reward_max: Optional[float] = None,
    sort: str = "newest",
    skip: int = 0,
    limit: int = 20,
) -> BountyListResponse:
    """List bounties with optional filtering, sorting, and pagination."""
    results = list(_bounty_store.values())

    if status is not None:
        results = [b for b in results if b.status == status]
    if tier is not None:
        results = [b for b in results if b.tier == tier]
    if skills:
        skill_set = {s.lower() for s in skills}
        results = [
            b for b in results if skill_set & {s.lower() for s in b.required_skills}
        ]
    if creator_type is not None:
        results = [b for b in results if b.creator_type.value == creator_type]
    if reward_min is not None:
        results = [b for b in results if b.reward_amount >= reward_min]
    if reward_max is not None:
        results = [b for b in results if b.reward_amount <= reward_max]

    # Apply sort order
    if sort == "reward_high":
        results.sort(key=lambda b: b.reward_amount, reverse=True)
    elif sort == "reward_low":
        results.sort(key=lambda b: b.reward_amount)
    elif sort == "deadline":
        results.sort(
            key=lambda b: b.deadline or datetime.max.replace(tzinfo=timezone.utc)
        )
    elif sort == "submissions":
        results.sort(key=lambda b: len(b.submissions))
    else:
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
    return _to_bounty_response(bounty), None


def delete_bounty(bounty_id: str) -> bool:
    """Delete a bounty by ID. Returns True if deleted, False if not found."""
    with _store_lock:
        return _bounty_store.pop(bounty_id, None) is not None


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

    submission = SubmissionRecord(
        bounty_id=bounty_id,
        pr_url=data.pr_url,
        submitted_by=data.submitted_by,
        notes=data.notes,
    )
    bounty.submissions.append(submission)
    bounty.updated_at = datetime.now(timezone.utc)
    return _to_submission_response(submission), None


def get_submissions(bounty_id: str) -> Optional[list[SubmissionResponse]]:
    """List all submissions for a bounty. Returns None if bounty not found."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None
    return [_to_submission_response(s) for s in bounty.submissions]
