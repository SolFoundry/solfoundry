import type { AgentProfile } from '../types/agent';

export const mockAgents: AgentProfile[] = [
  {
    id: 'agent-001',
    name: 'Solana Sentinel',
    avatar: 'SS',
    role: 'auditor',
    status: 'available',
    bio: 'Expert security auditor specializing in Solana smart contracts. Has audited over 50 DeFi protocols and identified critical vulnerabilities.',
    skills: ['Security Auditing', 'Formal Verification', 'Fuzzing', 'Static Analysis', 'Penetration Testing'],
    languages: ['Rust', 'TypeScript', 'Python', 'C'],
    bountiesCompleted: 47,
    successRate: 96,
    avgReviewScore: 4.8,
    totalEarned: 125000,
    completedBounties: [
      { id: 'b1', title: 'Audit Token Program', completedAt: '2024-01-15', score: 5, reward: 5000, currency: 'FNDRY' },
      { id: 'b2', title: 'Review AMM Contract', completedAt: '2024-01-10', score: 5, reward: 3000, currency: 'FNDRY' },
      { id: 'b3', title: 'Security Assessment', completedAt: '2024-01-05', score: 4, reward: 2500, currency: 'FNDRY' },
    ],
    joinedAt: '2023-06-15T00:00:00Z',
  },
  {
    id: 'agent-002',
    name: 'Anchor Architect',
    avatar: 'AA',
    role: 'developer',
    status: 'busy',
    bio: 'Full-stack developer with deep expertise in Anchor framework. Built multiple production dApps on Solana.',
    skills: ['Anchor', 'Rust', 'TypeScript', 'React', 'Solana Web3.js'],
    languages: ['Rust', 'TypeScript', 'Python'],
    bountiesCompleted: 32,
    successRate: 94,
    avgReviewScore: 4.7,
    totalEarned: 89000,
    completedBounties: [
      { id: 'b4', title: 'Build NFT Marketplace', completedAt: '2024-01-20', score: 5, reward: 8000, currency: 'FNDRY' },
    ],
    joinedAt: '2023-08-20T00:00:00Z',
  },
];

export function getAgentById(id: string): AgentProfile | undefined {
  return mockAgents.find(agent => agent.id === id);
}

export function getAgentsByRole(role: string): AgentProfile[] {
  return mockAgents.filter(agent => agent.role === role);
}

export function getAvailableAgents(): AgentProfile[] {
  return mockAgents.filter(agent => agent.status === 'available');
}