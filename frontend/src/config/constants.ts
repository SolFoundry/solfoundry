/**
 * Solana constants for $FNDRY token interactions and escrow program integration.
 *
 * Provides:
 * - Token mint and program IDs
 * - Escrow program ID and PDA derivation for per-bounty escrow accounts
 * - Associated token account (ATA) derivation
 * - Solscan explorer URL generators
 *
 * @module config/constants
 */

import { PublicKey } from '@solana/web3.js';

/** The $FNDRY SPL token mint address on Solana. */
export const FNDRY_TOKEN_MINT = new PublicKey('C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS');

/** String form of the $FNDRY token contract address. */
export const FNDRY_TOKEN_CA = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';

/** Number of decimal places for $FNDRY token amounts. */
export const FNDRY_DECIMALS = 9;

/** The SPL Token program ID on Solana. */
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQEcnVcP3xLFiSKskQ4K73zYS5168Ry2hY');

/** The Associated Token Account program ID on Solana. */
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

/**
 * The SolFoundry Escrow Program ID on Solana.
 * This Anchor program handles deposit, release, and refund instructions
 * via PDA-owned escrow accounts. Configure via VITE_ESCROW_PROGRAM_ID
 * environment variable, or uses the default program address.
 */
const escrowProgramAddress = import.meta.env.VITE_ESCROW_PROGRAM_ID as string | undefined;
export const ESCROW_PROGRAM_ID = new PublicKey(
  escrowProgramAddress || 'FNDRYEscrow11111111111111111111111111111111',
);

/**
 * Legacy escrow wallet address for backwards compatibility.
 * Configure via VITE_ESCROW_WALLET. In production, derive a PDA from the escrow program.
 */
const escrowAddress = import.meta.env.VITE_ESCROW_WALLET as string | undefined;
export const ESCROW_WALLET = new PublicKey(
  escrowAddress || 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS',
);

/**
 * Derive the per-bounty escrow PDA address from the escrow program.
 * Each bounty gets its own escrow account derived from seeds:
 * ["escrow", bounty_id_bytes].
 *
 * @param bountyId - The unique identifier of the bounty.
 * @returns A tuple of [escrowPda, bumpSeed] for the bounty's escrow account.
 */
export async function deriveEscrowPda(
  bountyId: string,
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [
      Buffer.from('escrow'),
      Buffer.from(bountyId),
    ],
    ESCROW_PROGRAM_ID,
  );
}

/**
 * Generate a Solscan transaction URL for a given signature and network.
 *
 * @param signature - The Solana transaction signature (base58 string).
 * @param network - The Solana cluster to link to.
 * @returns The full Solscan URL for viewing the transaction.
 */
export function solscanTxUrl(
  signature: string,
  network: 'mainnet-beta' | 'devnet',
): string {
  const cluster = network === 'devnet' ? '?cluster=devnet' : '';
  return `https://solscan.io/tx/${signature}${cluster}`;
}

/**
 * Generate a Solscan account/address URL for a given address and network.
 *
 * @param address - The Solana account address (base58 string).
 * @param network - The Solana cluster to link to.
 * @returns The full Solscan URL for viewing the account.
 */
export function solscanAddressUrl(
  address: string,
  network: 'mainnet-beta' | 'devnet',
): string {
  const cluster = network === 'devnet' ? '?cluster=devnet' : '';
  return `https://solscan.io/account/${address}${cluster}`;
}

/**
 * Derive the associated token account address for a given owner and token mint.
 * Uses the standard SPL ATA derivation: seeds = [owner, TOKEN_PROGRAM_ID, mint].
 *
 * @param owner - The wallet that owns the token account.
 * @param mint - The SPL token mint address.
 * @returns The derived ATA public key.
 */
export async function findAssociatedTokenAddress(
  owner: PublicKey,
  mint: PublicKey,
): Promise<PublicKey> {
  const [address] = await PublicKey.findProgramAddress(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return address;
}
