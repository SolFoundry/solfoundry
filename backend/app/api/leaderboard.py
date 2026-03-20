"""Leaderboard API endpoints."""

from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.models.leaderboard import (
    CategoryFilter,
    LeaderboardResponse,
    TierFilter,
    TimePeriod,
)
from app.services.leaderboard_service import get_leaderboard

router = APIRouter(prefix="/api", tags=["leaderboard"])

# Map frontend range params to backend TimePeriod
_RANGE_MAP = {
    "7d": TimePeriod.week,
    "30d": TimePeriod.month,
    "90d": TimePeriod.month,  # no 90d period, use month
    "all": TimePeriod.all,
    "week": TimePeriod.week,
    "month": TimePeriod.month,
}

_LEADERBOARD_EXAMPLE = [
    {
        "rank": 1,
        "username": "alice",
        "avatarUrl": "https://api.dicebear.com/7.x/identicon/svg?seed=alice",
        "points": 9500,
        "bountiesCompleted": 12,
        "earningsFndry": 95000.0,
        "earningsSol": 0,
        "streak": 6,
        "topSkills": ["rust", "anchor", "typescript"],
    },
    {
        "rank": 2,
        "username": "bob",
        "avatarUrl": "https://api.dicebear.com/7.x/identicon/svg?seed=bob",
        "points": 7200,
        "bountiesCompleted": 8,
        "earningsFndry": 72000.0,
        "earningsSol": 0,
        "streak": 4,
        "topSkills": ["solidity", "frontend", "react"],
    },
]


@router.get(
    "/leaderboard",
    summary="Get contributor leaderboard",
    description="""
Returns a ranked list of contributors sorted by $FNDRY earned.

**Time period filtering:**

You can use either the backend `period` parameter or the frontend-friendly `range` parameter:

| `range` | `period` equivalent | Description |
|---------|---------------------|-------------|
| `7d` | `week` | Last 7 days |
| `30d` | `month` | Last 30 days |
| `90d` | `month` | Approximated as 30 days |
| `all` | `all` | All time (default) |

**Category filter values:** `frontend`, `backend`, `security`, `docs`, `devops`

**Tier filter:** `1`, `2`, or `3` — filter by the tier of bounties completed

Results include enriched skill data from contributor profiles.
Each entry includes `points` (reputation × 100), `bountiesCompleted`, `earningsFndry`, and `topSkills`.
""",
    responses={
        200: {
            "description": "Ranked contributor list",
            "content": {
                "application/json": {
                    "example": _LEADERBOARD_EXAMPLE
                }
            },
        }
    },
)
async def leaderboard(
    period: Optional[TimePeriod] = Query(
        None,
        description="Time period: `week`, `month`, or `all`",
    ),
    range: Optional[str] = Query(
        None,
        description="Frontend range alias: `7d`, `30d`, `90d`, or `all`",
    ),
    tier: Optional[TierFilter] = Query(
        None,
        description="Filter by bounty tier: `1`, `2`, or `3`",
    ),
    category: Optional[CategoryFilter] = Query(
        None,
        description="Filter by skill category: `frontend`, `backend`, `security`, `docs`, `devops`",
    ),
    limit: int = Query(50, ge=1, le=100, description="Maximum entries to return (max 100)"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
):
    """Ranked list of contributors by $FNDRY earned."""
    # Resolve period from either param
    resolved_period = TimePeriod.all
    if period:
        resolved_period = period
    elif range:
        resolved_period = _RANGE_MAP.get(range, TimePeriod.all)

    result = get_leaderboard(
        period=resolved_period,
        tier=tier,
        category=category,
        limit=limit,
        offset=offset,
    )

    # Return frontend-friendly format: array of Contributor objects
    contributors = []
    for entry in result.entries:
        contributors.append({
            "rank": entry.rank,
            "username": entry.username,
            "avatarUrl": entry.avatar_url or f"https://api.dicebear.com/7.x/identicon/svg?seed={entry.username}",
            "points": int(entry.reputation_score * 100) if entry.reputation_score else 0,
            "bountiesCompleted": entry.bounties_completed,
            "earningsFndry": entry.total_earned,
            "earningsSol": 0,
            "streak": max(1, entry.bounties_completed // 2),
            "topSkills": [],
        })

    # Enrich with skills from contributor store
    from app.services.contributor_service import _store
    for c in contributors:
        for db_contrib in _store.values():
            if db_contrib.username == c["username"]:
                c["topSkills"] = (db_contrib.skills or [])[:3]
                break

    return JSONResponse(content=contributors)
