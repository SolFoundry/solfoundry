"""Leaderboard API endpoints."""

from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.models.leaderboard import (
    CategoryFilter,
    TierFilter,
    TimePeriod,
    LeaderboardResponse
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


@router.get("/leaderboard", response_model=LeaderboardResponse)
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
    """Ranked list of contributors by $FNDRY earned.

    Supports both backend format (?period=all) and frontend format (?range=all).
    Returns structured leaderboard response.
    """
    # Resolve period from either param
    resolved_period = TimePeriod.all
    if period:
        resolved_period = period
    elif range:
        resolved_period = _RANGE_MAP.get(range, TimePeriod.all)

    return get_leaderboard(
        period=resolved_period,
        tier=tier,
        category=category,
        limit=limit,
        offset=offset,
    )
