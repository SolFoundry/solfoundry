"""Leaderboard API endpoints.

Serves ranked contributor data from the PostgreSQL-backed leaderboard
service with TTL caching.  Supports both the backend structured format
(``LeaderboardResponse``) and a frontend-friendly camelCase JSON array.
"""

from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.models.leaderboard import (
    CategoryFilter,
    TierFilter,
    TimePeriod,
)
from app.services.leaderboard_service import get_leaderboard

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])

# Map frontend range params to backend TimePeriod
_RANGE_MAP = {
    "7d": TimePeriod.week,
    "30d": TimePeriod.month,
    "90d": TimePeriod.month,  # no 90d period, use month
    "all": TimePeriod.all,
    "week": TimePeriod.week,
    "month": TimePeriod.month,
}


@router.get(
    "/",
    summary="Get leaderboard",
    description="Ranked list of contributors by $FNDRY earned.",
)
@router.get("", include_in_schema=False)
async def leaderboard(
    period: Optional[TimePeriod] = Query(
        None, description="Time period: week, month, or all"
    ),
    range: Optional[str] = Query(None, description="Frontend range: 7d, 30d, 90d, all"),
    tier: Optional[TierFilter] = Query(
        None, description="Filter by bounty tier: 1, 2, or 3"
    ),
    category: Optional[CategoryFilter] = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=100, description="Results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> JSONResponse:
    """Ranked list of contributors by $FNDRY earned.

    Supports both backend format (``?period=all``) and frontend format
    (``?range=all``).  Returns an array of contributors in
    frontend-friendly camelCase format.

    Args:
        period: Backend-style time period enum.
        range: Frontend-style range string (7d, 30d, 90d, all).
        tier: Filter by bounty tier.
        category: Filter by skill category.
        limit: Results per page.
        offset: Pagination offset.

    Returns:
        JSON array of contributor objects for the leaderboard UI.
    """
    # Resolve period from either param
    resolved_period = TimePeriod.all
    if period:
        resolved_period = period
    elif range:
        resolved_period = _RANGE_MAP.get(range, TimePeriod.all)

    result = await get_leaderboard(
        period=resolved_period,
        tier=tier,
        category=category,
        limit=limit,
        offset=offset,
    )

    # Owner/platform accounts excluded from ranking
    EXCLUDED_USERNAMES = {"mtarcure", "SolFoundry", "solfoundry-bot"}

    # Return frontend-friendly format: array of Contributor objects
    contributors = []
    for entry in result.entries:
        if entry.username in EXCLUDED_USERNAMES:
            continue

        # Points formula: bounties are the primary signal
        # 100k per bounty completed + earnings/10 (so FNDRY payouts boost but don't dominate)
        # + reputation * 1000 (on-chain reputation as multiplier)
        bounties = entry.bounties_completed or 0
        earnings = float(entry.total_earned) if entry.total_earned else 0.0
        rep_score = entry.reputation_score if entry.reputation_score else 0
        points = (bounties * 100_000) + int(earnings / 10) + (rep_score * 1000)

        contributors.append(
            {
                "rank": 0,  # re-ranked after sorting
                "username": entry.username,
                "avatarUrl": entry.avatar_url
                or f"https://api.dicebear.com/7.x/identicon/svg?seed={entry.username}",
                "points": points,
                "bountiesCompleted": bounties,
                "earningsFndry": earnings,
                "earningsSol": 0,
                "streak": max(1, bounties // 2),
                "topSkills": [],
                # Phase 3: on-chain reputation + staking
                "reputation": rep_score,
                "stakedFndry": 0,
                "reputationBoost": 1.0,
            }
        )

    # Sort by points descending, then bounties as tiebreaker
    contributors.sort(key=lambda c: (c["points"], c["bountiesCompleted"]), reverse=True)
    for i, c in enumerate(contributors, start=1):
        c["rank"] = i

    # Enrich with skills from the contributor cache
    from app.services.contributor_service import _store

    for contributor_entry in contributors:
        for db_contrib in _store.values():
            if db_contrib.username == contributor_entry["username"]:
                contributor_entry["topSkills"] = (db_contrib.skills or [])[:3]
                break

    # Phase 3: Enrich with staking positions and reputation scores
    try:
        from app.services.staking_service import get_staking_positions_by_usernames
        from app.services.reputation_service import get_reputation_scores_by_usernames

        usernames = [c["username"] for c in contributors]

        staking_map = await get_staking_positions_by_usernames(usernames)
        reputation_map = await get_reputation_scores_by_usernames(usernames)

        for contributor_entry in contributors:
            uname = contributor_entry["username"]
            if uname in staking_map:
                pos = staking_map[uname]
                contributor_entry["stakedFndry"] = float(pos.get("amount", 0))
                contributor_entry["reputationBoost"] = float(pos.get("boost", 1.0))
            if uname in reputation_map:
                contributor_entry["reputation"] = int(reputation_map[uname])
    except (ImportError, Exception):
        # Phase 3 services may not be fully wired yet — graceful fallback
        pass

    return JSONResponse(content=contributors)
