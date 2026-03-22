/**
 * useAnalytics - React Query hooks for the Contributor Analytics API.
 *
 * Provides four hooks matching the four analytics endpoint groups:
 * 1. useLeaderboardAnalytics — Ranked contributors with filtering
 * 2. useContributorAnalytics — Detailed contributor profiles
 * 3. useBountyAnalytics — Completion stats by tier/category
 * 4. usePlatformHealth — Platform metrics and growth trends
 *
 * All hooks use React Query for caching, deduplication, and
 * automatic background refetching. Data is transformed from
 * snake_case backend responses to camelCase TypeScript interfaces.
 * @module hooks/useAnalytics
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import type {
  AnalyticsTimeRange,
  BountyAnalyticsResponse,
  ContributorProfileAnalytics,
  LeaderboardAnalyticsResponse,
  LeaderboardRankingEntry,
  LeaderboardSortField,
  PlatformHealthResponse,
  SortOrder,
} from '../types/analytics';

// ---------------------------------------------------------------------------
// Response transformers (snake_case -> camelCase)
// ---------------------------------------------------------------------------

/**
 * Transform a leaderboard entry from backend snake_case to frontend camelCase.
 *
 * @param raw - Raw backend response object with snake_case keys.
 * @returns Transformed LeaderboardRankingEntry with camelCase keys.
 */
function transformLeaderboardEntry(raw: Record<string, unknown>): LeaderboardRankingEntry {
  return {
    rank: (raw.rank as number) ?? 0,
    username: (raw.username as string) ?? '',
    displayName: (raw.display_name as string) ?? (raw.username as string) ?? '',
    avatarUrl: (raw.avatar_url as string) ?? null,
    tier: (raw.tier as number) ?? 1,
    totalEarned: (raw.total_earned as number) ?? 0,
    bountiesCompleted: (raw.bounties_completed as number) ?? 0,
    qualityScore: (raw.quality_score as number) ?? 0,
    reputationScore: (raw.reputation_score as number) ?? 0,
    onChainVerified: (raw.on_chain_verified as boolean) ?? false,
    walletAddress: (raw.wallet_address as string) ?? null,
    topSkills: (raw.top_skills as string[]) ?? [],
    streakDays: (raw.streak_days as number) ?? 0,
  };
}

/**
 * Transform the full leaderboard response from backend to frontend format.
 *
 * @param raw - Raw backend response object.
 * @returns Transformed LeaderboardAnalyticsResponse.
 */
function transformLeaderboardResponse(raw: Record<string, unknown>): LeaderboardAnalyticsResponse {
  const entries = Array.isArray(raw.entries)
    ? raw.entries.map((entry: Record<string, unknown>) => transformLeaderboardEntry(entry))
    : [];

  return {
    entries,
    total: (raw.total as number) ?? 0,
    page: (raw.page as number) ?? 1,
    perPage: (raw.per_page as number) ?? 20,
    sortBy: (raw.sort_by as string) ?? 'total_earned',
    sortOrder: (raw.sort_order as string) ?? 'desc',
    filtersApplied: (raw.filters_applied as Record<string, string | number>) ?? {},
  };
}

/**
 * Transform a contributor profile response from backend to frontend format.
 *
 * @param raw - Raw backend response object.
 * @returns Transformed ContributorProfileAnalytics.
 */
function transformContributorProfile(raw: Record<string, unknown>): ContributorProfileAnalytics {
  const completionHistory = Array.isArray(raw.completion_history)
    ? raw.completion_history.map((record: Record<string, unknown>) => ({
        bountyId: (record.bounty_id as string) ?? '',
        bountyTitle: (record.bounty_title as string) ?? '',
        tier: (record.tier as number) ?? 1,
        category: (record.category as string) ?? null,
        rewardAmount: (record.reward_amount as number) ?? 0,
        reviewScore: (record.review_score as number) ?? 0,
        completedAt: (record.completed_at as string) ?? null,
        timeToCompleteHours: (record.time_to_complete_hours as number) ?? null,
        onChainTxHash: (record.on_chain_tx_hash as string) ?? null,
      }))
    : [];

  const tierProgression = Array.isArray(raw.tier_progression)
    ? raw.tier_progression.map((record: Record<string, unknown>) => ({
        tier: (record.tier as number) ?? 1,
        achievedAt: (record.achieved_at as string) ?? null,
        qualifyingBounties: (record.qualifying_bounties as number) ?? 0,
        averageScoreAtAchievement: (record.average_score_at_achievement as number) ?? 0,
      }))
    : [];

  const reviewScoreTrend = Array.isArray(raw.review_score_trend)
    ? raw.review_score_trend.map((point: Record<string, unknown>) => ({
        date: (point.date as string) ?? '',
        score: (point.score as number) ?? 0,
        bountyTitle: (point.bounty_title as string) ?? '',
        bountyTier: (point.bounty_tier as number) ?? 1,
      }))
    : [];

  return {
    username: (raw.username as string) ?? '',
    displayName: (raw.display_name as string) ?? '',
    avatarUrl: (raw.avatar_url as string) ?? null,
    bio: (raw.bio as string) ?? null,
    walletAddress: (raw.wallet_address as string) ?? null,
    tier: (raw.tier as number) ?? 1,
    totalEarned: (raw.total_earned as number) ?? 0,
    bountiesCompleted: (raw.bounties_completed as number) ?? 0,
    qualityScore: (raw.quality_score as number) ?? 0,
    reputationScore: (raw.reputation_score as number) ?? 0,
    onChainVerified: (raw.on_chain_verified as boolean) ?? false,
    topSkills: (raw.top_skills as string[]) ?? [],
    badges: (raw.badges as string[]) ?? [],
    completionHistory,
    tierProgression,
    reviewScoreTrend,
    joinedAt: (raw.joined_at as string) ?? null,
    lastActiveAt: (raw.last_active_at as string) ?? null,
    streakDays: (raw.streak_days as number) ?? 0,
    completionsByTier: (raw.completions_by_tier as Record<string, number>) ?? {},
    completionsByCategory: (raw.completions_by_category as Record<string, number>) ?? {},
  };
}

