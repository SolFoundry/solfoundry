/**
 * Escrow API service — fetches escrow account data and records transactions.
 * All on-chain interactions happen in the useEscrow hook; this service
 * handles only the backend REST API communication for escrow state.
 * @module services/escrowService
 */

import { apiClient } from './apiClient';
import type { EscrowAccount, EscrowTransaction } from '../types/escrow';

/**
 * Fetch the escrow account details for a given bounty.
 *
 * @param bountyId - The unique identifier of the bounty.
 * @returns The escrow account data including state, locked amount, and transactions.
 */
export async function fetchEscrowAccount(
  bountyId: string,
): Promise<EscrowAccount> {
  return apiClient<EscrowAccount>(`/api/bounties/${bountyId}/escrow`);
}

/**
 * Record a deposit transaction in the backend after on-chain confirmation.
 * The backend validates the transaction signature against the Solana cluster.
 *
 * @param bountyId - The bounty whose escrow was funded.
 * @param signature - The confirmed Solana transaction signature.
 * @param amount - The deposited amount in display units.
 * @returns The updated escrow account data.
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
 * Transfers funds from the escrow PDA to the contributor's wallet.
 *
 * @param bountyId - The bounty whose escrow is being released.
 * @param signature - The confirmed Solana transaction signature.
 * @param contributorWallet - The wallet address receiving the funds.
 * @returns The updated escrow account data.
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
 * Returns funds from the escrow PDA back to the bounty owner.
 *
 * @param bountyId - The bounty whose escrow is being refunded.
 * @param signature - The confirmed Solana transaction signature.
 * @returns The updated escrow account data.
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
 *
 * @param bountyId - The bounty whose escrow transactions to fetch.
 * @returns Array of escrow transactions sorted by confirmation time descending.
 */
export async function fetchEscrowTransactions(
  bountyId: string,
): Promise<EscrowTransaction[]> {
  return apiClient<EscrowTransaction[]>(
    `/api/bounties/${bountyId}/escrow/transactions`,
  );
}
