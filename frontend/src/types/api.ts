/**
 * Shared API response and request models for the SolFoundry frontend.
 * Standardizes contracts between React Query hooks and the FastAPI backend.
 */

export type BountyStatus = 'doc' | 'draft' | 'open' | 'claimed' | 'in_progress' | 'under_review' | 'disputed' | 'completed' | 'paid' | 'cancelled';
export type BountyTier = 1 | 2 | 3;

export interface Bounty {
  id: string;
  title: string;
  description: string;
  status: BountyStatus;
  reward_amount: number;
  reward_token: string;
  tier: BountyTier;
  created_by: string;
  created_at: string;
  updated_at: string;
  deadline?: string;
  skills?: string[];
  category?: string;
  github_issue_url?: string;
  submissions_count?: number;
  progress?: number; // Calculated on frontend or returned by some endpoints
}

export interface BountyListResponse {
  items: Bounty[];
  total: number;
  skip: number;
  limit: number;
}

export interface ContributorStats {
  total_contributions: number;
  total_bounties_completed: number;
  total_earnings: number;
  reputation_score: number;
}

export interface BadgeStats {
  merged_pr_count: number;
  merged_without_revision_count: number;
  is_top_contributor_this_month: boolean;
  pr_submission_timestamps_utc: string[];
}

export interface Contributor {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  stats: ContributorStats;
  badge_stats?: BadgeStats;
  skills: string[];
  github_id?: string;
  wallet_address?: string;
  tier?: number;
  rank?: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  avatarUrl: string;
  points: number;
  bountiesCompleted: number;
  earningsFndry: number;
  earningsSol: number;
  streak: number;
  topSkills: string[];
}

export interface ContributorListResponse {
  items: Contributor[];
  total: number;
  skip: number;
  limit: number;
}

export interface DashboardStats {
  totalEarned: number;
  activeBounties: number;
  pendingPayouts: number;
  reputationRank: number;
  totalContributors: number;
}

export interface DashboardActivity {
  id: string;
  type: 'bounty_claimed' | 'pr_submitted' | 'review_received' | 'payout' | 'bounty_completed';
  title: string;
  description: string;
  timestamp: string;
  amount?: number;
}

export interface DashboardNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface DashboardEarning {
  date: string;
  amount: number;
}

export interface DashboardLinkedAccount {
  type: 'github' | 'twitter' | 'discord' | 'google' | 'solana';
  username?: string;
  connected: boolean;
}

export interface DashboardData {
  stats: DashboardStats;
  bounties: Bounty[];
  activities: DashboardActivity[];
  notifications: DashboardNotification[];
  earnings: DashboardEarning[];
  linkedAccounts: DashboardLinkedAccount[];
}

export interface CreatorStats {
  staked: number;
  paid: number;
  refunded: number;
}

export interface CreatorDashboardData {
  bounties: Bounty[];
  stats: CreatorStats;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  availability: 'available' | 'working' | 'offline';
  success_rate: number;
  description: string;
  capabilities: string[];
  avatar: string;
  joined_at: string;
  bio: string;
  skills: string[];
  languages: string[];
  bounties_completed: number;
  total_earned: number;
  avg_score: number;
  operator_wallet?: string;
}

export interface AgentListResponse {
  items: Agent[];
  total: number;
  page: number;
  limit: number;
}

export interface TokenomicsData {
  tokenName: string;
  tokenCA: string;
  totalSupply: number;
  circulatingSupply: number;
  treasuryHoldings: number;
  totalDistributed: number;
  totalBuybacks: number;
  totalBurned: number;
  feeRevenueSol: number;
  distributionBreakdown: Record<string, number>;
  lastUpdated: string;
}

export interface TreasuryStats {
  solBalance: number;
  fndryBalance: number;
  totalPayouts: number;
  treasuryWallet: string;
}
