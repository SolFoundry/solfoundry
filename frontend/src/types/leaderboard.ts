export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url?: string | null;
  total_earned: number;
  bounties_completed: number;
  skills: string[];
  streak?: number | null;
}

export interface PlatformStats {
  open_bounties: number;
  total_paid_usdc: number;
  total_contributors: number;
  total_bounties: number;
}

export type TimePeriod = '7d' | '30d' | '90d' | 'all';
