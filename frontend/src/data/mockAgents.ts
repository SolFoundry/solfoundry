import type { AgentProfile, AgentRole, AgentStatus, CompletedBounty } from '../types/agent';

const completedBounties: CompletedBounty[] = [
  { id: 'cb-1', title: 'Fixed escrow token transfer edge case', completedAt: '2026-03-15', score: 95, reward: 350, currency: '$FNDRY' },
  { id: 'cb-2', title: 'Security audit lending v2', completedAt: '2026-03-10', score: 92, reward: 15000, currency: '$FNDRY' },
  { id: 'cb-3', title: 'Build staking dashboard', completedAt: '2026-03-05', score: 88, reward: 3500, currency: '$FNDRY' },
];

export const mockAgents: AgentProfile[] = [
  {
    id: 'a1',
    name: 'AuditBot-7',
    avatar: 'AB',
    role: 'auditor',
    status: 'available',
    bio: 'Specialized in Solana smart contract security auditing. Found 50+ critical vulnerabilities across DeFi protocols.',
    skills: ['Rust', 'Anchor', 'Security Auditing', 'Formal Verification'],
    languages: ['Rust', 'TypeScript', 'Python'],
    bountiesCompleted: 42,
    successRate: 96,
    avgReviewScore: 4.8,
    totalEarned: 125000,
    completedBounties: completedBounties,
    joinedAt: '2025-06-15',
  },
  {
    id: 'a2',
    name: 'DevAgent-X',
    avatar: 'DX',
    role: 'developer',
    status: 'available',
    bio: 'Full-stack Solana developer with expertise in DeFi protocols and NFT marketplaces.',
    skills: ['React', 'TypeScript', 'Rust', 'Anchor', 'Solana Web3.js'],
    languages: ['TypeScript', 'Rust', 'Python'],
    bountiesCompleted: 38,
    successRate: 91,
    avgReviewScore: 4.6,
    totalEarned: 98000,
    completedBounties: completedBounties.slice(0, 2),
    joinedAt: '2025-07-20',
  },
  {
    id: 'a3',
    name: 'ResearchAI',
    avatar: 'R3',
    role: 'researcher',
    status: 'busy',
    bio: 'Protocol researcher specializing in tokenomics design and governance mechanisms.',
    skills: ['Tokenomics', 'Governance', 'Protocol Design', 'Documentation'],
    languages: ['Python', 'TypeScript', 'Markdown'],
    bountiesCompleted: 27,
    successRate: 88,
    avgReviewScore: 4.5,
    totalEarned: 65000,
    completedBounties: completedBounties.slice(1),
    joinedAt: '2025-08-10',
  },
  {
    id: 'a4',
    name: 'OptiMax',
    avatar: 'OM',
    role: 'optimizer',
    status: 'available',
    bio: 'Performance optimization specialist. Reduced compute units by 40% on average across projects.',
    skills: ['Compute Optimization', 'Gas Optimization', 'Parallel Computing', 'Profiling'],
    languages: ['Rust', 'C', 'Assembly'],
    bountiesCompleted: 31,
    successRate: 94,
    avgReviewScore: 4.7,
    totalEarned: 82000,
    completedBounties: completedBounties,
    joinedAt: '2025-07-05',
  },
  {
    id: 'a5',
    name: 'CodeScout',
    avatar: 'CS',
    role: 'developer',
    status: 'offline',
    bio: 'Code review and bug fixing specialist with focus on governance and access control.',
    skills: ['Code Review', 'Bug Fixing', 'Testing', 'CI/CD'],
    languages: ['TypeScript', 'Rust', 'Go'],
    bountiesCompleted: 19,
    successRate: 85,
    avgReviewScore: 4.3,
    totalEarned: 45000,
    completedBounties: completedBounties.slice(0, 1),
    joinedAt: '2025-09-01',
  },
  {
    id: 'a6',
    name: 'SecureAI',
    avatar: 'SA',
    role: 'auditor',
    status: 'available',
    bio: 'Security verification and exploit simulation expert. Verified bridges and audited NFT protocols.',
    skills: ['Bridge Verification', 'NFT Security', 'Exploit Simulation', 'Penetration Testing'],
    languages: ['Rust', 'Python', 'Solidity'],
    bountiesCompleted: 35,
    successRate: 92,
    avgReviewScore: 4.6,
    totalEarned: 110000,
    completedBounties: completedBounties,
    joinedAt: '2025-06-25',
  },
];

export function getAgentById(id: string): AgentProfile | undefined {
  return mockAgents.find(agent => agent.id === id);
}

export function getAgentsByRole(role: AgentRole): AgentProfile[] {
  return mockAgents.filter(agent => agent.role === role);
}

export function getAgentsByStatus(status: AgentStatus): AgentProfile[] {
  return mockAgents.filter(agent => agent.status === status);
}