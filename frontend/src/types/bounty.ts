/**
 * Bounty types for SolFoundry
 * Updated for Issue #482
 */

export type BountyStatus = 'open' | 'claimed' | 'closed';
export type BountyTier = 't1' | 't2' | 't3';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  createdAt: string;
  updatedAt: string;
  status: BountyStatus;
  tier: BountyTier;
  category: string;
  tags: string[];
  claimer?: string;
  prUrl?: string;
}

/**
 * Sort options as per new requirements:
 * - Newest (date desc)
 * - Oldest (date asc)
 * - Highest Reward (reward desc)
 * - Lowest Reward (reward asc)
 * - Tier (high to low)
 */
export type SortOption = 
  | 'newest'
  | 'oldest' 
  | 'highest-reward'
  | 'lowest-reward'
  | 'tier';

export interface SortConfig {
  option: SortOption;
}

/**
 * Default sort: Newest first
 */
export const DEFAULT_SORT_CONFIG: SortConfig = {
  option: 'newest',
};

/**
 * Sort option labels for UI
 */
export const SORT_OPTION_LABELS: Record<SortOption, string> = {
  'newest': 'Newest',
  'oldest': 'Oldest',
  'highest-reward': 'Highest Reward',
  'lowest-reward': 'Lowest Reward',
  'tier': 'Tier (high to low)',
};
