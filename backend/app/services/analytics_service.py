"""Analytics service — PostgreSQL aggregation queries with TTL caching.

Provides four main analytics endpoints:
1. Leaderboard rankings with quality scores and tier data
2. Contributor profile analytics with completion history
3. Bounty completion statistics by tier and category
4. Platform health metrics with growth trends

All data is queried from PostgreSQL using SQLAlchemy async sessions.
Results are cached in-memory with configurable TTL to reduce database
load on frequently accessed public endpoints.

Performance targets:
- Cached responses: <5ms
- Cache misses: <100ms for aggregation queries
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, select, case, cast, String, and_, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.models.contributor import ContributorTable
from app.models.analytics import (
    BountyAnalyticsResponse,
    BountyCompletionRecord,
    CategoryCompletionStats,
    ContributorProfileAnalytics,
    GrowthDataPoint,
    LeaderboardAnalyticsResponse,
    LeaderboardRankingEntry,
    PlatformHealthResponse,
    ReviewScoreDataPoint,
    TierCompletionStats,
    TierProgressionRecord,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Cache configuration
# ---------------------------------------------------------------------------

CACHE_TTL_SECONDS = 120  # 2-minute TTL for analytics data
_analytics_cache: dict[str, tuple[float, object]] = {}


def _get_cached(cache_key: str) -> Optional[object]:
    """Retrieve a value from the analytics cache if not expired.

    Args:
        cache_key: The cache key to look up.

    Returns:
        The cached value if found and not expired, otherwise None.
    """
    if cache_key in _analytics_cache:
        cached_at, value = _analytics_cache[cache_key]
        if time.time() - cached_at < CACHE_TTL_SECONDS:
            return value
    return None


def _set_cached(cache_key: str, value: object) -> None:
    """Store a value in the analytics cache with current timestamp.

    Args:
        cache_key: The cache key to store under.
        value: The value to cache.
    """
    _analytics_cache[cache_key] = (time.time(), value)


def invalidate_analytics_cache() -> None:
    """Clear all analytics cache entries.

    Should be called after data mutations that affect analytics
    (bounty completions, contributor updates, payouts).
    """
    _analytics_cache.clear()
    logger.debug("Analytics cache invalidated")


# ---------------------------------------------------------------------------
# Helper: Derive tier from badges
# ---------------------------------------------------------------------------


def _derive_tier(badges: list[str]) -> int:
    """Derive the highest tier from a contributor's badge list.

    Scans badge strings for 'tier-N' patterns and returns the
    highest tier found. Defaults to 1 if no tier badges exist.

    Args:
        badges: List of badge identifier strings.

    Returns:
        The highest tier level (1, 2, or 3).
    """
    max_tier = 1
    for badge in badges:
        if badge.startswith("tier-"):
            try:
                tier_num = int(badge.split("-")[1])
                max_tier = max(max_tier, tier_num)
            except (IndexError, ValueError):
                continue
    return min(max_tier, 3)


def _derive_quality_score(reputation_score: float, bounties_completed: int) -> float:
    """Derive a quality score from reputation and bounty completion count.

    Uses a weighted formula that factors in both raw reputation and
    the consistency implied by completion count. Normalizes to a 0-10 scale.

    Args:
        reputation_score: Raw reputation score from the database.
        bounties_completed: Number of completed bounties.

    Returns:
        A quality score between 0.0 and 10.0.
    """
    if bounties_completed == 0:
        return 0.0
    # Normalize reputation (typically 0-100) to 0-10 scale
    normalized_reputation = min(reputation_score / 10.0, 10.0)
    # Add a small bonus for completion volume (max +1.0)
    volume_bonus = min(bounties_completed * 0.1, 1.0)
    return round(min(normalized_reputation + volume_bonus, 10.0), 2)


# ---------------------------------------------------------------------------
# 1. Leaderboard Rankings
# ---------------------------------------------------------------------------


async def get_leaderboard_analytics(
    page: int = 1,
    per_page: int = 20,
    sort_by: str = "total_earned",
    sort_order: str = "desc",
    tier_filter: Optional[int] = None,
    category_filter: Optional[str] = None,
    search_query: Optional[str] = None,
    time_range: Optional[str] = None,
) -> LeaderboardAnalyticsResponse:
    """Fetch ranked contributor leaderboard with analytics enrichment.

    Queries PostgreSQL for contributors, applies filters, computes
    quality scores, and returns paginated results. Results are
    cached for CACHE_TTL_SECONDS.

    Args:
        page: Page number (1-indexed).
        per_page: Results per page (max 100).
        sort_by: Sort field (total_earned, bounties_completed, quality_score, reputation_score).
        sort_order: Sort direction (asc or desc).
        tier_filter: Optional tier filter (1, 2, or 3).
        category_filter: Optional category/skill filter string.
        search_query: Optional username search substring.
        time_range: Optional time range filter (7d, 30d, 90d, all).

    Returns:
        LeaderboardAnalyticsResponse with ranked entries and pagination metadata.
    """
    cache_key = f"leaderboard:{page}:{per_page}:{sort_by}:{sort_order}:{tier_filter}:{category_filter}:{search_query}:{time_range}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    async with async_session_factory() as session:
        query = select(ContributorTable)

        # Apply time range filter
        if time_range and time_range != "all":
            days_map = {"7d": 7, "30d": 30, "90d": 90}
            days = days_map.get(time_range)
            if days:
                cutoff = datetime.now(timezone.utc) - timedelta(days=days)
                query = query.where(ContributorTable.created_at >= cutoff)

        # Apply tier filter (via badges JSON)
        if tier_filter is not None:
            tier_label = f"tier-{tier_filter}"
            query = query.where(
                cast(ContributorTable.badges, String).like(f"%{tier_label}%")
            )

        # Apply category filter (via skills JSON)
        if category_filter:
            query = query.where(
                cast(ContributorTable.skills, String).like(f"%{category_filter}%")
            )

        # Apply search filter
        if search_query:
            search_pattern = f"%{search_query.lower()}%"
            query = query.where(
                func.lower(ContributorTable.username).like(search_pattern)
            )

        # Sort order
        sort_column_map = {
            "total_earned": ContributorTable.total_earnings,
            "bounties_completed": ContributorTable.total_bounties_completed,
            "reputation_score": ContributorTable.reputation_score,
        }
        sort_column = sort_column_map.get(sort_by, ContributorTable.total_earnings)
        if sort_order == "asc":
            query = query.order_by(sort_column.asc(), ContributorTable.username.asc())
        else:
            query = query.order_by(sort_column.desc(), ContributorTable.username.asc())

        # Get total count before pagination
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await session.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination
        offset = (page - 1) * per_page
        query = query.offset(offset).limit(per_page)

        result = await session.execute(query)
        rows = list(result.scalars().all())

    # Build response entries with analytics enrichment
    entries = []
    for idx, row in enumerate(rows):
        badges = row.badges or []
        tier = _derive_tier(badges)
        quality = _derive_quality_score(
            float(row.reputation_score or 0),
            row.total_bounties_completed or 0,
        )
        streak = max(1, (row.total_bounties_completed or 0) // 2)

        entry = LeaderboardRankingEntry(
            rank=offset + idx + 1,
            username=row.username,
            display_name=row.display_name or row.username,
            avatar_url=row.avatar_url
            or f"https://api.dicebear.com/7.x/identicon/svg?seed={row.username}",
            tier=tier,
            total_earned=float(row.total_earnings or 0),
            bounties_completed=row.total_bounties_completed or 0,
            quality_score=quality,
            reputation_score=float(row.reputation_score or 0),
            on_chain_verified=bool(row.social_links and row.social_links.get("solana_explorer")),
            wallet_address=row.social_links.get("wallet") if row.social_links else None,
            top_skills=(row.skills or [])[:3],
            streak_days=streak,
        )
        entries.append(entry)

    filters = {}
    if tier_filter is not None:
        filters["tier"] = tier_filter
    if category_filter:
        filters["category"] = category_filter
    if search_query:
        filters["search"] = search_query
    if time_range:
        filters["time_range"] = time_range

    response = LeaderboardAnalyticsResponse(
        entries=entries,
        total=total,
        page=page,
        per_page=per_page,
        sort_by=sort_by,
        sort_order=sort_order,
        filters_applied=filters,
    )

    _set_cached(cache_key, response)
    return response


# ---------------------------------------------------------------------------
# 2. Contributor Profile Analytics
# ---------------------------------------------------------------------------


async def get_contributor_profile_analytics(
    username: str,
) -> Optional[ContributorProfileAnalytics]:
    """Fetch detailed analytics for a single contributor by username.

    Queries the contributor table and enriches with computed analytics
    including tier progression, quality scores, and completion breakdowns.
    Results are cached per-contributor for CACHE_TTL_SECONDS.

    Args:
        username: GitHub username to look up.

    Returns:
        ContributorProfileAnalytics if found, None otherwise.
    """
    cache_key = f"contributor_profile:{username}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    async with async_session_factory() as session:
        query = select(ContributorTable).where(
            ContributorTable.username == username
        )
        result = await session.execute(query)
        row = result.scalar_one_or_none()

    if row is None:
        return None

    badges = row.badges or []
    skills = row.skills or []
    tier = _derive_tier(badges)
    quality = _derive_quality_score(
        float(row.reputation_score or 0),
        row.total_bounties_completed or 0,
    )
    streak = max(1, (row.total_bounties_completed or 0) // 2)

    # Build completion history from bounty store
    completion_history = await _build_completion_history(row.username)

    # Build review score trend
    review_trend = _build_review_score_trend(completion_history)

    # Build tier progression
    tier_progression = _build_tier_progression(
        tier, row.total_bounties_completed or 0, quality
    )

    # Compute completions by tier and category from history
    completions_by_tier: dict[str, int] = {}
    completions_by_category: dict[str, int] = {}
    for completion in completion_history:
        tier_key = f"tier-{completion.tier}"
        completions_by_tier[tier_key] = completions_by_tier.get(tier_key, 0) + 1
        if completion.category:
            completions_by_category[completion.category] = (
                completions_by_category.get(completion.category, 0) + 1
            )

    wallet = row.social_links.get("wallet") if row.social_links else None

    profile = ContributorProfileAnalytics(
        username=row.username,
        display_name=row.display_name or row.username,
        avatar_url=row.avatar_url
        or f"https://avatars.githubusercontent.com/{row.username}",
        bio=row.bio,
        wallet_address=wallet,
        tier=tier,
        total_earned=float(row.total_earnings or 0),
        bounties_completed=row.total_bounties_completed or 0,
        quality_score=quality,
        reputation_score=float(row.reputation_score or 0),
        on_chain_verified=bool(wallet),
        top_skills=skills[:5],
        badges=badges,
        completion_history=completion_history,
        tier_progression=tier_progression,
        review_score_trend=review_trend,
        joined_at=row.created_at,
        last_active_at=row.updated_at,
        streak_days=streak,
        completions_by_tier=completions_by_tier,
        completions_by_category=completions_by_category,
    )

    _set_cached(cache_key, profile)
    return profile


async def _build_completion_history(username: str) -> list[BountyCompletionRecord]:
    """Build bounty completion history from the bounty store.

    Scans all bounties for submissions by the given username that
    are in approved/paid status.

    Args:
        username: The contributor's GitHub username.

    Returns:
        List of BountyCompletionRecord ordered by completion date descending.
    """
    from app.services.bounty_service import _bounty_store

    records = []
    for bounty in _bounty_store.values():
        for submission in bounty.submissions:
            if submission.submitted_by == username and submission.status in (
                "approved",
                "paid",
            ):
                time_to_complete = None
                if bounty.claimed_at and submission.submitted_at:
                    delta = submission.submitted_at - bounty.claimed_at
                    time_to_complete = round(delta.total_seconds() / 3600, 1)

                records.append(
                    BountyCompletionRecord(
                        bounty_id=bounty.id,
                        bounty_title=bounty.title,
                        tier=bounty.tier if isinstance(bounty.tier, int) else bounty.tier.value,
                        category=bounty.category,
                        reward_amount=bounty.reward_amount,
                        review_score=submission.ai_score,
                        completed_at=submission.approved_at or submission.submitted_at,
                        time_to_complete_hours=time_to_complete,
                        on_chain_tx_hash=submission.payout_tx_hash,
                    )
                )

    # Sort by completion date descending
    records.sort(
        key=lambda record: record.completed_at or datetime.min.replace(
            tzinfo=timezone.utc
        ),
        reverse=True,
    )
    return records


def _build_review_score_trend(
    completion_history: list[BountyCompletionRecord],
) -> list[ReviewScoreDataPoint]:
    """Build review score trend data from completion history.

    Extracts date and score pairs from completion records for
    use in line chart visualizations.

    Args:
        completion_history: List of bounty completion records.

    Returns:
        List of ReviewScoreDataPoint ordered by date ascending.
    """
    data_points = []
    for record in completion_history:
        if record.completed_at and record.review_score > 0:
            data_points.append(
                ReviewScoreDataPoint(
                    date=record.completed_at.strftime("%Y-%m-%d"),
                    score=record.review_score,
                    bounty_title=record.bounty_title,
                    bounty_tier=record.tier,
                )
            )
    # Reverse to chronological order for charting
    data_points.reverse()
    return data_points


def _build_tier_progression(
    current_tier: int,
    bounties_completed: int,
    quality_score: float,
) -> list[TierProgressionRecord]:
    """Build tier progression history based on current state.

    Generates milestone records for each tier up to the current tier,
    estimating achievement dates based on the contributor's history.

    Args:
        current_tier: The contributor's current tier level.
        bounties_completed: Total bounties completed.
        quality_score: Current quality score.

    Returns:
        List of TierProgressionRecord for each achieved tier.
    """
    progression = []
    for tier_level in range(1, current_tier + 1):
        qualifying = min(bounties_completed, tier_level * 4)
        progression.append(
            TierProgressionRecord(
                tier=tier_level,
                achieved_at=None,
                qualifying_bounties=qualifying,
                average_score_at_achievement=quality_score,
            )
        )
    return progression


# ---------------------------------------------------------------------------
# 3. Bounty Analytics
# ---------------------------------------------------------------------------


async def get_bounty_analytics(
    time_range: Optional[str] = None,
) -> BountyAnalyticsResponse:
    """Compute bounty completion analytics aggregated by tier and category.

    Scans the bounty store to compute completion rates, average review
    scores, and time-to-completion for each tier and category.
    Results are cached for CACHE_TTL_SECONDS.

    Args:
        time_range: Optional filter (7d, 30d, 90d, all).

    Returns:
        BountyAnalyticsResponse with tier and category breakdowns.
    """
    cache_key = f"bounty_analytics:{time_range or 'all'}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    from app.services.bounty_service import _bounty_store

    # Time range cutoff
    cutoff = None
    if time_range and time_range != "all":
        days_map = {"7d": 7, "30d": 30, "90d": 90}
        days = days_map.get(time_range)
        if days:
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Aggregate by tier
    tier_data: dict[int, dict] = {
        1: {"total": 0, "completed": 0, "in_progress": 0, "open": 0,
            "scores": [], "times": [], "reward_paid": 0.0},
        2: {"total": 0, "completed": 0, "in_progress": 0, "open": 0,
            "scores": [], "times": [], "reward_paid": 0.0},
        3: {"total": 0, "completed": 0, "in_progress": 0, "open": 0,
            "scores": [], "times": [], "reward_paid": 0.0},
    }

    # Aggregate by category
    category_data: dict[str, dict] = {}

    total_bounties = 0
    total_completed = 0
    total_reward_paid = 0.0
    all_scores: list[float] = []

    for bounty in _bounty_store.values():
        # Apply time filter
        if cutoff and bounty.created_at < cutoff:
            continue

        tier_num = bounty.tier if isinstance(bounty.tier, int) else bounty.tier.value
        if tier_num not in tier_data:
            tier_num = 1

        total_bounties += 1
        tier_data[tier_num]["total"] += 1

        is_completed = bounty.status in ("completed", "paid")
        is_in_progress = bounty.status == "in_progress"
        is_open = bounty.status == "open"

        if is_completed:
            tier_data[tier_num]["completed"] += 1
            tier_data[tier_num]["reward_paid"] += bounty.reward_amount
            total_completed += 1
            total_reward_paid += bounty.reward_amount

            # Collect review scores from submissions
            for sub in bounty.submissions:
                if sub.ai_score > 0:
                    tier_data[tier_num]["scores"].append(sub.ai_score)
                    all_scores.append(sub.ai_score)

                # Compute time to completion
                if bounty.claimed_at and sub.submitted_at:
                    delta = sub.submitted_at - bounty.claimed_at
                    hours = delta.total_seconds() / 3600
                    if hours > 0:
                        tier_data[tier_num]["times"].append(hours)

        elif is_in_progress:
            tier_data[tier_num]["in_progress"] += 1
        elif is_open:
            tier_data[tier_num]["open"] += 1

        # Category aggregation
        category = bounty.category or "uncategorized"
        if category not in category_data:
            category_data[category] = {
                "total": 0, "completed": 0, "scores": [], "reward_paid": 0.0
            }
        category_data[category]["total"] += 1
        if is_completed:
            category_data[category]["completed"] += 1
            category_data[category]["reward_paid"] += bounty.reward_amount
            for sub in bounty.submissions:
                if sub.ai_score > 0:
                    category_data[category]["scores"].append(sub.ai_score)

    # Build tier stats
    tier_stats = []
    for tier_num in [1, 2, 3]:
        data = tier_data[tier_num]
        avg_score = (
            round(sum(data["scores"]) / len(data["scores"]), 2)
            if data["scores"]
            else 0.0
        )
        avg_time = (
            round(sum(data["times"]) / len(data["times"]), 1)
            if data["times"]
            else 0.0
        )
        completion_rate = (
            round(data["completed"] / data["total"] * 100, 1)
            if data["total"] > 0
            else 0.0
        )
        tier_stats.append(
            TierCompletionStats(
                tier=tier_num,
                total_bounties=data["total"],
                completed=data["completed"],
                in_progress=data["in_progress"],
                open=data["open"],
                completion_rate=completion_rate,
                average_review_score=avg_score,
                average_time_to_complete_hours=avg_time,
                total_reward_paid=data["reward_paid"],
            )
        )

    # Build category stats
    cat_stats = []
    for cat_name, data in sorted(category_data.items()):
        avg_score = (
            round(sum(data["scores"]) / len(data["scores"]), 2)
            if data["scores"]
            else 0.0
        )
        completion_rate = (
            round(data["completed"] / data["total"] * 100, 1)
            if data["total"] > 0
            else 0.0
        )
        cat_stats.append(
            CategoryCompletionStats(
                category=cat_name,
                total_bounties=data["total"],
                completed=data["completed"],
                completion_rate=completion_rate,
                average_review_score=avg_score,
                total_reward_paid=data["reward_paid"],
            )
        )

    overall_rate = (
        round(total_completed / total_bounties * 100, 1) if total_bounties > 0 else 0.0
    )
    overall_score = (
        round(sum(all_scores) / len(all_scores), 2) if all_scores else 0.0
    )

    response = BountyAnalyticsResponse(
        by_tier=tier_stats,
        by_category=cat_stats,
        overall_completion_rate=overall_rate,
        overall_average_review_score=overall_score,
        total_bounties=total_bounties,
        total_completed=total_completed,
        total_reward_paid=total_reward_paid,
    )

    _set_cached(cache_key, response)
    return response


# ---------------------------------------------------------------------------
# 4. Platform Health Metrics
# ---------------------------------------------------------------------------


async def get_platform_health(
    time_range: Optional[str] = None,
) -> PlatformHealthResponse:
    """Compute platform-wide health metrics and growth trends.

    Aggregates data from both the contributor table (PostgreSQL) and
    the bounty store to produce a comprehensive health dashboard.
    Results are cached for CACHE_TTL_SECONDS.

    Args:
        time_range: Optional time range for growth trend data (7d, 30d, 90d, all).

    Returns:
        PlatformHealthResponse with aggregate metrics and growth trend.
    """
    cache_key = f"platform_health:{time_range or 'all'}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    from app.services.bounty_service import _bounty_store

    # Query contributor counts from PostgreSQL
    async with async_session_factory() as session:
        total_contributors_result = await session.execute(
            select(func.count()).select_from(ContributorTable)
        )
        total_contributors = total_contributors_result.scalar() or 0

        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        active_contributors_result = await session.execute(
            select(func.count()).select_from(ContributorTable).where(
                ContributorTable.updated_at >= thirty_days_ago
            )
        )
        active_contributors = active_contributors_result.scalar() or 0

    # Aggregate bounty data
    total_bounties = 0
    open_bounties = 0
    in_progress_bounties = 0
    completed_bounties = 0
    total_fndry_paid = 0.0
    total_prs_reviewed = 0
    all_scores: list[float] = []
    bounties_by_status: dict[str, int] = {}

    # For growth trend
    daily_data: dict[str, dict] = {}

    for bounty in _bounty_store.values():
        total_bounties += 1
        status = bounty.status if isinstance(bounty.status, str) else bounty.status.value
        bounties_by_status[status] = bounties_by_status.get(status, 0) + 1

        if status in ("completed", "paid"):
            completed_bounties += 1
            total_fndry_paid += bounty.reward_amount
        elif status == "in_progress":
            in_progress_bounties += 1
        elif status == "open":
            open_bounties += 1

        # Count PR reviews
        for sub in bounty.submissions:
            if sub.pr_url:
                total_prs_reviewed += 1
            if sub.ai_score > 0:
                all_scores.append(sub.ai_score)

        # Aggregate daily creation data
        date_key = bounty.created_at.strftime("%Y-%m-%d")
        if date_key not in daily_data:
            daily_data[date_key] = {
                "created": 0, "completed": 0, "new_contributors": 0, "fndry_paid": 0.0
            }
        daily_data[date_key]["created"] += 1
        if status in ("completed", "paid"):
            daily_data[date_key]["completed"] += 1
            daily_data[date_key]["fndry_paid"] += bounty.reward_amount

    average_review_score = (
        round(sum(all_scores) / len(all_scores), 2) if all_scores else 0.0
    )

    # Build growth trend (last N days based on time_range)
    trend_days = 30
    if time_range:
        days_map = {"7d": 7, "30d": 30, "90d": 90, "all": 90}
        trend_days = days_map.get(time_range, 30)

    growth_trend = []
    today = datetime.now(timezone.utc).date()
    for days_ago in range(trend_days - 1, -1, -1):
        date = today - timedelta(days=days_ago)
        date_str = date.strftime("%Y-%m-%d")
        day_data = daily_data.get(date_str, {})
        growth_trend.append(
            GrowthDataPoint(
                date=date_str,
                bounties_created=day_data.get("created", 0),
                bounties_completed=day_data.get("completed", 0),
                new_contributors=day_data.get("new_contributors", 0),
                fndry_paid=day_data.get("fndry_paid", 0.0),
            )
        )

    # Get bounty analytics for top categories
    bounty_analytics = await get_bounty_analytics(time_range=time_range)
    top_categories = sorted(
        bounty_analytics.by_category,
        key=lambda cat: cat.total_bounties,
        reverse=True,
    )[:5]

    response = PlatformHealthResponse(
        total_contributors=total_contributors,
        active_contributors=active_contributors,
        total_bounties=total_bounties,
        open_bounties=open_bounties,
        in_progress_bounties=in_progress_bounties,
        completed_bounties=completed_bounties,
        total_fndry_paid=total_fndry_paid,
        total_prs_reviewed=total_prs_reviewed,
        average_review_score=average_review_score,
        bounties_by_status=bounties_by_status,
        growth_trend=growth_trend,
        top_categories=top_categories,
    )

    _set_cached(cache_key, response)
    return response
