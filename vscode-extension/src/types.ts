// SolFoundry Bounty types

export interface BountyLabel {
  name: string;
  color?: string;
}

export interface Bounty {
  id: string;
  number: number;
  title: string;
  body: string;
  url: string;
  state: 'open' | 'in_progress' | 'completed';
  reward: number;
  rewardToken: string;
  tier: string;
  language?: string;
  labels: BountyLabel[];
  repo: string;
  createdAt: string;
  updatedAt: string;
  claimedBy?: string;
}

export interface BountyFilter {
  language?: string;
  minReward?: number;
  maxReward?: number;
  tier?: string;
}

export interface ClaimResult {
  success: boolean;
  message?: string;
  claimUrl?: string;
}

export interface ApiConfig {
  baseUrl: string;
  walletAddress?: string;
}
