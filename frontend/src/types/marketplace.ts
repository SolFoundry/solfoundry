export interface MarketplaceRepo {
  id: string;
  github_id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stars: number;
  owner_login: string;
  owner_avatar_url: string | null;
  html_url: string;
  total_funded_usdc: number;
  total_funded_fndry: number;
  active_goals: number;
  created_at: string;
}

export interface FundingGoal {
  id: string;
  repo_id: string;
  creator_id: string;
  creator_username: string | null;
  title: string;
  description: string;
  target_amount: number;
  target_token: 'USDC' | 'FNDRY';
  current_amount: number;
  contributor_count: number;
  status: 'active' | 'completed' | 'cancelled';
  deadline: string | null;
  created_at: string;
}

export interface Contribution {
  id: string;
  goal_id: string;
  contributor_id: string;
  contributor_username: string | null;
  amount: number;
  token: 'USDC' | 'FNDRY';
  tx_signature: string | null;
  created_at: string;
}

export interface RepoLeaderboardEntry {
  contributor_id: string;
  username: string;
  avatar_url: string | null;
  total_contributed: number;
  goals_funded: number;
  rank: number;
}
