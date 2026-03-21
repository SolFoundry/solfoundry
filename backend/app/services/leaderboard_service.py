"""Leaderboard service — cached ranked contributor data."""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Optional

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
from app.services.contributor_service import _store

# ---------------------------------------------------------------------------
# In-memory cache (replaces materialized view for the MVP)
# ---------------------------------------------------------------------------

_cache: dict[str, tuple[float, LeaderboardResponse]] = {}
CACHE_TTL = 60  # seconds


def _cache_key(
    period: TimePeriod,
    tier: Optional[TierFilter],
    category: Optional[CategoryFilter],
) -> str:
    """Build a cache key from filter parameters."""
    return f"{period.value}:{tier or 'all'}:{category or 'all'}"


def invalidate_cache() -> None:
    """Call after any contributor stat change."""
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


def _matches_tier(contributor: ContributorDB, tier: Optional[TierFilter]) -> bool:
    """Check if contributor has completed bounties in the given tier."""
    if tier is None:
        return True
    tier_label = f"tier-{tier.value}"
    return tier_label in (contributor.badges or [])


def _matches_category(
    contributor: ContributorDB, category: Optional[CategoryFilter]
) -> bool:
    """Check if contributor has skills in the given category."""
    if category is None:
        return True
    return category.value in (contributor.skills or [])


def _build_leaderboard(
    period: TimePeriod,
    tier: Optional[TierFilter],
    category: Optional[CategoryFilter],
) -> list[tuple[int, ContributorDB]]:
    """Return ranked list of (rank, contributor) tuples."""
    cutoff = _period_cutoff(period)
    candidates = list(_store.values())

    # Filter by time period (created_at as proxy — full payout history would
    # allow per-period earnings, but this is the MVP in-memory approach).
    if cutoff:
        candidates = [c for c in candidates if c.created_at and c.created_at >= cutoff]

    # Filter by tier / category
    candidates = [c for c in candidates if _matches_tier(c, tier)]
    candidates = [c for c in candidates if _matches_category(c, category)]

    # Sort by total_earnings desc, then reputation desc, then username asc
    candidates.sort(
        key=lambda c: (-c.total_earnings, -c.reputation_score, c.username),
    )

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
            best_bounty_title=None,  # placeholder — extend when payout history exists
            best_bounty_earned=c.total_earnings,
        ),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_leaderboard(
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
    ranked = _build_leaderboard(period, tier, category)

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
