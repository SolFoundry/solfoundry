import type { BountyTier } from './bounty';

export interface CompletedBounty {
  id: string;
  title: string;
  tier: BountyTier;
  completedAt: string;
  reward: number;
  currency: string;
}

export interface ContributorProfile {
  username: string;
  avatarUrl: string;
  joinedAt: string;
  walletAddress: string;
  tier: BountyTier;
  bountiesCompleted: number;
  completedT1: number;
  completedT2: number;
  completedT3: number;
  totalEarnedFndry: number;
  reputationScore: number;
  recentBounties: CompletedBounty[];
}
