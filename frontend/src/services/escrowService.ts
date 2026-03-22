/**
 * Escrow API service — fetches escrow account data and records transactions.
 * All on-chain interactions happen in the useEscrow hook via Anchor program
 * instructions; this service handles only the backend REST API communication
 * for escrow state persistence and transaction recording.
 *
 * The backend validates transaction signatures against the Solana cluster
 * before recording them, ensuring consistency between on-chain and off-chain state.
 *
 * @module services/escrowService
 */

import { apiClient } from './apiClient';
import type { EscrowAccount, EscrowTransaction } from '../types/escrow';

/**
 * Fetch the escrow account details for a given bounty.
 * Returns the current escrow state, locked amount, PDA address,
 * transaction history, and expiration information.
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
 * The backend validates the transaction signature against the Solana cluster
 * and updates the escrow state from 'unfunded' to 'funded'.
 *
 * @param bountyId - The bounty whose escrow was funded.
 * @param signature - The confirmed Solana transaction signature.
 * @param amount - The deposited amount in display units.
 * @returns The updated escrow account data reflecting the deposit.
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
 * The backend validates the signature and updates escrow state to 'released'.
 * The actual token transfer is handled by the Anchor escrow program's PDA authority.
 *
 * @param bountyId - The bounty whose escrow is being released.
 * @param signature - The confirmed Solana transaction signature.
 * @param contributorWallet - The wallet address receiving the funds.
 * @returns The updated escrow account data reflecting the release.
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
 * The backend validates the signature and updates escrow state to 'refunded'.
 * The actual token transfer is handled by the Anchor escrow program's PDA authority.
 *
 * @param bountyId - The bounty whose escrow is being refunded.
 * @param signature - The confirmed Solana transaction signature.
 * @returns The updated escrow account data reflecting the refund.
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
 * Returns all deposit, release, and refund transactions sorted
 * by confirmation time descending (most recent first).
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
