"""Leaderboard service -- cached ranked contributor data from PostgreSQL.

Queries the ``contributors`` table for ranked results and applies a
time-to-live (TTL) in-memory cache so that repeated requests within
``CACHE_TTL`` seconds are served without hitting the database.

Performance target: leaderboard responses under 100 ms with caching.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, func, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.models.contributor import ContributorTable
from app.models.leaderboard import (
    CategoryFilter,
    LeaderboardEntry,
    LeaderboardResponse,
    TierFilter,
    TimePeriod,
    TopContributor,
    TopContributorMeta,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# TTL-based in-memory cache
# ---------------------------------------------------------------------------

_cache: dict[str, tuple[float, LeaderboardResponse]] = {}
CACHE_TTL = 60  # seconds


def _cache_key(
    period: TimePeriod,
    tier: Optional[TierFilter],
    category: Optional[CategoryFilter],
) -> str:
    """Build a deterministic cache key from the filter parameters.

    Args:
        period: Time period filter (week, month, all).
        tier: Optional bounty tier filter.
        category: Optional skill category filter.

    Returns:
        A colon-separated string uniquely identifying the query.
    """
    return f"{period.value}:{tier or 'all'}:{category or 'all'}"


def invalidate_cache() -> None:
    """Clear the entire leaderboard cache.

    Call after any contributor stat change (reputation update, sync,
    or manual edit) to ensure stale rankings are never served.
    """
    _cache.clear()
    logger.debug("Leaderboard cache invalidated")


# ---------------------------------------------------------------------------
# Core ranking logic
# ---------------------------------------------------------------------------

MEDALS = {1: "\U0001f947", 2: "\U0001f948", 3: "\U0001f949"}


def _period_cutoff(period: TimePeriod) -> Optional[datetime]:
    """Return the earliest ``created_at`` value for a given time period.

    Args:
        period: The time period to compute the cutoff for.

    Returns:
        A UTC ``datetime`` cutoff or ``None`` for all-time.
    """
    now = datetime.now(timezone.utc)
    if period == TimePeriod.week:
        return now - timedelta(days=7)
    if period == TimePeriod.month:
        return now - timedelta(days=30)
    return None  # all-time


def _to_entry(rank: int, row: ContributorTable) -> LeaderboardEntry:
    """Convert a ranked contributor row to a ``LeaderboardEntry``.

    Args:
        rank: 1-indexed rank position.
        row: The contributor ORM instance.

    Returns:
        A ``LeaderboardEntry`` Pydantic model.
    """
    return LeaderboardEntry(
        rank=rank,
        username=row.username,
        display_name=row.display_name,
        avatar_url=row.avatar_url,
        total_earned=float(row.total_earnings or 0),
        bounties_completed=row.total_bounties_completed or 0,
        reputation_score=int(row.reputation_score or 0),
    )


def _to_top(rank: int, row: ContributorTable) -> TopContributor:
    """Convert a ranked contributor row to a ``TopContributor`` (podium).

    Args:
        rank: 1-indexed rank position (expected 1, 2, or 3).
        row: The contributor ORM instance.

    Returns:
        A ``TopContributor`` with medal metadata.
    """
    return TopContributor(
        rank=rank,
        username=row.username,
        display_name=row.display_name,
        avatar_url=row.avatar_url,
        total_earned=float(row.total_earnings or 0),
        bounties_completed=row.total_bounties_completed or 0,
        reputation_score=int(row.reputation_score or 0),
        meta=TopContributorMeta(
            medal=MEDALS.get(rank, ""),
            join_date=row.created_at,
            best_bounty_title=None,
            best_bounty_earned=float(row.total_earnings or 0),
        ),
    )


# ---------------------------------------------------------------------------
# Database query builder
# ---------------------------------------------------------------------------


async def _query_leaderboard(
    period: TimePeriod,
    tier: Optional[TierFilter],
    category: Optional[CategoryFilter],
    session: Optional[AsyncSession] = None,
) -> list[ContributorTable]:
    """Query the contributors table with filters and return ranked rows.

    Applies time-period, tier-badge, and skill-category filters, then
    sorts by earnings descending, reputation descending, username
    ascending as tiebreaker.

    Args:
        period: Time period filter.
        tier: Optional tier filter (matches ``tier-N`` in badges JSON).
        category: Optional category filter (matches skill in skills JSON).
        session: Optional externally managed session.

    Returns:
        A list of ``ContributorTable`` rows sorted by rank.
    """

    async def _run(db_session: AsyncSession) -> list[ContributorTable]:
        """Execute the query inside the given session."""
        query = select(ContributorTable)

        cutoff = _period_cutoff(period)
        if cutoff:
            query = query.where(ContributorTable.created_at >= cutoff)

        if tier:
            tier_label = f"tier-{tier.value}"
            query = query.where(
                cast(ContributorTable.badges, String).like(
                    f"%{tier_label}%"
                )
            )

        if category:
            query = query.where(
                cast(ContributorTable.skills, String).like(
                    f"%{category.value}%"
                )
            )

        query = query.order_by(
            ContributorTable.total_earnings.desc(),
            ContributorTable.reputation_score.desc(),
            ContributorTable.username.asc(),
        )

        result = await db_session.execute(query)
        return list(result.scalars().all())

    if session is not None:
        return await _run(session)

    async with async_session_factory() as auto_session:
        return await _run(auto_session)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def get_leaderboard(
    period: TimePeriod = TimePeriod.all,
    tier: Optional[TierFilter] = None,
    category: Optional[CategoryFilter] = None,
    limit: int = 20,
    offset: int = 0,
    session: Optional[AsyncSession] = None,
) -> LeaderboardResponse:
    """Return the leaderboard, served from cache when possible.

    First checks the TTL cache for a matching (period, tier, category)
    key.  On a cache miss, queries PostgreSQL, builds the full response,
    caches it, and returns the requested pagination window.

    Performance: cached responses are returned in <1 ms.  Cache misses
    incur a single DB round-trip (~5-50 ms depending on row count).

    Args:
        period: Time period filter (week, month, all).
        tier: Optional tier filter.
        category: Optional category filter.
        limit: Maximum entries to return.
        offset: Pagination offset.
        session: Optional externally managed database session.

    Returns:
        A ``LeaderboardResponse`` with ranked entries and top-3 podium.
    """
    key = _cache_key(period, tier, category)
    now = time.time()

    # Check cache
    if key in _cache:
        cached_at, cached_response = _cache[key]
        if now - cached_at < CACHE_TTL:
            paginated = cached_response.entries[offset: offset + limit]
            return LeaderboardResponse(
                period=cached_response.period,
                total=cached_response.total,
                offset=offset,
                limit=limit,
                top3=cached_response.top3,
                entries=paginated,
            )

    # Build fresh from database
    ranked_rows = await _query_leaderboard(
        period, tier, category, session=session
    )

    ranked = [(rank, row) for rank, row in enumerate(ranked_rows, start=1)]

    top3 = [_to_top(rank, row) for rank, row in ranked[:3]]
    all_entries = [_to_entry(rank, row) for rank, row in ranked]

    full = LeaderboardResponse(
        period=period.value,
        total=len(all_entries),
        offset=0,
        limit=len(all_entries),
        top3=top3,
        entries=all_entries,
    )

    # Store in cache
    _cache[key] = (now, full)

    # Return paginated slice
    return LeaderboardResponse(
        period=period.value,
        total=full.total,
        offset=offset,
        limit=limit,
        top3=top3,
        entries=all_entries[offset: offset + limit],
    )
