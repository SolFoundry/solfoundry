"""Contributor service with PostgreSQL as primary source of truth.

All read/write operations use async database sessions. The in-memory
cache (_store) is kept for backward compatibility with GitHub sync
and any callers that don't yet use the db parameter.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update, delete, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

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
# Internal helpers
# ---------------------------------------------------------------------------


def _db_to_response(contributor: ContributorDB) -> ContributorResponse:
    """Convert a ContributorDB record to the public API response schema."""
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
    """Convert a ContributorDB record to a lightweight list-view item."""
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
# Public API -- async, PostgreSQL-first
# ---------------------------------------------------------------------------


async def create_contributor(db: AsyncSession, data: ContributorCreate) -> ContributorResponse:
    """Create a new contributor and return its response."""
    now = datetime.now(timezone.utc)
    contributor = ContributorDB(
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
    db.add(contributor)
    await db.commit()
    await db.refresh(contributor)
    _store[str(contributor.id)] = contributor
    return _db_to_response(contributor)


async def list_contributors(
    db: AsyncSession,
    search: Optional[str] = None,
    skills: Optional[list[str]] = None,
    badges: Optional[list[str]] = None,
    skip: int = 0,
    limit: int = 20,
) -> ContributorListResponse:
    """List contributors with optional search, skill, and badge filters."""
    query = select(ContributorDB)

    if search:
        q = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(ContributorDB.username).like(q),
                func.lower(ContributorDB.display_name).like(q),
            )
        )

    if skills:
        for skill in skills:
            query = query.where(ContributorDB.skills.contains([skill]))
    if badges:
        for badge in badges:
            query = query.where(ContributorDB.badges.contains([badge]))

    # Get total count before pagination
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Apply pagination
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    contributors = result.scalars().all()

    return ContributorListResponse(
        items=[_db_to_list_item(c) for c in contributors],
        total=total,
        skip=skip,
        limit=limit,
    )


async def get_contributor(db: AsyncSession, contributor_id: str) -> Optional[ContributorResponse]:
    """Return a contributor response by ID or None if not found."""
    try:
        uuid_obj = uuid.UUID(contributor_id)
        result = await db.execute(select(ContributorDB).where(ContributorDB.id == uuid_obj))
        contributor = result.scalar_one_or_none()
        return _db_to_response(contributor) if contributor else None
    except ValueError:
        return None


async def get_contributor_by_username(db: AsyncSession, username: str) -> Optional[ContributorResponse]:
    """Look up a contributor by username or return None."""
    result = await db.execute(select(ContributorDB).where(ContributorDB.username == username))
    contributor = result.scalar_one_or_none()
    return _db_to_response(contributor) if contributor else None


async def update_contributor(
    db: AsyncSession, contributor_id: str, data: ContributorUpdate
) -> Optional[ContributorResponse]:
    """Partially update a contributor, returning the updated response."""
    try:
        uuid_obj = uuid.UUID(contributor_id)
        result = await db.execute(select(ContributorDB).where(ContributorDB.id == uuid_obj))
        contributor = result.scalar_one_or_none()
        if not contributor:
            return None

        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(contributor, key, value)

        await db.commit()
        await db.refresh(contributor)
        _store[contributor_id] = contributor
        return _db_to_response(contributor)
    except ValueError:
        return None


async def delete_contributor(db: AsyncSession, contributor_id: str) -> bool:
    """Delete a contributor by ID, returning True if found."""
    try:
        uuid_obj = uuid.UUID(contributor_id)
        result = await db.execute(select(ContributorDB).where(ContributorDB.id == uuid_obj))
        contributor = result.scalar_one_or_none()
        if not contributor:
            return False

        await db.delete(contributor)
        await db.commit()
        _store.pop(contributor_id, None)
        return True
    except ValueError:
        return False


async def get_contributor_db(db: AsyncSession, contributor_id: str) -> Optional[ContributorDB]:
    """Return the raw ContributorDB record or None."""
    try:
        uuid_obj = uuid.UUID(contributor_id)
        result = await db.execute(select(ContributorDB).where(ContributorDB.id == uuid_obj))
        return result.scalar_one_or_none()
    except ValueError:
        return None


async def update_reputation_score(db: AsyncSession, contributor_id: str, score: float) -> None:
    """Set the reputation_score on the contributor's DB record."""
    try:
        uuid_obj = uuid.UUID(contributor_id)
        await db.execute(
            update(ContributorDB)
            .where(ContributorDB.id == uuid_obj)
            .values(reputation_score=score, updated_at=datetime.now(timezone.utc))
        )
        await db.commit()
    except ValueError:
        pass


async def list_contributor_ids(db: AsyncSession) -> list[str]:
    """Return all contributor IDs currently in the DB."""
    result = await db.execute(select(ContributorDB.id))
    return [str(row) for row in result.scalars().all()]
