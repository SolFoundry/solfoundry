/**
 * Escrow API service — custodial mode.
 *
 * All escrow logic is handled by the backend. The frontend's only on-chain
 * action is a standard SPL token transfer to the treasury wallet for deposits.
 * Release, refund, and dispute operations are REST calls to the backend,
 * which signs with the treasury keypair.
 *
 * Backend endpoints:
 *   POST /escrow/fund    - lock $FNDRY for a bounty
 *   POST /escrow/release - send $FNDRY to winner (5% treasury fee deducted)
 *   POST /escrow/refund  - return $FNDRY to creator
 *   GET  /escrow/{id}    - status + audit trail
 *
 * @module services/escrowService
 */

import { apiClient } from './apiClient';
import type { EscrowAccount, EscrowTransaction } from '../types/escrow';

// ---------------------------------------------------------------------------
// Escrow REST API (backend-managed custodial escrow)
// ---------------------------------------------------------------------------

/**
 * Fetch the escrow account details for a given bounty.
 * Returns the current escrow state, locked amount, transaction history,
 * and expiration information.
 */
export async function fetchEscrowAccount(
  bountyId: string,
): Promise<EscrowAccount> {
  return apiClient<EscrowAccount>(`/api/escrow/${bountyId}`);
}

/**
 * Record a deposit transaction in the backend after the user's SPL transfer
 * to the treasury wallet has been confirmed on-chain.
 */
export async function recordDeposit(
  bountyId: string,
  signature: string,
  amount: number,
): Promise<EscrowAccount> {
  return apiClient<EscrowAccount>('/api/escrow/fund', {
    method: 'POST',
    body: { bounty_id: bountyId, signature, amount },
  });
}

/**
 * Record a release transaction in the backend.
 * The backend signs and sends the token transfer from treasury to contributor.
 */
export async function recordRelease(
  bountyId: string,
  signature: string,
  contributorWallet: string,
): Promise<EscrowAccount> {
  return apiClient<EscrowAccount>('/api/escrow/release', {
    method: 'POST',
    body: { bounty_id: bountyId, signature, winner_wallet: contributorWallet },
  });
}

/**
 * Record a refund transaction in the backend.
 */
export async function recordRefund(
  bountyId: string,
  signature: string,
): Promise<EscrowAccount> {
  return apiClient<EscrowAccount>('/api/escrow/refund', {
    method: 'POST',
    body: { bounty_id: bountyId, signature },
  });
}

/**
 * Fetch the transaction history for a bounty's escrow account.
 */
export async function fetchEscrowTransactions(
  bountyId: string,
): Promise<EscrowTransaction[]> {
  const status = await apiClient<{ ledger: EscrowTransaction[] }>(
    `/api/escrow/${bountyId}`,
  );
  return status.ledger;
}

// ---------------------------------------------------------------------------
// Custodial backend operations (backend signs with treasury keypair)
// ---------------------------------------------------------------------------

/** Response from backend-signed operations. */
export interface TxResponse {
  signature: string;
  message: string;
}

/**
 * Release escrow funds to the winner (backend-signed).
 * The backend deducts a 5% treasury fee automatically.
 */
export async function releaseEscrow(
  bountyId: string,
  winnerWallet: string,
): Promise<TxResponse> {
  return apiClient<TxResponse>('/api/escrow/release', {
    method: 'POST',
    body: { bounty_id: bountyId, winner_wallet: winnerWallet },
  });
}

/**
 * Refund escrow funds to the creator (backend-signed).
 */
export async function refundEscrow(
  bountyId: string,
  creatorWallet: string,
): Promise<TxResponse> {
  return apiClient<TxResponse>('/api/escrow/refund', {
    method: 'POST',
    body: { bounty_id: bountyId, creator_wallet: creatorWallet },
  });
}

/**
 * Open a dispute on the escrow (backend-signed).
 */
export async function disputeEscrow(
  bountyId: string,
): Promise<TxResponse> {
  return apiClient<TxResponse>('/api/escrow/dispute', {
    method: 'POST',
    body: { bounty_id: bountyId },
  });
}

/**
 * Resolve a dispute by releasing funds to the winner (backend-signed).
 */
export async function resolveDisputeRelease(
  bountyId: string,
  winnerWallet: string,
): Promise<TxResponse> {
  return apiClient<TxResponse>('/api/escrow/resolve-release', {
    method: 'POST',
    body: { bounty_id: bountyId, winner_wallet: winnerWallet },
  });
}

/**
 * Resolve a dispute by refunding to the creator (backend-signed).
 */
export async function resolveDisputeRefund(
  bountyId: string,
  creatorWallet: string,
): Promise<TxResponse> {
  return apiClient<TxResponse>('/api/escrow/resolve-refund', {
    method: 'POST',
    body: { bounty_id: bountyId, creator_wallet: creatorWallet },
  });
}
