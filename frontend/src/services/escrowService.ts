/**
 * Escrow API service — communicates with the backend PDA endpoints.
 *
 * Two operation modes:
 * 1. Frontend-signed: Backend builds unsigned tx → frontend wallet signs → submit
 *    (create_escrow + deposit)
 * 2. Backend-signed: Backend signs with authority keypair → returns tx signature
 *    (assign, release, refund, dispute, resolve)
 *
 * Also handles legacy REST API communication for escrow state persistence
 * and transaction recording.
 *
 * @module services/escrowService
 */

import { apiClient } from './apiClient';
import type { EscrowAccount, EscrowTransaction } from '../types/escrow';

// ---------------------------------------------------------------------------
// Legacy REST API (escrow state persistence + tx recording)
// ---------------------------------------------------------------------------

/**
 * Fetch the escrow account details for a given bounty.
 * Returns the current escrow state, locked amount, PDA address,
 * transaction history, and expiration information.
 */
export async function fetchEscrowAccount(
  bountyId: string,
): Promise<EscrowAccount> {
  return apiClient<EscrowAccount>(`/api/bounties/${bountyId}/escrow`);
}

/**
 * Record a deposit transaction in the backend after on-chain confirmation.
 */
export async function recordDeposit(
  bountyId: string,
  signature: string,
  amount: number,
): Promise<EscrowAccount> {
  return apiClient<EscrowAccount>(`/api/bounties/${bountyId}/escrow/deposit`, {
    method: 'POST',
    body: { signature, amount },
  });
}

/**
 * Record a release transaction in the backend after on-chain confirmation.
 */
export async function recordRelease(
  bountyId: string,
  signature: string,
  contributorWallet: string,
): Promise<EscrowAccount> {
  return apiClient<EscrowAccount>(`/api/bounties/${bountyId}/escrow/release`, {
    method: 'POST',
    body: { signature, contributor_wallet: contributorWallet },
  });
}

/**
 * Record a refund transaction in the backend after on-chain confirmation.
 */
export async function recordRefund(
  bountyId: string,
  signature: string,
): Promise<EscrowAccount> {
  return apiClient<EscrowAccount>(`/api/bounties/${bountyId}/escrow/refund`, {
    method: 'POST',
    body: { signature },
  });
}

/**
 * Fetch the transaction history for a bounty's escrow account.
 */
export async function fetchEscrowTransactions(
  bountyId: string,
): Promise<EscrowTransaction[]> {
  return apiClient<EscrowTransaction[]>(
    `/api/bounties/${bountyId}/escrow/transactions`,
  );
}

// ---------------------------------------------------------------------------
// PDA Program API (Solana on-chain operations)
// ---------------------------------------------------------------------------

/** Response from create escrow endpoint — unsigned tx for wallet signing */
export interface CreateEscrowResponse {
  transaction: string; // base64-encoded unsigned Message
  escrow_pda: string;
  vault_pda: string;
  blockhash: string;
}

/** Response from backend-signed operations */
export interface TxResponse {
  signature: string;
  message: string;
}

/** On-chain escrow state read from Solana */
export interface OnChainEscrowState {
  bounty_id: number;
  creator: string;
  winner: string;
  authority: string;
  token_mint: string;
  amount: number;
  state: string; // Created | Funded | Active | Completed | Refunded | Disputed
  created_at: number;
  deadline: number;
}

/** PDA addresses for a bounty */
export interface EscrowPdaInfo {
  escrow_pda: string;
  escrow_bump: number;
  vault_pda: string;
  vault_bump: number;
  program_id: string;
}

/**
 * Build an unsigned create_escrow + deposit transaction via the backend.
 * The frontend wallet will sign and submit this transaction.
 */
export async function buildCreateEscrowTx(
  bountyId: number,
  amount: number,
  deadline: number,
  creatorWallet: string,
  authorityWallet?: string,
): Promise<CreateEscrowResponse> {
  return apiClient<CreateEscrowResponse>('/api/pda/escrow/create', {
    method: 'POST',
    body: {
      bounty_id: bountyId,
      amount,
      deadline,
      creator_wallet: creatorWallet,
      authority_wallet: authorityWallet,
    },
  });
}

/**
 * Assign a contributor to the escrow (backend-signed by authority).
 */
export async function assignContributor(
  bountyId: number,
  contributorWallet: string,
): Promise<TxResponse> {
  return apiClient<TxResponse>('/api/pda/escrow/assign', {
    method: 'POST',
    body: { bounty_id: bountyId, contributor_wallet: contributorWallet },
  });
}

/**
 * Release escrow funds to the winner (backend-signed by authority).
 */
export async function releaseEscrow(
  bountyId: number,
  winnerWallet: string,
): Promise<TxResponse> {
  return apiClient<TxResponse>('/api/pda/escrow/release', {
    method: 'POST',
    body: { bounty_id: bountyId, winner_wallet: winnerWallet },
  });
}

/**
 * Refund escrow funds to the creator (backend-signed by authority).
 */
export async function refundEscrow(
  bountyId: number,
  creatorWallet: string,
): Promise<TxResponse> {
  return apiClient<TxResponse>('/api/pda/escrow/refund', {
    method: 'POST',
    body: { bounty_id: bountyId, creator_wallet: creatorWallet },
  });
}

/**
 * Open a dispute on the escrow (backend-signed by authority).
 */
export async function disputeEscrow(
  bountyId: number,
): Promise<TxResponse> {
  return apiClient<TxResponse>('/api/pda/escrow/dispute', {
    method: 'POST',
    body: { bounty_id: bountyId },
  });
}

/**
 * Resolve a dispute by releasing funds to the winner (backend-signed).
 */
export async function resolveDisputeRelease(
  bountyId: number,
  winnerWallet: string,
): Promise<TxResponse> {
  return apiClient<TxResponse>('/api/pda/escrow/resolve-release', {
    method: 'POST',
    body: { bounty_id: bountyId, winner_wallet: winnerWallet },
  });
}

/**
 * Resolve a dispute by refunding to the creator (backend-signed).
 */
export async function resolveDisputeRefund(
  bountyId: number,
  creatorWallet: string,
): Promise<TxResponse> {
  return apiClient<TxResponse>('/api/pda/escrow/resolve-refund', {
    method: 'POST',
    body: { bounty_id: bountyId, creator_wallet: creatorWallet },
  });
}

/**
 * Read the on-chain escrow state directly from Solana (via backend RPC).
 */
export async function fetchOnChainEscrowState(
  bountyId: number,
): Promise<OnChainEscrowState> {
  return apiClient<OnChainEscrowState>(`/api/pda/escrow/${bountyId}`);
}

/**
 * Get PDA addresses for a bounty (useful before escrow creation).
 */
export async function fetchEscrowPdaInfo(
  bountyId: number,
): Promise<EscrowPdaInfo> {
  return apiClient<EscrowPdaInfo>(`/api/pda/escrow/${bountyId}/pda`);
}
