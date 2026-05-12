/**
 * Tests for LeaderboardClient.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LeaderboardClient } from '../leaderboard.js';
import type { HttpClient } from '../client.js';

function createMockHttpClient(): HttpClient {
  return {
    request: vi.fn(),
    setAuthToken: vi.fn(),
    getAuthToken: vi.fn(),
  } as unknown as HttpClient;
}

describe('LeaderboardClient', () => {
  let client: LeaderboardClient;
  let http: HttpClient;

  beforeEach(() => {
    http = createMockHttpClient();
    client = new LeaderboardClient(http);
  });

  describe('getLeaderboard', () => {
    it('should return an array of leaderboard entries', async () => {
      const mockEntries = [
        { rank: 1, username: 'alice', points: 500, bountiesCompleted: 10, earningsFndry: 500000, earningsSol: 0, topSkills: ['react'], reputation: 500, stakedFndry: 0, reputationBoost: 0 },
        { rank: 2, username: 'bob', points: 300, bountiesCompleted: 6, earningsFndry: 300000, earningsSol: 0, topSkills: ['python'], reputation: 300, stakedFndry: 0, reputationBoost: 0 },
      ];
      vi.mocked(http.request).mockResolvedValue(mockEntries);

      const result = await client.getLeaderboard('7d');

      expect(result).toEqual(mockEntries);
      expect(http.request).toHaveBeenCalledWith({
        path: '/api/leaderboard',
        method: 'GET',
        params: { period: '7d' },
      });
    });

    it('should handle paginated response shape', async () => {
      const mockResponse = {
        items: [
          { rank: 1, username: 'alice', points: 500, bountiesCompleted: 10, earningsFndry: 500000, earningsSol: 0, topSkills: [], reputation: 500, stakedFndry: 0, reputationBoost: 0 },
        ],
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const result = await client.getLeaderboard();

      expect(result).toEqual(mockResponse.items);
      expect(http.request).toHaveBeenCalledWith({
        path: '/api/leaderboard',
        method: 'GET',
        params: {},
      });
    });

    it('should omit period param when "all"', async () => {
      vi.mocked(http.request).mockResolvedValue([]);

      await client.getLeaderboard('all');

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/leaderboard',
        method: 'GET',
        params: {},
      });
    });
  });

  describe('getStats', () => {
    it('should return normalized platform stats', async () => {
      const mockStats = {
        open_bounties: 42,
        total_paid_usdc: 15000,
        total_contributors: 200,
        total_bounties: 500,
      };
      vi.mocked(http.request).mockResolvedValue(mockStats);

      const result = await client.getStats();

      expect(result).toEqual(mockStats);
      expect(http.request).toHaveBeenCalledWith({
        path: '/api/stats',
        method: 'GET',
      });
    });

    it('should normalize alternative field names', async () => {
      const mockStats = {
        active_bounties: 10,
        total_rewards_paid: 5000,
        contributors: 50,
        total_bounties: 100,
      };
      vi.mocked(http.request).mockResolvedValue(mockStats);

      const result = await client.getStats();

      expect(result).toEqual({
        open_bounties: 10,
        total_paid_usdc: 5000,
        total_contributors: 50,
        total_bounties: 100,
      });
    });

    it('should default to zeros for missing fields', async () => {
      vi.mocked(http.request).mockResolvedValue({});

      const result = await client.getStats();

      expect(result).toEqual({
        open_bounties: 0,
        total_paid_usdc: 0,
        total_contributors: 0,
        total_bounties: 0,
      });
    });
  });
});
