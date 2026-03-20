"""Leaderboard API endpoints.

## Overview

The leaderboard ranks contributors by $FNDRY earned. Features:
- **Time Periods**: Week, month, or all-time
- **Filters**: By tier, category
- **Top 3**: Extra metadata including medal, join date, best bounty

## Time Periods

| Period | Description |
|--------|-------------|
| week | Last 7 days |
| month | Last 30 days |
| all | All time (default) |

## Tier Filters

| Filter | Description |
|--------|-------------|
| 1 | Tier 1 bounties only |
| 2 | Tier 2 bounties only |
| 3 | Tier 3 bounties only |

## Category Filters

| Filter | Description |
|--------|-------------|
| frontend | Frontend work |
| backend | Backend work |
| security | Security work |
| docs | Documentation |
| devops | DevOps/Infrastructure |

## Response Fields

### Leaderboard Entry

| Field | Type | Description |
|-------|------|-------------|
| rank | integer | Position on leaderboard |
| username | string | GitHub username |
| display_name | string | Display name |
| avatar_url | string | Profile picture URL |
| total_earned | float | Total $FNDRY earned |
| bounties_completed | integer | Number of bounties |
| reputation_score | integer | Reputation points |
| wallet_address | string | Solana wallet address |

### Top 3 Metadata (for podium)

| Field | Type | Description |
|-------|------|-------------|
| medal | string | Medal emoji (🥇🥈🥉) |
| join_date | datetime | When they joined |
| best_bounty_title | string | Highest earning bounty |
| best_bounty_earned | float | Amount earned from best bounty |

## Caching

Results are cached for 60 seconds for performance.

## Rate Limit

100 requests per minute.
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


@router.get(
    "/leaderboard",
    summary="Get contributor leaderboard",
    description="""
Ranked list of contributors by $FNDRY earned.

## Features

- **Time Periods**: Filter by week, month, or all-time
- **Frontend Range**: Also supports `range` param (7d, 30d, 90d, all)
- **Tier Filter**: Show only specific bounty tier earnings
- **Category Filter**: Show only specific category earnings
- **Top 3 Podium**: Extra metadata for top performers

## Example Requests

```
GET /api/leaderboard?period=week
GET /api/leaderboard?range=7d
GET /api/leaderboard?period=month&tier=1
GET /api/leaderboard?category=frontend&limit=50
```

## Response Structure

Returns array of contributors in frontend-friendly camelCase format:
- `rank`, `username`, `avatarUrl`
- `points`, `bountiesCompleted`, `earningsFndry`
- `streak`, `topSkills`

## Caching

Results are cached for 60 seconds.

## Rate Limit

100 requests per minute.
""",
)
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
):
    """
    Ranked list of contributors by $FNDRY earned.

    Supports both backend format (?period=all) and frontend format (?range=all).
    Returns array of contributors in frontend-friendly camelCase format.
    """
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
        contributors.append(
            {
                "rank": entry.rank,
                "username": entry.username,
                "avatarUrl": entry.avatar_url
                or f"https://api.dicebear.com/7.x/identicon/svg?seed={entry.username}",
                "points": int(entry.reputation_score * 100)
                if entry.reputation_score
                else 0,
                "bountiesCompleted": entry.bounties_completed,
                "earningsFndry": entry.total_earned,
                "earningsSol": 0,
                "streak": max(1, entry.bounties_completed // 2),
                "topSkills": [],
            }
        )

    # Enrich with skills from contributor store
    from app.services.contributor_service import _store

    for c in contributors:
        for db_contrib in _store.values():
            if db_contrib.username == c["username"]:
                c["topSkills"] = (db_contrib.skills or [])[:3]
                break

    return JSONResponse(content=contributors)