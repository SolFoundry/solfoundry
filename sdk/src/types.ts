/**
 * Core type definitions for the SolFoundry SDK.
 *
 * All types mirror the backend Pydantic models exactly so API responses
 * deserialize into strongly-typed objects without manual mapping.
 *
 * @module types
 */

// ---------------------------------------------------------------------------
// Bounty enums
// ---------------------------------------------------------------------------

/** Bounty difficulty and reward tier. */
export enum BountyTier {
  T1 = 1,
  T2 = 2,
  T3 = 3,
}

/** Lifecycle status of a bounty. */
export enum BountyStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  UNDER_REVIEW = 'under_review',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

/** Lifecycle status of a solution submission. */
export enum SubmissionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DISPUTED = 'disputed',
  PAID = 'paid',
  REJECTED = 'rejected',
}

// ---------------------------------------------------------------------------
// Escrow enums
// ---------------------------------------------------------------------------

/** Lifecycle states for a custodial escrow. */
export enum EscrowState {
  PENDING = 'pending',
  FUNDED = 'funded',
  ACTIVE = 'active',
  RELEASING = 'releasing',
  COMPLETED = 'completed',
  REFUNDED = 'refunded',
}

/** Types of escrow ledger entries. */
export enum LedgerAction {
  DEPOSIT = 'deposit',
  RELEASE = 'release',
  REFUND = 'refund',
  STATE_CHANGE = 'state_change',
}

// ---------------------------------------------------------------------------
// Submission types
// ---------------------------------------------------------------------------

/** Payload for submitting a solution to a bounty. */
export interface SubmissionCreate {
  /** GitHub PR URL for the submission. */
  readonly pr_url: string;
  /** Identifier of the submitter (defaults to "system"). */
  readonly submitted_by?: string;
  /** Solana wallet address for payout (32-64 chars). */
  readonly contributor_wallet?: string;
  /** Optional notes about the submission (max 1000 chars). */
  readonly notes?: string;
}

/** API response for a single submission. */
export interface SubmissionResponse {
  /** Unique UUID identifier. */
  readonly id: string;
  /** UUID of the parent bounty. */
  readonly bounty_id: string;
  /** GitHub PR URL. */
  readonly pr_url: string;
  /** Who submitted this solution. */
  readonly submitted_by: string;
  /** Submitter's Solana wallet address. */
  readonly contributor_wallet: string | null;
  /** Submission notes. */
  readonly notes: string | null;
  /** Current submission lifecycle status. */
  readonly status: SubmissionStatus;
  /** Aggregated AI review score (0-10). */
  readonly ai_score: number;
  /** Individual scores by model name. */
  readonly ai_scores_by_model: Record<string, number>;
  /** Whether all AI reviews have completed. */
  readonly review_complete: boolean;
  /** Whether the score meets the tier threshold. */
  readonly meets_threshold: boolean;
  /** Whether eligible for automatic approval. */
  readonly auto_approve_eligible: boolean;
  /** ISO timestamp after which auto-approval triggers. */
  readonly auto_approve_after: string | null;
  /** Who approved this submission. */
  readonly approved_by: string | null;
  /** ISO timestamp of approval. */
  readonly approved_at: string | null;
  /** On-chain payout transaction hash. */
  readonly payout_tx_hash: string | null;
  /** Payout amount in $FNDRY. */
  readonly payout_amount: number | null;
  /** ISO timestamp of payout. */
  readonly payout_at: string | null;
  /** Whether this is the winning submission. */
  readonly winner: boolean;
  /** ISO timestamp of submission. */
  readonly submitted_at: string;
}

/** Request model for updating submission status. */
export interface SubmissionStatusUpdate {
  /** New status value. */
  readonly status: string;
}

// ---------------------------------------------------------------------------
// Bounty types
// ---------------------------------------------------------------------------

/** Payload for creating a new bounty. */
export interface BountyCreate {
  /** Clear, concise title (3-200 chars). */
  readonly title: string;
  /** Detailed requirements in Markdown (max 5000 chars). */
  readonly description?: string;
  /** Difficulty and reward tier. */
  readonly tier?: BountyTier;
  /** Broad category (e.g., "backend", "frontend"). */
  readonly category?: string;
  /** Reward amount in USD-equivalent $FNDRY tokens. */
  readonly reward_amount: number;
  /** List of required technical skills. */
  readonly required_skills?: string[];
  /** Direct link to the tracking GitHub issue. */
  readonly github_issue_url?: string;
  /** ISO 8601 deadline for the bounty. */
  readonly deadline?: string;
  /** Creator identifier. */
  readonly created_by?: string;
}

