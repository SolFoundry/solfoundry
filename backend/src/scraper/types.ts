export enum BountyTier {
  TIER_1 = "tier-1",
  TIER_2 = "tier-2",
  TIER_3 = "tier-3",
}

export interface ScraperConfig {
  owner: string;
  repo: string;
  enabled: boolean;
}

export interface BountyMetadata {
  githubIssueId: number;
  githubUrl: string;
  title: string;
  description: string;
  tier: BountyTier;
  rewardAmount: number;
}

export const TIER_REWARDS: Record<BountyTier, number> = {
  [BountyTier.TIER_1]: 100000, // 100K $FNDRY
  [BountyTier.TIER_2]: 600000, // 600K $FNDRY
  [BountyTier.TIER_3]: 2000000, // 2M $FNDRY
};
