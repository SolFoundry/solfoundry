export interface AnalyticsPoint {
  label: string;
  bounties: number;
  reward: number;
}

export interface AnalyticsMetrics {
  openBounties: number;
  completedBounties: number;
  totalReward: number;
  activeContributors: number;
  completionRate: number;
  rewardByToken: Record<string, number>;
  bountyVolume: AnalyticsPoint[];
  payoutDistribution: AnalyticsPoint[];
}
