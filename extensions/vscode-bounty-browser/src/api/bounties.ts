/**
 * SolFoundry Bounty API functions.
 * Mirrors the frontend API at frontend/src/api/bounties.ts
 */

import { apiClient, ApiError } from './client';
import type {
  Bounty,
  BountiesListParams,
  BountiesListResponse,
  Submission,
  SubmissionCreatePayload,
  ReviewFeeInfo,
} from '../types/bounty';

// Map backend field names to frontend types (funding_token -> reward_token)
function mapBounty(b: Bounty & { funding_token?: string }): Bounty {
  if (!b.reward_token && b.funding_token) {
    b.reward_token = b.funding_token as Bounty['reward_token'];
  }
  if (!b.reward_token) b.reward_token = 'FNDRY';
  return b;
}

export interface SolFoundryApiConfig {
  baseUrl: string;
  authToken?: string;
}

/**
 * List bounties with optional filters.
 * GET /api/bounties
 */
export async function listBounties(
  config: SolFoundryApiConfig,
  params?: BountiesListParams
): Promise<BountiesListResponse> {
  const response = await apiClient<BountiesListResponse | Bounty[]>('/api/bounties', {
    baseUrl: config.baseUrl,
    authToken: config.authToken,
    params: params as Record<string, string | number | boolean | undefined>,
  });

  if (Array.isArray(response)) {
    return {
      items: response.map(mapBounty),
      total: response.length,
      limit: params?.limit ?? 20,
      offset: params?.offset ?? 0,
    };
  }

  return {
    ...response,
    items: response.items.map(mapBounty),
  };
}

/**
 * Get a single bounty by ID.
 * GET /api/bounties/:id
 */
export async function getBounty(
  config: SolFoundryApiConfig,
  id: string
): Promise<Bounty> {
  const raw = await apiClient<Bounty & { funding_token?: string }>(`/api/bounties/${id}`, {
    baseUrl: config.baseUrl,
    authToken: config.authToken,
  });
  return mapBounty(raw);
}

/**
 * List submissions for a bounty.
 * GET /api/bounties/:id/submissions
 */
export async function listSubmissions(
  config: SolFoundryApiConfig,
  bountyId: string
): Promise<Submission[]> {
  return apiClient<Submission[]>(`/api/bounties/${bountyId}/submissions`, {
    baseUrl: config.baseUrl,
    authToken: config.authToken,
  });
}

/**
 * Create a submission (claim) for a bounty.
 * POST /api/bounties/:id/submissions
 */
export async function createSubmission(
  config: SolFoundryApiConfig,
  bountyId: string,
  payload: SubmissionCreatePayload
): Promise<Submission> {
  return apiClient<Submission>(`/api/bounties/${bountyId}/submissions`, {
    baseUrl: config.baseUrl,
    authToken: config.authToken,
    method: 'POST',
    body: payload,
  });
}

/**
 * Get review fee info for a bounty.
 * GET /api/review-fee/:id
 */
export async function getReviewFee(
  config: SolFoundryApiConfig,
  bountyId: string
): Promise<ReviewFeeInfo> {
  return apiClient<ReviewFeeInfo>(`/api/review-fee/${bountyId}`, {
    baseUrl: config.baseUrl,
    authToken: config.authToken,
  });
}

/**
 * Verify a review fee payment.
 * POST /api/review-fee/verify
 */
export async function verifyReviewFee(
  config: SolFoundryApiConfig,
  payload: { bounty_id: string; tx_signature: string; payer_wallet?: string }
): Promise<{ verified: boolean; bounty_id: string; fndry_amount_verified?: number; error?: string }> {
  return apiClient('/api/review-fee/verify', {
    baseUrl: config.baseUrl,
    authToken: config.authToken,
    method: 'POST',
    body: payload,
  });
}

/**
 * Get current authenticated user.
 * GET /api/auth/me
 */
export async function getMe(
  config: SolFoundryApiConfig
): Promise<{ id: string; username: string; email?: string | null; avatar_url?: string | null }> {
  return apiClient('/api/auth/me', {
    baseUrl: config.baseUrl,
    authToken: config.authToken,
  });
}
