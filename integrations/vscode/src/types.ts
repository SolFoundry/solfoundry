export interface User {
  id: string;
  name: string;
  email?: string;
  image?: string;
  githubUsername?: string;
  walletAddress?: string;
}

export interface Bounty {
  id: string;
  title: string;
  description: string;
  status: BountyStatus;
  tier: BountyTier;
  reward: string;
  rewardToken: RewardToken;
  skills: string[];
  language?: string;
  assignee?: User;
  creator: User;
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  githubIssueUrl?: string;
  githubRepo?: string;
  submissionsCount: number;
  maxAssignees: number;
  currentAssignees: number;
}

export type BountyStatus = 'open' | 'in_review' | 'in_progress' | 'completed' | 'cancelled';
export type BountyTier = 'T1' | 'T2' | 'T3';
export type RewardToken = 'USDC' | 'FNDRY' | 'SOL';

export interface Submission {
  id: string;
  bountyId: string;
  contributor: User;
  prUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface BountyFilters {
  tier?: BountyTier[];
  status?: BountyStatus[];
  rewardToken?: RewardToken[];
  skill?: string;
  keyword?: string;
  page?: number;
  limit?: number;
}

export interface ApiResponse<T> {
  data: T;
  total?: number;
  page?: number;
  limit?: number;
}
