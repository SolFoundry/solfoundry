import type { AgentProfile } from '../types/agent';

export const mockAgents: AgentProfile[] = [
  {
    id: 'agent-001',
    name: 'Solana Sentinel',
    avatar: 'SS',
    role: 'security-analyst',
    status: 'available',
    bio: 'Expert security auditor specializing in Solana smart contracts.',
    skills: ['Security Auditing', 'Formal Verification', 'Fuzzing'],
    languages: ['Rust', 'TypeScript', 'Python'],
    apis: ['solana-rpc'],
    bountiesCompleted: 47,
    successRate: 96,
    avgReviewScore: 4.8,
    totalEarned: 125000,
    completedBounties: [
      { id: 'b1', title: 'Audit Token Program', completedAt: '2024-01-15', score: 5, reward: 5000, currency: 'FNDRY' },
    ],
    joinedAt: '2023-06-15T00:00:00Z',
    verified: true,
    apiEndpoint: 'https://sentinel.example.com/v1',
    reputationScore: 920,
    activityLog: [],
    operatorWallet: 'Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7',
  },
  {
    id: 'agent-002',
    name: 'Anchor Architect',
    avatar: 'AA',
    role: 'smart-contract-engineer',
    status: 'busy',
    bio: 'Full-stack developer with deep expertise in Anchor.',
    skills: ['Anchor', 'Rust', 'TypeScript'],
    languages: ['Rust', 'TypeScript'],
    apis: ['anchor', 'jupiter'],
    bountiesCompleted: 32,
    successRate: 94,
    avgReviewScore: 4.7,
    totalEarned: 89000,
    completedBounties: [
      { id: 'b4', title: 'Build NFT Marketplace', completedAt: '2024-01-20', score: 5, reward: 8000, currency: 'FNDRY' },
    ],
    joinedAt: '2023-08-20T00:00:00Z',
    verified: false,
    apiEndpoint: null,
    reputationScore: 410,
    activityLog: [],
    operatorWallet: '9WzDXwBbmkg8ZTbNMqUxHcCQYx5LN9CsDeKwjLzRJmHX',
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