/** Payload for partially updating a bounty (PATCH semantics). */
export interface BountyUpdate {
  /** Updated title (3-200 chars). */
  readonly title?: string;
  /** Updated description (max 5000 chars). */
  readonly description?: string;
  /** New lifecycle status. */
  readonly status?: BountyStatus;
  /** Updated reward amount. */
  readonly reward_amount?: number;
  /** Updated required skills list. */
  readonly required_skills?: string[];
  /** Updated deadline (ISO 8601). */
  readonly deadline?: string;
}

/** Full details of a bounty for API responses. */
export interface BountyResponse {
  /** Unique UUID for the bounty. */
  readonly id: string;
  /** Bounty title. */
  readonly title: string;
  /** Detailed description in Markdown. */
  readonly description: string;
  /** Difficulty and reward tier. */
  readonly tier: BountyTier;
  /** Broad task category. */
  readonly category: string | null;
  /** Reward amount in $FNDRY tokens. */
  readonly reward_amount: number;
  /** Current lifecycle status. */
  readonly status: BountyStatus;
  /** "platform" for official bounties, "community" for user-created. */
  readonly creator_type: string;
  /** Direct link to the GitHub issue. */
  readonly github_issue_url: string | null;
  /** List of required technical skills. */
  readonly required_skills: string[];
  /** Optional deadline for the bounty. */
  readonly deadline: string | null;
  /** Creator identifier. */
  readonly created_by: string;
  /** ISO timestamp of creation. */
  readonly created_at: string;
  /** ISO timestamp of last update. */
  readonly updated_at: string;
  /** GitHub issue number (if linked). */
  readonly github_issue_number: number | null;
  /** Full repository name (org/repo). */
  readonly github_repo: string | null;
  /** ID of the winning submission. */
  readonly winner_submission_id: string | null;
  /** Wallet address of the winner. */
  readonly winner_wallet: string | null;
  /** On-chain payout transaction hash. */
  readonly payout_tx_hash: string | null;
  /** ISO timestamp of payout. */
  readonly payout_at: string | null;
  /** Who claimed this bounty (T2/T3). */
  readonly claimed_by: string | null;
  /** ISO timestamp of claim. */
  readonly claimed_at: string | null;
  /** Deadline for the claim to be completed. */
  readonly claim_deadline: string | null;
  /** All submissions for this bounty. */
  readonly submissions: SubmissionResponse[];
  /** Total number of submissions. */
  readonly submission_count: number;
}

/** Compact bounty representation for list endpoints. */
export interface BountyListItem {
  /** Unique UUID. */
  readonly id: string;
  /** Bounty title. */
  readonly title: string;
  /** Difficulty tier. */
  readonly tier: BountyTier;
  /** Reward amount. */
  readonly reward_amount: number;
  /** Current status. */
  readonly status: BountyStatus;
  /** Task category. */
  readonly category: string | null;
  /** Creator type. */
  readonly creator_type: string;
  /** Required skills. */
  readonly required_skills: string[];
  /** GitHub issue URL. */
  readonly github_issue_url: string | null;
  /** Bounty deadline. */
  readonly deadline: string | null;
  /** Creator identifier. */
  readonly created_by: string;
  /** All submissions. */
  readonly submissions: SubmissionResponse[];
  /** Total submission count. */
  readonly submission_count: number;
  /** ISO timestamp of creation. */
  readonly created_at: string;
}

/** Paginated list of bounties. */
export interface BountyListResponse {
  /** Array of bounty list items. */
  readonly items: BountyListItem[];
  /** Total number of bounties matching the query. */
  readonly total: number;
  /** Pagination offset. */
  readonly skip: number;
  /** Page size. */
  readonly limit: number;
}

// ---------------------------------------------------------------------------
// Search types
// ---------------------------------------------------------------------------

/** Valid sort fields for bounty search. */
export type BountySearchSort =
  | 'newest'
  | 'reward_high'
  | 'reward_low'
  | 'deadline'
  | 'submissions'
  | 'best_match';

/** Valid bounty categories. */
export type BountyCategory =
  | 'smart-contract'
  | 'frontend'
  | 'backend'
  | 'design'
  | 'content'
  | 'security'
  | 'devops'
  | 'documentation';

