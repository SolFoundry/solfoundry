import type { Bounty } from '../types/bounty';
const d = (o: number) => new Date(Date.now() + o * 864e5).toISOString();
export const mockBounties: Bounty[] = [
  { id: 'b-1', title: 'Fix escrow token transfer edge case', description: 'Panics on closed account.', tier: 'T1', skills: ['Rust', 'Anchor', 'Solana'], rewardAmount: 350, currency: 'USDC', deadline: d(2), status: 'open', submissionCount: 2, createdAt: d(-1), projectName: 'SolFoundry' },
  { id: 'b-2', title: 'Build staking dashboard', description: 'Staking UI.', tier: 'T2', skills: ['React', 'TypeScript'], rewardAmount: 3500, currency: 'USDC', deadline: d(7), status: 'open', submissionCount: 5, createdAt: d(-3), projectName: 'StakePro' },
  { id: 'b-3', title: 'Security audit lending v2', description: 'Audit v2.', tier: 'T3', skills: ['Rust'], rewardAmount: 15000, currency: 'USDC', deadline: d(21), status: 'open', submissionCount: 1, createdAt: d(-5), projectName: 'LendSol' },
  { id: 'b-4', title: 'Price feed indexer', description: 'Indexer.', tier: 'T2', skills: ['Rust', 'Node.js'], rewardAmount: 4500, currency: 'USDC', deadline: d(10), status: 'in-progress', submissionCount: 3, createdAt: d(-7), projectName: 'PriceSol' },
  { id: 'b-5', title: 'API docs', description: 'OpenAPI.', tier: 'T1', skills: ['TypeScript'], rewardAmount: 200, currency: 'USDC', deadline: d(3), status: 'completed', submissionCount: 4, createdAt: d(-10), projectName: 'SolFoundry' },
];
