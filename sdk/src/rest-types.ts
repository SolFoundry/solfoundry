/**
 * REST API specific types for SolFoundry marketplace endpoints.
 *
 * These interfaces mirror the web app API contracts used by `/api/bounties`,
 * `/api/bounties/:id/submissions`, and `/api/users` routes.
 *
 * @module rest-types
 */

/** Bounty status values returned by marketplace endpoints. */
export type MarketplaceBountyStatus = 'open' | 'in_review' | 'completed' | 'cancelled' | 'funded';

/** Bounty tier values used by marketplace endpoints. */
export type MarketplaceBountyTier = 'T1' | 'T2' | 'T3';

/** Reward token values for bounty payouts. */
export type RewardToken = 'USDC' | 'FNDRY';

/** Submission lifecycle status in marketplace endpoints. */
export type MarketplaceSubmissionStatus = 'pending' | 'in_review' | 'approved' | 'rejected';

/** User role values returned by the users API. */
export type UserRole = 'admin' | 'maintainer' | 'contributor' | 'user';

/** Bounty object returned by `/api/bounties`. */
export interface MarketplaceBounty {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: MarketplaceBountyStatus;
  readonly tier: MarketplaceBountyTier;
  readonly reward_amount: number;
  readonly reward_token: RewardToken;
  readonly github_issue_url?: string | null;
  readonly github_repo_url?: string | null;
  readonly org_name?: string | null;
  readonly repo_name?: string | null;
  readonly org_avatar_url?: string | null;
  readonly issue_number?: number | null;
  readonly category?: string | null;
  readonly skills: string[];
  readonly deadline?: string | null;
  readonly submission_count: number;
  readonly created_at: string;
  readonly creator_id?: string | null;
  readonly creator_username?: string | null;
  readonly has_repo?: boolean;
}

/** Payload for creating a marketplace bounty. */
export interface MarketplaceBountyCreate {
  readonly title: string;
  readonly description: string;
  readonly reward_amount: number;
  readonly reward_token: RewardToken;
  readonly deadline?: string | null;
  readonly github_repo_url?: string | null;
  readonly github_issue_url?: string | null;
  readonly tier?: MarketplaceBountyTier | null;
  readonly skills?: string[];
}

/** Query params for listing marketplace bounties. */
export interface MarketplaceBountiesListParams {
  readonly status?: MarketplaceBountyStatus;
  readonly limit?: number;
  readonly offset?: number;
  readonly skill?: string;
  readonly tier?: MarketplaceBountyTier;
  readonly reward_token?: RewardToken;
}

/** Paginated response from `/api/bounties`. */
export interface MarketplaceBountiesListResponse {
  readonly items: MarketplaceBounty[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/** Submission object returned by submission endpoints. */
export interface MarketplaceSubmission {
  readonly id: string;
  readonly bounty_id: string;
  readonly contributor_id: string;
  readonly contributor_username?: string | null;
  readonly contributor_avatar?: string | null;
  readonly repo_url?: string | null;
  readonly pr_url?: string | null;
  readonly description?: string | null;
  readonly status: MarketplaceSubmissionStatus;
  readonly review_score?: number | null;
  readonly earned?: number | null;
  readonly created_at: string;
}

/** Payload for creating a submission on `/api/bounties/:id/submissions`. */
export interface MarketplaceSubmissionCreate {
  readonly repo_url?: string;
  readonly pr_url?: string;
  readonly description?: string;
  readonly tx_signature?: string;
}

/** User object returned by `/api/users` endpoints. */
export interface UserProfile {
  readonly id: string;
  readonly username: string;
  readonly wallet_address?: string | null;
  readonly avatar_url?: string | null;
  readonly role?: UserRole;
  readonly created_at?: string;
  readonly updated_at?: string;
}

/** Payload for updating the authenticated user profile. */
export interface UserProfileUpdate {
  readonly username?: string;
  readonly wallet_address?: string | null;
  readonly avatar_url?: string | null;
}