/** Parameters for the bounty search endpoint. */
export interface BountySearchParams {
  /** Full-text search query (max 200 chars). */
  readonly q?: string;
  /** Filter by lifecycle status. */
  readonly status?: BountyStatus;
  /** Filter by tier (1-3). */
  readonly tier?: number;
  /** Filter by required skills. */
  readonly skills?: string[];
  /** Filter by category. */
  readonly category?: BountyCategory;
  /** Filter by creator type ("platform" or "community"). */
  readonly creator_type?: string;
  /** Filter by creator's ID/wallet. */
  readonly creator_id?: string;
  /** Minimum reward amount. */
  readonly reward_min?: number;
  /** Maximum reward amount. */
  readonly reward_max?: number;
  /** Only bounties with deadline before this ISO date. */
  readonly deadline_before?: string;
  /** Sort order for results. */
  readonly sort?: BountySearchSort;
  /** Page number (1-based). */
  readonly page?: number;
  /** Results per page (1-100). */
  readonly per_page?: number;
}

/** A single search result with relevance metadata. */
export interface BountySearchResult extends BountyListItem {
  /** Detailed description. */
  readonly description: string;
  /** Relevance score from the search engine. */
  readonly relevance_score: number;
  /** Number of matching skills. */
  readonly skill_match_count: number;
}

/** Paginated search results. */
export interface BountySearchResponse {
  /** Array of search result items. */
  readonly items: BountySearchResult[];
  /** Total matching results. */
  readonly total: number;
  /** Current page number. */
  readonly page: number;
  /** Results per page. */
  readonly per_page: number;
  /** The original search query. */
  readonly query: string;
}

/** A single autocomplete suggestion. */
export interface AutocompleteItem {
  /** Suggestion text. */
  readonly text: string;
  /** Type of suggestion ("title" or "skill"). */
  readonly type: string;
  /** Associated bounty ID (if type is "title"). */
  readonly bounty_id: string | null;
}

/** Autocomplete suggestions response. */
export interface AutocompleteResponse {
  /** Array of suggestion items. */
  readonly suggestions: AutocompleteItem[];
}

// ---------------------------------------------------------------------------
// Escrow types
// ---------------------------------------------------------------------------

/** Request body for funding a bounty escrow. */
export interface EscrowFundRequest {
  /** UUID of the bounty to escrow funds for. */
  readonly bounty_id: string;
  /** Creator's Solana wallet address (32-44 chars base58). */
  readonly creator_wallet: string;
  /** Amount of $FNDRY to lock in escrow. */
  readonly amount: number;
  /** ISO 8601 expiry for auto-refund (optional). */
  readonly expires_at?: string;
}

/** Request body for releasing an escrow. */
export interface EscrowReleaseRequest {
  /** UUID of the bounty whose escrow to release. */
  readonly bounty_id: string;
  /** Winner's Solana wallet address (32-44 chars base58). */
  readonly winner_wallet: string;
}

/** Request body for refunding an escrow. */
export interface EscrowRefundRequest {
  /** UUID of the bounty whose escrow to refund. */
  readonly bounty_id: string;
}

/** Public escrow response with full lifecycle metadata. */
export interface EscrowResponse {
  /** Escrow UUID. */
  readonly id: string;
  /** Associated bounty UUID. */
  readonly bounty_id: string;
  /** Creator's Solana wallet. */
  readonly creator_wallet: string;
  /** Winner's Solana wallet (set on release). */
  readonly winner_wallet: string | null;
  /** Escrowed $FNDRY amount. */
  readonly amount: number;
  /** Current escrow lifecycle state. */
  readonly state: EscrowState;
  /** Funding transaction signature. */
  readonly fund_tx_hash: string | null;
  /** Release/refund transaction signature. */
  readonly release_tx_hash: string | null;
  /** Auto-refund deadline (ISO 8601). */
  readonly expires_at: string | null;
  /** Creation timestamp (ISO 8601 UTC). */
  readonly created_at: string;
  /** Last state-change timestamp (ISO 8601 UTC). */
  readonly updated_at: string;
}

/** Single entry in the escrow audit ledger. */
export interface EscrowLedgerEntry {
  /** Entry UUID. */
  readonly id: string;
  /** Parent escrow UUID. */
  readonly escrow_id: string;
  /** Type of ledger action. */
  readonly action: LedgerAction;
  /** State before this action. */
  readonly from_state: string;
  /** State after this action. */
  readonly to_state: string;
  /** Amount involved in this action. */
  readonly amount: number;
  /** Wallet address involved. */
  readonly wallet: string;
  /** On-chain transaction hash. */
  readonly tx_hash: string | null;
  /** Optional note. */
  readonly note: string | null;
  /** ISO 8601 timestamp. */
  readonly created_at: string;
}

