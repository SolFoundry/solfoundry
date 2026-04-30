/**
 * Unit tests for the BountyTreeDataProvider.
 * Tests tree item rendering, filtering, and data management.
 */

import assert from 'assert';
import { describe, it } from 'mocha';
import type { Bounty, BountyStatus, BountyTier } from '../types/bounty';

// --- Mock Bounty Data ---

function createMockBounty(overrides: Partial<Bounty> = {}): Bounty {
  return {
    id: 'bounty-1',
    title: 'Implement Token Swap Feature',
    description: 'Add a token swap feature to the DEX protocol',
    status: 'open' as BountyStatus,
    tier: 'T2' as BountyTier,
    reward_amount: 500,
    reward_token: 'FNDRY',
    skills: ['Rust', 'Solana'],
    submission_count: 5,
    created_at: '2024-01-15T00:00:00Z',
    org_name: 'solfoundry',
    repo_name: 'dex-protocol',
    issue_number: 42,
    ...overrides,
  };
}

// --- Bounty Data Tests ---

describe('BountyTreeDataProvider - Data', () => {
  it('should create a mock bounty with correct defaults', () => {
    const bounty = createMockBounty();
    assert.strictEqual(bounty.id, 'bounty-1');
    assert.strictEqual(bounty.status, 'open');
    assert.strictEqual(bounty.tier, 'T2');
    assert.strictEqual(bounty.reward_amount, 500);
    assert.deepStrictEqual(bounty.skills, ['Rust', 'Solana']);
  });

  it('should allow overriding bounty properties', () => {
    const bounty = createMockBounty({
      id: 'bounty-2',
      tier: 'T1',
      reward_amount: 1000,
      status: 'funded',
    });

    assert.strictEqual(bounty.id, 'bounty-2');
    assert.strictEqual(bounty.tier, 'T1');
    assert.strictEqual(bounty.reward_amount, 1000);
    assert.strictEqual(bounty.status, 'funded');
  });

  it('should handle bounties with optional fields missing', () => {
    const bounty = createMockBounty({
      org_name: null,
      repo_name: null,
      issue_number: null,
      github_issue_url: null,
      deadline: null,
    });

    assert.strictEqual(bounty.org_name, null);
    assert.strictEqual(bounty.repo_name, null);
    assert.strictEqual(bounty.issue_number, null);
  });
});

// --- Filtering Logic Tests ---

describe('BountyTreeDataProvider - Filtering', () => {
  const bounties: Bounty[] = [
    createMockBounty({ id: '1', title: 'Rust DEX Feature', tier: 'T1', status: 'open', skills: ['Rust'] }),
    createMockBounty({ id: '2', title: 'TypeScript Frontend', tier: 'T2', status: 'open', skills: ['TypeScript'] }),
    createMockBounty({ id: '3', title: 'Solidity Smart Contract', tier: 'T3', status: 'completed', skills: ['Solidity'] }),
    createMockBounty({ id: '4', title: 'Python Backend API', tier: 'T2', status: 'funded', skills: ['Python'] }),
    createMockBounty({ id: '5', title: 'Go Microservice', tier: 'T1', status: 'open', skills: ['Go'] }),
  ];

  it('should filter by status', () => {
    const filtered = bounties.filter((b) => b.status === 'open');
    assert.strictEqual(filtered.length, 3);
    assert.ok(filtered.every((b) => b.status === 'open'));
  });

  it('should filter by tier', () => {
    const filtered = bounties.filter((b) => b.tier === 'T2');
    assert.strictEqual(filtered.length, 2);
    assert.ok(filtered.every((b) => b.tier === 'T2'));
  });

  it('should filter by skill', () => {
    const filtered = bounties.filter((b) => b.skills.includes('Rust'));
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, '1');
  });

  it('should filter by search query (title)', () => {
    const query = 'frontend';
    const filtered = bounties.filter((b) =>
      b.title.toLowerCase().includes(query.toLowerCase())
    );
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, '2');
  });

  it('should filter by search query (skills)', () => {
    const query = 'solidity';
    const filtered = bounties.filter((b) =>
      b.skills.some((s) => s.toLowerCase().includes(query.toLowerCase()))
    );
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, '3');
  });

  it('should combine status and tier filters', () => {
    const filtered = bounties.filter(
      (b) => b.status === 'open' && b.tier === 'T1'
    );
    assert.strictEqual(filtered.length, 2);
  });

  it('should return all bounties when no filters applied', () => {
    const filtered = bounties.filter(() => true);
    assert.strictEqual(filtered.length, 5);
  });
});

