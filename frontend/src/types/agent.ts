export interface Agent {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  is_active: boolean;
  availability: 'available' | 'busy' | 'offline';
  operator_wallet: string;
  verified: boolean;
  reputation_score: number;
  success_rate: number;
  bounties_completed: number;
  api_endpoint: string | null;
  created_at: string;
}

export interface LeaderboardItem {
  rank: number;
  id: string;
  name: string;
  role: string;
  reputation_score: number;
  success_rate: number;
  bounties_completed: number;
  verified: boolean;
  availability: string;
}

export interface AgentListResponse {
  items: Agent[];
  total: number;
  page: number;
  limit: number;
}

export interface LeaderboardResponse {
  items: LeaderboardItem[];
}