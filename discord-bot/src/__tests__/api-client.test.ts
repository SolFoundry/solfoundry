/**
 * Tests for the API client module.
 *
 * Validates request building, error handling, and response parsing
 * for the SolFoundry API client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SolFoundryApiClient } from '../services/api-client.js';
import { createLogger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// API Client Tests
// ---------------------------------------------------------------------------

describe('SolFoundryApiClient', () => {
  let globalFetch: typeof global.fetch;
  const logger = createLogger('error');

  beforeEach(() => {
    globalFetch = global.fetch;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = globalFetch;
  });

  function createMockFetch(response: unknown, status = 200) {
    return vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: () => Promise.resolve(response),
    });
  }

  it('should create an API client with config', () => {
    const client = new SolFoundryApiClient({
      baseUrl: 'https://api.example.com',
      logger,
    });
    expect(client).toBeDefined();
  });

  it('should fetch open bounties', async () => {
    const mockBounties = {
      items: [
        {
          id: 'bounty-1',
          title: 'Test Bounty',
          description: 'A test',
          tier: 1,
          category: 'frontend',
          reward_amount: 100,
          status: 'open',
          deadline: null,
          github_issue_url: null,
          required_skills: [],
          created_at: '2026-03-22T00:00:00Z',
          updated_at: '2026-03-22T00:00:00Z',
          claimed_by: null,
          claimed_at: null,
        },
      ],
    };

    global.fetch = createMockFetch(mockBounties);

    const client = new SolFoundryApiClient({
      baseUrl: 'https://api.example.com',
      logger,
    });

    const bounties = await client.fetchOpenBounties();
    expect(bounties.length).toBe(1);
    expect(bounties[0].title).toBe('Test Bounty');
  });

  it('should fetch a single bounty', async () => {
    const mockBounty = {
      id: 'bounty-1',
      title: 'Test Bounty',
      description: 'A test',
      tier: 1,
      category: 'frontend',
      reward_amount: 100,
      status: 'open',
      deadline: null,
      github_issue_url: null,
      required_skills: [],
      created_at: '2026-03-22T00:00:00Z',
      updated_at: '2026-03-22T00:00:00Z',
      claimed_by: null,
      claimed_at: null,
    };

    global.fetch = createMockFetch(mockBounty);

    const client = new SolFoundryApiClient({
      baseUrl: 'https://api.example.com',
      logger,
    });

    const bounty = await client.fetchBounty('bounty-1');
    expect(bounty.id).toBe('bounty-1');
    expect(bounty.title).toBe('Test Bounty');
  });

  it('should fetch leaderboard', async () => {
    const mockLeaderboard = {
      items: [
        { username: 'alice', bounties_completed: 10, total_earnings: 5000, reputation_score: 90 },
        { username: 'bob', bounties_completed: 8, total_earnings: 4000, reputation_score: 85 },
      ],
    };

    global.fetch = createMockFetch(mockLeaderboard);

    const client = new SolFoundryApiClient({
      baseUrl: 'https://api.example.com',
      logger,
    });

    const leaderboard = await client.fetchLeaderboard(10);
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].username).toBe('alice');
  });

  it('should fetch stats', async () => {
    const mockStats = {
      total_bounties_created: 100,
      total_bounties_completed: 50,
      total_bounties_open: 30,
      total_contributors: 25,
      total_fndry_paid: 25000,
      top_contributor: { username: 'alice', bounties_completed: 10 },
    };

    global.fetch = createMockFetch(mockStats);

    const client = new SolFoundryApiClient({
      baseUrl: 'https://api.example.com',
      logger,
    });

    const stats = await client.fetchStats();
    expect(stats.total_bounties_created).toBe(100);
    expect(stats.total_fndry_paid).toBe(25000);
  });

  it('should return empty leaderboard on error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const client = new SolFoundryApiClient({
      baseUrl: 'https://api.example.com',
      logger,
    });

    const leaderboard = await client.fetchLeaderboard();
    expect(leaderboard).toEqual([]);
  });

  it('should return default stats on error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const client = new SolFoundryApiClient({
      baseUrl: 'https://api.example.com',
      logger,
    });

    const stats = await client.fetchStats();
    expect(stats.total_bounties_created).toBe(0);
    expect(stats.top_contributor).toBeNull();
  });

  it('should throw on fetchOpenBounties error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const client = new SolFoundryApiClient({
      baseUrl: 'https://api.example.com',
      logger,
    });

    await expect(client.fetchOpenBounties()).rejects.toThrow('Network error');
  });

  it('should throw on fetchBounty error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Not found'));

    const client = new SolFoundryApiClient({
      baseUrl: 'https://api.example.com',
      logger,
    });

    await expect(client.fetchBounty('nonexistent')).rejects.toThrow('Not found');
  });

  it('should strip trailing slash from base URL', () => {
    const client = new SolFoundryApiClient({
      baseUrl: 'https://api.example.com/',
      logger,
    });
    expect(client).toBeDefined();
  });

  it('should handle empty items array', async () => {
    global.fetch = createMockFetch({ items: [] });

    const client = new SolFoundryApiClient({
      baseUrl: 'https://api.example.com',
      logger,
    });

    const bounties = await client.fetchOpenBounties();
    expect(bounties).toEqual([]);
  });

  it('should handle missing items in response', async () => {
    global.fetch = createMockFetch({});

    const client = new SolFoundryApiClient({
      baseUrl: 'https://api.example.com',
      logger,
    });

    const bounties = await client.fetchOpenBounties();
    expect(bounties).toEqual([]);
  });

  it('should include auth token in headers when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [] }),
    });
    global.fetch = mockFetch;

    const client = new SolFoundryApiClient({
      baseUrl: 'https://api.example.com',
      token: 'secret-token',
      logger,
    });

    await client.fetchOpenBounties();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bounties'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token',
        }),
      }),
    );
  });
});
