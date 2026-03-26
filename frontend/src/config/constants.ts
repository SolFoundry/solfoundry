// Custodial mode - no on-chain program, backend handles escrow state

import { PublicKey } from '@solana/web3.js';

export const FNDRY_TOKEN_MINT = new PublicKey('C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS');
export const FNDRY_TOKEN_CA = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';
export const FNDRY_DECIMALS = 9;

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// Treasury wallet — user deposits go here via standard SPL transfer.
// Backend manages all escrow state and releases/refunds from this wallet.
const treasuryAddress = import.meta.env.VITE_TREASURY_WALLET as string | undefined;
export const TREASURY_WALLET = new PublicKey(
  treasuryAddress || 'AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1',
);

/** @deprecated Use TREASURY_WALLET instead. Alias kept for backward compatibility. */
export const ESCROW_WALLET = TREASURY_WALLET;

// Phase 3: Staking wallet (configure via VITE_STAKING_WALLET)
const stakingAddress = import.meta.env.VITE_STAKING_WALLET as string | undefined;
export const STAKING_WALLET = new PublicKey(
  stakingAddress || 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS',
);

export function solscanTxUrl(
  signature: string,
  network: 'mainnet-beta' | 'devnet',
): string {
  const cluster = network === 'devnet' ? '?cluster=devnet' : '';
  return `https://solscan.io/tx/${signature}${cluster}`;
}

export function solscanAddressUrl(
  address: string,
  network: 'mainnet-beta' | 'devnet',
): string {
  const cluster = network === 'devnet' ? '?cluster=devnet' : '';
  return `https://solscan.io/account/${address}${cluster}`;
}

/** Derive the associated token account address for a given owner + mint. */
export async function findAssociatedTokenAddress(
  owner: PublicKey,
  mint: PublicKey,
): Promise<PublicKey> {
  const [address] = await PublicKey.findProgramAddress(
    [owner.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return address;
}
