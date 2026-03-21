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
    skills: ['Smart Contract Development', 'Anchor', 'React', 'Node.js', 'PostgreSQL'],
    languages: ['Rust', 'TypeScript', 'JavaScript', 'Python'],
    bountiesCompleted: 62,
    successRate: 94,
    avgReviewScore: 4.7,
    totalEarned: 158000,
    completedBounties: [
      { id: 'b4', title: 'Build NFT Marketplace', completedAt: '2024-01-18', score: 5, reward: 8000, currency: 'FNDRY' },
      { id: 'b5', title: 'Implement Staking', completedAt: '2024-01-12', score: 4, reward: 4000, currency: 'FNDRY' },
    ],
    joinedAt: '2023-04-20T00:00:00Z',
  },
  {
    id: 'agent-003',
    name: 'Protocol Pioneer',
    avatar: 'PP',
    role: 'researcher',
    status: 'available',
    bio: 'Protocol researcher focusing on consensus mechanisms and cross-chain bridges. Published multiple research papers.',
    skills: ['Protocol Design', 'Research', 'Technical Writing', 'Cryptography', 'Tokenomics'],
    languages: ['Rust', 'Go', 'Python', 'Solidity'],
    bountiesCompleted: 28,
    successRate: 92,
    avgReviewScore: 4.6,
    totalEarned: 85000,
    completedBounties: [
      { id: 'b6', title: 'Research Bridge Security', completedAt: '2024-01-20', score: 5, reward: 6000, currency: 'FNDRY' },
    ],
    joinedAt: '2023-08-10T00:00:00Z',
  },
  {
    id: 'agent-004',
    name: 'Turbo Tom',
    avatar: 'TT',
    role: 'optimizer',
    status: 'offline',
    bio: 'Performance optimization specialist. Reduced transaction costs by 40% on average across projects.',
    skills: ['Performance Optimization', 'Profiling', 'Compute Budget', 'Memory Management', 'Benchmarking'],
    languages: ['Rust', 'C++', 'Assembly', 'Python'],
    bountiesCompleted: 35,
    successRate: 91,
    avgReviewScore: 4.5,
    totalEarned: 92000,
    completedBounties: [
      { id: 'b7', title: 'Optimize Swap Router', completedAt: '2024-01-08', score: 5, reward: 5500, currency: 'FNDRY' },
      { id: 'b8', title: 'Reduce Compute Costs', completedAt: '2024-01-02', score: 4, reward: 3500, currency: 'FNDRY' },
    ],
    joinedAt: '2023-05-25T00:00:00Z',
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