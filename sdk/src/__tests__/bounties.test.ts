/**
 * Tests for the BountyClient resource module.
 *
 * Verifies that each method constructs the correct HTTP request
 * (path, method, params, body) and delegates to the HttpClient.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BountyClient } from '../bounties.js';
import type { HttpClient } from '../client.js';
import type {
  BountyListResponse,
  BountyResponse,
  BountySearchResponse,
  SubmissionResponse,
  AutocompleteResponse,
} from '../types.js';
import { BountyStatus, BountyTier, SubmissionStatus } from '../types.js';

/** Create a mock HttpClient with a vi.fn() for request. */
function createMockHttpClient(): HttpClient {
  return {
    request: vi.fn(),
    setAuthToken: vi.fn(),
    getAuthToken: vi.fn(),
  } as unknown as HttpClient;
}

/** Create a minimal bounty response fixture. */
function createBountyFixture(overrides?: Partial<BountyResponse>): BountyResponse {
  return {
    id: 'bounty-123',
    title: 'Test Bounty',
    description: 'A test bounty',
    tier: BountyTier.T2,
    category: 'backend',
    reward_amount: 500,
    status: BountyStatus.OPEN,
    creator_type: 'platform',
    github_issue_url: null,
    required_skills: ['typescript'],
    deadline: null,
    created_by: 'user-1',
    created_at: '2026-03-22T00:00:00Z',
    updated_at: '2026-03-22T00:00:00Z',
    github_issue_number: null,
    github_repo: null,
    winner_submission_id: null,
    winner_wallet: null,
    payout_tx_hash: null,
    payout_at: null,
    claimed_by: null,
    claimed_at: null,
    claim_deadline: null,
    submissions: [],
    submission_count: 0,
    ...overrides,
  };
}