/** Escrow status response with state, balance, and audit ledger. */
export interface EscrowStatusResponse {
  /** Current escrow details. */
  readonly escrow: EscrowResponse;
  /** Full audit trail of all escrow actions. */
  readonly ledger: EscrowLedgerEntry[];
}

// ---------------------------------------------------------------------------
// Contributor types
// ---------------------------------------------------------------------------

/** Payload for creating a contributor profile. */
export interface ContributorCreate {
  /** GitHub username. */
  readonly username: string;
  /** Display name. */
  readonly display_name?: string;
  /** Solana wallet address. */
  readonly wallet_address?: string;
  /** Technical skills. */
  readonly skills?: string[];
}

/** Payload for updating a contributor profile. */
export interface ContributorUpdate {
  /** Updated display name. */
  readonly display_name?: string;
  /** Updated wallet address. */
  readonly wallet_address?: string;
  /** Updated skills list. */
  readonly skills?: string[];
}

/** Full contributor profile response. */
export interface ContributorResponse {
  /** Unique contributor UUID. */
  readonly id: string;
  /** GitHub username. */
  readonly username: string;
  /** Display name. */
  readonly display_name: string | null;
  /** Solana wallet address. */
  readonly wallet_address: string | null;
  /** Technical skills. */
  readonly skills: string[];
  /** Earned badges. */
  readonly badges: string[];
  /** Current reputation score. */
  readonly reputation_score: number;
  /** Total bounties completed. */
  readonly total_bounties_completed: number;
  /** Total $FNDRY earned. */
  readonly total_earned: number;
  /** Current unlocked tier. */
  readonly tier_unlocked: number;
  /** ISO timestamp of creation. */
  readonly created_at: string;
}

/** Paginated contributor list response. */
export interface ContributorListResponse {
  /** Array of contributor profiles. */
  readonly items: ContributorResponse[];
  /** Total number of contributors matching the query. */
  readonly total: number;
  /** Pagination offset. */
  readonly skip: number;
  /** Page size. */
  readonly limit: number;
}

// ---------------------------------------------------------------------------
// Stats types
// ---------------------------------------------------------------------------

/** Statistics for a single tier. */
export interface TierStats {
  /** Number of open bounties in this tier. */
  readonly open: number;
  /** Number of completed bounties in this tier. */
  readonly completed: number;
}

/** Top contributor information. */
export interface TopContributor {
  /** GitHub username. */
  readonly username: string;
  /** Number of bounties completed. */
  readonly bounties_completed: number;
}

/** Bounty program aggregate statistics. */
export interface StatsResponse {
  /** Total bounties ever created. */
  readonly total_bounties_created: number;
  /** Total bounties completed. */
  readonly total_bounties_completed: number;
  /** Total bounties currently open. */
  readonly total_bounties_open: number;
  /** Total registered contributors. */
  readonly total_contributors: number;
  /** Total $FNDRY paid out. */
  readonly total_fndry_paid: number;
  /** Total PRs that have been reviewed. */
  readonly total_prs_reviewed: number;
  /** Breakdown of open/completed bounties by tier. */
  readonly bounties_by_tier: Record<string, TierStats>;
  /** Top contributor by bounties completed. */
  readonly top_contributor: TopContributor | null;
}

// ---------------------------------------------------------------------------
// Health types
// ---------------------------------------------------------------------------

/** Service health status for a dependency. */
export interface ServiceHealth {
  /** Database connectivity status. */
  readonly database: string;
  /** Redis connectivity status. */
  readonly redis: string;
}

/** Health check response from the backend. */
export interface HealthResponse {
  /** Overall service status ("healthy" or "degraded"). */
  readonly status: string;
  /** API version string. */
  readonly version: string;
  /** Seconds since the service started. */
  readonly uptime_seconds: number;
  /** ISO 8601 timestamp of the health check. */
  readonly timestamp: string;
  /** Individual service statuses. */
  readonly services: ServiceHealth;
}

// ---------------------------------------------------------------------------
// User / Auth types
// ---------------------------------------------------------------------------

