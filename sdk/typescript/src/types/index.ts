/**
 * SolFoundry TypeScript SDK - Type Definitions
 * Auto-generated from backend Pydantic models
 * Covers: bounties, submissions, contributors, notifications, leaderboard, payouts
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum BountyTier {
  T1 = 1,
  T2 = 2,
  T3 = 3,
}

export enum BountyStatus {
  OPEN = "open",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  PAID = "paid",
}

// ---------------------------------------------------------------------------
// Bounty Types
// ---------------------------------------------------------------------------

export interface SubmissionRecord {
  id: string;
  bounty_id: string;
  pr_url: string;
  submitted_by: string;
  notes?: string;
  submitted_at: string; // ISO 8601
}

export interface SubmissionCreate {
  pr_url: string;
  submitted_by: string;
  notes?: string;
}

export interface BountyCreate {
  title: string;
  description: string;
  tier: BountyTier;
  reward: number;
  skills?: string[];
  external_url?: string;
  deadline?: string; // ISO 8601
}

export interface BountyUpdate {
  title?: string;
  description?: string;
  status?: BountyStatus;
  reward?: number;
  skills?: string[];
  deadline?: string;
}

export interface BountyResponse {
  id: string;
  title: string;
  description: string;
  tier: BountyTier;
  status: BountyStatus;
  reward: number;
  skills: string[];
  external_url?: string;
  deadline?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface BountyListResponse {
  items: BountyResponse[];
  total: number;
  skip: number;
  limit: number;
}

export interface SubmissionResponse {
  id: string;
  bounty_id: string;
  pr_url: string;
  submitted_by: string;
  notes?: string;
  submitted_at: string;
}

// ---------------------------------------------------------------------------
// Contributor Types
// ---------------------------------------------------------------------------

export interface ContributorResponse {
  id: string;
  github_username: string;
  xp: number;
  level: number;
  bounties_completed: number;
  total_earned: number;
  joined_at: string;
}

// ---------------------------------------------------------------------------
// Leaderboard Types
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  rank: number;
  contributor: ContributorResponse;
  period: string; // e.g. "weekly", "monthly", "all_time"
}

// ---------------------------------------------------------------------------
// Notification Types
// ---------------------------------------------------------------------------

export interface NotificationResponse {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Payout Types
// ---------------------------------------------------------------------------

export interface PayoutResponse {
  id: string;
  bounty_id: string;
  contributor_id: string;
  amount: number;
  token: string;
  tx_hash?: string;
  status: "pending" | "completed" | "failed";
  created_at: string;
}

// ---------------------------------------------------------------------------
// Auth Types
// ---------------------------------------------------------------------------

export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserResponse {
  id: string;
  github_username: string;
  email?: string;
  xp: number;
  level: number;
}

// ---------------------------------------------------------------------------
// Filter Types
// ---------------------------------------------------------------------------

export interface BountyFilters {
  status?: BountyStatus;
  tier?: BountyTier;
  skills?: string[];
  skip?: number;
  limit?: number;
}
