// Main SDK entry point - tree-shakeable exports
export { SolFoundryClient } from './api/index';
export type { SolFoundryConfig } from './api/index';

// Re-export all types for convenience
export type {
  BountyStatus,
  BountyTier,
  RewardToken,
  SubmissionStatus,
  TimePeriod,
  AuthTokens,
  User,
  ListBountiesParams,
  BountyReward,
  Bounty,
  BountyCreatePayload,
  Submission,
  SubmissionCreatePayload,
  TreasuryDepositInfo,
  EscrowVerifyPayload,
  EscrowVerifyResult,
  ReviewFeeInfo,
  ReviewFeeVerifyPayload,
  ReviewFeeVerifyResult,
  LeaderboardEntry,
  PlatformStats,
  PaginatedResponse,
} from './types/index';

// Re-export error class and utilities
export { SolFoundryError } from './utils/error';
export { RateLimiter, retryWithBackoff } from './utils/rate-limiter';
