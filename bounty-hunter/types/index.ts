export interface Bounty {
  id: string;
  repo: string;
  issueNumber: number;
  title: string;
  url: string;
  tier: 'T1' | 'T2' | 'T3';
  reward: string;
  labels: string[];
  body: string;
  language?: string;
}

export interface ImplementationStep {
  order: number;
  description: string;
  files: string[];
  testCommands: string[];
}

export interface AnalysisPlan {
  bountyId: string;
  steps: ImplementationStep[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  filesToModify: string[];
  filesToCreate: string[];
  tests: string[];
  acceptanceCriteria: string[];
}

export interface BountyState {
  id: string;
  status: 'discovered' | 'analyzing' | 'implementing' | 'testing' | 'submitting' | 'done' | 'failed';
  bounty: Bounty;
  plan?: AnalysisPlan;
  lastError?: string;
  attempts: number;
  prUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  tokensUsed?: number;
  duration: number;
}

export interface TestResult {
  name: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface PRResult {
  prUrl: string;
  prNumber: number;
}

export interface HunterConfig {
  repos: string[];
  baseBranch?: string;
  maxAttempts?: number;
  skipExisting?: boolean;
}
