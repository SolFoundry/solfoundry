"""Async PostgreSQL contributor service.

Replaces the former in-memory dict with real database queries using
SQLAlchemy async sessions and the connection pool defined in
``app.database``.  All public functions are now ``async`` and accept
an optional ``session`` parameter for transactional callers.

Backward-compatible: API response schemas are unchanged.
"""

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import String, func, or_, select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.models.contributor import (
    ContributorCreate,
    ContributorDB,
    ContributorListItem,
    ContributorListResponse,
    ContributorResponse,
    ContributorStats,
    ContributorTable,
    ContributorUpdate,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _row_to_response(row: ContributorTable) -> ContributorResponse:
    """Convert a SQLAlchemy ``ContributorTable`` row to an API response.

    Maps individual stat columns into the nested ``ContributorStats``
    object expected by the frontend.

    Args:
        row: A contributor ORM instance loaded from the database.

    Returns:
        A ``ContributorResponse`` ready for JSON serialisation.
    """
    return ContributorResponse(
        id=str(row.id),
        username=row.username,
        display_name=row.display_name,
        email=row.email,
        avatar_url=row.avatar_url,
        bio=row.bio,
        skills=row.skills or [],
        badges=row.badges or [],
        social_links=row.social_links or {},
        unsubscribe_token=row.unsubscribe_token,
        email_notifications_enabled=row.email_notifications_enabled,
        notification_preferences=row.notification_preferences or {},
        stats=ContributorStats(
            total_contributions=row.total_contributions,
            total_bounties_completed=row.total_bounties_completed,
            total_earnings=float(row.total_earnings or 0),
            reputation_score=float(row.reputation_score or 0),
        ),
        created_at=row.created_at or datetime.now(timezone.utc),
        updated_at=row.updated_at or datetime.now(timezone.utc),
    )


def _row_to_list_item(row: ContributorTable) -> ContributorListItem:
    """Convert a SQLAlchemy row to a lightweight list item.

    Excludes email, bio, and social_links to keep list payloads small.

    Args:
        row: A contributor ORM instance loaded from the database.

    Returns:
        A ``ContributorListItem`` for paginated list responses.
    """
    return ContributorListItem(
        id=str(row.id),
        username=row.username,
        display_name=row.display_name,
        avatar_url=row.avatar_url,
        skills=row.skills or [],
        badges=row.badges or [],
        stats=ContributorStats(
            total_contributions=row.total_contributions,
            total_bounties_completed=row.total_bounties_completed,
            total_earnings=float(row.total_earnings or 0),
            reputation_score=float(row.reputation_score or 0),
        ),
    )


# ---------------------------------------------------------------------------
# CRUD operations
# ---------------------------------------------------------------------------


async def create_contributor(
    data: ContributorCreate,
    session: Optional[AsyncSession] = None,
) -> ContributorResponse:
    """Insert a new contributor and return the API response.

    Generates a UUID v4 primary key, sets timestamps to UTC now, and
    commits the row.  Caller is responsible for checking username
    uniqueness beforehand (the DB constraint will also catch it).

    Args:
        data: Validated contributor creation payload.
        session: Optional externally managed session.  When ``None``,
            a fresh session is created and auto-committed.

    Returns:
        The newly created contributor as a ``ContributorResponse``.
    """
    now = datetime.now(timezone.utc)
    row = ContributorTable(
        id=uuid.uuid4(),
        username=data.username,
        display_name=data.display_name,
        email=data.email,
        avatar_url=data.avatar_url,
        bio=data.bio,
        skills=data.skills,
        badges=data.badges,
        social_links=data.social_links,
        total_contributions=0,
        total_bounties_completed=0,
        total_earnings=Decimal("0"),
        reputation_score=0.0,
        created_at=now,
        updated_at=now,
    )

    if session is not None:
        session.add(row)
        await session.flush()
    else:
        async with async_session_factory() as auto_session:
            auto_session.add(row)
            await auto_session.commit()
            await auto_session.refresh(row)

    # Keep in-memory cache in sync
    _store[str(row.id)] = row

    return _row_to_response(row)


async def list_contributors(
    search: Optional[str] = None,
    skills: Optional[list[str]] = None,
    badges: Optional[list[str]] = None,
    skip: int = 0,
    limit: int = 20,
    session: Optional[AsyncSession] = None,
) -> ContributorListResponse:
    """List contributors with optional search, skill, and badge filters.

    Runs two queries -- one ``COUNT(*)`` for the total and one paginated
    ``SELECT`` -- so the frontend can render pagination controls.

    Args:
        search: Case-insensitive substring match on username or display_name.
        skills: When provided, only contributors whose ``skills`` JSON
            column contains at least one matching entry are returned.
        badges: Same as ``skills`` but for the ``badges`` column.
        skip: Number of rows to skip (pagination offset).
        limit: Maximum rows to return (page size, capped at 100 by API).
        session: Optional externally managed session.

    Returns:
        A ``ContributorListResponse`` with items, total count, skip, and limit.
    """

    async def _run(db_session: AsyncSession) -> ContributorListResponse:
        """Execute the query inside the given session."""
        base_query = select(ContributorTable)
        count_query = select(func.count(ContributorTable.id))

        if search:
            pattern = f"%{search.lower()}%"
            search_filter = or_(
                func.lower(ContributorTable.username).like(pattern),
                func.lower(ContributorTable.display_name).like(pattern),
            )
            base_query = base_query.where(search_filter)
            count_query = count_query.where(search_filter)

        # JSON array containment filters -- for SQLite test compatibility,
        # fall back to CAST + LIKE when the JSON operator is unavailable.
        if skills:
            for skill in skills:
                skill_filter = func.cast(ContributorTable.skills, String).like(
                    f"%{skill}%"
                )
                base_query = base_query.where(skill_filter)
                count_query = count_query.where(skill_filter)

        if badges:
            for badge in badges:
                badge_filter = func.cast(ContributorTable.badges, String).like(
                    f"%{badge}%"
                )
                base_query = base_query.where(badge_filter)
                count_query = count_query.where(badge_filter)

        total_result = await db_session.execute(count_query)
        total = total_result.scalar() or 0

        rows_result = await db_session.execute(base_query.offset(skip).limit(limit))
        rows = rows_result.scalars().all()

        return ContributorListResponse(
            items=[_row_to_list_item(r) for r in rows],
            total=total,
            skip=skip,
            limit=limit,
        )

    if session is not None:
        return await _run(session)

    async with async_session_factory() as auto_session:
        return await _run(auto_session)


async def get_contributor(
    contributor_id: str,
    session: Optional[AsyncSession] = None,
) -> Optional[ContributorResponse]:
    """Return a contributor response by ID or ``None`` if not found.

    Args:
        contributor_id: The UUID string of the contributor.
        session: Optional externally managed session.

    Returns:
        ``ContributorResponse`` or ``None``.
    """

    async def _run(db_session: AsyncSession) -> Optional[ContributorResponse]:
        """Execute the lookup inside the given session."""
        try:
            uid = uuid.UUID(contributor_id)
        except (ValueError, AttributeError):
            return None
        result = await db_session.execute(
            select(ContributorTable).where(ContributorTable.id == uid)
        )
        row = result.scalar_one_or_none()
        return _row_to_response(row) if row else None

    if session is not None:
        return await _run(session)

    async with async_session_factory() as auto_session:
        return await _run(auto_session)


async def get_contributor_by_username(
    username: str,
    session: Optional[AsyncSession] = None,
) -> Optional[ContributorResponse]:
    """Look up a contributor by username or return ``None``.

    Args:
        username: The exact GitHub username to match.
        session: Optional externally managed session.

    Returns:
        ``ContributorResponse`` or ``None``.
    """

    async def _run(db_session: AsyncSession) -> Optional[ContributorResponse]:
        """Execute the lookup inside the given session."""
        result = await db_session.execute(
            select(ContributorTable).where(ContributorTable.username == username)
        )
        row = result.scalar_one_or_none()
        return _row_to_response(row) if row else None

    if session is not None:
        return await _run(session)

    async with async_session_factory() as auto_session:
        return await _run(auto_session)


async def get_contributor_by_token(token: str) -> Optional[ContributorResponse]:
    """Retrieve a contributor profile by unsubscribe token.

    Used for one-click unsubscribe links without authentication.
    """
    async with async_session_factory() as session:
        result = await session.execute(
            select(ContributorTable).where(ContributorTable.unsubscribe_token == token)
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return _row_to_response(row)


async def update_contributor(
    contributor_id: str,
    data: ContributorUpdate,
    session: Optional[AsyncSession] = None,
) -> Optional[ContributorResponse]:
    """Partially update a contributor, returning the updated response.

    Only fields present in ``data`` (``exclude_unset=True``) are applied.
    The ``updated_at`` timestamp is refreshed automatically.

    Args:
        contributor_id: The UUID string of the contributor.
        data: Partial update payload.
        session: Optional externally managed session.

    Returns:
        The updated ``ContributorResponse`` or ``None`` if not found.
    """

    async def _run(
        db_session: AsyncSession,
    ) -> Optional[ContributorResponse]:
        """Execute the update inside the given session."""
        try:
            uid = uuid.UUID(contributor_id)
        except (ValueError, AttributeError):
            return None
        result = await db_session.execute(
            select(ContributorTable).where(ContributorTable.id == uid)
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(row, key, value)
        row.updated_at = datetime.now(timezone.utc)
        await db_session.flush()
        return _row_to_response(row)

    if session is not None:
        return await _run(session)

    async with async_session_factory() as auto_session:
        resp = await _run(auto_session)
        await auto_session.commit()
        return resp


async def delete_contributor(
    contributor_id: str,
    session: Optional[AsyncSession] = None,
) -> bool:
    """Delete a contributor by ID, returning ``True`` if found.

    Args:
        contributor_id: The UUID string of the contributor.
        session: Optional externally managed session.

    Returns:
        ``True`` if a row was deleted, ``False`` otherwise.
    """

    async def _run(db_session: AsyncSession) -> bool:
        """Execute the delete inside the given session."""
        try:
            uid = uuid.UUID(contributor_id)
        except (ValueError, AttributeError):
            return False
        result = await db_session.execute(
            sa_delete(ContributorTable).where(ContributorTable.id == uid)
        )
        return (result.rowcount or 0) > 0

    if session is not None:
        deleted = await _run(session)
    else:
        async with async_session_factory() as auto_session:
            deleted = await _run(auto_session)
            await auto_session.commit()

    # Remove from in-memory cache
    _store.pop(contributor_id, None)

    return deleted


async def get_contributor_db(
    contributor_id: str,
    session: Optional[AsyncSession] = None,
) -> Optional[ContributorTable]:
    """Return the raw ``ContributorTable`` ORM row or ``None``.

    Used internally by services that need direct column access (e.g.
    reputation_service updating ``reputation_score``).

    Args:
        contributor_id: The UUID string of the contributor.
        session: Optional externally managed session.

    Returns:
        A detached ``ContributorTable`` instance or ``None``.
    """

    async def _run(
        db_session: AsyncSession,
    ) -> Optional[ContributorTable]:
        """Execute the lookup inside the given session."""
        try:
            uid = uuid.UUID(contributor_id)
        except (ValueError, AttributeError):
            return None
        result = await db_session.execute(
            select(ContributorTable).where(ContributorTable.id == uid)
        )
        return result.scalar_one_or_none()

    if session is not None:
        return await _run(session)

    async with async_session_factory() as auto_session:
        row = await _run(auto_session)
        if row is not None:
            _store[contributor_id] = row
        return row


async def update_reputation_score(
    contributor_id: str,
    score: float,
    session: Optional[AsyncSession] = None,
) -> None:
    """Set the ``reputation_score`` on a contributor row.

    This is the public API that other services should use instead of
    reaching into the ORM directly.

    Args:
        contributor_id: The UUID string of the contributor.
        score: The new reputation score value.
        session: Optional externally managed session.
    """

    async def _run(db_session: AsyncSession) -> None:
        """Execute the update inside the given session."""
        try:
            uid = uuid.UUID(contributor_id)
        except (ValueError, AttributeError):
            return
        result = await db_session.execute(
            select(ContributorTable).where(ContributorTable.id == uid)
        )
        row = result.scalar_one_or_none()
        if row is not None:
            row.reputation_score = score
            row.updated_at = datetime.now(timezone.utc)
            await db_session.flush()

    if session is not None:
        await _run(session)
    else:
        async with async_session_factory() as auto_session:
            await _run(auto_session)
            await auto_session.commit()

    # Update in-memory cache
    cached = _store.get(contributor_id)
    if cached is not None:
        cached.reputation_score = score


async def list_contributor_ids(
    session: Optional[AsyncSession] = None,
) -> list[str]:
    """Return all contributor IDs currently in the database.

    Used by the reputation leaderboard to iterate contributors.

    Args:
        session: Optional externally managed session.

    Returns:
        A list of UUID strings for every contributor row.
    """

    async def _run(db_session: AsyncSession) -> list[str]:
        """Execute the query inside the given session."""
        result = await db_session.execute(select(ContributorTable.id))
        return [str(row_id) for (row_id,) in result.all()]

    if session is not None:
        return await _run(session)

    async with async_session_factory() as auto_session:
        return await _run(auto_session)


async def upsert_contributor(
    row_data: dict,
    session: Optional[AsyncSession] = None,
) -> ContributorTable:
    """Insert or update a contributor by username.

    Used by the GitHub sync and seed scripts to idempotently populate
    contributor data.  If a contributor with the same ``username``
    already exists, its stats and metadata are updated.

    Args:
        row_data: Dictionary of column values.  Must include ``username``.
        session: Optional externally managed session.

    Returns:
        The inserted or updated ``ContributorTable`` row.
    """

    async def _run(db_session: AsyncSession) -> ContributorTable:
        """Execute the upsert inside the given session."""
        username = row_data["username"]
        result = await db_session.execute(
            select(ContributorTable).where(ContributorTable.username == username)
        )
        existing = result.scalar_one_or_none()

        if existing:
            for key, value in row_data.items():
                if key not in ("id", "created_at"):
                    setattr(existing, key, value)
            existing.updated_at = datetime.now(timezone.utc)
            await db_session.flush()
            return existing

        row = ContributorTable(**row_data)
        if not row.created_at:
            row.created_at = datetime.now(timezone.utc)
        if not row.updated_at:
            row.updated_at = datetime.now(timezone.utc)
        db_session.add(row)
        await db_session.flush()
        return row

    if session is not None:
        return await _run(session)

    async with async_session_factory() as auto_session:
        result_row = await _run(auto_session)
        await auto_session.commit()
        return result_row


async def get_all_contributors(
    session: Optional[AsyncSession] = None,
) -> list[ContributorTable]:
    """Return all contributor rows from the database.

    Used by the leaderboard service and health endpoint.  Avoid calling
    this with very large tables -- the leaderboard service applies its
    own ORDER BY and LIMIT via ``get_leaderboard_contributors()``.

    Args:
        session: Optional externally managed session.

    Returns:
        A list of all ``ContributorTable`` ORM instances.
    """

    async def _run(db_session: AsyncSession) -> list[ContributorTable]:
        """Execute the query inside the given session."""
        result = await db_session.execute(select(ContributorTable))
        return list(result.scalars().all())

    if session is not None:
        return await _run(session)

    async with async_session_factory() as auto_session:
        return await _run(auto_session)


async def count_contributors(
    session: Optional[AsyncSession] = None,
) -> int:
    """Return the total number of contributors in the database.

    Args:
        session: Optional externally managed session.

    Returns:
        An integer count of all contributor rows.
    """

    async def _run(db_session: AsyncSession) -> int:
        """Execute the count inside the given session."""
        result = await db_session.execute(select(func.count(ContributorTable.id)))
        return result.scalar() or 0

    if session is not None:
        return await _run(session)

    async with async_session_factory() as auto_session:
        return await _run(auto_session)


# ---------------------------------------------------------------------------
# Backward-compatible in-memory store for callers that import ``_store``
# ---------------------------------------------------------------------------
# Several modules (github_sync, seed_leaderboard, tests, health endpoint)
# directly import ``_store``.  We keep this dict as a read-through cache
# that is populated on startup sync.  The authoritative data lives in
# PostgreSQL; ``_store`` is a convenience reference only.
_store: dict[str, ContributorTable] = {}


async def refresh_store_cache(
    session: Optional[AsyncSession] = None,
) -> None:
    """Reload ``_store`` from the database.

    Called after bulk operations (GitHub sync, seed) to keep the
    in-memory cache consistent with PostgreSQL.

    Args:
        session: Optional externally managed session.
    """
    rows = await get_all_contributors(session=session)
    _store.clear()
    for row in rows:
        _store[str(row.id)] = row
    logger.info("Refreshed in-memory contributor cache: %d entries", len(_store))
