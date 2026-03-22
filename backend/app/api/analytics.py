"""Contributor Analytics API endpoints.

Public-facing analytics API providing four main endpoint groups:
1. /api/analytics/leaderboard — Ranked contributors with quality scores
2. /api/analytics/contributors/{username} — Detailed contributor profiles
3. /api/analytics/bounties — Bounty completion statistics by tier/category
4. /api/analytics/platform — Platform health metrics and growth trends

All endpoints are public (no authentication required) and cached
for 2 minutes to reduce database load. Data is sourced from PostgreSQL
aggregation queries with in-memory caching.

See Also:
    - app.services.analytics_service: Business logic and caching
    - app.models.analytics: Pydantic request/response schemas
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.analytics import (
    BountyAnalyticsResponse,
    ContributorProfileAnalytics,
    LeaderboardAnalyticsResponse,
    PlatformHealthResponse,
)
from app.services.analytics_service import (
    get_bounty_analytics,
    get_contributor_profile_analytics,
    get_leaderboard_analytics,
    get_platform_health,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ---------------------------------------------------------------------------
# 1. Leaderboard Rankings
# ---------------------------------------------------------------------------


@router.get(
    "/leaderboard",
    response_model=LeaderboardAnalyticsResponse,
    summary="Get analytics leaderboard",
    description="Ranked list of contributors with quality scores, tier data, and on-chain verification status.",
)
async def analytics_leaderboard(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    per_page: int = Query(20, ge=1, le=100, description="Results per page"),
    sort_by: str = Query(
        "total_earned",
        description="Sort field: total_earned, bounties_completed, quality_score, reputation_score",
    ),
    sort_order: str = Query("desc", description="Sort direction: asc or desc"),
    tier: Optional[int] = Query(None, ge=1, le=3, description="Filter by tier (1-3)"),
    category: Optional[str] = Query(None, description="Filter by skill category"),
    search: Optional[str] = Query(None, description="Search by username substring"),
    time_range: Optional[str] = Query(
        None, description="Time range: 7d, 30d, 90d, or all"
    ),
) -> LeaderboardAnalyticsResponse:
    """Fetch the analytics leaderboard with ranked contributors.

    Returns contributors ranked by the specified sort field with
    extended analytics including quality scores, tier information,
    on-chain verification status, and top skills. Results are
    paginated and filterable.

    Public endpoint — no authentication required.
    Cached for 2 minutes.

    Args:
        page: Page number for pagination (1-indexed).
        per_page: Number of results per page (max 100).
        sort_by: Field to sort by (total_earned, bounties_completed,
                 quality_score, or reputation_score).
        sort_order: Sort direction (asc or desc).
        tier: Optional filter by contributor tier (1, 2, or 3).
        category: Optional filter by skill category string.
        search: Optional username search substring.
        time_range: Optional time range filter (7d, 30d, 90d, all).

    Returns:
        LeaderboardAnalyticsResponse with ranked entries and pagination metadata.
    """
    valid_sort_fields = {"total_earned", "bounties_completed", "quality_score", "reputation_score"}
    if sort_by not in valid_sort_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort_by. Must be one of: {', '.join(valid_sort_fields)}",
        )

    valid_sort_orders = {"asc", "desc"}
    if sort_order not in valid_sort_orders:
        raise HTTPException(
            status_code=400,
            detail="Invalid sort_order. Must be 'asc' or 'desc'.",
        )

    valid_time_ranges = {"7d", "30d", "90d", "all", None}
    if time_range not in valid_time_ranges:
        raise HTTPException(
            status_code=400,
            detail="Invalid time_range. Must be one of: 7d, 30d, 90d, all.",
        )

    return await get_leaderboard_analytics(
        page=page,
        per_page=per_page,
        sort_by=sort_by,
        sort_order=sort_order,
        tier_filter=tier,
        category_filter=category,
        search_query=search,
        time_range=time_range,
    )


# ---------------------------------------------------------------------------
# 2. Contributor Profile Analytics
# ---------------------------------------------------------------------------


@router.get(
    "/contributors/{username}",
    response_model=ContributorProfileAnalytics,
    summary="Get contributor profile analytics",
    description="Detailed contributor profile with completion history, review score trends, and tier progression.",
)
async def analytics_contributor_profile(
    username: str,
) -> ContributorProfileAnalytics:
    """Fetch detailed analytics for a single contributor.

    Returns comprehensive profile data including completion history,
    review score trends over time, tier progression milestones,
    and bounty completion breakdowns by tier and category.

    Public endpoint — no authentication required.
    Cached for 2 minutes per contributor.

    Args:
        username: GitHub username of the contributor.

    Returns:
        ContributorProfileAnalytics with full profile data.

    Raises:
        HTTPException 404: Contributor not found.
    """
    profile = await get_contributor_profile_analytics(username)
    if profile is None:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return profile


# ---------------------------------------------------------------------------
# 3. Bounty Analytics
# ---------------------------------------------------------------------------


@router.get(
    "/bounties",
    response_model=BountyAnalyticsResponse,
    summary="Get bounty analytics",
    description="Bounty completion statistics by tier and category with average review scores.",
)
async def analytics_bounties(
    time_range: Optional[str] = Query(
        None, description="Time range: 7d, 30d, 90d, or all"
    ),
) -> BountyAnalyticsResponse:
    """Fetch bounty completion analytics aggregated by tier and category.

    Returns completion rates, average review scores, time-to-completion
    metrics, and reward totals broken down by bounty tier and category.

    Public endpoint — no authentication required.
    Cached for 2 minutes.

    Args:
        time_range: Optional time range filter (7d, 30d, 90d, all).

    Returns:
        BountyAnalyticsResponse with tier and category breakdowns.
    """
    valid_time_ranges = {"7d", "30d", "90d", "all", None}
    if time_range not in valid_time_ranges:
        raise HTTPException(
            status_code=400,
            detail="Invalid time_range. Must be one of: 7d, 30d, 90d, all.",
        )

    return await get_bounty_analytics(time_range=time_range)


# ---------------------------------------------------------------------------
# 4. Platform Health
# ---------------------------------------------------------------------------


@router.get(
    "/platform",
    response_model=PlatformHealthResponse,
    summary="Get platform health metrics",
    description="Platform-wide health metrics including growth trends, active contributors, and payout totals.",
)
async def analytics_platform_health(
    time_range: Optional[str] = Query(
        None, description="Time range for growth trend: 7d, 30d, 90d, or all"
    ),
) -> PlatformHealthResponse:
    """Fetch platform health metrics and growth trend data.

    Returns aggregate counts (contributors, bounties, payouts),
    bounties grouped by status, and daily growth data points
    for dashboard visualizations.

    Public endpoint — no authentication required.
    Cached for 2 minutes.

    Args:
        time_range: Optional time range for growth trend (7d, 30d, 90d, all).

    Returns:
        PlatformHealthResponse with metrics and growth trend.
    """
    valid_time_ranges = {"7d", "30d", "90d", "all", None}
    if time_range not in valid_time_ranges:
        raise HTTPException(
            status_code=400,
            detail="Invalid time_range. Must be one of: 7d, 30d, 90d, all.",
        )

    return await get_platform_health(time_range=time_range)
