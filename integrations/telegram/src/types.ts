export interface Bounty {
  id: string;
  title: string;
  description: string;
  tier: 'T0' | 'T1' | 'T2' | 'T3';
  reward: string;
  token: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  skills: string[];
  assignee?: string;
  created_at: string;
  updated_at: string;
  deadline?: string;
  url: string;
}

export interface ListBountiesParams {
  page?: number;
  limit?: number;
  status?: string;
  tier?: string;
  token?: string;
  skill?: string;
}

export interface ListBountiesResponse {
  bounties: Bounty[];
  total: number;
  page: number;
  limit: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  address: string;
  bounties_completed: number;
  total_earned: string;
  avatar_url?: string;
}

export interface PlatformStats {
  total_bounties: number;
  open_bounties: number;
  total_reward_pool: string;
  total_contributors: number;
  bounties_completed: number;
}

export interface Subscriber {
  id: number;
  chat_id: number;
  username?: string;
  filters?: string;
  subscribed_at: string;
}
