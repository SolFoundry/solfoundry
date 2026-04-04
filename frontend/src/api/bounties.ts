import { apiClient } from '../services/apiClient';
import type {
  Bounty,
  BountyCreatePayload,
  Submission,
  TreasuryDepositInfo,
  EscrowVerifyPayload,
  EscrowVerifyResult,
} from '../types/bounty';

export interface BountiesListParams {
  status?: string;
  limit?: number;
  offset?: number;
  skill?: string;
  tier?: string;
  reward_token?: string;
}

export interface BountiesListResponse {
  items: Bounty[];
  total: number;
  limit: number;
export async function listBounties(params?: BountiesListParams): Promise<BountiesListResponse> {
  if (params) {
    if (params.status && typeof params.status !== 'string') {
      throw new Error('Invalid status parameter');
    }
    if (params.limit && (typeof params.limit !== 'number' || params.limit < 0)) {
      throw new Error('Invalid limit parameter');
    }
    if (params.offset && (typeof params.offset !== 'number' || params.offset < 0)) {
      throw new Error('Invalid offset parameter');
    }
    if (params.skill && typeof params.skill !== 'string') {
      throw new Error('Invalid skill parameter');
    }
    if (params.tier && typeof params.tier !== 'string') {
      throw new Error('Invalid tier parameter');
    }
    if (params.reward_token && typeof params.reward_token !== 'string') {
      throw new Error('Invalid reward_token parameter');
    }
  }
  const response = await apiClient<BountiesListResponse | Bounty[]>('/api/bounties', {
    params: params as Record<string, string | number | boolean | undefined>,
  });
  // Handle both array and paginated response shapes
  if (Array.isArray(response)) {
    return { items: response.map(mapBounty), total: response.length, limit: params?.limit ?? 20, offset: params?.offset ?? 0 };
  }
  return { ...response, items: response.items.map(mapBounty) };
}
  const response = await apiClient<BountiesListResponse | Bounty[]>('/api/bounties', {
    params: params as Record<string, string | number | boolean | undefined>,
  });
  // Handle both array and paginated response shapes
  if (Array.isArray(response)) {
    return { items: response.map(mapBounty), total: response.length, limit: params?.limit ?? 20, offset: params?.offset ?? 0 };
  }
  return { ...response, items: response.items.map(mapBounty) };
}

export async function getBounty(id: string): Promise<Bounty> {
  const raw = await apiClient<Bounty>(`/api/bounties/${id}`);
  return mapBounty(raw);
}

export async function createBounty(payload: BountyCreatePayload): Promise<Bounty> {
  return apiClient<Bounty>('/api/bounties', { method: 'POST', body: payload });
}

export async function listSubmissions(bountyId: string): Promise<Submission[]> {
  return apiClient<Submission[]>(`/api/bounties/${bountyId}/submissions`);
}

export async function createSubmission(
  bountyId: string,
  payload: { repo_url?: string; pr_url?: string; description?: string; tx_signature?: string }
): Promise<Submission> {
  return apiClient<Submission>(`/api/bounties/${bountyId}/submissions`, {
    method: 'POST',
    body: payload,
  });
}

export async function getTreasuryDepositInfo(bountyId: string): Promise<TreasuryDepositInfo> {
  return apiClient<TreasuryDepositInfo>('/api/treasury/deposit-info', {
    params: { bounty_id: bountyId },
  });
}

export async function verifyEscrowDeposit(payload: EscrowVerifyPayload): Promise<EscrowVerifyResult> {
  return apiClient<EscrowVerifyResult>('/api/escrow/verify-deposit', {
    method: 'POST',
    body: payload,
  });
}

export interface ReviewFeeInfo {
  bounty_id: string;
  required: boolean;
  fndry_amount: number;
  fndry_price_usd: number;
  usdc_bounty_value: number;
  fee_percentage: number;
  exchange_rate: number;
  price_source: string;
}

export async function getReviewFee(bountyId: string): Promise<ReviewFeeInfo> {
  return apiClient<ReviewFeeInfo>(`/api/review-fee/${bountyId}`);
}

export async function verifyReviewFee(payload: {
  bounty_id: string;
  tx_signature: string;
  payer_wallet?: string;
}): Promise<{ verified: boolean; bounty_id: string; fndry_amount_verified?: number; error?: string }> {
  return apiClient('/api/review-fee/verify', { method: 'POST', body: payload });
}
