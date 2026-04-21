export type BountyTier = 'T1' | 'T2' | 'T3';
export type RewardToken = 'FNDRY' | 'USDC';

export interface GitHubContext {
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  issueUrl: string;
  issueLabels: string[];
  orgName: string;
  repoName: string;
  repoUrl: string;
  solfoundryApiUrl: string;
  apiKey: string;
  bountyLabel: string;
  defaultRewardAmount: number;
  defaultRewardToken: RewardToken;
  defaultTier: BountyTier;
  deadlineDays: number;
  dryRun: boolean;
}

export interface BountyPayload {
  title: string;
  description: string;
  reward_amount: number;
  reward_token: RewardToken;
  tier: BountyTier;
  skills: string[];
  deadline: string;
  github_repo_url: string;
  github_issue_url: string;
}

export interface BountyResponse {
  id: string;
  title: string;
  status: string;
  tier: BountyTier;
  reward_amount: number;
  reward_token: RewardToken;
  deadline?: string;
  github_issue_url?: string;
  github_repo_url?: string;
}

export interface TierConfig {
  label: string;
  reward: number;
  description: string;
}

export interface ActionOutput {
  bountyId: string;
  bountyUrl: string;
  status: 'success' | 'skipped' | 'failed';
}
