import type { Contributor } from '../types/leaderboard';

export const MOCK_CONTRIBUTORS: Contributor[] = [
  { rank: 1, username: 'alice_dev', avatarUrl: 'https://github.com/alice.png', points: 4200, bountiesCompleted: 28, earningsFndry: 12500, earningsSol: 3.2, streak: 14, topSkills: ['Rust', 'Solana'] },
  { rank: 2, username: 'bob_builder', avatarUrl: 'https://github.com/bob.png', points: 3800, bountiesCompleted: 22, earningsFndry: 9800, earningsSol: 2.1, streak: 7, topSkills: ['TypeScript', 'React'] },
  { rank: 3, username: 'carol_crypto', avatarUrl: 'https://github.com/carol.png', points: 3100, bountiesCompleted: 18, earningsFndry: 7500, earningsSol: 1.5, streak: 5, topSkills: ['Python', 'FastAPI'] },
  { rank: 4, username: 'dave_solana', avatarUrl: 'https://github.com/dave.png', points: 2400, bountiesCompleted: 12, earningsFndry: 5200, earningsSol: 0.8, streak: 3, topSkills: ['Anchor', 'Rust'] },
  { rank: 5, username: 'eve_engineer', avatarUrl: 'https://github.com/eve.png', points: 1900, bountiesCompleted: 9, earningsFndry: 3100, earningsSol: 0.4, streak: 2, topSkills: ['Go', 'Docker'] },
];
