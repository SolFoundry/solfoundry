/**
 * Staking domain types for the $FNDRY staking interface.
 *
 * Defines all data shapes used by the staking dashboard, stake/unstake flows,
 * cooldown timers, rewards claiming, staking history, and tier visualization.
 * @module types/staking
 */

/** Supported transaction types for staking operations. */
export type StakingTransactionType = 'stake' | 'unstake' | 'claim_reward';

/**
 * Lifecycle states for an on-chain staking transaction.
 * - idle: no transaction in progress
 * - signing: wallet is prompting user to sign
 * - confirming: transaction sent, awaiting network confirmation
 * - confirmed: transaction finalized on-chain
 * - error: transaction failed at any stage
 */
export type TransactionStatus = 'idle' | 'signing' | 'confirming' | 'confirmed' | 'error';

/**
 * Staking tier with different reward rates by staked amount.
 * Higher tiers require more tokens but yield better APY.
 */
export interface StakingTier {
  /** Unique tier identifier (e.g., "bronze", "silver", "gold", "diamond"). */
  readonly id: string;
  /** Human-readable tier name. */
  readonly name: string;
  /** Minimum $FNDRY tokens required to qualify for this tier. */
  readonly minimumStake: number;
  /** Annual percentage yield for this tier (e.g., 12.5 means 12.5%). */
  readonly apyPercent: number;
  /** Hex color code for tier badge rendering. */
  readonly color: string;
  /** Optional icon identifier for the tier badge. */
  readonly icon: string;
}

/**
 * The user's current staking position including balance, rewards, and cooldown state.
 */
export interface StakingPosition {
  /** Total $FNDRY tokens currently staked by this wallet. */
  readonly stakedAmount: number;
  /** Accumulated but unclaimed reward tokens. */
  readonly pendingRewards: number;
  /** Current annual percentage yield based on staked tier. */
  readonly currentApyPercent: number;
  /** The tier this position qualifies for based on stakedAmount. */
  readonly currentTier: StakingTier;
  /** ISO 8601 timestamp when staking position was first created (or null). */
  readonly stakedSince: string | null;
  /** Whether an unstake is in-progress with an active cooldown. */
  readonly cooldownActive: boolean;
  /** ISO 8601 timestamp when the cooldown period ends (null if no active cooldown). */
  readonly cooldownEndsAt: string | null;
  /** Amount of $FNDRY currently locked in cooldown. */
  readonly cooldownAmount: number;
  /** Lifetime total rewards earned by this wallet. */
  readonly totalRewardsEarned: number;
}

/**
 * A single entry in the staking history table.
 * Tracks deposits, withdrawals, and reward claims.
 */
export interface StakingHistoryEntry {
  /** Unique identifier for this history entry. */
  readonly id: string;
  /** Type of staking operation performed. */
  readonly type: StakingTransactionType;
  /** Amount of $FNDRY involved in the transaction. */
  readonly amount: number;
  /** ISO 8601 timestamp when the transaction occurred. */
  readonly timestamp: string;
  /** On-chain transaction signature (Solana base58). */
  readonly transactionSignature: string;
  /** Whether the transaction was confirmed on-chain. */
  readonly confirmed: boolean;
}

/**
 * Result of a staking transaction attempt.
 * Contains the signature on success or an error message on failure.
 */
export interface StakingTransactionResult {
  /** Whether the transaction succeeded. */
  readonly success: boolean;
  /** On-chain transaction signature (present on success). */
  readonly signature: string | null;
  /** Human-readable error message (present on failure). */
  readonly errorMessage: string | null;
}

/**
 * Aggregate staking statistics for the platform dashboard.
 */
export interface StakingStats {
  /** Total $FNDRY staked across all users on the platform. */
  readonly totalStaked: number;
  /** Number of unique wallets with active staking positions. */
  readonly totalStakers: number;
  /** Weighted average APY across all stakers. */
  readonly averageApyPercent: number;
  /** Total rewards distributed to date. */
  readonly totalRewardsDistributed: number;
}

/** Predefined staking tiers with escalating APY rates. */
export const STAKING_TIERS: readonly StakingTier[] = [
  { id: 'bronze', name: 'Bronze', minimumStake: 0, apyPercent: 5.0, color: '#CD7F32', icon: 'shield' },
  { id: 'silver', name: 'Silver', minimumStake: 100_000, apyPercent: 8.0, color: '#C0C0C0', icon: 'star' },
  { id: 'gold', name: 'Gold', minimumStake: 500_000, apyPercent: 12.0, color: '#FFD700', icon: 'crown' },
  { id: 'diamond', name: 'Diamond', minimumStake: 2_000_000, apyPercent: 18.0, color: '#B9F2FF', icon: 'diamond' },
] as const;

/** Cooldown period in seconds for unstaking (7 days). */
export const UNSTAKE_COOLDOWN_SECONDS = 7 * 24 * 60 * 60;

/** $FNDRY token mint address on Solana mainnet. */
export const FNDRY_TOKEN_MINT = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';

/** Staking program ID on Solana. */
export const STAKING_PROGRAM_ID = 'StakeFNDRYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

/**
 * Determine which staking tier a given staked amount qualifies for.
 * Returns the highest tier whose minimumStake threshold is met.
 *
 * @param stakedAmount - The total amount of $FNDRY staked.
 * @returns The highest qualifying StakingTier.
 */
export function getStakingTier(stakedAmount: number): StakingTier {
  for (let i = STAKING_TIERS.length - 1; i >= 0; i--) {
    if (stakedAmount >= STAKING_TIERS[i].minimumStake) {
      return STAKING_TIERS[i];
    }
  }
  return STAKING_TIERS[0];
}

/**
 * Calculate estimated annual rewards for a given staked amount.
 *
 * @param stakedAmount - The total amount of $FNDRY staked.
 * @param apyPercent - The annual percentage yield to apply.
 * @returns Estimated annual reward in $FNDRY tokens.
 */
export function calculateEstimatedRewards(stakedAmount: number, apyPercent: number): number {
  if (stakedAmount <= 0 || apyPercent <= 0) return 0;
  return Math.floor(stakedAmount * (apyPercent / 100));
}
