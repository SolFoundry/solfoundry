"""In-memory bounty marketplace service (Issues #3, #188).

Provides CRUD, filtering, sorting, and solution submission for the
SolFoundry bounty marketplace. Threading lock guards ``_bounty_store``
for concurrent request safety.

Architecture
------------
This service uses an in-memory dict as the primary data store.
The BountyTable SQLAlchemy model in ``app.models.bounty_table`` defines the
PostgreSQL schema used for full-text search and production persistence.

PostgreSQL migration path
~~~~~~~~~~~~~~~~~~~~~~~~~
1. ``BountyTable`` already mirrors every field in ``BountyDB``.
2. ``bounty_search_service.py`` reads/writes through ``BountySearchService``,
   which auto-detects whether a live ``bounties`` table exists.
3. To switch fully to Postgres, replace each ``_bounty_store`` access with a
   SQLAlchemy query — all Pydantic models remain identical.
4. ``alembic`` migrations are recommended for DDL changes; the initial schema
   is created by ``database.init_db()`` using ``Base.metadata.create_all``.
"""

import hashlib
import threading
from datetime import datetime, timezone
from typing import Optional

from app.core.audit import audit_event
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
    SubmissionStatus,
    VALID_SUBMISSION_TRANSITIONS,
    VALID_STATUS_TRANSITIONS,
)

# ---------------------------------------------------------------------------
# In-memory store
#
# Production replacement: PostgreSQL via ``BountyTable`` (see bounty_table.py).
# The in-memory store provides zero-config local development and fast tests.
# ---------------------------------------------------------------------------

_bounty_store: dict[str, BountyDB] = {}
_store_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _to_submission_response(s: SubmissionRecord) -> SubmissionResponse:
    """Convert an internal ``SubmissionRecord`` to the API response model."""
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
    """Convert an internal ``BountyDB`` record to the full API response model."""
    subs = [_to_submission_response(s) for s in b.submissions]
    return BountyResponse(
        id=b.id,
        title=b.title,
        description=b.description,
        tier=b.tier,
        category=b.category,
        reward_amount=b.reward_amount,
        status=b.status,
        creator_type=b.creator_type,
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
    """Convert an internal ``BountyDB`` record to a compact list item."""
    subs = [_to_submission_response(s) for s in b.submissions]
    return BountyListItem(
        id=b.id,
        title=b.title,
        tier=b.tier,
        reward_amount=b.reward_amount,
        status=b.status,
        category=b.category,
        creator_type=b.creator_type,
        required_skills=b.required_skills,
        github_issue_url=b.github_issue_url,
        deadline=b.deadline,
        created_by=b.created_by,
        submissions=subs,
        submission_count=len(b.submissions),
        created_at=b.created_at,
    )


def _apply_sort(bounties: list[BountyDB], sort: str) -> list[BountyDB]:
    """Sort a list of bounties by the given criterion.

    Supported values: ``newest``, ``reward_high``, ``reward_low``,
    ``deadline``, ``submissions``, ``submissions_low``.
    Unknown values default to ``newest`` (created_at descending).
    """
    if sort == "reward_high":
        return sorted(bounties, key=lambda b: b.reward_amount, reverse=True)
    if sort == "reward_low":
        return sorted(bounties, key=lambda b: b.reward_amount)
    if sort == "deadline":
        far_future = datetime.max.replace(tzinfo=timezone.utc)
        return sorted(bounties, key=lambda b: b.deadline or far_future)
    if sort in ("submissions", "submissions_low"):
        return sorted(bounties, key=lambda b: len(b.submissions), reverse=(sort == "submissions"))
    return sorted(bounties, key=lambda b: b.created_at, reverse=True)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def create_bounty(data: BountyCreate) -> BountyResponse:
    """Create a new bounty and return its response representation."""
    bounty = BountyDB(
        title=data.title,
        description=data.description,
        tier=data.tier,
        category=getattr(data, "category", None),
        reward_amount=data.reward_amount,
        github_issue_url=data.github_issue_url,
        required_skills=data.required_skills,
        deadline=data.deadline,
        created_by=data.created_by,
        creator_type=data.creator_type,
    )
    with _store_lock:
        _bounty_store[bounty.id] = bounty
    audit_event("bounty_created", bounty_id=bounty.id, creator=bounty.created_by)
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
    creator_type: Optional[str] = None,
    sort: str = "newest",
    skip: int = 0,
    limit: int = 20,
) -> BountyListResponse:
    """List bounties with filtering, sorting, and pagination."""
    with _store_lock:
        results = list(_bounty_store.values())

    if created_by is not None:
        results = [b for b in results if b.created_by == created_by]
    if status is not None:
        results = [b for b in results if b.status == status]
    if tier is not None:
        results = [b for b in results if b.tier == tier]
    if creator_type is not None:
        results = [b for b in results if b.creator_type.value == creator_type]
    if skills:
        skill_set = frozenset(s.lower() for s in skills)
        results = [
            b for b in results if skill_set & {s.lower() for s in b.required_skills}
        ]

    results = _apply_sort(results, sort)

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
            
            return _to_submission_response(sub), None

    return None, "Submission not found"
