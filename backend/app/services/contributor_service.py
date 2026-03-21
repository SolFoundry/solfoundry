"""Contributor service with PostgreSQL write-through persistence (Issue #162)."""

import asyncio
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

_store: dict[str, ContributorDB] = {}


def _fire_persist(db: ContributorDB) -> None:
    """Schedule a write-through to PostgreSQL with error logging."""
    try:
        loop = asyncio.get_running_loop()
        from app.services.pg_store import persist_contributor
        task = loop.create_task(persist_contributor(db))
        task.add_done_callback(
            lambda t: logger.error("pg_store write failed: %s", t.exception())
            if t.exception() else None)
    except RuntimeError:
        pass


def _db_to_response(db: ContributorDB) -> ContributorResponse:
    """Convert a ContributorDB row to an API response model."""
    return ContributorResponse(
        id=str(db.id),
        username=db.username,
        display_name=db.display_name,
        email=db.email,
        avatar_url=db.avatar_url,
        bio=db.bio,
        skills=db.skills or [],
        badges=db.badges or [],
        social_links=db.social_links or {},
        stats=ContributorStats(
            total_contributions=db.total_contributions or 0,
            total_bounties_completed=db.total_bounties_completed or 0,
            total_earnings=db.total_earnings or 0.0,
            reputation_score=db.reputation_score or 0,
        ),
        created_at=db.created_at,
        updated_at=db.updated_at,
    )


def _db_to_list_item(db: ContributorDB) -> ContributorListItem:
    """Convert a ContributorDB row to a lightweight list item."""
    return ContributorListItem(
        id=str(db.id),
        username=db.username,
        display_name=db.display_name,
        avatar_url=db.avatar_url,
        skills=db.skills or [],
        badges=db.badges or [],
        stats=ContributorStats(
            total_contributions=db.total_contributions or 0,
            total_bounties_completed=db.total_bounties_completed or 0,
            total_earnings=db.total_earnings or 0.0,
            reputation_score=db.reputation_score or 0,
        ),
    )


def create_contributor(data: ContributorCreate) -> ContributorResponse:
    """Create a new contributor and return its response."""
    now = datetime.now(timezone.utc)
    db = ContributorDB(
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
    _store[str(db.id)] = db
    _fire_persist(db)
    return _db_to_response(db)


def list_contributors(
    search: Optional[str] = None,
    skills: Optional[list[str]] = None,
    badges: Optional[list[str]] = None,
    skip: int = 0,
    limit: int = 20,
) -> ContributorListResponse:
    """List contributors with optional search, skill, and badge filters."""
    results = list(_store.values())
    if search:
        q = search.lower()
        results = [
            r for r in results if q in r.username.lower() or q in r.display_name.lower()
        ]
    if skills:
        s = set(skills)
        results = [r for r in results if s & set(r.skills or [])]
    if badges:
        b = set(badges)
        results = [r for r in results if b & set(r.badges or [])]
    total = len(results)
    return ContributorListResponse(
        items=[_db_to_list_item(r) for r in results[skip : skip + limit]],
        total=total,
        skip=skip,
        limit=limit,
    )


def get_contributor(contributor_id: str) -> Optional[ContributorResponse]:
    """Return a contributor response by ID or None if not found."""
    db = _store.get(contributor_id)
    return _db_to_response(db) if db else None


def get_contributor_by_username(username: str) -> Optional[ContributorResponse]:
    """Look up a contributor by username or return None."""
    for db in _store.values():
        if db.username == username:
            return _db_to_response(db)
    return None


def update_contributor(
    contributor_id: str, data: ContributorUpdate
) -> Optional[ContributorResponse]:
    """Partially update a contributor, returning the updated response."""
    db = _store.get(contributor_id)
    if not db:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(db, key, value)
    db.updated_at = datetime.now(timezone.utc)
    _fire_persist(db)
    return _db_to_response(db)


def delete_contributor(contributor_id: str) -> bool:
    """Delete a contributor by ID, returning True if found."""
    deleted = _store.pop(contributor_id, None) is not None
    if deleted:
        try:
            loop = asyncio.get_running_loop()
            from app.services.pg_store import delete_contributor_row
            task = loop.create_task(delete_contributor_row(contributor_id))
            task.add_done_callback(
                lambda t: logger.error("pg_store delete failed: %s", t.exception())
                if t.exception() else None)
        except RuntimeError:
            pass
    return deleted


def get_contributor_db(contributor_id: str) -> Optional[ContributorDB]:
    """Return the raw ContributorDB record or None."""
    return _store.get(contributor_id)


def update_reputation_score(contributor_id: str, score: float) -> None:
    """Set the reputation_score on the contributor's DB record.

    This is the public API that other services should use instead of
    reaching into ``_store`` directly.
    """
    db = _store.get(contributor_id)
    if db is not None:
        db.reputation_score = score


def list_contributor_ids() -> list[str]:
    """Return all contributor IDs currently in the store."""
    return list(_store.keys())
