"""Analytics Pydantic models for the Contributor Analytics Platform.

Defines request/response schemas for analytics endpoints including
leaderboard rankings, contributor profiles with history, bounty
completion statistics, and platform health metrics.

All monetary values use Decimal-compatible floats to maintain precision.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Leaderboard Analytics
# ---------------------------------------------------------------------------


class LeaderboardRankingEntry(BaseModel):
    """A single contributor entry in the analytics leaderboard.

    Extends the basic leaderboard entry with quality score,
    tier information, and on-chain verification status.

    Attributes:
        rank: 1-indexed position in the leaderboard.
        username: GitHub username of the contributor.
        display_name: Human-readable display name.
        avatar_url: URL to the contributor's avatar image.
        tier: Current contributor tier (1, 2, or 3).
        total_earned: Total $FNDRY tokens earned.
        bounties_completed: Number of successfully completed bounties.
        quality_score: Average review score across all submissions.
        reputation_score: Reputation points accumulated over time.
        on_chain_verified: Whether the contributor has verified on-chain activity.
        wallet_address: Solana wallet address if linked.
        top_skills: Top 3 skill tags for this contributor.
        streak_days: Current consecutive active days.
    """

    rank: int = Field(..., description="1-indexed leaderboard position")
    username: str = Field(..., description="GitHub username")
    display_name: str = Field("", description="Display name")
    avatar_url: Optional[str] = Field(None, description="Avatar image URL")
    tier: int = Field(1, ge=1, le=3, description="Contributor tier (1-3)")
    total_earned: float = Field(0.0, description="Total $FNDRY earned")
    bounties_completed: int = Field(0, description="Completed bounties count")
    quality_score: float = Field(0.0, description="Average review score (0-10)")
    reputation_score: float = Field(0.0, description="Reputation points")
    on_chain_verified: bool = Field(False, description="On-chain verification status")
    wallet_address: Optional[str] = Field(None, description="Linked Solana wallet")
    top_skills: list[str] = Field(default_factory=list, description="Top skill tags")
    streak_days: int = Field(0, description="Consecutive active days")


class LeaderboardAnalyticsResponse(BaseModel):
    """Paginated leaderboard analytics response.

    Includes contributor rankings with extended analytics data,
    pagination metadata, and applied filter information.

    Attributes:
        entries: List of ranked contributor entries.
        total: Total number of contributors matching the filters.
        page: Current page number (1-indexed).
        per_page: Number of entries per page.
        sort_by: Field used for sorting.
        sort_order: Sort direction (asc or desc).
        filters_applied: Dictionary of active filter parameters.
    """

    entries: list[LeaderboardRankingEntry] = Field(default_factory=list)
    total: int = Field(0, description="Total matching contributors")
    page: int = Field(1, ge=1, description="Current page number")
    per_page: int = Field(20, ge=1, le=100, description="Entries per page")
    sort_by: str = Field("total_earned", description="Sort field")
    sort_order: str = Field("desc", description="Sort direction")
    filters_applied: dict = Field(default_factory=dict, description="Active filters")


# ---------------------------------------------------------------------------
# Contributor Profile Analytics
# ---------------------------------------------------------------------------


class BountyCompletionRecord(BaseModel):
    """A single bounty completion in a contributor's history.

    Attributes:
        bounty_id: Unique identifier for the bounty.
        bounty_title: Title of the completed bounty.
        tier: Bounty tier (1, 2, or 3).
        category: Bounty category (backend, frontend, etc.).
        reward_amount: $FNDRY reward received.
        review_score: AI review score received (0-10).
        completed_at: Timestamp when the bounty was completed.
        time_to_complete_hours: Hours taken from claim to completion.
        on_chain_tx_hash: Solana transaction hash for the payout.
    """

    bounty_id: str = Field(..., description="Bounty unique identifier")
    bounty_title: str = Field(..., description="Bounty title")
    tier: int = Field(1, ge=1, le=3, description="Bounty tier")
    category: Optional[str] = Field(None, description="Bounty category")
    reward_amount: float = Field(0.0, description="$FNDRY reward received")
    review_score: float = Field(0.0, description="AI review score (0-10)")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    time_to_complete_hours: Optional[float] = Field(
        None, description="Hours from claim to completion"
    )
    on_chain_tx_hash: Optional[str] = Field(
        None, description="Solana payout transaction hash"
    )


class TierProgressionRecord(BaseModel):
    """Tier progression milestone for a contributor.

    Attributes:
        tier: Tier level achieved (1, 2, or 3).
        achieved_at: When this tier was achieved.
        qualifying_bounties: Number of bounties that qualified for this tier.
        average_score_at_achievement: Average review score at time of achievement.
    """

    tier: int = Field(..., ge=1, le=3, description="Tier level achieved")
    achieved_at: Optional[datetime] = Field(None, description="Achievement timestamp")
    qualifying_bounties: int = Field(0, description="Qualifying bounty count")
    average_score_at_achievement: float = Field(
        0.0, description="Average score at achievement time"
    )


class ReviewScoreDataPoint(BaseModel):
    """A single data point for review score trend charts.

    Attributes:
        date: Date of the review.
        score: Review score received (0-10).
        bounty_title: Title of the reviewed bounty.
        bounty_tier: Tier of the reviewed bounty.
    """

    date: str = Field(..., description="Date string (YYYY-MM-DD)")
    score: float = Field(..., description="Review score (0-10)")
    bounty_title: str = Field("", description="Reviewed bounty title")
    bounty_tier: int = Field(1, description="Reviewed bounty tier")


class ContributorProfileAnalytics(BaseModel):
    """Full analytics profile for a single contributor.

    Combines basic profile info with detailed history, tier progression,
    review score trends, and badge information.

    Attributes:
        username: GitHub username.
        display_name: Human-readable display name.
        avatar_url: Avatar image URL.
        bio: Contributor bio text.
        wallet_address: Linked Solana wallet address.
        tier: Current tier level.
        total_earned: Total $FNDRY earned.
        bounties_completed: Total bounties completed.
        quality_score: Average review score.
        reputation_score: Total reputation points.
        on_chain_verified: On-chain verification status.
        top_skills: Top skill tags.
        badges: Earned badge identifiers.
        completion_history: List of bounty completion records.
        tier_progression: Tier achievement history.
        review_score_trend: Review score data points for charting.
        joined_at: Account creation timestamp.
        last_active_at: Last activity timestamp.
        streak_days: Current consecutive active days.
        completions_by_tier: Bounties completed per tier.
        completions_by_category: Bounties completed per category.
    """

    username: str = Field(..., description="GitHub username")
    display_name: str = Field("", description="Display name")
    avatar_url: Optional[str] = Field(None, description="Avatar URL")
    bio: Optional[str] = Field(None, description="Contributor bio")
    wallet_address: Optional[str] = Field(None, description="Solana wallet")
    tier: int = Field(1, ge=1, le=3, description="Current tier")
    total_earned: float = Field(0.0, description="Total $FNDRY earned")
    bounties_completed: int = Field(0, description="Total bounties completed")
    quality_score: float = Field(0.0, description="Average review score")
    reputation_score: float = Field(0.0, description="Reputation points")
    on_chain_verified: bool = Field(False, description="On-chain verified")
    top_skills: list[str] = Field(default_factory=list, description="Top skills")
    badges: list[str] = Field(default_factory=list, description="Earned badges")
    completion_history: list[BountyCompletionRecord] = Field(
        default_factory=list, description="Bounty completion history"
    )
    tier_progression: list[TierProgressionRecord] = Field(
        default_factory=list, description="Tier achievement history"
    )
    review_score_trend: list[ReviewScoreDataPoint] = Field(
        default_factory=list, description="Review score trend data"
    )
    joined_at: Optional[datetime] = Field(None, description="Join timestamp")
    last_active_at: Optional[datetime] = Field(None, description="Last activity")
    streak_days: int = Field(0, description="Active day streak")
    completions_by_tier: dict[str, int] = Field(
        default_factory=dict, description="Completions per tier"
    )
    completions_by_category: dict[str, int] = Field(
        default_factory=dict, description="Completions per category"
    )


# ---------------------------------------------------------------------------
# Bounty Analytics
# ---------------------------------------------------------------------------


class TierCompletionStats(BaseModel):
    """Bounty completion statistics for a single tier.

    Attributes:
        tier: Tier number (1, 2, or 3).
        total_bounties: Total bounties created in this tier.
        completed: Number completed.
        in_progress: Number currently in progress.
        open: Number currently open.
        completion_rate: Percentage of bounties completed (0-100).
        average_review_score: Mean review score for completed bounties.
        average_time_to_complete_hours: Mean hours to complete a bounty.
        total_reward_paid: Total $FNDRY paid out for this tier.
    """

    tier: int = Field(..., ge=1, le=3, description="Tier number")
    total_bounties: int = Field(0, description="Total bounties in tier")
    completed: int = Field(0, description="Completed count")
    in_progress: int = Field(0, description="In-progress count")
    open: int = Field(0, description="Open count")
    completion_rate: float = Field(0.0, description="Completion percentage")
    average_review_score: float = Field(0.0, description="Mean review score")
    average_time_to_complete_hours: float = Field(
        0.0, description="Mean hours to complete"
    )
    total_reward_paid: float = Field(0.0, description="Total $FNDRY paid")


class CategoryCompletionStats(BaseModel):
    """Bounty completion statistics for a single category.

    Attributes:
        category: Category name (backend, frontend, etc.).
        total_bounties: Total bounties in this category.
        completed: Number completed.
        completion_rate: Percentage completed (0-100).
        average_review_score: Mean review score.
        total_reward_paid: Total $FNDRY paid.
    """

    category: str = Field(..., description="Category name")
    total_bounties: int = Field(0, description="Total bounties")
    completed: int = Field(0, description="Completed count")
    completion_rate: float = Field(0.0, description="Completion percentage")
    average_review_score: float = Field(0.0, description="Mean review score")
    total_reward_paid: float = Field(0.0, description="Total $FNDRY paid")


class BountyAnalyticsResponse(BaseModel):
    """Aggregated bounty analytics across all tiers and categories.

    Attributes:
        by_tier: Completion stats grouped by tier.
        by_category: Completion stats grouped by category.
        overall_completion_rate: Platform-wide completion percentage.
        overall_average_review_score: Platform-wide mean review score.
        total_bounties: Total bounties on the platform.
        total_completed: Total completed bounties.
        total_reward_paid: Total $FNDRY paid across all bounties.
    """

    by_tier: list[TierCompletionStats] = Field(
        default_factory=list, description="Stats per tier"
    )
    by_category: list[CategoryCompletionStats] = Field(
        default_factory=list, description="Stats per category"
    )
    overall_completion_rate: float = Field(0.0, description="Overall completion %")
    overall_average_review_score: float = Field(0.0, description="Overall avg score")
    total_bounties: int = Field(0, description="Total bounties")
    total_completed: int = Field(0, description="Total completed")
    total_reward_paid: float = Field(0.0, description="Total $FNDRY paid")


# ---------------------------------------------------------------------------
# Platform Health Metrics
# ---------------------------------------------------------------------------


class GrowthDataPoint(BaseModel):
    """A single data point for growth trend charts.

    Attributes:
        date: Date string (YYYY-MM-DD).
        bounties_created: Bounties created on this date.
        bounties_completed: Bounties completed on this date.
        new_contributors: New contributors registered on this date.
        fndry_paid: $FNDRY paid out on this date.
    """

    date: str = Field(..., description="Date (YYYY-MM-DD)")
    bounties_created: int = Field(0, description="Bounties created")
    bounties_completed: int = Field(0, description="Bounties completed")
    new_contributors: int = Field(0, description="New contributors")
    fndry_paid: float = Field(0.0, description="$FNDRY paid out")


class PlatformHealthResponse(BaseModel):
    """Platform health metrics and growth data.

    Provides aggregate counts, financial summaries, and time-series
    growth data for dashboard visualizations.

    Attributes:
        total_contributors: Total registered contributors.
        active_contributors: Contributors active in the last 30 days.
        total_bounties: Total bounties created.
        open_bounties: Currently open bounties.
        in_progress_bounties: Currently in-progress bounties.
        completed_bounties: Total completed bounties.
        total_fndry_paid: Total $FNDRY tokens paid out.
        total_prs_reviewed: Total pull requests reviewed.
        average_review_score: Platform-wide average review score.
        bounties_by_status: Count of bounties in each status.
        growth_trend: Daily growth data points for charts.
        top_categories: Most popular bounty categories.
    """

    total_contributors: int = Field(0, description="Total contributors")
    active_contributors: int = Field(0, description="Active in last 30 days")
    total_bounties: int = Field(0, description="Total bounties")
    open_bounties: int = Field(0, description="Open bounties")
    in_progress_bounties: int = Field(0, description="In-progress bounties")
    completed_bounties: int = Field(0, description="Completed bounties")
    total_fndry_paid: float = Field(0.0, description="Total $FNDRY paid")
    total_prs_reviewed: int = Field(0, description="Total PRs reviewed")
    average_review_score: float = Field(0.0, description="Average review score")
    bounties_by_status: dict[str, int] = Field(
        default_factory=dict, description="Bounties grouped by status"
    )
    growth_trend: list[GrowthDataPoint] = Field(
        default_factory=list, description="Daily growth data"
    )
    top_categories: list[CategoryCompletionStats] = Field(
        default_factory=list, description="Top bounty categories"
    )
