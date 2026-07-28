/**
 * Tests for the SubmissionsClient resource module.
 *
 * Verifies that each method constructs the correct HTTP request
 * (path, method, params, body) and delegates to the HttpClient.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubmissionsClient } from '../submissions.js';
import type { HttpClient } from '../client.js';
import type {
  SubmissionCreate,
  SubmissionResponse,
  SubmissionStatusUpdate,
  SubmissionReviewResponse,
} from '../types.js';
import { SubmissionStatus } from '../types.js';

/** Create a mock HttpClient with a vi.fn() for request. */
function createMockHttpClient(): HttpClient {
  return {
    request: vi.fn(),
    setAuthToken: vi.fn(),
    getAuthToken: vi.fn(),
  } as unknown as HttpClient;
}

/** Create a minimal submission fixture. */
function createSubmissionFixture(overrides?: Partial<SubmissionResponse>): SubmissionResponse {
  return {
    id: 'sub-123',
    bounty_id: 'bounty-456',
    pr_url: 'https://github.com/owner/repo/pull/42',
    submitted_by: 'user-1',
    contributor_wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
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
    ...overrides,
  };
}

describe('SubmissionsClient', () => {
  let http: HttpClient;
  let client: SubmissionsClient;

  beforeEach(() => {
    http = createMockHttpClient();
    client = new SubmissionsClient(http);
  });

  describe('list', () => {
    it('should call GET /api/bounties/:id/submissions', async () => {
      const mockSubmissions = [createSubmissionFixture()];
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubmissions);

      const result = await client.list('bounty-456');

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/bounty-456/submissions',
        method: 'GET',
      });
      expect(result).toEqual(mockSubmissions);
    });
  });

  describe('get', () => {
    it('should call GET /api/bounties/:id/submissions/:subId', async () => {
      const mockSubmission = createSubmissionFixture();
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubmission);

      const result = await client.get('bounty-456', 'sub-123');

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/bounty-456/submissions/sub-123',
        method: 'GET',
      });
      expect(result).toEqual(mockSubmission);
    });
  });

  describe('create', () => {
    it('should call POST /api/bounties/:id/submissions with auth', async () => {
      const createData: SubmissionCreate = {
        pr_url: 'https://github.com/owner/repo/pull/99',
        notes: 'Fixes the issue',
      };
      const mockSubmission = createSubmissionFixture({
        pr_url: 'https://github.com/owner/repo/pull/99',
        notes: 'Fixes the issue',
      });
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubmission);

      const result = await client.create('bounty-456', createData);

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/bounty-456/submissions',
        method: 'POST',
        body: createData,
        requiresAuth: true,
      });
      expect(result).toEqual(mockSubmission);
    });

    it('should include optional wallet address', async () => {
      const createData: SubmissionCreate = {
        pr_url: 'https://github.com/owner/repo/pull/100',
        contributor_wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(
        createSubmissionFixture({ pr_url: 'https://github.com/owner/repo/pull/100' }),
      );

      await client.create('bounty-456', createData);

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/bounty-456/submissions',
        method: 'POST',
        body: createData,
        requiresAuth: true,
      });
    });
  });

  describe('updateStatus', () => {
    it('should call PATCH /api/bounties/:id/submissions/:subId/status with auth', async () => {
      const statusUpdate: SubmissionStatusUpdate = { status: 'approved' };
      const mockSubmission = createSubmissionFixture({
        status: SubmissionStatus.APPROVED,
        approved_by: 'user-1',
        approved_at: '2026-03-23T00:00:00Z',
      });
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubmission);

      const result = await client.updateStatus('bounty-456', 'sub-123', statusUpdate);

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/bounty-456/submissions/sub-123/status',
        method: 'PATCH',
        body: statusUpdate,
        requiresAuth: true,
      });
      expect(result.status).toBe(SubmissionStatus.APPROVED);
    });
  });

  describe('getReview', () => {
    it('should call GET /api/bounties/:id/submissions/:subId/review', async () => {
      const mockReview: SubmissionReviewResponse = {
        submission_id: 'sub-123',
        bounty_id: 'bounty-456',
        aggregated_score: 8.5,
        meets_threshold: true,
        review_complete: true,
        auto_approve_eligible: true,
        model_reviews: [
          {
            model_name: 'claude',
            score: 9,
            summary: 'Well-structured solution',
            detailed_feedback: 'Good code quality and tests',
            has_critical_issues: false,
            issues: [],
            reviewed_at: '2026-03-23T00:00:00Z',
          },
        ],
        reviewed_at: '2026-03-23T00:00:00Z',
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockReview);

      const result = await client.getReview('bounty-456', 'sub-123');

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/bounties/bounty-456/submissions/sub-123/review',
        method: 'GET',
      });
      expect(result).toEqual(mockReview);
      expect(result.model_reviews[0].model_name).toBe('claude');
    });
  });
});