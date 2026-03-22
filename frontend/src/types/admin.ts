/** TypeScript types for the admin dashboard. */

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export interface AdminOverview {
  total_bounties: number;
  open_bounties: number;
  completed_bounties: number;
  cancelled_bounties: number;
  total_contributors: number;
  active_contributors: number;
  banned_contributors: number;
  total_fndry_paid: number;
  total_submissions: number;
  pending_reviews: number;
  uptime_seconds: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Bounties
// ---------------------------------------------------------------------------

export interface BountyAdminItem {
  id: string;
  title: string;
  status: string;
  tier: number | string;
  reward_amount: number;
  created_by: string;
  deadline: string;
  submission_count: number;
  created_at: string;
}

export interface BountyListAdminResponse {
  items: BountyAdminItem[];
  total: number;
  page: number;
  per_page: number;
}

export interface BountyAdminUpdate {
  status?: string;
  reward_amount?: number;
  title?: string;
}

// ---------------------------------------------------------------------------
// Contributors
// ---------------------------------------------------------------------------

export interface ContributorAdminItem {
  id: string;
  username: string;
  display_name: string;
  tier: string;
  reputation_score: number;
  quality_score: number;
  total_bounties_completed: number;
  total_earnings: number;
  is_banned: boolean;
  skills: string[];
  created_at: string;
}

export interface TierHistoryItem {
  tier: string;
  reputation_score: number;
  bounty_id: string | null;
  bounty_title: string | null;
  earned_reputation: number;
  created_at: string;
}

export interface TierHistoryResponse {
  contributor_id: string;
  items: TierHistoryItem[];
  total: number;
}

export interface ContributorListAdminResponse {
  items: ContributorAdminItem[];
  total: number;
  page: number;
  per_page: number;
}

// ---------------------------------------------------------------------------
// Review pipeline
// ---------------------------------------------------------------------------

export interface ReviewPipelineItem {
  bounty_id: string;
  bounty_title: string;
  submission_id: string;
  pr_url: string;
  submitted_by: string;
  ai_score: number;
  review_complete: boolean;
  meets_threshold: boolean;
  submitted_at: string;
}

export interface ReviewPipelineResponse {
  active: ReviewPipelineItem[];
  total_active: number;
  pass_rate: number;
  avg_score: number;
}

// ---------------------------------------------------------------------------
// Financial
// ---------------------------------------------------------------------------

export interface FinancialOverview {
  total_fndry_distributed: number;
  total_paid_bounties: number;
  pending_payout_count: number;
  pending_payout_amount: number;
  avg_reward: number;
  highest_reward: number;
}

export interface PayoutHistoryItem {
  bounty_id: string;
  bounty_title: string;
  winner: string;
  amount: number;
  status: string;
  completed_at: string | null;
}

export interface PayoutHistoryResponse {
  items: PayoutHistoryItem[];
  total: number;
}

// ---------------------------------------------------------------------------
// System health
// ---------------------------------------------------------------------------

export interface SystemHealthResponse {
  status: 'healthy' | 'degraded';
  uptime_seconds: number;
  bot_uptime_seconds: number;
  timestamp: string;
  services: Record<string, string>;
  queue_depth: number;
  webhook_events_processed: number;
  github_webhook_status: string;
  active_websocket_connections: number;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  event: string;
  actor: string;
  role: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface BountyAdminCreate {
  title: string;
  description: string;
  tier: 1 | 2 | 3;
  reward_amount: number;
  deadline?: string;
  tags?: string[];
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export type AdminSection =
  | 'overview'
  | 'bounties'
  | 'contributors'
  | 'reviews'
  | 'financial'
  | 'health'
  | 'audit-log';
