/**
 * Analytics domain types for the Contributor Analytics Platform.
 *
 * Defines TypeScript interfaces matching the backend analytics API
 * response schemas. Used by hooks, components, and tests.
 * @module types/analytics
 */

/** Time range filter for analytics queries. */
export type AnalyticsTimeRange = '7d' | '30d' | '90d' | 'all';

/** Valid sort fields for the leaderboard analytics endpoint. */
export type LeaderboardSortField =
  | 'total_earned'
  | 'bounties_completed'
  | 'quality_score'
  | 'reputation_score';

/** Sort direction for analytics queries. */
export type SortOrder = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Leaderboard Analytics
// ---------------------------------------------------------------------------

/** A single contributor entry in the analytics leaderboard. */
export interface LeaderboardRankingEntry {
  rank: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  tier: number;
  totalEarned: number;
  bountiesCompleted: number;
  qualityScore: number;
  reputationScore: number;
  onChainVerified: boolean;
  walletAddress: string | null;
  topSkills: string[];
  streakDays: number;
}

/** Paginated leaderboard analytics response from the backend. */
export interface LeaderboardAnalyticsResponse {
  entries: LeaderboardRankingEntry[];
  total: number;
  page: number;
  perPage: number;
  sortBy: string;
  sortOrder: string;
  filtersApplied: Record<string, string | number>;
}

// ---------------------------------------------------------------------------
// Contributor Profile Analytics
// ---------------------------------------------------------------------------

/** A single bounty completion record in a contributor's history. */
export interface BountyCompletionRecord {
  bountyId: string;
  bountyTitle: string;
  tier: number;
  category: string | null;
  rewardAmount: number;
  reviewScore: number;
  completedAt: string | null;
  timeToCompleteHours: number | null;
  onChainTxHash: string | null;
}

/** Tier progression milestone for a contributor. */
export interface TierProgressionRecord {
  tier: number;
  achievedAt: string | null;
  qualifyingBounties: number;
  averageScoreAtAchievement: number;
}

/** Data point for review score trend line chart. */
export interface ReviewScoreDataPoint {
  date: string;
  score: number;
  bountyTitle: string;
  bountyTier: number;
}

/** Full analytics profile for a single contributor. */
export interface ContributorProfileAnalytics {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  walletAddress: string | null;
  tier: number;
  totalEarned: number;
  bountiesCompleted: number;
  qualityScore: number;
  reputationScore: number;
  onChainVerified: boolean;
  topSkills: string[];
  badges: string[];
  completionHistory: BountyCompletionRecord[];
  tierProgression: TierProgressionRecord[];
  reviewScoreTrend: ReviewScoreDataPoint[];
  joinedAt: string | null;
  lastActiveAt: string | null;
  streakDays: number;
  completionsByTier: Record<string, number>;
  completionsByCategory: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Bounty Analytics
// ---------------------------------------------------------------------------

/** Bounty completion statistics for a single tier. */
export interface TierCompletionStats {
  tier: number;
  totalBounties: number;
  completed: number;
  inProgress: number;
  open: number;
  completionRate: number;
  averageReviewScore: number;
  averageTimeToCompleteHours: number;
  totalRewardPaid: number;
}

/** Bounty completion statistics for a single category. */
export interface CategoryCompletionStats {
  category: string;
  totalBounties: number;
  completed: number;
  completionRate: number;
  averageReviewScore: number;
  totalRewardPaid: number;
}

/** Aggregated bounty analytics response. */
export interface BountyAnalyticsResponse {
  byTier: TierCompletionStats[];
  byCategory: CategoryCompletionStats[];
  overallCompletionRate: number;
  overallAverageReviewScore: number;
  totalBounties: number;
  totalCompleted: number;
  totalRewardPaid: number;
}

// ---------------------------------------------------------------------------
// Platform Health
// ---------------------------------------------------------------------------

/** Daily growth data point for trend charts. */
export interface GrowthDataPoint {
  date: string;
  bountiesCreated: number;
  bountiesCompleted: number;
  newContributors: number;
  fndryPaid: number;
}

/** Platform health metrics response. */
export interface PlatformHealthResponse {
  totalContributors: number;
  activeContributors: number;
  totalBounties: number;
  openBounties: number;
  inProgressBounties: number;
  completedBounties: number;
  totalFndryPaid: number;
  totalPrsReviewed: number;
  averageReviewScore: number;
  bountiesByStatus: Record<string, number>;
  growthTrend: GrowthDataPoint[];
  topCategories: CategoryCompletionStats[];
}