/** Full user profile returned by the authenticated /api/auth/me endpoint. */
export interface User {
  /** Unique UUID of the user. */
  readonly id: string;
  /** GitHub username. */
  readonly username: string;
  /** Primary email address (null if not granted by the user). */
  readonly email: string | null;
  /** GitHub avatar URL. */
  readonly avatar_url: string | null;
  /** Registered Solana wallet address (null if not yet linked). */
  readonly wallet_address: string | null;
  /** Whether the wallet signature has been verified. */
  readonly wallet_verified: boolean;
  /** GitHub numeric user ID. */
  readonly github_id: string | null;
  /** ISO 8601 account creation timestamp. */
  readonly created_at: string | null;
}

/** Tokens issued after successful OAuth or wallet authentication. */
export interface AuthTokens {
  /** JWT bearer access token. */
  readonly access_token: string;
  /** Refresh token for renewing expired sessions. */
  readonly refresh_token: string;
  /** Token type (always "Bearer"). */
  readonly token_type: string;
}

/** Response from the GitHub OAuth code exchange endpoint. */
export interface GitHubAuthResponse extends AuthTokens {
  /** Authenticated user profile. */
  readonly user: User;
}

/**
 * Payload for requesting a GitHub OAuth authorize URL.
 * The server returns { authorize_url: string }.
 */
export interface GitHubAuthorizeUrlResponse {
  readonly authorize_url: string;
}

// ---------------------------------------------------------------------------
// GitHub types (for the GitHub API wrapper)
// ---------------------------------------------------------------------------

/** Represents a GitHub issue mapped to a SolFoundry bounty. */
export interface GitHubBountyIssue {
  /** GitHub issue number. */
  readonly number: number;
  /** Issue title. */
  readonly title: string;
  /** Issue body/description. */
  readonly body: string;
  /** Issue state ("open" or "closed"). */
  readonly state: string;
  /** Labels applied to the issue. */
  readonly labels: string[];
  /** GitHub URL for the issue. */
  readonly html_url: string;
  /** ISO 8601 creation timestamp. */
  readonly created_at: string;
  /** ISO 8601 last update timestamp. */
  readonly updated_at: string;
}

/** Represents a GitHub pull request for claim status checking. */
export interface GitHubPullRequest {
  /** Pull request number. */
  readonly number: number;
  /** PR title. */
  readonly title: string;
  /** PR state ("open", "closed", "merged"). */
  readonly state: string;
  /** Whether the PR has been merged. */
  readonly merged: boolean;
  /** GitHub URL for the PR. */
  readonly html_url: string;
  /** Head branch name. */
  readonly head_branch: string;
  /** Base branch name. */
  readonly base_branch: string;
  /** ISO 8601 creation timestamp. */
  readonly created_at: string;
}

// ---------------------------------------------------------------------------
// WebSocket event types
// ---------------------------------------------------------------------------

/** Types of real-time events from the WebSocket connection. */
export type WebSocketEventType =
  | 'bounty_created'
  | 'bounty_updated'
  | 'bounty_completed'
  | 'submission_created'
  | 'submission_reviewed'
  | 'payout_sent'
  | 'escrow_funded'
  | 'escrow_released';

/** A real-time event received over the WebSocket connection. */
export interface WebSocketEvent {
  /** Type of event. */
  readonly type: WebSocketEventType;
  /** Event payload data. */
  readonly data: Record<string, unknown>;
  /** ISO 8601 timestamp of the event. */
  readonly timestamp: string;
}

// ---------------------------------------------------------------------------
// Client configuration
// ---------------------------------------------------------------------------

/** Configuration for the SolFoundry API client. */
export interface SolFoundryClientConfig {
  /** Base URL for the SolFoundry REST API (e.g., "https://api.solfoundry.io"). */
  readonly baseUrl: string;
  /** JWT bearer token for authenticated requests. */
  readonly authToken?: string;
  /** Solana RPC endpoint URL. Defaults to mainnet-beta. */
  readonly rpcEndpoint?: string;
  /** Request timeout in milliseconds. Defaults to 30000. */
  readonly timeoutMs?: number;
  /** Maximum number of retry attempts for transient failures. Defaults to 3. */
  readonly maxRetries?: number;
  /** Maximum requests per second for rate limiting. Defaults to 10. */
  readonly maxRequestsPerSecond?: number;
}

/** Standard API error response from the SolFoundry backend. */
export interface ApiErrorResponse {
  /** Human-readable error message. */
  readonly message: string;
  /** Request correlation ID for debugging. */
  readonly request_id: string | null;
  /** Machine-readable error code. */
  readonly code: string;
}
