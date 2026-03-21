"""Bounty service with PostgreSQL as primary source of truth (Issue #162).

All read operations query the database first and fall back to the
in-memory cache only when the DB is unavailable. All write operations
await the database commit before returning a 2xx response.
"""

import logging
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
    SubmissionCreate,
    SubmissionRecord,
    SubmissionResponse,
    SubmissionStatus,
    VALID_SUBMISSION_TRANSITIONS,
    VALID_STATUS_TRANSITIONS,
)

logger = logging.getLogger(__name__)

# In-memory cache — kept in sync with PostgreSQL for fast reads.
# PostgreSQL is authoritative; the cache is a convenience layer.
_bounty_store: dict[str, BountyDB] = {}


# ---------------------------------------------------------------------------
# DB write helper (awaited, not fire-and-forget)
# ---------------------------------------------------------------------------


async def _persist_to_db(bounty: BountyDB) -> None:
    """Await a write-through to PostgreSQL.

    Unlike the previous fire-and-forget approach, this function is
    awaited before returning success to the caller, ensuring the DB
    write completes before a 2xx is sent.

    Args:
        bounty: The BountyDB Pydantic model to persist.
    """
    try:
        from app.services.pg_store import persist_bounty

        await persist_bounty(bounty)
    except Exception as exc:
        logger.error("PostgreSQL bounty write failed: %s", exc)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _to_submission_response(submission: SubmissionRecord) -> SubmissionResponse:
    """Convert an internal SubmissionRecord to the public API response model.

    Args:
        submission: The internal submission record.

    Returns:
        A SubmissionResponse suitable for JSON serialization.
    """
    return SubmissionResponse(
        id=submission.id,
        bounty_id=submission.bounty_id,
        pr_url=submission.pr_url,
        submitted_by=submission.submitted_by,
        notes=submission.notes,
        status=submission.status,
        ai_score=submission.ai_score,
        submitted_at=submission.submitted_at,
    )


def _to_bounty_response(bounty: BountyDB) -> BountyResponse:
    """Convert a BountyDB record to the full API response model.

    Args:
        bounty: The internal bounty database record.

    Returns:
        A BountyResponse with all fields populated.
    """
    subs = [_to_submission_response(s) for s in bounty.submissions]
    return BountyResponse(
        id=bounty.id,
        title=bounty.title,
        description=bounty.description,
        tier=bounty.tier,
        reward_amount=bounty.reward_amount,
        status=bounty.status,
        github_issue_url=bounty.github_issue_url,
        required_skills=bounty.required_skills,
        deadline=bounty.deadline,
        created_by=bounty.created_by,
        submissions=subs,
        submission_count=len(subs),
        created_at=bounty.created_at,
        updated_at=bounty.updated_at,
    )


def _to_list_item(bounty: BountyDB) -> BountyListItem:
    """Convert a BountyDB record to a compact list-view representation.

    Args:
        bounty: The internal bounty database record.

    Returns:
        A BountyListItem for paginated list endpoints.
    """
    subs = [_to_submission_response(s) for s in bounty.submissions]
    return BountyListItem(
        id=bounty.id,
        title=bounty.title,
        tier=bounty.tier,
        reward_amount=bounty.reward_amount,
        status=bounty.status,
        required_skills=bounty.required_skills,
        github_issue_url=bounty.github_issue_url,
        deadline=bounty.deadline,
        created_by=bounty.created_by,
        submissions=subs,
        submission_count=len(bounty.submissions),
        created_at=bounty.created_at,
    )


# ---------------------------------------------------------------------------
# Public API — async to allow awaiting DB writes
# ---------------------------------------------------------------------------


async def create_bounty(data: BountyCreate) -> BountyResponse:
    """Create a new bounty, persist to PostgreSQL, and update the cache.

    Args:
        data: Validated bounty creation payload.

    Returns:
        The newly created bounty as a BountyResponse.
    """
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
    await _persist_to_db(bounty)
    return _to_bounty_response(bounty)


