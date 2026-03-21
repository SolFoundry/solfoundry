"""Contributor service with PostgreSQL as primary source of truth (Issue #162).

All write operations await the database commit before returning. The
in-memory ``_store`` acts as a synchronized cache, not the authority.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.models.contributor import (
    ContributorDB,
    ContributorCreate,
    ContributorListItem,
    ContributorListResponse,
    ContributorResponse,
    ContributorStats,
    ContributorUpdate,
)

logger = logging.getLogger(__name__)

# In-memory cache — kept in sync with PostgreSQL for fast reads.
_store: dict[str, ContributorDB] = {}


# ---------------------------------------------------------------------------
# DB write helper (awaited)
# ---------------------------------------------------------------------------


async def _persist_to_db(contributor: ContributorDB) -> None:
    """Await a write to PostgreSQL for the given contributor.

    Args:
        contributor: The ContributorDB ORM-compatible instance to persist.
    """
    try:
        from app.services.pg_store import persist_contributor

        await persist_contributor(contributor)
    except Exception as exc:
        logger.error("PostgreSQL contributor write failed: %s", exc)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _db_to_response(contributor: ContributorDB) -> ContributorResponse:
    """Convert a ContributorDB record to the public API response schema.

    Maps internal fields to the nested ContributorStats model expected
    by the API layer.

    Args:
        contributor: The internal contributor record.

    Returns:
        A ContributorResponse suitable for JSON serialization.
    """
    return ContributorResponse(
        id=str(contributor.id),
        username=contributor.username,
        display_name=contributor.display_name,
        email=contributor.email,
        avatar_url=contributor.avatar_url,
        bio=contributor.bio,
        skills=contributor.skills or [],
        badges=contributor.badges or [],
        social_links=contributor.social_links or {},
        stats=ContributorStats(
            total_contributions=contributor.total_contributions or 0,
            total_bounties_completed=contributor.total_bounties_completed or 0,
            total_earnings=contributor.total_earnings or 0.0,
            reputation_score=contributor.reputation_score or 0,
        ),
        created_at=contributor.created_at,
        updated_at=contributor.updated_at,
    )


def _db_to_list_item(contributor: ContributorDB) -> ContributorListItem:
    """Convert a ContributorDB record to a lightweight list-view item.

    Args:
        contributor: The internal contributor record.

    Returns:
        A ContributorListItem for paginated list endpoints.
    """
    return ContributorListItem(
        id=str(contributor.id),
        username=contributor.username,
        display_name=contributor.display_name,
        avatar_url=contributor.avatar_url,
        skills=contributor.skills or [],
        badges=contributor.badges or [],
        stats=ContributorStats(
            total_contributions=contributor.total_contributions or 0,
            total_bounties_completed=contributor.total_bounties_completed or 0,
            total_earnings=contributor.total_earnings or 0.0,
            reputation_score=contributor.reputation_score or 0,
        ),
    )


# ---------------------------------------------------------------------------
# Public API — async where DB writes are involved
# ---------------------------------------------------------------------------


async def create_contributor(data: ContributorCreate) -> ContributorResponse:
    """Create a new contributor, persist to PostgreSQL, and update the cache.

    Args:
        data: Validated contributor creation payload.

    Returns:
        The newly created contributor as a ContributorResponse.
    """
    now = datetime.now(timezone.utc)
    contributor = ContributorDB(
        id=uuid.uuid4(),
        username=data.username,
        display_name=data.display_name,
        email=data.email,
        avatar_url=data.avatar_url,
        bio=data.bio,
        skills=data.skills,
        badges=data.badges,
        social_links=data.social_links,
        created_at=now,
        updated_at=now,
    )
    _store[str(contributor.id)] = contributor
    await _persist_to_db(contributor)
    return _db_to_response(contributor)


def list_contributors(
    search: Optional[str] = None,
    skills: Optional[list[str]] = None,
    badges: Optional[list[str]] = None,
    skip: int = 0,
    limit: int = 20,
) -> ContributorListResponse:
    """List contributors with optional search, skill, and badge filters.

    Results are served from the in-memory cache which is kept in sync
    with PostgreSQL on every write operation.

    Args:
        search: Case-insensitive substring to match against username
            or display_name.
        skills: Filter by contributors who have any of these skills.
        badges: Filter by contributors who have any of these badges.
        skip: Pagination offset.
        limit: Maximum results per page.

    Returns:
        A ContributorListResponse with paginated items and total count.
    """
    results = list(_store.values())
    if search:
        query = search.lower()
        results = [
            r
            for r in results
            if query in r.username.lower() or query in r.display_name.lower()
        ]
    if skills:
        skill_set = set(skills)
        results = [r for r in results if skill_set & set(r.skills or [])]
    if badges:
        badge_set = set(badges)
        results = [r for r in results if badge_set & set(r.badges or [])]
    total = len(results)
    return ContributorListResponse(
        items=[_db_to_list_item(r) for r in results[skip : skip + limit]],
        total=total,
        skip=skip,
        limit=limit,
    )


def get_contributor(contributor_id: str) -> Optional[ContributorResponse]:
    """Retrieve a contributor by ID from the in-memory cache.

    Args:
        contributor_id: The UUID string of the contributor.

    Returns:
        A ContributorResponse if found, None otherwise.
    """
    contributor = _store.get(contributor_id)
    return _db_to_response(contributor) if contributor else None


def get_contributor_by_username(username: str) -> Optional[ContributorResponse]:
    """Look up a contributor by their unique username.

    Performs a linear scan of the cache. For large datasets, consider
    adding a username-keyed index.

    Args:
        username: The username to search for.

    Returns:
        A ContributorResponse if found, None otherwise.
    """
    for contributor in _store.values():
        if contributor.username == username:
            return _db_to_response(contributor)
    return None


async def update_contributor(
    contributor_id: str, data: ContributorUpdate
) -> Optional[ContributorResponse]:
    """Partially update a contributor and persist the changes.

    Only fields present in the update payload are modified.
    The updated_at timestamp is refreshed automatically.

    Args:
        contributor_id: The UUID string of the contributor.
        data: The partial update payload.

    Returns:
        The updated ContributorResponse, or None if not found.
    """
    contributor = _store.get(contributor_id)
    if not contributor:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(contributor, key, value)
    contributor.updated_at = datetime.now(timezone.utc)
    await _persist_to_db(contributor)
    return _db_to_response(contributor)


async def delete_contributor(contributor_id: str) -> bool:
    """Delete a contributor from both the cache and PostgreSQL.

    The database deletion is awaited to prevent the record from
    resurrecting on the next startup hydration.

    Args:
        contributor_id: The UUID string of the contributor.

    Returns:
        True if the contributor was found and deleted, False otherwise.
    """
    deleted = _store.pop(contributor_id, None) is not None
    if deleted:
        try:
            from app.services.pg_store import delete_contributor_row

            await delete_contributor_row(contributor_id)
        except Exception as exc:
            logger.error("PostgreSQL contributor delete failed: %s", exc)
    return deleted


def get_contributor_db(contributor_id: str) -> Optional[ContributorDB]:
    """Return the raw ContributorDB record from the cache.

    Used by the reputation service to access internal fields that
    are not exposed in the API response.

    Args:
        contributor_id: The UUID string of the contributor.

    Returns:
        The ContributorDB instance or None.
    """
    return _store.get(contributor_id)


def update_reputation_score(contributor_id: str, score: float) -> None:
    """Set the reputation_score on the contributor's cached record.

    This is the internal API that the reputation service calls after
    computing a new aggregate score. The value will be persisted to
    PostgreSQL on the next write-through cycle.

    Args:
        contributor_id: The UUID string of the contributor.
        score: The new reputation score value.
    """
    contributor = _store.get(contributor_id)
    if contributor is not None:
        contributor.reputation_score = score


def list_contributor_ids() -> list[str]:
    """Return all contributor IDs currently in the cache.

    Returns:
        A list of UUID strings.
    """
    return list(_store.keys())
