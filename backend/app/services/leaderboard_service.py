"""Leaderboard service — cached ranked contributor data from PostgreSQL.

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

from sqlalchemy import select, func, cast, String, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.models.contributor import ContributorTable, ReputationHistoryDB
from app.models.tables import PayoutTable
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

import redis.asyncio as redis_async
import os
import json

# ---------------------------------------------------------------------------
# Redis-based cache
# ---------------------------------------------------------------------------

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CACHE_TTL = int(os.getenv("LEADERBOARD_CACHE_TTL", "60"))

_redis_client: Optional[redis_async.Redis] = None

def get_redis_client() -> redis_async.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis_async.from_url(REDIS_URL, decode_responses=True)
    return _redis_client

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
    return f"leaderboard:{period.value}:{tier.value if tier else 'all'}:{category.value if category else 'all'}"


async def invalidate_cache() -> None:
    """Clear the entire leaderboard cache in Redis.

    Call after any contributor stat change (reputation update, sync,
    or manual edit) to ensure stale rankings are never served.
    """
    try:
        r = get_redis_client()
        cursor = 0
        while True:
            cursor, keys = await r.scan(cursor, match="leaderboard:*", count=100)
            if keys:
                await r.delete(*keys)
            if cursor == 0:
                break
        logger.debug("Leaderboard Redis cache invalidated")
    except Exception as e:
        logger.warning(f"Redis invalidation failed: {e}")


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


def _to_entry(
    rank: int,
    row: ContributorTable,
    period_earnings: Optional[float] = None,
    period_reputation: Optional[float] = None,
) -> LeaderboardEntry:
    """Convert a ranked contributor row to a ``LeaderboardEntry``.

    Args:
        rank: 1-indexed rank position.
        row: The contributor ORM instance.
        period_earnings: Earnings for the selected period (if any).
        period_reputation: Reputation earned in the selected period (if any).

    Returns:
        A ``LeaderboardEntry`` Pydantic model.
    """
    return LeaderboardEntry(
        rank=rank,
        username=row.username,
        display_name=row.display_name,
        avatar_url=row.avatar_url,
        total_earned=period_earnings if period_earnings is not None else float(row.total_earnings or 0),
        bounties_completed=row.total_bounties_completed or 0,
        reputation_score=int(period_reputation if period_reputation is not None else row.reputation_score or 0),
        top_skills=(row.skills or [])[:3],
    )


def _to_top(
    rank: int,
    row: ContributorTable,
    period_earnings: Optional[float] = None,
    # period_reputation not used in podium yet but available
) -> TopContributor:
    """Convert a ranked contributor row to a ``TopContributor`` (podium).

    Args:
        rank: 1-indexed rank position (expected 1, 2, or 3).
        row: The contributor ORM instance.
        period_earnings: Earnings for the selected period (if any).

    Returns:
        A ``TopContributor`` with medal metadata.
    """
    earned = period_earnings if period_earnings is not None else float(row.total_earnings or 0)
    return TopContributor(
        rank=rank,
        username=row.username,
        display_name=row.display_name,
        avatar_url=row.avatar_url,
        total_earned=earned,
        bounties_completed=row.total_bounties_completed or 0,
        reputation_score=int(row.reputation_score or 0),
        top_skills=(row.skills or [])[:3],
        meta=TopContributorMeta(
            medal=MEDALS.get(rank, ""),
            join_date=row.created_at,
            best_bounty_title=None,
            best_bounty_earned=earned,
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
) -> list[tuple[ContributorTable, Optional[float], Optional[float]]]:
    """Query contributors with a mix of all-time and period-specific stats.

    If a period (week, month) is specified, joins with PayoutTable and
    ReputationHistory to compute earnings/reputation earned strictly
    within that time window. Results are ranked by period stats first.

    Returns:
        List of (row, period_earnings, period_rep) tuples.
    """

    async def _run(db_session: AsyncSession) -> list[tuple[ContributorTable, Optional[float], Optional[float]]]:
        cutoff = _period_cutoff(period)

        if not cutoff:
            # All-time: Simple query from contributors table
            query = select(ContributorTable, cast(None, Float), cast(None, Float))
        else:
            # Period: Aggregate payouts and reputation history
            payouts_subquery = (
                select(
                    PayoutTable.recipient,
                    func.sum(PayoutTable.amount).label("p_earnings"),
                )
                .where(PayoutTable.created_at >= cutoff)
                .group_by(PayoutTable.recipient)
                .subquery()
            )

            rep_subquery = (
                select(
                    ReputationHistoryDB.contributor_id,
                    func.sum(ReputationHistoryDB.earned_reputation).label("p_rep"),
                )
                .where(ReputationHistoryDB.created_at >= cutoff)
                .group_by(ReputationHistoryDB.contributor_id)
                .subquery()
            )

            query = (
                select(
                    ContributorTable,
                    func.coalesce(payouts_subquery.c.p_earnings, 0),
                    func.coalesce(rep_subquery.c.p_rep, 0),
                )
                .outerjoin(
                    payouts_subquery,
                    ContributorTable.username == payouts_subquery.c.recipient,
                )
                .outerjoin(
                    rep_subquery,
                    ContributorTable.id == rep_subquery.c.contributor_id,
                )
            )

        # Common filters (tier, category)
        if tier:
            tier_label = f"tier-{tier.value}"
            if db_session.bind and db_session.bind.dialect.name == "postgresql":
                from sqlalchemy.dialects.postgresql import JSONB
                query = query.where(
                    cast(ContributorTable.badges, JSONB).contains([tier_label])
                )
            else:
                query = query.where(
                    cast(ContributorTable.badges, String).like(f'%"{tier_label}"%')
                )

        if category:
            if db_session.bind and db_session.bind.dialect.name == "postgresql":
                from sqlalchemy.dialects.postgresql import JSONB
                query = query.where(
                    cast(ContributorTable.skills, JSONB).contains([category.value])
                )
            else:
                query = query.where(
                    cast(ContributorTable.skills, String).like(f'%"{category.value}"%')
                )

        # Ranking: period stats first if period specified, otherwise all-time
        if cutoff:
            query = query.order_by(
                text("p_earnings DESC"),
                text("p_rep DESC"),
                ContributorTable.username.asc(),
            )
        else:
            query = query.order_by(
                ContributorTable.total_earnings.desc(),
                ContributorTable.reputation_score.desc(),
                ContributorTable.username.asc(),
            )

        result = await db_session.execute(query)
        return list(result.all())

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
    cache_key = _cache_key(period, tier, category)
    redis = get_redis_client()

    # Check cache
    try:
        cached_data = await redis.get(cache_key)
        if cached_data:
            cached_response = LeaderboardResponse.model_validate_json(cached_data)
            paginated = cached_response.entries[offset: offset + limit]
            return LeaderboardResponse(
                period=cached_response.period,
                total=cached_response.total,
                offset=offset,
                limit=limit,
                top3=cached_response.top3,
                entries=paginated,
            )
    except Exception as e:
        logger.warning(f"Redis cache read failed: {e}")

    # Build fresh from database
    ranked_rows = await _query_leaderboard(
        period, tier, category, session=session
    )

    ranked = [(rank, row, pe, pr) for rank, (row, pe, pr) in enumerate(ranked_rows, start=1)]

    top3 = [_to_top(rank, row, pe) for rank, row, pe, pr in ranked[:3]]
    all_entries = [_to_entry(rank, row, pe, pr) for rank, row, pe, pr in ranked]

    full = LeaderboardResponse(
        period=period.value,
        total=len(all_entries),
        offset=0,
        limit=len(all_entries),
        top3=top3,
        entries=all_entries,
    )

    # Store in cache
    try:
        redis = get_redis_client()
        await redis.setex(cache_key, CACHE_TTL, full.model_dump_json())
    except Exception as e:
        logger.warning(f"Redis cache write failed: {e}")

    # Return paginated slice
    return LeaderboardResponse(
        period=period.value,
        total=full.total,
        offset=offset,
        limit=limit,
        top3=top3,
        entries=all_entries[offset: offset + limit],
    )
