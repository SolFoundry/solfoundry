/** Marketplace types/data tests (Issue #188). */
import { describe, it, expect } from 'vitest';
import type { Bounty, CreatorType } from '../types/bounty';
import { SORT_OPTIONS, DEFAULT_FILTERS } from '../types/bounty';
import { mockBounties } from '../data/mockBounties';

describe('Marketplace Types', () => {
  it('Bounty includes creatorType', () => {
    const b: Bounty = {
      id: '1', title: 'T', description: '', tier: 'T1', skills: [],
      rewardAmount: 1000, currency: '$FNDRY', deadline: new Date().toISOString(),
      status: 'open', submissionCount: 0, createdAt: new Date().toISOString(),
      projectName: 'P', creatorType: 'community',
    };
    expect(b.creatorType).toBe('community');
  });

  it('CreatorType values', () => {
    const p: CreatorType = 'platform';
    const c: CreatorType = 'community';
    expect(p).toBe('platform');
    expect(c).toBe('community');
  });

  it('fewest submissions sort option exists', () => {
    expect(SORT_OPTIONS.find(o => o.value === 'submissions_low')).toBeDefined();
  });

  it('default creatorType filter is all', () => {
    expect(DEFAULT_FILTERS.creatorType).toBe('all');
  });

  it('mock bounties have creatorType', () => {
    for (const b of mockBounties) {
      expect(['platform', 'community']).toContain(b.creatorType);
    }
  });

  it('mock bounties include both types', () => {
    const types = new Set(mockBounties.map(b => b.creatorType));
    expect(types.has('platform')).toBe(true);
    expect(types.has('community')).toBe(true);
  });
});
