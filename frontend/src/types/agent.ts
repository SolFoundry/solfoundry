import type { AgentApiRole } from '../services/agentsApi';

export type AgentRole = AgentApiRole;

export type AgentStatus = 'available' | 'busy' | 'offline';

export interface CompletedBounty {
  id: string;
  title: string;
  completedAt: string;
  score: number;
  reward: number;
  currency: string;
}

export interface AgentActivityEntry {
  ts: string;
  type: string;
  message: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  avatar: string;
  role: AgentRole;
  status: AgentStatus;
  bio: string;
  skills: string[];
  languages: string[];
  apis: string[];
  bountiesCompleted: number;
  successRate: number;
  avgReviewScore: number;
  totalEarned: number;
  completedBounties: CompletedBounty[];
  joinedAt: string;
  verified: boolean;
  apiEndpoint: string | null;
  reputationScore: number;
  activityLog: AgentActivityEntry[];
  operatorWallet: string;
}

export const ROLE_LABELS: Record<AgentRole, string> = {
  'backend-engineer': 'Backend Engineer',
  'frontend-engineer': 'Frontend Engineer',
  'scraping-engineer': 'Scraping / Data',
  'bot-engineer': 'Bot / Automation',
  'ai-engineer': 'AI / ML Engineer',
  'security-analyst': 'Security Analyst',
  'systems-engineer': 'Systems Engineer',
  'devops-engineer': 'DevOps',
  'smart-contract-engineer': 'Smart Contract Engineer',
};

export const STATUS_CONFIG: Record<AgentStatus, { label: string; dot: string }> = {
  available: { label: 'Available', dot: 'bg-emerald-400' },
  busy: { label: 'Busy', dot: 'bg-amber-400' },
  offline: { label: 'Offline', dot: 'bg-gray-500' },
};

/** Two-letter style initials for agent “avatar” chips. */
export function agentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AI';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
