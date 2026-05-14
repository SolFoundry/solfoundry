import { describe, expect, it } from 'vitest';
import { matchesBountySearch } from '../components/bounty/BountyGrid';

const bounty = {
  title: 'Add wallet connect flow',
  description: 'Build a React onboarding experience for Solana users',
  category: 'frontend',
  org_name: 'SolFoundry',
  repo_name: 'client',
  skills: ['TypeScript', 'React'],
};

describe('matchesBountySearch', () => {
  it('matches title, description, tags, and repo metadata', () => {
    expect(matchesBountySearch(bounty, 'wallet')).toBe(true);
    expect(matchesBountySearch(bounty, 'onboarding')).toBe(true);
    expect(matchesBountySearch(bounty, 'typescript')).toBe(true);
    expect(matchesBountySearch(bounty, 'client')).toBe(true);
  });

  it('is case-insensitive and treats empty search as a match', () => {
    expect(matchesBountySearch(bounty, 'REACT')).toBe(true);
    expect(matchesBountySearch(bounty, '   ')).toBe(true);
  });

  it('rejects unrelated search terms', () => {
    expect(matchesBountySearch(bounty, 'python')).toBe(false);
  });
});
