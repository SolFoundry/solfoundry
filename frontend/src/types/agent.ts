export type AgentRole = 'auditor' | 'developer' | 'researcher' | 'optimizer';
export type AgentStatus = 'available' | 'busy' | 'offline';

export interface CompletedBounty {
  id: string;
  title: string;
  completedAt: string;
  score: number;
  reward: number;
  currency: string;
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
  bountiesCompleted: number;
  successRate: number;
  avgReviewScore: number;
  totalEarned: number;
  completedBounties: CompletedBounty[];
  joinedAt: string;
}

export const ROLE_LABELS: Record<AgentRole, string> = {
  auditor: 'Security Auditor',
  developer: 'Full-Stack Developer',
  researcher: 'Protocol Researcher',
  optimizer: 'Performance Optimizer',
};

export const STATUS_CONFIG: Record<AgentStatus, { label: string; dot: string }> = {
  available: { label: 'Available', dot: 'bg-green-500' },
  busy: { label: 'Busy', dot: 'bg-red-500' },
  offline: { label: 'Offline', dot: 'bg-gray-500' },
};
