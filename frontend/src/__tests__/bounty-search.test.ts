import { describe, expect, it } from 'vitest';
import { filterBountiesBySearch } from '../components/bounty/BountyGrid';
import type { Bounty } from '../types/bounty';

const baseBounty: Bounty = {
  id: 'b1',
  title: 'Build TypeScript SDK',
  description: 'Create client helpers for submissions',
  status: 'open',
  tier: 'T2',
  reward_amount: 400_000,
  reward_token: 'FNDRY',
  org_name: 'SolFoundry',
  repo_name: 'solfoundry',
  category: 'frontend',
  skills: ['TypeScript', 'React'],
  submission_count: 0,
  created_at: '2026-05-03T00:00:00Z',
};

const bounties: Bounty[] = [
  baseBounty,
  {
    ...baseBounty,
    id: 'b2',
    title: 'Rust escrow program',
    description: 'Anchor PDA setup',
    tier: 'T3',
    skills: ['Rust', 'Solana'],
    repo_name: 'escrow-program',
  },
];

describe('filterBountiesBySearch', () => {
  it('returns all bounties for an empty query', () => {
    expect(filterBountiesBySearch(bounties, '')).toHaveLength(2);
  });

  it('matches title, skills, repo, and tier case-insensitively', () => {
    expect(filterBountiesBySearch(bounties, 'typescript')).toEqual([bounties[0]]);
    expect(filterBountiesBySearch(bounties, 'ESCROW')).toEqual([bounties[1]]);
    expect(filterBountiesBySearch(bounties, 't3')).toEqual([bounties[1]]);
  });

  it('returns no results when nothing matches', () => {
    expect(filterBountiesBySearch(bounties, 'design')).toEqual([]);
  });
});