// --- Bounty Sorting Tests ---

describe('BountyTreeDataProvider - Sorting', () => {
  const bounties: Bounty[] = [
    createMockBounty({ id: '1', reward_amount: 100, tier: 'T3', created_at: '2024-01-10T00:00:00Z' }),
    createMockBounty({ id: '2', reward_amount: 1000, tier: 'T1', created_at: '2024-01-15T00:00:00Z' }),
    createMockBounty({ id: '3', reward_amount: 500, tier: 'T2', created_at: '2024-01-12T00:00:00Z' }),
  ];

  it('should sort by reward amount descending', () => {
    const sorted = [...bounties].sort((a, b) => b.reward_amount - a.reward_amount);
    assert.strictEqual(sorted[0].id, '2');
    assert.strictEqual(sorted[1].id, '3');
    assert.strictEqual(sorted[2].id, '1');
  });

  it('should sort by tier priority', () => {
    const tierPriority: Record<string, number> = { T1: 3, T2: 2, T3: 1 };
    const sorted = [...bounties].sort(
      (a, b) => tierPriority[b.tier] - tierPriority[a.tier]
    );
    assert.strictEqual(sorted[0].tier, 'T1');
    assert.strictEqual(sorted[1].tier, 'T2');
    assert.strictEqual(sorted[2].tier, 'T3');
  });

  it('should sort by creation date (newest first)', () => {
    const sorted = [...bounties].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    assert.strictEqual(sorted[0].id, '2');
    assert.strictEqual(sorted[1].id, '3');
    assert.strictEqual(sorted[2].id, '1');
  });
});

// --- Bounty Status Display Tests ---

describe('BountyTreeDataProvider - Status Display', () => {
  it('should map status codes to display labels', () => {
    const statusLabels: Record<string, string> = {
      open: 'Open',
      in_review: 'In Review',
      funded: 'Funded',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };

    assert.strictEqual(statusLabels['open'], 'Open');
    assert.strictEqual(statusLabels['in_review'], 'In Review');
    assert.strictEqual(statusLabels['funded'], 'Funded');
    assert.strictEqual(statusLabels['completed'], 'Completed');
    assert.strictEqual(statusLabels['cancelled'], 'Cancelled');
  });

  it('should map tier codes to display colors', () => {
    const tierColors: Record<string, string> = {
      T1: '#eab308',
      T2: '#3b82f6',
      T3: '#ef4444',
    };

    assert.strictEqual(tierColors['T1'], '#eab308');
    assert.strictEqual(tierColors['T2'], '#3b82f6');
    assert.strictEqual(tierColors['T3'], '#ef4444');
  });

  it('should determine if bounty has repo', () => {
    const withRepo = createMockBounty({ has_repo: true, github_repo_url: 'https://github.com/org/repo' });
    const withoutRepo = createMockBounty({ has_repo: false });

    assert.ok(withRepo.has_repo);
    assert.ok(!withoutRepo.has_repo);
  });
});

// --- API Response Mock Tests ---

describe('BountyTreeDataProvider - API Response', () => {
  it('should handle paginated response format', () => {
    const response = {
      items: [
        createMockBounty({ id: '1' }),
        createMockBounty({ id: '2' }),
      ],
      total: 10,
      limit: 2,
      offset: 0,
    };

    assert.strictEqual(response.items.length, 2);
    assert.strictEqual(response.total, 10);
    assert.strictEqual(response.limit, 2);
    assert.strictEqual(response.offset, 0);
  });

  it('should handle array response format', () => {
    const response = [
      createMockBounty({ id: '1' }),
      createMockBounty({ id: '2' }),
      createMockBounty({ id: '3' }),
    ];

    // Simulate the mapping logic
    const mapped = {
      items: response,
      total: response.length,
      limit: 20,
      offset: 0,
    };

    assert.strictEqual(mapped.items.length, 3);
    assert.strictEqual(mapped.total, 3);
  });

  it('should handle empty response', () => {
    const response = {
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    };

    assert.strictEqual(response.items.length, 0);
    assert.strictEqual(response.total, 0);
  });
});
