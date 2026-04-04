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
  offset: number;
}

export async function listBounties(params?: BountiesListParams): Promise<BountiesListResponse> {
  const response = await apiClient<BountiesListResponse | Bounty[]>('/api/bounties', {
    params: params as Record<string, string | number | boolean | undefined>,
  });
  // Handle both array and paginated response shapes
  if (Array.isArray(response)) {
    return { items: response, total: response.length, limit: params?.limit ?? 20, offset: params?.offset ?? 0 };
  }
  return response;
}

export async function getBounty(id: string): Promise<Bounty> {
  return apiClient<Bounty>(`/api/bounties/${id}`);
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
