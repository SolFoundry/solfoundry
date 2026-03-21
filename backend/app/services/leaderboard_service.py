"""Leaderboard service — cached ranked contributor data from PostgreSQL."""

from __future__ import annotations

import time
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contributor import ContributorDB
from app.models.leaderboard import (
    CategoryFilter,
    LeaderboardEntry,
    LeaderboardResponse,
    TierFilter,
    TimePeriod,
    TopContributor,
    TopContributorMeta,
)

# ---------------------------------------------------------------------------
# In-memory cache
# ---------------------------------------------------------------------------

_cache: dict[str, tuple[float, LeaderboardResponse]] = {}
CACHE_TTL = 60  # seconds
_cache_lock = asyncio.Lock()


def _cache_key(
    period: TimePeriod,
    tier: Optional[TierFilter],
    category: Optional[CategoryFilter],
) -> str:
    """Build a cache key from filter parameters."""
    return f"{period.value}:{tier or 'all'}:{category or 'all'}"


async def invalidate_cache() -> None:
    """Call after any contributor stat change."""
    async with _cache_lock:
        _cache.clear()


# ---------------------------------------------------------------------------
# Core ranking logic
# ---------------------------------------------------------------------------

MEDALS = {1: "🥇", 2: "🥈", 3: "🥉"}


def _period_cutoff(period: TimePeriod) -> Optional[datetime]:
    """Return the UTC cutoff datetime for a time period."""
    now = datetime.now(timezone.utc)
    if period == TimePeriod.week:
        return now - timedelta(days=7)
    if period == TimePeriod.month:
        return now - timedelta(days=30)
    return None  # all-time


async def _build_leaderboard(
    db: AsyncSession,
    period: TimePeriod,
    tier: Optional[TierFilter],
    category: Optional[CategoryFilter],
) -> list[tuple[int, ContributorDB]]:
    """Return ranked list of (rank, contributor) tuples from DB."""
    cutoff = _period_cutoff(period)
    
    query = select(ContributorDB)

    if cutoff:
        query = query.where(ContributorDB.created_at >= cutoff)

    # Filter by tier / category
    if tier:
        # Assuming tier is stored in badges as 'tier-1', 'tier-2', etc.
        tier_label = f"tier-{tier.value}"
        query = query.where(ContributorDB.badges.contains([tier_label]))
    
    if category:
        query = query.where(ContributorDB.skills.contains([category.value]))

    # Sort by total_earnings desc, then reputation desc, then username asc
    query = query.order_by(
        desc(ContributorDB.total_earnings),
        desc(ContributorDB.reputation_score),
        ContributorDB.username,
    )

    result = await db.execute(query)
    candidates = result.scalars().all()

    return [(rank, c) for rank, c in enumerate(candidates, start=1)]


def _to_entry(rank: int, c: ContributorDB) -> LeaderboardEntry:
    """Convert a ranked contributor to a LeaderboardEntry."""
    return LeaderboardEntry(
        rank=rank,
        username=c.username,
        display_name=c.display_name,
        avatar_url=c.avatar_url,
        total_earned=c.total_earnings,
        bounties_completed=c.total_bounties_completed,
        reputation_score=c.reputation_score,
    )


def _to_top(rank: int, c: ContributorDB) -> TopContributor:
    """Convert a ranked contributor to a TopContributor."""
    return TopContributor(
        rank=rank,
        username=c.username,
        display_name=c.display_name,
        avatar_url=c.avatar_url,
        total_earned=c.total_earnings,
        bounties_completed=c.total_bounties_completed,
        reputation_score=c.reputation_score,
        meta=TopContributorMeta(
            medal=MEDALS.get(rank, ""),
            join_date=c.created_at,
            best_bounty_title=None,
            best_bounty_earned=c.total_earnings,
        ),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def get_leaderboard(
    db: AsyncSession,
    period: TimePeriod = TimePeriod.all,
    tier: Optional[TierFilter] = None,
    category: Optional[CategoryFilter] = None,
    limit: int = 20,
    offset: int = 0,
) -> LeaderboardResponse:
    """Return the leaderboard, served from cache when possible."""

    key = _cache_key(period, tier, category)
    now = time.time()

    # Check cache
    async with _cache_lock:
        if key in _cache:
            cached_at, cached_resp = _cache[key]
            if now - cached_at < CACHE_TTL:
                # Apply pagination on cached full result
                paginated = cached_resp.entries[offset : offset + limit]
                return LeaderboardResponse(
                    period=cached_resp.period,
                    total=cached_resp.total,
                    offset=offset,
                    limit=limit,
                    top3=cached_resp.top3,
                    entries=paginated,
                )

    # Build fresh
    ranked = await _build_leaderboard(db, period, tier, category)

    top3 = [_to_top(rank, c) for rank, c in ranked[:3]]
    all_entries = [_to_entry(rank, c) for rank, c in ranked]

    full = LeaderboardResponse(
        period=period.value,
        total=len(all_entries),
        offset=0,
        limit=len(all_entries),
        top3=top3,
        entries=all_entries,
    )

    # Store in cache
    async with _cache_lock:
        _cache[key] = (now, full)

    # Return paginated slice
    return LeaderboardResponse(
        period=period.value,
        total=full.total,
        offset=offset,
        limit=limit,
        top3=top3,
        entries=all_entries[offset : offset + limit],
    )