/**
 * Transform bounty analytics response from backend to frontend format.
 *
 * @param raw - Raw backend response object.
 * @returns Transformed BountyAnalyticsResponse.
 */
function transformBountyAnalytics(raw: Record<string, unknown>): BountyAnalyticsResponse {
  const byTier = Array.isArray(raw.by_tier)
    ? raw.by_tier.map((tier: Record<string, unknown>) => ({
        tier: (tier.tier as number) ?? 1,
        totalBounties: (tier.total_bounties as number) ?? 0,
        completed: (tier.completed as number) ?? 0,
        inProgress: (tier.in_progress as number) ?? 0,
        open: (tier.open as number) ?? 0,
        completionRate: (tier.completion_rate as number) ?? 0,
        averageReviewScore: (tier.average_review_score as number) ?? 0,
        averageTimeToCompleteHours: (tier.average_time_to_complete_hours as number) ?? 0,
        totalRewardPaid: (tier.total_reward_paid as number) ?? 0,
      }))
    : [];

  const byCategory = Array.isArray(raw.by_category)
    ? raw.by_category.map((cat: Record<string, unknown>) => ({
        category: (cat.category as string) ?? '',
        totalBounties: (cat.total_bounties as number) ?? 0,
        completed: (cat.completed as number) ?? 0,
        completionRate: (cat.completion_rate as number) ?? 0,
        averageReviewScore: (cat.average_review_score as number) ?? 0,
        totalRewardPaid: (cat.total_reward_paid as number) ?? 0,
      }))
    : [];

  return {
    byTier,
    byCategory,
    overallCompletionRate: (raw.overall_completion_rate as number) ?? 0,
    overallAverageReviewScore: (raw.overall_average_review_score as number) ?? 0,
    totalBounties: (raw.total_bounties as number) ?? 0,
    totalCompleted: (raw.total_completed as number) ?? 0,
    totalRewardPaid: (raw.total_reward_paid as number) ?? 0,
  };
}

/**
 * Transform platform health response from backend to frontend format.
 *
 * @param raw - Raw backend response object.
 * @returns Transformed PlatformHealthResponse.
 */
function transformPlatformHealth(raw: Record<string, unknown>): PlatformHealthResponse {
  const growthTrend = Array.isArray(raw.growth_trend)
    ? raw.growth_trend.map((point: Record<string, unknown>) => ({
        date: (point.date as string) ?? '',
        bountiesCreated: (point.bounties_created as number) ?? 0,
        bountiesCompleted: (point.bounties_completed as number) ?? 0,
        newContributors: (point.new_contributors as number) ?? 0,
        fndryPaid: (point.fndry_paid as number) ?? 0,
      }))
    : [];

  const topCategories = Array.isArray(raw.top_categories)
    ? raw.top_categories.map((cat: Record<string, unknown>) => ({
        category: (cat.category as string) ?? '',
        totalBounties: (cat.total_bounties as number) ?? 0,
        completed: (cat.completed as number) ?? 0,
        completionRate: (cat.completion_rate as number) ?? 0,
        averageReviewScore: (cat.average_review_score as number) ?? 0,
        totalRewardPaid: (cat.total_reward_paid as number) ?? 0,
      }))
    : [];

  return {
    totalContributors: (raw.total_contributors as number) ?? 0,
    activeContributors: (raw.active_contributors as number) ?? 0,
    totalBounties: (raw.total_bounties as number) ?? 0,
    openBounties: (raw.open_bounties as number) ?? 0,
    inProgressBounties: (raw.in_progress_bounties as number) ?? 0,
    completedBounties: (raw.completed_bounties as number) ?? 0,
    totalFndryPaid: (raw.total_fndry_paid as number) ?? 0,
    totalPrsReviewed: (raw.total_prs_reviewed as number) ?? 0,
    averageReviewScore: (raw.average_review_score as number) ?? 0,
    bountiesByStatus: (raw.bounties_by_status as Record<string, number>) ?? {},
    growthTrend,
    topCategories,
  };
}

