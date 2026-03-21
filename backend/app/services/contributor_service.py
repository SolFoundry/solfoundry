"""Contributor service with PostgreSQL as primary source of truth (Issue #162).

All read operations query the database first and fall back to the in-memory
cache only when the DB is unreachable. All write operations await the
database commit before returning.
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

# In-memory cache -- populated during GitHub sync / startup hydration.
# Kept in sync with PostgreSQL on every write. Used as a fast fallback
# when the database connection is unavailable (e.g. in unit tests).
_store: dict[str, ContributorDB] = {}


# ---------------------------------------------------------------------------
# DB write helper (awaited)
# ---------------------------------------------------------------------------


async def _persist_to_db(contributor: ContributorDB) -> None:
    """Await a write to PostgreSQL for the given contributor.

    Logs errors but does not propagate them to allow graceful degradation
    when the database is temporarily unavailable.

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


async def _load_contributor_from_db(contributor_id: str) -> Optional[ContributorDB]:
    """Load a contributor from PostgreSQL by ID.

    Returns None on DB failure so callers can fall back to the cache.

    Args:
        contributor_id: The UUID string of the contributor.

    Returns:
        A ContributorDB ORM instance or None.
    """
    try:
        from app.services.pg_store import get_contributor_by_id

        return await get_contributor_by_id(contributor_id)
    except Exception as exc:
        logger.warning("DB read failed for contributor %s: %s", contributor_id, exc)
        return None


async def _load_all_contributors_from_db() -> Optional[list[ContributorDB]]:
    """Load all contributors from PostgreSQL.

    Returns None on DB failure so callers can fall back to the cache.

    Returns:
        A list of ContributorDB instances, or None on failure.
    """
    try:
        from app.services.pg_store import load_contributors

        return await load_contributors()
    except Exception as exc:
        logger.warning("DB read failed for contributor list: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Public API -- async where DB reads/writes are involved
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
    await _persist_to_db(contributor)
    _store[str(contributor.id)] = contributor
    return _db_to_response(contributor)


async def list_contributors(
    search: Optional[str] = None,
    skills: Optional[list[str]] = None,
    badges: Optional[list[str]] = None,
    skip: int = 0,
    limit: int = 20,
) -> ContributorListResponse:
    """List contributors with optional search, skill, and badge filters.

    Queries PostgreSQL first. Falls back to the in-memory cache when
    the database is unreachable.

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
    db_results = await _load_all_contributors_from_db()
    # Prefer DB results when available; fall back to cache when DB returns
    # None (error) or an empty list while the cache has data.
    results = list(_store.values())
    if db_results:
        results = db_results

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


async def get_contributor(contributor_id: str) -> Optional[ContributorResponse]:
    """Retrieve a contributor by ID, querying PostgreSQL first.

    Args:
        contributor_id: The UUID string of the contributor.

    Returns:
        A ContributorResponse if found, None otherwise.
    """
    db_contributor = await _load_contributor_from_db(contributor_id)
    if db_contributor is not None:
        _store[contributor_id] = db_contributor
        return _db_to_response(db_contributor)

    cached = _store.get(contributor_id)
    return _db_to_response(cached) if cached else None


async def get_contributor_by_username(username: str) -> Optional[ContributorResponse]:
    """Look up a contributor by their unique username.

    Queries PostgreSQL first, then falls back to a linear scan
    of the in-memory cache.

    Args:
        username: The username to search for.

    Returns:
        A ContributorResponse if found, None otherwise.
    """
    try:
        from app.services.pg_store import get_contributor_by_username as db_lookup

        db_result = await db_lookup(username)
        if db_result is not None:
            return _db_to_response(db_result)
    except Exception as exc:
        logger.warning("DB lookup by username failed: %s", exc)

    for contributor in _store.values():
        if contributor.username == username:
            return _db_to_response(contributor)
    return None


async def update_contributor(
    contributor_id: str, data: ContributorUpdate
) -> Optional[ContributorResponse]:
    """Partially update a contributor and persist the changes.

    Loads from the database first to ensure we are modifying the latest
    state. Only fields present in the update payload are modified.
    The updated_at timestamp is refreshed automatically.

    Args:
        contributor_id: The UUID string of the contributor.
        data: The partial update payload.

    Returns:
        The updated ContributorResponse, or None if not found.
    """
    contributor = await _load_contributor_from_db(contributor_id)
    if contributor is None:
        contributor = _store.get(contributor_id)
    if not contributor:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(contributor, key, value)
    contributor.updated_at = datetime.now(timezone.utc)
    await _persist_to_db(contributor)
    _store[contributor_id] = contributor
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
    db_contributor = await _load_contributor_from_db(contributor_id)
    cache_had = _store.pop(contributor_id, None) is not None
    found = db_contributor is not None or cache_had

    if found:
        try:
            from app.services.pg_store import delete_contributor_row

            await delete_contributor_row(contributor_id)
        except Exception as exc:
            logger.error("PostgreSQL contributor delete failed: %s", exc)
    return found


async def get_contributor_db(contributor_id: str) -> Optional[ContributorDB]:
    """Return the raw ContributorDB record, querying PostgreSQL first.

    Used by the reputation service to access internal fields that
    are not exposed in the API response.

    Args:
        contributor_id: The UUID string of the contributor.

    Returns:
        The ContributorDB instance or None.
    """
    db_result = await _load_contributor_from_db(contributor_id)
    if db_result is not None:
        _store[contributor_id] = db_result
        return db_result
    return _store.get(contributor_id)


async def update_reputation_score(contributor_id: str, score: float) -> None:
    """Set the reputation_score on the contributor and persist to PostgreSQL.

    Called by the reputation service after computing a new aggregate score.

    Args:
        contributor_id: The UUID string of the contributor.
        score: The new reputation score value.
    """
    contributor = await _load_contributor_from_db(contributor_id)
    if contributor is None:
        contributor = _store.get(contributor_id)
    if contributor is not None:
        contributor.reputation_score = int(round(score))
        _store[contributor_id] = contributor
        await _persist_to_db(contributor)


async def list_contributor_ids() -> list[str]:
    """Return all contributor IDs, querying PostgreSQL first.

    Falls back to cache keys when the database is unavailable.

    Returns:
        A list of UUID strings.
    """
    try:
        from app.services.pg_store import list_contributor_ids as db_list_ids

        return await db_list_ids()
    except Exception as exc:
        logger.warning("DB list_contributor_ids failed: %s", exc)
        return list(_store.keys())
