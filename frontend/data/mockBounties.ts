export interface Bounty {
  id: string;
  title: string;
  description: string;
  tier: 'T1' | 'T2' | 'T3';
  status: 'open' | 'in-progress' | 'completed';
  reward: number;
  deadline: number;
  createdAt: number;
  skills: string[];
  submissions: number;
}

export const mockBounties: Bounty[] = [
  {
    id: 'bounty-1',
    title: 'Solana Wallet Connect Component',
    description: 'Build a Solana wallet connection component using @solana/web3.js with Phantom and Backpack support.',
    tier: 'T1',
    status: 'open',
    reward: 500,
    deadline: Date.now() + 72 * 60 * 60 * 1000,
    createdAt: Date.now() - 2 * 60 * 60 * 1000,
    skills: ['React', 'TypeScript', 'Solana'],
    submissions: 3
  },
  {
    id: 'bounty-2',
    title: 'REST API — Bounty CRUD Endpoints',
    description: 'Implement REST API endpoints for creating, reading, updating, and deleting bounties.',
    tier: 'T1',
    status: 'open',
    reward: 300,
    deadline: Date.now() + 48 * 60 * 60 * 1000,
    createdAt: Date.now() - 5 * 60 * 60 * 1000,
    skills: ['Node.js', 'TypeScript'],
    submissions: 2
  },
  {
    id: 'bounty-3',
    title: 'GitHub Webhook Receiver',
    description: 'Build a webhook receiver to handle GitHub events and trigger bounty workflows.',
    tier: 'T1',
    status: 'open',
    reward: 400,
    deadline: Date.now() + 60 * 60 * 60 * 1000,
    createdAt: Date.now() - 1 * 60 * 60 * 1000,
    skills: ['Node.js', 'TypeScript'],
    submissions: 1
  },
  {
    id: 'bounty-4',
    title: 'Real-time WebSocket Server',
    description: 'Implement a WebSocket server for real-time bounty updates and notifications.',
    tier: 'T2',
    status: 'open',
    reward: 2000,
    deadline: Date.now() + 120 * 60 * 60 * 1000,
    createdAt: Date.now() - 8 * 60 * 60 * 1000,
    skills: ['Node.js', 'TypeScript', 'Python'],
    submissions: 5
  },
  {
    id: 'bounty-5',
    title: 'Bounty Creation Wizard',
    description: 'Build a multi-step wizard for creating new bounties with validation and preview.',
    tier: 'T2',
    status: 'in-progress',
    reward: 1500,
    deadline: Date.now() + 96 * 60 * 60 * 1000,
    createdAt: Date.now() - 12 * 60 * 60 * 1000,
    skills: ['React', 'Next.js', 'TypeScript'],
    submissions: 2
  },
  {
    id: 'bounty-6',
    title: 'Contributor Dashboard',
    description: 'Build a comprehensive dashboard showing contributor stats, earnings, and activity.',
    tier: 'T2',
    status: 'open',
    reward: 3000,
    deadline: Date.now() + 168 * 60 * 60 * 1000,
    createdAt: Date.now() - 24 * 60 * 60 * 1000,
    skills: ['React', 'Next.js', 'TypeScript'],
    submissions: 4
  },
  {
    id: 'bounty-7',
    title: 'Tokenomics Page',
    description: 'Create a page displaying FNDRY token information, distribution, and economics.',
    tier: 'T1',
    status: 'open',
    reward: 250,
    deadline: Date.now() + 36 * 60 * 60 * 1000,
    createdAt: Date.now() - 3 * 60 * 60 * 1000,
    skills: ['React', 'Next.js'],
    submissions: 1
  },
  {
    id: 'bounty-8',
    title: 'PR Status Tracker Component',
    description: 'Build a component to display real-time PR status with CI/CD integration.',
    tier: 'T1',
    status: 'open',
    reward: 350,
    deadline: Date.now() + 48 * 60 * 60 * 1000,
    createdAt: Date.now() - 6 * 60 * 60 * 1000,
    skills: ['React', 'TypeScript'],
    submissions: 2
  }
];