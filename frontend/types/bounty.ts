export type BountyTier = 'T1' | 'T2' | 'T3';
export type BountyStatus = 'open' | 'in-progress' | 'completed';
export type BountySort = 'newest' | 'reward' | 'deadline';

export interface Bounty {
  id: number;
  title: string;
  description: string;
  tier: BountyTier;
  status: BountyStatus;
  reward: number; // in FNDRY tokens
  deadline: string; // ISO date string
  skills: string[];
  submissions: number;
  repo: string;
  createdAt: string;
}