// ---------------------------------------------------------------------------
// React Query Hooks
// ---------------------------------------------------------------------------

/** Parameters for the leaderboard analytics query. */
export interface LeaderboardAnalyticsParams {
  page?: number;
  perPage?: number;
  sortBy?: LeaderboardSortField;
  sortOrder?: SortOrder;
  tier?: number;
  category?: string;
  search?: string;
  timeRange?: AnalyticsTimeRange;
}

/**
 * Hook for fetching analytics leaderboard data.
 *
 * Queries GET /api/analytics/leaderboard with optional filtering,
 * sorting, and pagination. Returns transformed camelCase data.
 *
 * @param params - Query parameters for filtering and pagination.
 * @returns React Query result with LeaderboardAnalyticsResponse data.
 */
export function useLeaderboardAnalytics(params: LeaderboardAnalyticsParams = {}) {
  const {
    page = 1,
    perPage = 20,
    sortBy = 'total_earned',
    sortOrder = 'desc',
    tier,
    category,
    search,
    timeRange = 'all',
  } = params;

  return useQuery({
    queryKey: ['analytics', 'leaderboard', page, perPage, sortBy, sortOrder, tier, category, search, timeRange],
    queryFn: async (): Promise<LeaderboardAnalyticsResponse> => {
      const queryParams: Record<string, string | number | boolean | undefined> = {
        page,
        per_page: perPage,
        sort_by: sortBy,
        sort_order: sortOrder,
        tier,
        category,
        search: search || undefined,
        time_range: timeRange,
      };
      const raw = await apiClient<Record<string, unknown>>('/api/analytics/leaderboard', {
        params: queryParams,
        retries: 1,
      });
      return transformLeaderboardResponse(raw);
    },
    staleTime: 60_000,
  });
}

/**
 * Hook for fetching detailed contributor profile analytics.
 *
 * Queries GET /api/analytics/contributors/{username} and returns
 * transformed profile data with completion history and trends.
 *
 * @param username - GitHub username of the contributor.
 * @returns React Query result with ContributorProfileAnalytics data.
 */
export function useContributorAnalytics(username: string | undefined) {
  return useQuery({
    queryKey: ['analytics', 'contributor', username],
    queryFn: async (): Promise<ContributorProfileAnalytics> => {
      const raw = await apiClient<Record<string, unknown>>(
        `/api/analytics/contributors/${encodeURIComponent(username!)}`,
        { retries: 1 },
      );
      return transformContributorProfile(raw);
    },
    enabled: Boolean(username),
    staleTime: 60_000,
  });
}

/**
 * Hook for fetching bounty completion analytics.
 *
 * Queries GET /api/analytics/bounties with optional time range
 * and returns completion stats grouped by tier and category.
 *
 * @param timeRange - Optional time range filter.
 * @returns React Query result with BountyAnalyticsResponse data.
 */
export function useBountyAnalytics(timeRange: AnalyticsTimeRange = 'all') {
  return useQuery({
    queryKey: ['analytics', 'bounties', timeRange],
    queryFn: async (): Promise<BountyAnalyticsResponse> => {
      const raw = await apiClient<Record<string, unknown>>('/api/analytics/bounties', {
        params: { time_range: timeRange },
        retries: 1,
      });
      return transformBountyAnalytics(raw);
    },
    staleTime: 60_000,
  });
}

/**
 * Hook for fetching platform health metrics.
 *
 * Queries GET /api/analytics/platform with optional time range
 * and returns aggregate metrics with growth trend data.
 *
 * @param timeRange - Optional time range for growth trend.
 * @returns React Query result with PlatformHealthResponse data.
 */
export function usePlatformHealth(timeRange: AnalyticsTimeRange = 'all') {
  return useQuery({
    queryKey: ['analytics', 'platform', timeRange],
    queryFn: async (): Promise<PlatformHealthResponse> => {
      const raw = await apiClient<Record<string, unknown>>('/api/analytics/platform', {
        params: { time_range: timeRange },
        retries: 1,
      });
      return transformPlatformHealth(raw);
    },
    staleTime: 60_000,
  });
}
