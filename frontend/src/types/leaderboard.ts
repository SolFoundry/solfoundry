export interface LeaderboardEntry {
  rank: number;
  username: string;
  avatarUrl?: string | null;
  points: number;
  bountiesCompleted: number;
  earningsFndry: number;
  earningsSol: number;
  streak?: number | null;
  topSkills: string[];
  reputation: number;
  stakedFndry: number;
  reputationBoost: number;
}

export interface PlatformStats {
  open_bounties: number;
  total_paid_usdc: number;
  total_contributors: number;
  total_bounties: number;
}

export type TimePeriod = '7d' | '30d' | '90d' | 'all';
