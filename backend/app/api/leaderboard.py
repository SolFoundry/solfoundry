"""Leaderboard API endpoints."""

from typing import Optional

from fastapi import APIRouter, Query

from app.models.leaderboard import (
    CategoryFilter,
    LeaderboardResponse,
    TierFilter,
    TimePeriod,
)
from app.services.leaderboard_service import get_leaderboard

router = APIRouter(prefix="/api", tags=["leaderboard"])


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def leaderboard(
    period: TimePeriod = Query(TimePeriod.all, description="Time period: week, month, or all"),
    tier: Optional[TierFilter] = Query(None, description="Filter by bounty tier: 1, 2, or 3"),
    category: Optional[CategoryFilter] = Query(None, description="Filter by category"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> LeaderboardResponse:
    """Ranked list of contributors by $FNDRY earned.

    Top 3 include extra metadata (medal, join date, best bounty).
    Results are cached for 60 seconds.
    """
    return get_leaderboard(
        period=period,
        tier=tier,
        category=category,
        limit=limit,
        offset=offset,
    )
