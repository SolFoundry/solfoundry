/**
 * Tests for the ContributorClient resource module.
 *
 * Verifies that contributor CRUD, stats, and health methods
 * construct the correct HTTP requests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContributorClient } from '../contributors.js';
import type { HttpClient } from '../client.js';
import type {
  ContributorListResponse,
  ContributorResponse,
  StatsResponse,
  HealthResponse,
} from '../types.js';

/** Create a mock HttpClient. */
function createMockHttpClient(): HttpClient {
  return {
    request: vi.fn(),
    setAuthToken: vi.fn(),
    getAuthToken: vi.fn(),
  } as unknown as HttpClient;
}

/** Create a minimal contributor response fixture. */
function createContributorFixture(
  overrides?: Partial<ContributorResponse>,
): ContributorResponse {
  return {
    id: 'contrib-1',
    username: 'testdev',
    display_name: 'Test Developer',
    wallet_address: 'WalletAddress1234567890abcdefghij',
    skills: ['typescript', 'python'],
    badges: ['first-bounty'],
    reputation_score: 85,
    total_bounties_completed: 5,
    total_earned: 2500,
    tier_unlocked: 2,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ContributorClient', () => {
  let http: HttpClient;
  let client: ContributorClient;

  beforeEach(() => {
    http = createMockHttpClient();
    client = new ContributorClient(http);
  });

  describe('list', () => {
    it('should call GET /api/contributors with no params by default', async () => {
      const mockResponse: ContributorListResponse = {
        items: [],
        total: 0,
        skip: 0,
        limit: 20,
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await client.list();

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/contributors',
        method: 'GET',
        params: {
          search: undefined,
          skills: undefined,
          badges: undefined,
          skip: undefined,
          limit: undefined,
        },
      });
      expect(result.total).toBe(0);
    });

    it('should pass all filter options', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [],
        total: 0,
        skip: 0,
        limit: 10,
      });

      await client.list({
        search: 'dev',
        skills: 'python,fastapi',
        badges: 'first-bounty',
        skip: 10,
        limit: 10,
      });

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/contributors',
        method: 'GET',
        params: {
          search: 'dev',
          skills: 'python,fastapi',
          badges: 'first-bounty',
          skip: 10,
          limit: 10,
        },
      });
    });
  });

  describe('get', () => {
    it('should call GET /api/contributors/{id}', async () => {
      const fixture = createContributorFixture();
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(fixture);

      const result = await client.get('contrib-1');

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/contributors/contrib-1',
        method: 'GET',
      });
      expect(result.username).toBe('testdev');
      expect(result.reputation_score).toBe(85);
    });
  });

  describe('create', () => {
    it('should call POST /api/contributors with body and requiresAuth', async () => {
      const fixture = createContributorFixture();
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(fixture);

      const createData = {
        username: 'testdev',
        display_name: 'Test Developer',
        wallet_address: 'WalletAddress1234567890abcdefghij',
        skills: ['typescript', 'python'],
      };

      const result = await client.create(createData);

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/contributors',
        method: 'POST',
        body: createData,
        requiresAuth: true,
      });
      expect(result.id).toBe('contrib-1');
    });
  });

  describe('update', () => {
    it('should call PATCH /api/contributors/{id} with partial data', async () => {
      const fixture = createContributorFixture({ display_name: 'Updated Name' });
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(fixture);

      const result = await client.update('contrib-1', { display_name: 'Updated Name' });

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/contributors/contrib-1',
        method: 'PATCH',
        body: { display_name: 'Updated Name' },
        requiresAuth: true,
      });
      expect(result.display_name).toBe('Updated Name');
    });
  });

  describe('getStats', () => {
    it('should call GET /api/stats', async () => {
      const statsFixture: StatsResponse = {
        total_bounties_created: 100,
        total_bounties_completed: 50,
        total_bounties_open: 30,
        total_contributors: 200,
        total_fndry_paid: 5000000,
        total_prs_reviewed: 300,
        bounties_by_tier: {
          'tier-1': { open: 20, completed: 30 },
          'tier-2': { open: 8, completed: 15 },
          'tier-3': { open: 2, completed: 5 },
        },
        top_contributor: {
          username: 'topdev',
          bounties_completed: 15,
        },
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(statsFixture);

      const result = await client.getStats();

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/stats',
        method: 'GET',
      });
      expect(result.total_bounties_created).toBe(100);
      expect(result.top_contributor?.username).toBe('topdev');
    });

    it('should handle null top_contributor', async () => {
      const statsFixture: StatsResponse = {
        total_bounties_created: 0,
        total_bounties_completed: 0,
        total_bounties_open: 0,
        total_contributors: 0,
        total_fndry_paid: 0,
        total_prs_reviewed: 0,
        bounties_by_tier: {},
        top_contributor: null,
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(statsFixture);

      const result = await client.getStats();
      expect(result.top_contributor).toBeNull();
    });
  });

  describe('getHealth', () => {
    it('should call GET /health', async () => {
      const healthFixture: HealthResponse = {
        status: 'healthy',
        version: '1.0.0',
        uptime_seconds: 3600,
        timestamp: '2026-03-22T12:00:00Z',
        services: {
          database: 'connected',
          redis: 'connected',
        },
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(healthFixture);

      const result = await client.getHealth();

      expect(http.request).toHaveBeenCalledWith({
        path: '/health',
        method: 'GET',
      });
      expect(result.status).toBe('healthy');
      expect(result.services.database).toBe('connected');
    });

    it('should report degraded status', async () => {
      const healthFixture: HealthResponse = {
        status: 'degraded',
        version: '1.0.0',
        uptime_seconds: 100,
        timestamp: '2026-03-22T12:00:00Z',
        services: {
          database: 'connected',
          redis: 'disconnected',
        },
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(healthFixture);

      const result = await client.getHealth();
      expect(result.status).toBe('degraded');
      expect(result.services.redis).toBe('disconnected');
    });
  });
});
