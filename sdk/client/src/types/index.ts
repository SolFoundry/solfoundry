/** Bounty status lifecycle */
export type BountyStatus =
  | 'open'
  | 'in_progress'
  | 'in_review'
  | 'completed'
  | 'cancelled'
  | 'expired';

/** Bounty difficulty tier */
export type BountyTier = 'T1' | 'T2' | 'T3' | 'T4';

/** Supported reward tokens */
export type RewardToken = 'SOL' | 'USDC' | 'FNDRY';

/** Submission review status */
export type SubmissionStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'revision_requested';

/** Leaderboard time period */
export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';

/** Authentication tokens returned after OAuth exchange */
export interface AuthTokens {
  /** JWT access token */
  accessToken: string;
  /** Long-lived refresh token */
  refreshToken: string;
  /** Token expiration time in seconds from now */
  expiresIn: number;
  /** Token type, typically "Bearer" */
  tokenType: string;
}

/** SolFoundry user profile */
export interface User {
  /** Unique user identifier */
  id: string;
  /** Display name */
  name: string | null;
  /** GitHub username */
  githubUsername: string;
  /** Avatar URL */
  avatarUrl: string | null;
  /** Email address */
  email: string | null;
  /** Wallet public key */
  wallet: string | null;
  /** Account creation timestamp */
  createdAt: string;
}

/** Bounty listing filters */
export interface ListBountiesParams {
  /** Filter by bounty status */
  status?: BountyStatus;
  /** Maximum number of results (default 20, max 100) */
  limit?: number;
  /** Pagination offset */
  offset?: number;
  /** Filter by required skill */
  skill?: string;
  /** Filter by tier */
  tier?: BountyTier;
  /** Filter by reward token */
  reward_token?: RewardToken;
}

/** Bounty reward details */
export interface BountyReward {
  /** Reward amount (in smallest unit) */
  amount: string;
  /** Reward token */
  token: RewardToken;
  /** USD equivalent if available */
  usdEquivalent?: number;
}

/** A SolFoundry bounty */
export interface Bounty {
  /** Unique bounty identifier */
  id: string;
  /** Bounty title */
  title: string;
  /** Detailed description (markdown) */
  description: string;
  /** Current status */
  status: BountyStatus;
  /** Difficulty tier */
  tier: BountyTier;
  /** Reward details */
  reward: BountyReward;
  /** Required skills */
  skills: string[];
  /** Deadline for submissions */
  deadline: string | null;
  /** Bounty creator user ID */
  creatorId: string;
  /** Assigned reviewer user ID */
  reviewerId: string | null;
  /** Number of submissions received */
  submissionCount: number;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/** Payload for creating a new bounty */
export interface BountyCreatePayload {
  /** Bounty title */
  title: string;
  /** Detailed description (markdown) */
  description: string;
  /** Difficulty tier */
  tier: BountyTier;
  /** Reward token */
  rewardToken: RewardToken;
  /** Reward amount (in smallest unit or whole number) */
  rewardAmount: string;
  /** Required skills */
  skills: string[];
  /** Submission deadline (ISO 8601) */
  deadline?: string;
  /** Reviewer wallet or user ID (optional) */
  reviewerId?: string;
}

/** A submission to a bounty */
export interface Submission {
  /** Unique submission identifier */
  id: string;
  /** Parent bounty ID */
  bountyId: string;
  /** Submitter user ID */
  userId: string;
  /** Submission title */
  title: string;
  /** Submission description (markdown) */
  description: string;
  /** URLs to supporting materials (PRs, demos, etc.) */
  links: string[];
  /** Current review status */
  status: SubmissionStatus;
  /** Reviewer feedback (if reviewed) */
  feedback: string | null;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/** Payload for creating a submission */
export interface SubmissionCreatePayload {
  /** Submission title */
  title: string;
  /** Submission description (markdown) */
  description: string;
  /** URLs to supporting materials */
  links: string[];
}

/** Treasury deposit information for escrow */
export interface TreasuryDepositInfo {
  /** Deposit destination wallet address */
  walletAddress: string;
  /** Required deposit amount */
  amount: string;
  /** Token to deposit */
  token: RewardToken;
  /** Memo/reference ID for the deposit */
  memo: string;
  /** Minimum required confirmations */
  minConfirmations: number;
}

/** Payload for verifying an escrow deposit */
export interface EscrowVerifyPayload {
  /** Bounty ID */
  bountyId: string;
  /** Transaction signature on Solana */
  transactionSignature: string;
}

/** Result of escrow deposit verification */
export interface EscrowVerifyResult {
  /** Whether the deposit was verified */
  verified: boolean;
  /** Verification message */
  message: string;
  /** Escrow balance after verification */
  escrowBalance?: string;
}

/** Review fee information */
export interface ReviewFeeInfo {
  /** Fee amount */
  amount: string;
  /** Fee token */
  token: RewardToken;
  /** Fee wallet address */
  walletAddress: string;
  /** Payment memo */
  memo: string;
  /** Whether the fee has been paid */
  paid: boolean;
}

/** Payload for verifying a review fee payment */
export interface ReviewFeeVerifyPayload {
  /** Bounty ID */
  bountyId: string;
  /** Transaction signature */
  transactionSignature: string;
}

/** Review fee verification result */
export interface ReviewFeeVerifyResult {
  /** Whether the fee was verified */
  verified: boolean;
  /** Verification message */
  message: string;
}

/** Leaderboard entry for a user */
export interface LeaderboardEntry {
  /** Rank position */
  rank: number;
  /** User ID */
  userId: string;
  /** Display name */
  name: string | null;
  /** GitHub username */
  githubUsername: string;
  /** Avatar URL */
  avatarUrl: string | null;
  /** Total earnings in USD */
  totalEarnings: number;
  /** Number of bounties completed */
  bountiesCompleted: number;
  /** Points earned this period */
  points: number;
}

/** Platform-wide statistics */
export interface PlatformStats {
  /** Total bounties created */
  totalBounties: number;
  /** Currently open bounties */
  openBounties: number;
  /** Total completed bounties */
  completedBounties: number;
  /** Total value distributed (USD) */
  totalDistributed: number;
  /** Total registered users */
  totalUsers: number;
  /** Total submissions received */
  totalSubmissions: number;
}

/** Generic paginated response */
export interface PaginatedResponse<T> {
  /** Result items */
  data: T[];
  /** Total count of matching items */
  total: number;
  /** Current offset */
  offset: number;
  /** Items per page */
  limit: number;
}