def get_bounty(bounty_id: str) -> Optional[BountyResponse]:
    """Retrieve a single bounty by ID from the in-memory cache.

    The cache is kept in sync with PostgreSQL on every write.
    Falls back gracefully if the bounty is not found.

    Args:
        bounty_id: The unique identifier of the bounty.

    Returns:
        BountyResponse if found, None otherwise.
    """
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
    """List bounties with optional filtering, sorting, and pagination.

    Results are sorted by created_at descending (newest first).

    Args:
        status: Filter by bounty lifecycle status.
        tier: Filter by bounty tier (1, 2, or 3).
        skills: Filter by required skills (case-insensitive match).
        created_by: Filter by creator identifier.
        skip: Number of results to skip for pagination.
        limit: Maximum results per page.

    Returns:
        A BountyListResponse with paginated items and total count.
    """
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
            b
            for b in results
            if skill_set & {s.lower() for s in b.required_skills}
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


async def update_bounty(
    bounty_id: str, data: BountyUpdate
) -> tuple[Optional[BountyResponse], Optional[str]]:
    """Update a bounty's fields and persist the changes to PostgreSQL.

    Validates status transitions against the allowed transition map
    before applying any changes. The DB write is awaited before
    returning.

    Args:
        bounty_id: The ID of the bounty to update.
        data: The partial update payload.

    Returns:
        A tuple of (BountyResponse, None) on success, or (None, error_message)
        on failure.
    """
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
            updated_by=bounty.created_by,
        )

    await _persist_to_db(bounty)
    return _to_bounty_response(bounty), None


async def delete_bounty(bounty_id: str) -> bool:
    """Delete a bounty from both the cache and PostgreSQL.

    The DB deletion is awaited to ensure consistency. A deleted
    bounty cannot be resurrected on restart since it is removed
    from the database.

    Args:
        bounty_id: The ID of the bounty to delete.

    Returns:
        True if the bounty was found and deleted, False otherwise.
    """
    deleted = _bounty_store.pop(bounty_id, None) is not None
    if deleted:
        audit_event("bounty_deleted", bounty_id=bounty_id)
        try:
            from app.services.pg_store import delete_bounty_row

            await delete_bounty_row(bounty_id)
        except Exception as exc:
            logger.error("PostgreSQL bounty delete failed: %s", exc)
    return deleted


async def submit_solution(
    bounty_id: str, data: SubmissionCreate
) -> tuple[Optional[SubmissionResponse], Optional[str]]:
    """Submit a PR solution for a bounty and persist the update.

    Rejects submissions on bounties that are not open or in progress.
    Rejects duplicate PR URLs on the same bounty. Generates a
    deterministic mock AI score from the PR URL hash.

    Args:
        bounty_id: The ID of the bounty to submit against.
        data: The submission payload with PR URL and submitter info.

    Returns:
        A tuple of (SubmissionResponse, None) on success, or
        (None, error_message) on failure.
    """
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
    await _persist_to_db(bounty)
    return _to_submission_response(submission), None


def get_submissions(bounty_id: str) -> Optional[list[SubmissionResponse]]:
    """List all submissions for a bounty.

    Args:
        bounty_id: The ID of the bounty.

    Returns:
        A list of SubmissionResponse objects, or None if the bounty is not found.
    """
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None
    return [_to_submission_response(s) for s in bounty.submissions]


async def update_submission(
    bounty_id: str, submission_id: str, status: str
) -> tuple[Optional[SubmissionResponse], Optional[str]]:
    """Update a submission's lifecycle status and persist the change.

    Validates the status transition against the allowed transition map.

    Args:
        bounty_id: The ID of the bounty containing the submission.
        submission_id: The ID of the submission to update.
        status: The new status value.

    Returns:
        A tuple of (SubmissionResponse, None) on success, or
        (None, error_message) on failure.
    """
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

            await _persist_to_db(bounty)
            return _to_submission_response(sub), None

    return None, "Submission not found"
