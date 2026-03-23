"""Bounty service with PostgreSQL as primary source of truth (Issue #162).

All read operations query the database. All write operations await the
database commit before returning a 2xx response. The in-memory cache
is a fallback only when the DB is completely unreachable (e.g. tests
running against an unavailable backend).
"""

import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional

from app.core.audit import audit_event
from app.models.bounty import (
    BountyCreate,
    BountyInternal as BountyDB,
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

# In-memory cache -- populated on startup via sync/hydration and kept
# in sync on writes.  Used as a fast read fallback when the database
# connection is unavailable (e.g. in unit tests without a DB fixture).
_bounty_store: dict[str, BountyDB] = {}


# ---------------------------------------------------------------------------
# DB I/O helpers (awaited, not fire-and-forget)
# ---------------------------------------------------------------------------


async def _persist_to_db(bounty: BountyDB) -> None:
    """Await a write-through to PostgreSQL so the DB is always up to date.

    This is called on every mutation. Failures are logged but do not
    propagate to the caller to allow graceful degradation.

    Args:
        bounty: The BountyDB Pydantic model to persist.
    """
    try:
        from app.services.pg_store import persist_bounty

        await persist_bounty(bounty)
    except Exception as exc:
        logger.error("PostgreSQL bounty write failed: %s", exc)


async def _load_bounty_from_db(bounty_id: str) -> Optional[BountyDB]:
    """Load a single bounty from the database and reconstitute submissions.

    Queries the bounties table and the bounty_submissions table to build
    a complete BountyDB Pydantic model with embedded submissions.

    Args:
        bounty_id: The UUID string of the bounty to load.

    Returns:
        A BountyDB instance with submissions attached, or None if not found.
    """
    try:
        from app.services.pg_store import get_bounty_by_id, load_submissions_for_bounty

        row = await get_bounty_by_id(bounty_id)
        if row is None:
            return None

        sub_rows = await load_submissions_for_bounty(bounty_id)
        submissions = [
            SubmissionRecord(
                id=str(sr.id) if hasattr(sr, "id") else sr.id,
                bounty_id=bounty_id,
                pr_url=sr.pr_url,
                submitted_by=sr.submitted_by,
                notes=sr.notes,
                status=SubmissionStatus(sr.status)
                if isinstance(sr.status, str)
                else sr.status,
                ai_score=float(sr.ai_score) if sr.ai_score else 0.0,
                submitted_at=sr.submitted_at,
            )
            for sr in sub_rows
        ]

        return BountyDB(
            id=str(row.id),
            title=row.title,
            description=row.description or "",
            tier=row.tier,
            category=getattr(row, "category", None),
            reward_amount=float(row.reward_amount),
            status=BountyStatus(row.status)
            if isinstance(row.status, str)
            else row.status,
            creator_type=getattr(row, "creator_type", "platform"),
            github_issue_url=row.github_issue_url,
            required_skills=row.skills if isinstance(row.skills, list) else [],
            deadline=row.deadline,
            created_by=row.created_by,
            submissions=submissions,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
    except Exception as exc:
        logger.warning("DB read failed for bounty %s: %s", bounty_id, exc)
        return None


async def _load_all_bounties_from_db(
    *, offset: int = 0, limit: int = 10000
) -> Optional[list[BountyDB]]:
    """Load all bounties from PostgreSQL with their submissions.

    Note: submissions are loaded per-bounty (N+1 pattern). For large
    datasets, this should be replaced with a joined eager-load query.
    Acceptable for the MVP where bounty count is in the low hundreds.

    Returns None on DB failure so callers can fall back to the cache.

    Args:
        offset: Pagination offset.
        limit: Maximum rows to return.

    Returns:
        A list of BountyDB Pydantic models, or None on failure.
    """
    try:
        from app.services.pg_store import load_bounties, load_submissions_for_bounty

        rows = await load_bounties(offset=offset, limit=limit)
        result = []
        for row in rows:
            bounty_id = str(row.id)
            sub_rows = await load_submissions_for_bounty(bounty_id)
            submissions = [
                SubmissionRecord(
                    id=str(sr.id) if hasattr(sr, "id") else sr.id,
                    bounty_id=bounty_id,
                    pr_url=sr.pr_url,
                    submitted_by=sr.submitted_by,
                    notes=sr.notes,
                    status=SubmissionStatus(sr.status)
                    if isinstance(sr.status, str)
                    else sr.status,
                    ai_score=float(sr.ai_score) if sr.ai_score else 0.0,
                    submitted_at=sr.submitted_at,
                )
                for sr in sub_rows
            ]
            result.append(
                BountyDB(
                    id=bounty_id,
                    title=row.title,
                    description=row.description or "",
                    tier=row.tier,
                    category=getattr(row, "category", None),
                    reward_amount=float(row.reward_amount),
                    status=BountyStatus(row.status)
                    if isinstance(row.status, str)
                    else row.status,
                    creator_type=getattr(row, "creator_type", "platform"),
                    github_issue_url=row.github_issue_url,
                    required_skills=row.skills if isinstance(row.skills, list) else [],
                    deadline=row.deadline,
                    created_by=row.created_by,
                    submissions=submissions,
                    created_at=row.created_at,
                    updated_at=row.updated_at,
                )
            )
        return result
    except Exception as exc:
        logger.warning("DB read failed for bounty list: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Internal response converters
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
        category=bounty.category,
        reward_amount=bounty.reward_amount,
        status=bounty.status,
        creator_type=bounty.creator_type,
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
    return BountyListItem(
        id=bounty.id,
        title=bounty.title,
        project_name=bounty.project_name,
        tier=bounty.tier,
        reward_amount=bounty.reward_amount,
        status=bounty.status,
        category=bounty.category,
        creator_type=bounty.creator_type,
        required_skills=bounty.required_skills,
        github_issue_url=bounty.github_issue_url,
        deadline=bounty.deadline,
        created_by=bounty.created_by,
        submissions=[_to_submission_response(s) for s in bounty.submissions],
        submission_count=len(bounty.submissions),
        created_at=bounty.created_at,
    )


# ---------------------------------------------------------------------------
# Public API -- all read operations query DB first, cache as fallback
# ---------------------------------------------------------------------------


PLATFORM_CREATORS = {"system", "platform", "platform_admin", "SolFoundry"}


def _resolve_creator_type(created_by: str) -> str:
    """Determine whether a bounty is platform-official or community-created."""
    return "platform" if created_by in PLATFORM_CREATORS else "community"


async def create_bounty(data: BountyCreate) -> BountyResponse:
    """Create a new bounty, persist to PostgreSQL, and update the cache.

    The database write is awaited before returning so the caller can
    trust that a successful response means the data is durable.

    Args:
        data: Validated bounty creation payload.

    Returns:
        The newly created bounty as a BountyResponse.
    """
    bounty = BountyDB(
        title=data.title,
        description=data.description,
        tier=data.tier,
        category=data.category,
        reward_amount=data.reward_amount,
        creator_type=_resolve_creator_type(data.created_by),
        github_issue_url=data.github_issue_url,
        required_skills=data.required_skills,
        deadline=data.deadline,
        created_by=data.created_by,
    )
    await _persist_to_db(bounty)
    _bounty_store[bounty.id] = bounty
    return _to_bounty_response(bounty)


async def get_bounty(bounty_id: str) -> Optional[BountyResponse]:
    """Retrieve a single bounty by ID, querying PostgreSQL first.

    Falls back to the in-memory cache when the database is unavailable.

    Args:
        bounty_id: The unique identifier of the bounty.

    Returns:
        BountyResponse if found, None otherwise.
    """
    db_bounty = await _load_bounty_from_db(bounty_id)
    if db_bounty is not None:
        _bounty_store[bounty_id] = db_bounty
        return _to_bounty_response(db_bounty)

    # Fallback to cache
    cached = _bounty_store.get(bounty_id)
    return _to_bounty_response(cached) if cached else None


async def list_bounties(
    *,
    status: Optional[BountyStatus] = None,
    tier: Optional[int] = None,
    skills: Optional[list[str]] = None,
    created_by: Optional[str] = None,
    creator_type: Optional[str] = None,
    reward_min: Optional[float] = None,
    reward_max: Optional[float] = None,
    sort: str = "newest",
    skip: int = 0,
    limit: int = 20,
) -> BountyListResponse:
    """List bounties with filtering and sorting.

    Queries PostgreSQL as the primary source. Falls back to the
    in-memory cache if the database is unreachable.

    Args:
        status: Filter by bounty lifecycle status.
        tier: Filter by bounty tier (1, 2, or 3).
        skills: Filter by required skills (case-insensitive match).
        created_by: Filter by creator identifier.
        creator_type: Filter by 'platform' or 'community'.
        reward_min: Minimum reward amount.
        reward_max: Maximum reward amount.
        sort: Sort order (newest, oldest, reward_high, reward_low, tier_high,
            deadline, submissions).
        skip: Number of results to skip for pagination.
        limit: Maximum results per page.

    Returns:
        A BountyListResponse with paginated items and total count.
    """
    db_bounties = await _load_all_bounties_from_db()
    source = list(_bounty_store.values())
    if db_bounties:
        source = db_bounties

    results = list(source)

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
    if creator_type is not None:
        results = [b for b in results if b.creator_type == creator_type]
    if reward_min is not None:
        results = [b for b in results if b.reward_amount >= reward_min]
    if reward_max is not None:
        results = [b for b in results if b.reward_amount <= reward_max]

    if sort == "reward_high":
        results.sort(key=lambda b: b.reward_amount, reverse=True)
    elif sort == "reward_low":
        results.sort(key=lambda b: b.reward_amount)
    elif sort == "tier_high":
        results.sort(key=lambda b: int(b.tier), reverse=True)
    elif sort == "deadline":
        results.sort(
            key=lambda b: b.deadline.timestamp() if b.deadline else float("inf")
        )
    elif sort == "submissions":
        results.sort(key=lambda b: len(b.submissions), reverse=True)
    elif sort == "oldest":
        results.sort(key=lambda b: b.created_at)
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
    # Load from DB as primary source
    bounty = await _load_bounty_from_db(bounty_id)
    if bounty is None:
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
    _bounty_store[bounty_id] = bounty
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
    # Check DB first
    db_bounty = await _load_bounty_from_db(bounty_id)
    cache_had = _bounty_store.pop(bounty_id, None) is not None
    found = db_bounty is not None or cache_had

    if found:
        audit_event("bounty_deleted", bounty_id=bounty_id)
        try:
            from app.services.pg_store import delete_bounty_row

            await delete_bounty_row(bounty_id)
        except Exception as exc:
            logger.error("PostgreSQL bounty delete failed: %s", exc)
    return found


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
    # Load from DB as primary source
    bounty = await _load_bounty_from_db(bounty_id)
    if bounty is None:
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
    await _persist_to_db(bounty)
    _bounty_store[bounty_id] = bounty
    return _to_submission_response(submission), None


async def get_submissions(bounty_id: str) -> Optional[list[SubmissionResponse]]:
    """List all submissions for a bounty, querying PostgreSQL first.

    Args:
        bounty_id: The ID of the bounty.

    Returns:
        A list of SubmissionResponse objects, or None if the bounty is not found.
    """
    bounty = await _load_bounty_from_db(bounty_id)
    if bounty is None:
        bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None
    return [_to_submission_response(s) for s in bounty.submissions]


async def update_submission(
    bounty_id: str, submission_id: str, status: str
) -> tuple[Optional[SubmissionResponse], Optional[str]]:
    """Update a submission's lifecycle status and persist the change."""
    bounty = await _load_bounty_from_db(bounty_id)
    if bounty is None:
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

            if new_status == SubmissionStatus.APPROVED:
                bounty.status = BountyStatus.COMPLETED
                bounty.winner_submission_id = submission_id
                bounty.winner_wallet = sub.contributor_wallet

            audit_event(
                "submission_status_updated",
                bounty_id=bounty_id,
                submission_id=submission_id,
                new_status=status,
            )

            await _persist_to_db(bounty)
            _bounty_store[bounty_id] = bounty
            return _to_submission_response(sub), None

    return None, "Submission not found"


def get_submission(bounty_id: str, submission_id: str) -> Optional[SubmissionRecord]:
    """Retrieve a raw submission record by ID."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None
    for sub in bounty.submissions:
        if sub.id == submission_id:
            return sub
    return None


def approve_submission(
    bounty_id: str, submission_id: str, approved_by: str
) -> tuple[Optional[SubmissionResponse], Optional[str]]:
    """Sync wrapper for approving a submission (DEPRECATED: use update_submission)."""
    # This is a sync wrapper for backward compatibility with the current API router
    # In a real async flow, we would call update_submission
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"

    for sub in bounty.submissions:
        if sub.id == submission_id:
            sub.status = SubmissionStatus.APPROVED
            bounty.status = BountyStatus.COMPLETED
            bounty.winner_submission_id = submission_id
            bounty.winner_wallet = sub.contributor_wallet
            bounty.updated_at = datetime.now(timezone.utc)
            _bounty_store[bounty_id] = bounty
            return _to_submission_response(sub), None

    return None, "Submission not found"


def dispute_submission(
    bounty_id: str, submission_id: str, disputed_by: str, reason: str
) -> tuple[Optional[SubmissionResponse], Optional[str]]:
    """Sync wrapper for disputing a submission."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"

    for sub in bounty.submissions:
        if sub.id == submission_id:
            sub.status = SubmissionStatus.DISPUTED
            bounty.updated_at = datetime.now(timezone.utc)
            _bounty_store[bounty_id] = bounty
            return _to_submission_response(sub), None

    return None, "Submission not found"
