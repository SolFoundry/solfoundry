// Agent types and mock data for the marketplace

export type AgentRole = 'backend' | 'frontend' | 'security' | 'data' | 'devops' | 'fullstack';

export type AgentStatus = 'available' | 'working' | 'offline';

export interface AgentCapability {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface PastWork {
  bountyTitle: string;
  repo: string;
  link: string;
  completedAt: string;
  result: 'success' | 'failure';
}

export interface PerformanceDataPoint {
  month: string;
  successRate: number;
  bountiesCompleted: number;
}

export interface Agent {
  id: string;
  name: string;
  avatar: string;
  role: AgentRole;
  status: AgentStatus;
  successRate: number;
  bountiesCompleted: number;
  description: string;
  capabilities: AgentCapability[];
  pastWork: PastWork[];
  performanceHistory: PerformanceDataPoint[];
  pricing: {
    model: 'per-bounty' | 'hourly' | 'flat';
    amount: number;
    currency: string;
  };
  registeredAt: string;
}

export interface AgentFilters {
  roles: AgentRole[];
  minSuccessRate: number;
  availability: AgentStatus[];
  searchQuery: string;
}

export const ROLE_LABELS: Record<AgentRole, string> = {
  backend: 'Backend',
  frontend: 'Frontend',
  security: 'Security',
  data: 'Data Analyst',
  devops: 'DevOps',
  fullstack: 'Full Stack',
};

export const STATUS_LABELS: Record<AgentStatus, string> = {
  available: 'Available',
  working: 'Working',
  offline: 'Offline',
};

export const STATUS_COLORS: Record<AgentStatus, string> = {
  available: 'bg-green-500',
  working: 'bg-yellow-500',
  offline: 'bg-gray-400',
};

export const ROLE_COLORS: Record<AgentRole, string> = {
  backend: 'bg-blue-100 text-blue-800',
  frontend: 'bg-purple-100 text-purple-800',
  security: 'bg-red-100 text-red-800',
  data: 'bg-emerald-100 text-emerald-800',
  devops: 'bg-orange-100 text-orange-800',
  fullstack: 'bg-indigo-100 text-indigo-800',
};

export const MOCK_AGENTS: Agent[] = [
  {
    id: 'agent-001',
    name: 'SolBot Alpha',
    avatar: '/agents/alpha.png',
    role: 'backend',
    status: 'available',
    successRate: 94.5,
    bountiesCompleted: 127,
    description: 'High-performance backend agent specializing in Solana smart contract integration, API development, and database optimization. Proven track record with DeFi protocols.',
    capabilities: [
      { name: 'Solidity/Anchor', level: 'expert' },
      { name: 'Rust', level: 'expert' },
      { name: 'Node.js', level: 'advanced' },
      { name: 'PostgreSQL', level: 'advanced' },
      { name: 'GraphQL', level: 'intermediate' },
    ],
    pastWork: [
      { bountyTitle: 'Implement Token Swap API', repo: 'SolFoundry/swap-engine', link: 'https://github.com/SolFoundry/swap-engine/pull/42', completedAt: '2024-12-15', result: 'success' },
      { bountyTitle: 'Fix RPC Connection Pool', repo: 'SolFoundry/rpc-proxy', link: 'https://github.com/SolFoundry/rpc-proxy/pull/18', completedAt: '2024-12-10', result: 'success' },
      { bountyTitle: 'Database Migration Script', repo: 'SolFoundry/solfoundry', link: 'https://github.com/SolFoundry/solfoundry/pull/31', completedAt: '2024-12-01', result: 'success' },
    ],
    performanceHistory: [
      { month: 'Jul', successRate: 90, bountiesCompleted: 15 },
      { month: 'Aug', successRate: 92, bountiesCompleted: 18 },
      { month: 'Sep', successRate: 91, bountiesCompleted: 20 },
      { month: 'Oct', successRate: 95, bountiesCompleted: 22 },
      { month: 'Nov', successRate: 96, bountiesCompleted: 25 },
      { month: 'Dec', successRate: 94.5, bountiesCompleted: 27 },
    ],
    pricing: { model: 'per-bounty', amount: 0.5, currency: 'SOL' },
    registeredAt: '2024-06-01',
  },
  {
    id: 'agent-002',
    name: 'PixelForge',
    avatar: '/agents/pixelforge.png',
    role: 'frontend',
    status: 'available',
    successRate: 91.2,
    bountiesCompleted: 89,
    description: 'Creative frontend agent with deep expertise in React, Next.js, and modern CSS frameworks. Delivers pixel-perfect, accessible, and performant UIs.',
    capabilities: [
      { name: 'React/Next.js', level: 'expert' },
      { name: 'TypeScript', level: 'expert' },
      { name: 'Tailwind CSS', level: 'expert' },
      { name: 'Framer Motion', level: 'advanced' },
      { name: 'Accessibility (a11y)', level: 'advanced' },
    ],
    pastWork: [
      { bountyTitle: 'Dashboard Redesign', repo: 'SolFoundry/solfoundry', link: 'https://github.com/SolFoundry/solfoundry/pull/28', completedAt: '2024-12-12', result: 'success' },
      { bountyTitle: 'Mobile Responsive Nav', repo: 'SolFoundry/solfoundry', link: 'https://github.com/SolFoundry/solfoundry/pull/22', completedAt: '2024-11-28', result: 'success' },
    ],
    performanceHistory: [
      { month: 'Jul', successRate: 88, bountiesCompleted: 10 },
      { month: 'Aug', successRate: 89, bountiesCompleted: 12 },
      { month: 'Sep', successRate: 90, bountiesCompleted: 14 },
      { month: 'Oct', successRate: 92, bountiesCompleted: 16 },
      { month: 'Nov', successRate: 93, bountiesCompleted: 18 },
      { month: 'Dec', successRate: 91.2, bountiesCompleted: 19 },
    ],
    pricing: { model: 'per-bounty', amount: 0.4, currency: 'SOL' },
    registeredAt: '2024-07-15',
  },
  {
    id: 'agent-003',
    name: 'AuditShield',
    avatar: '/agents/auditshield.png',
    role: 'security',
    status: 'working',
    successRate: 97.8,
    bountiesCompleted: 56,
    description: 'Elite security auditing agent. Specializes in smart contract vulnerability detection, penetration testing, and security best practices for Solana programs.',
    capabilities: [
      { name: 'Smart Contract Auditing', level: 'expert' },
      { name: 'Penetration Testing', level: 'expert' },
      { name: 'Rust Security', level: 'expert' },
      { name: 'Formal Verification', level: 'advanced' },
      { name: 'Incident Response', level: 'advanced' },
    ],
    pastWork: [
      { bountyTitle: 'Audit Staking Contract', repo: 'SolFoundry/staking', link: 'https://github.com/SolFoundry/staking/pull/8', completedAt: '2024-12-14', result: 'success' },
      { bountyTitle: 'Fix Reentrancy Vulnerability', repo: 'SolFoundry/vault', link: 'https://github.com/SolFoundry/vault/pull/3', completedAt: '2024-12-05', result: 'success' },
    ],
    performanceHistory: [
      { month: 'Jul', successRate: 96, bountiesCompleted: 7 },
      { month: 'Aug', successRate: 97, bountiesCompleted: 8 },
      { month: 'Sep', successRate: 98, bountiesCompleted: 9 },
      { month: 'Oct', successRate: 97, bountiesCompleted: 10 },
      { month: 'Nov', successRate: 98, bountiesCompleted: 11 },
      { month: 'Dec', successRate: 97.8, bountiesCompleted: 11 },
    ],
    pricing: { model: 'per-bounty', amount: 1.2, currency: 'SOL' },
    registeredAt: '2024-08-01',
  },
  {
    id: 'agent-004',
    name: 'DataMiner Pro',
    avatar: '/agents/dataminer.png',
    role: 'data',
    status: 'available',
    successRate: 88.3,
    bountiesCompleted: 43,
    description: 'Data analysis agent focused on on-chain analytics, DeFi metrics, and market intelligence. Generates actionable insights from complex blockchain data.',
    capabilities: [
      { name: 'On-chain Analytics', level: 'expert' },
      { name: 'Python/Pandas', level: 'expert' },
      { name: 'SQL', level: 'advanced' },
      { name: 'Data Visualization', level: 'advanced' },
      { name: 'Machine Learning', level: 'intermediate' },
    ],
    pastWork: [
      { bountyTitle: 'TVL Dashboard Analytics', repo: 'SolFoundry/analytics', link: 'https://github.com/SolFoundry/analytics/pull/12', completedAt: '2024-12-08', result: 'success' },
    ],
    performanceHistory: [
      { month: 'Jul', successRate: 85, bountiesCompleted: 5 },
      { month: 'Aug', successRate: 86, bountiesCompleted: 6 },
      { month: 'Sep', successRate: 87, bountiesCompleted: 7 },
      { month: 'Oct', successRate: 89, bountiesCompleted: 8 },
      { month: 'Nov', successRate: 90, bountiesCompleted: 9 },
      { month: 'Dec', successRate: 88.3, bountiesCompleted: 8 },
    ],
    pricing: { model: 'hourly', amount: 0.1, currency: 'SOL' },
    registeredAt: '2024-09-01',
  },
  {
    id: 'agent-005',
    name: 'DeployBot',
    avatar: '/agents/deploybot.png',
    role: 'devops',
    status: 'offline',
    successRate: 92.1,
    bountiesCompleted: 34,
    description: 'Infrastructure and deployment automation agent. Handles CI/CD pipelines, cloud infrastructure, monitoring, and Solana validator operations.',
    capabilities: [
      { name: 'CI/CD Pipelines', level: 'expert' },
      { name: 'Docker/Kubernetes', level: 'expert' },
      { name: 'AWS/GCP', level: 'advanced' },
      { name: 'Monitoring/Alerting', level: 'advanced' },
      { name: 'Terraform', level: 'advanced' },
    ],
    pastWork: [
      { bountyTitle: 'Setup GitHub Actions CI', repo: 'SolFoundry/solfoundry', link: 'https://github.com/SolFoundry/solfoundry/pull/15', completedAt: '2024-11-20', result: 'success' },
    ],
    performanceHistory: [
      { month: 'Jul', successRate: 90, bountiesCompleted: 4 },
      { month: 'Aug', successRate: 91, bountiesCompleted: 5 },
      { month: 'Sep', successRate: 92, bountiesCompleted: 6 },
      { month: 'Oct', successRate: 93, bountiesCompleted: 7 },
      { month: 'Nov', successRate: 92, bountiesCompleted: 6 },
      { month: 'Dec', successRate: 92.1, bountiesCompleted: 6 },
    ],
    pricing: { model: 'flat', amount: 0.3, currency: 'SOL' },
    registeredAt: '2024-09-15',
  },
  {
    id: 'agent-006',
    name: 'OmniCoder',
    avatar: '/agents/omnicoder.png',
    role: 'fullstack',
    status: 'available',
    successRate: 89.7,
    bountiesCompleted: 71,
    description: 'Versatile full-stack agent capable of handling end-to-end feature development. From database schema to polished UI, delivers complete solutions.',
    capabilities: [
      { name: 'Next.js', level: 'expert' },
      { name: 'Node.js', level: 'expert' },
      { name: 'Solana Web3.js', level: 'advanced' },
      { name: 'PostgreSQL', level: 'advanced' },
      { name: 'Testing', level: 'advanced' },
    ],
    pastWork: [
      { bountyTitle: 'Bounty Submission Flow', repo: 'SolFoundry/solfoundry', link: 'https://github.com/SolFoundry/solfoundry/pull/35', completedAt: '2024-12-13', result: 'success' },
      { bountyTitle: 'User Profile Page', repo: 'SolFoundry/solfoundry', link: 'https://github.com/SolFoundry/solfoundry/pull/29', completedAt: '2024-12-02', result: 'success' },
      { bountyTitle: 'Notification System', repo: 'SolFoundry/solfoundry', link: 'https://github.com/SolFoundry/solfoundry/pull/24', completedAt: '2024-11-25', result: 'failure' },
    ],
    performanceHistory: [
      { month: 'Jul', successRate: 87, bountiesCompleted: 9 },
      { month: 'Aug', successRate: 88, bountiesCompleted: 10 },
      { month: 'Sep', successRate: 89, bountiesCompleted: 12 },
      { month: 'Oct', successRate: 91, bountiesCompleted: 13 },
      { month: 'Nov', successRate: 90, bountiesCompleted: 14 },
      { month: 'Dec', successRate: 89.7, bountiesCompleted: 13 },
    ],
    pricing: { model: 'per-bounty', amount: 0.6, currency: 'SOL' },
    registeredAt: '2024-07-01',
  },
];

export const MOCK_BOUNTIES = [
  { id: 'bounty-1', title: 'Implement Wallet Connect Flow', repo: 'SolFoundry/solfoundry', reward: '0.5 SOL' },
  { id: 'bounty-2', title: 'Add Token Price Feed Integration', repo: 'SolFoundry/price-oracle', reward: '0.8 SOL' },
  { id: 'bounty-3', title: 'Fix Transaction History Pagination', repo: 'SolFoundry/solfoundry', reward: '0.3 SOL' },
  { id: 'bounty-4', title: 'Audit Lending Protocol Contract', repo: 'SolFoundry/lending', reward: '2.0 SOL' },
  { id: 'bounty-5', title: 'Setup E2E Testing Framework', repo: 'SolFoundry/solfoundry', reward: '0.6 SOL' },
];

/**
 * Filter agents based on provided filter criteria.
 * Input: agents array + filters object
 * Output: filtered agents array (never mutates original)
 *
 * Logic validation (addressing past failure=logic):
 * - Empty roles array means "all roles" (no filter)
 * - Empty availability array means "all statuses" (no filter)
 * - minSuccessRate of 0 means no minimum
 * - searchQuery is case-insensitive, matches name or description
 */
export function filterAgents(agents: Agent[], filters: AgentFilters): Agent[] {
  return agents.filter((agent) => {
    // Role filter: if roles array is non-empty, agent.role must be included
    if (filters.roles.length > 0 && !filters.roles.includes(agent.role)) {
      return false;
    }

    // Success rate filter: agent must meet minimum
    if (filters.minSuccessRate > 0 && agent.successRate < filters.minSuccessRate) {
      return false;
    }

    // Availability filter: if availability array is non-empty, agent.status must be included
    if (filters.availability.length > 0 && !filters.availability.includes(agent.status)) {
      return false;
    }

    // Search query filter
    if (filters.searchQuery.trim() !== '') {
      const query = filters.searchQuery.toLowerCase().trim();
      const matchesName = agent.name.toLowerCase().includes(query);
      const matchesDescription = agent.description.toLowerCase().includes(query);
      const matchesRole = ROLE_LABELS[agent.role].toLowerCase().includes(query);
      if (!matchesName && !matchesDescription && !matchesRole) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sort agents by a given criterion.
 */
export type SortCriterion = 'successRate' | 'bountiesCompleted' | 'name' | 'pricing';
export type SortDirection = 'asc' | 'desc';

export function sortAgents(agents: Agent[], criterion: SortCriterion, direction: SortDirection): Agent[] {
  const sorted = [...agents];
  sorted.sort((a, b) => {
    let comparison = 0;
    switch (criterion) {
      case 'successRate':
        comparison = a.successRate - b.successRate;
        break;
      case 'bountiesCompleted':
        comparison = a.bountiesCompleted - b.bountiesCompleted;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'pricing':
        comparison = a.pricing.amount - b.pricing.amount;
        break;
      default:
        comparison = 0;
    }
    return direction === 'asc' ? comparison : -comparison;
  });
  return sorted;
}