describe('BountyClient', () => {
  let http: HttpClient;
  let client: BountyClient;

  beforeEach(() => {
    http = createMockHttpClient();
    client = new BountyClient(http);
  });

  describe('list', () => {
    it('should call GET /api/bounties with no params by default', async () => {
      const mockResponse: BountyListResponse = {
        items: [],
        total: 0,
        skip: 0,
        limit: 20,
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await client.list();

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties',
        method: 'GET',
        params: {
          status: undefined,
          tier: undefined,
          skip: undefined,
          limit: undefined,
        },
      });
      expect(result).toEqual(mockResponse);
    });

    it('should pass filter options as query params', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [],
        total: 0,
        skip: 0,
        limit: 10,
      });

      await client.list({ status: 'open', tier: 2, skip: 0, limit: 10 });

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties',
        method: 'GET',
        params: { status: 'open', tier: 2, skip: 0, limit: 10 },
      });
    });
  });

  describe('get', () => {
    it('should call GET /api/bounties/{id}', async () => {
      const fixture = createBountyFixture();
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(fixture);

      const result = await client.get('bounty-123');

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/bounty-123',
        method: 'GET',
      });
      expect(result.id).toBe('bounty-123');
    });
  });

  describe('create', () => {
    it('should call POST /api/bounties with body and requiresAuth', async () => {
      const fixture = createBountyFixture();
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(fixture);

      const createData = {
        title: 'New Bounty',
        reward_amount: 1000,
        tier: BountyTier.T2,
      };

      const result = await client.create(createData);

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties',
        method: 'POST',
        body: createData,
        requiresAuth: true,
      });
      expect(result).toEqual(fixture);
    });
  });

  describe('update', () => {
    it('should call PATCH /api/bounties/{id} with body and requiresAuth', async () => {
      const fixture = createBountyFixture({ title: 'Updated Title' });
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(fixture);

      const result = await client.update('bounty-123', { title: 'Updated Title' });

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/bounty-123',
        method: 'PATCH',
        body: { title: 'Updated Title' },
        requiresAuth: true,
      });
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('delete', () => {
    it('should call DELETE /api/bounties/{id} with requiresAuth', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await client.delete('bounty-123');

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/bounty-123',
        method: 'DELETE',
        requiresAuth: true,
      });
    });
  });

  describe('submitSolution', () => {
    it('should call POST /api/bounties/{id}/submissions', async () => {
      const submissionFixture: SubmissionResponse = {
        id: 'sub-1',
        bounty_id: 'bounty-123',
        pr_url: 'https://github.com/SolFoundry/solfoundry/pull/42',
        submitted_by: 'dev-1',
        contributor_wallet: 'wallet-address',
        notes: null,
        status: SubmissionStatus.PENDING,
        ai_score: 0,
        ai_scores_by_model: {},
        review_complete: false,
        meets_threshold: false,
        auto_approve_eligible: false,
        auto_approve_after: null,
        approved_by: null,
        approved_at: null,
        payout_tx_hash: null,
        payout_amount: null,
        payout_at: null,
        winner: false,
        submitted_at: '2026-03-22T00:00:00Z',
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(submissionFixture);

      const result = await client.submitSolution('bounty-123', {
        pr_url: 'https://github.com/SolFoundry/solfoundry/pull/42',
        contributor_wallet: 'wallet-address',
      });

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/bounty-123/submissions',
        method: 'POST',
        body: {
          pr_url: 'https://github.com/SolFoundry/solfoundry/pull/42',
          contributor_wallet: 'wallet-address',
        },
        requiresAuth: true,
      });
      expect(result.status).toBe(SubmissionStatus.PENDING);
    });
  });

  describe('listSubmissions', () => {
    it('should call GET /api/bounties/{id}/submissions', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await client.listSubmissions('bounty-123');

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/bounty-123/submissions',
        method: 'GET',
      });
      expect(result).toEqual([]);
    });
  });

  describe('updateSubmissionStatus', () => {
    it('should call PATCH on the submission status endpoint', async () => {
      const fixture: Partial<SubmissionResponse> = {
        id: 'sub-1',
        status: SubmissionStatus.APPROVED,
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(fixture);

      await client.updateSubmissionStatus('bounty-123', 'sub-1', {
        status: 'approved',
      });

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/bounty-123/submissions/sub-1/status',
        method: 'PATCH',
        body: { status: 'approved' },
        requiresAuth: true,
      });
    });
  });

  describe('search', () => {
    it('should call GET /api/bounties/search with query params', async () => {
      const searchResponse: BountySearchResponse = {
        items: [],
        total: 0,
        page: 1,
        per_page: 20,
        query: 'typescript',
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(searchResponse);

      const result = await client.search({
        q: 'typescript',
        tier: 2,
        sort: 'reward_high',
        page: 1,
        per_page: 20,
      });

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/search',
        method: 'GET',
        params: expect.objectContaining({
          q: 'typescript',
          tier: 2,
          sort: 'reward_high',
          page: 1,
          per_page: 20,
        }),
      });
      expect(result.query).toBe('typescript');
    });

    it('should join skills array as comma-separated string', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        per_page: 20,
        query: '',
      });

      await client.search({ skills: ['python', 'fastapi'] });

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/search',
        method: 'GET',
        params: expect.objectContaining({
          skills: 'python,fastapi',
        }),
      });
    });

    it('should not include skills param when empty array', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        per_page: 20,
        query: '',
      });

      await client.search({ skills: [] });

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.params.skills).toBeUndefined();
    });
  });

  describe('autocomplete', () => {
    it('should call GET /api/bounties/autocomplete with query', async () => {
      const response: AutocompleteResponse = {
        suggestions: [
          { text: 'TypeScript SDK', type: 'title', bounty_id: 'b-1' },
        ],
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(response);

      const result = await client.autocomplete('type', 5);

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/autocomplete',
        method: 'GET',
        params: { q: 'type', limit: 5 },
      });
      expect(result.suggestions).toHaveLength(1);
    });

    it('should handle autocomplete without limit parameter', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue({ suggestions: [] });

      await client.autocomplete('test');

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/autocomplete',
        method: 'GET',
        params: { q: 'test', limit: undefined },
      });
    });
  });
});
