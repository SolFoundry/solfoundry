/**
 * Bounty Poster Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BountyPoster, BountyData } from '../src/bounty-poster';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BountyPoster', () => {
  let poster: BountyPoster;

  beforeEach(() => {
    poster = new BountyPoster('https://api.solfoundry.io', 'test-api-key');
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const sampleBounty: BountyData = {
    title: 'Test Bounty',
    description: 'Test description',
    tier: 2,
    reward_amount: 500000,
    source_repo: 'test/repo',
    source_issue: 42,
    labels: ['bounty', 'tier-2'],
    html_url: 'https://github.com/test/repo/issues/42',
  };

  describe('post', () => {
    it('should post bounty successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'bounty-123', url: 'https://solfoundry.io/bounties/123' }),
      });

      const result = await poster.post(sampleBounty);

      expect(result.success).toBe(true);
      expect(result.bountyId).toBe('bounty-123');
      expect(result.bountyUrl).toBe('https://solfoundry.io/bounties/123');

      // Verify fetch was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.solfoundry.io/api/bounties',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key',
            'X-Action-Source': 'solfoundry-github-action',
          }),
        })
      );
    });

    it('should include source attribution in description', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'bounty-123' }),
      });

      await poster.post(sampleBounty);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.description).toContain('GitHub issue #42');
      expect(body.description).toContain('test/repo');
      expect(body.description).toContain('https://github.com/test/repo/issues/42');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const result = await poster.post(sampleBounty);

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 401');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await poster.post(sampleBounty);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should strip trailing slash from base URL', async () => {
      const posterWithSlash = new BountyPoster('https://api.solfoundry.io/', 'test-key');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'bounty-123' }),
      });

      await posterWithSlash.post(sampleBounty);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('https://api.solfoundry.io/api/bounties');
    });

    it('should map tier correctly in payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'bounty-123' }),
      });

      await poster.post({ ...sampleBounty, tier: 3 });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.tier).toBe(3);
    });

    it('should include metadata in payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'bounty-123' }),
      });

      await poster.post(sampleBounty);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.metadata).toEqual({
        source_repo: 'test/repo',
        source_issue: 42,
        source_url: 'https://github.com/test/repo/issues/42',
        source_type: 'github_issue',
      });
    });
  });

  describe('verify', () => {
    it('should return true for healthy API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await poster.verify();
      expect(result).toBe(true);
    });

    it('should return false for unhealthy API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await poster.verify();
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await poster.verify();
      expect(result).toBe(false);
    });
  });
});
