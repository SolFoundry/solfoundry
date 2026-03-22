/** Types for the $FNDRY staking subsystem. */

export type StakingTier = 'none' | 'bronze' | 'silver' | 'gold' | 'diamond';

export interface StakingPosition {
  wallet_address: string;
  staked_amount: number;
  tier: StakingTier;
  apy: number;
  rep_boost: number;
  staked_at: string | null;
  last_reward_claim: string | null;
  rewards_earned: number;
  rewards_available: number;
  cooldown_started_at: string | null;
  cooldown_ends_at: string | null;
  cooldown_active: boolean;
  unstake_ready: boolean;
  unstake_amount: number;
}

export interface StakingEvent {
  id: string;
  wallet_address: string;
  event_type: 'stake' | 'unstake_initiated' | 'unstake_completed' | 'reward_claimed';
  amount: number;
  rewards_amount: number | null;
  signature: string | null;
  created_at: string;
}

export interface StakingHistory {
  items: StakingEvent[];
  total: number;
}

export interface StakingStats {
  total_staked: number;
  total_stakers: number;
  total_rewards_paid: number;
  avg_apy: number;
  tier_distribution: Record<StakingTier, number>;
}

export interface TierConfig {
  tier: StakingTier;
  minStake: number;
  apy: number;
  repBoost: number;
  label: string;
  color: string;
  gradient: string;
}

export const TIER_CONFIGS: TierConfig[] = [
  {
    tier: 'bronze',
    minStake: 1_000,
    apy: 0.05,
    repBoost: 1.0,
    label: 'Bronze',
    color: '#cd7f32',
    gradient: 'from-amber-700 to-amber-600',
  },
  {
    tier: 'silver',
    minStake: 10_000,
    apy: 0.08,
    repBoost: 1.25,
    label: 'Silver',
    color: '#c0c0c0',
    gradient: 'from-gray-400 to-gray-300',
  },
  {
    tier: 'gold',
    minStake: 50_000,
    apy: 0.12,
    repBoost: 1.5,
    label: 'Gold',
    color: '#ffd700',
    gradient: 'from-yellow-500 to-yellow-400',
  },
  {
    tier: 'diamond',
    minStake: 100_000,
    apy: 0.18,
    repBoost: 2.0,
    label: 'Diamond',
    color: '#b9f2ff',
    gradient: 'from-cyan-300 to-sky-300',
  },
];

export type StakeModalMode = 'stake' | 'unstake' | 'claim';
