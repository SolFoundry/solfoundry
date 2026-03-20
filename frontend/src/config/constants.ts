import { PublicKey } from '@solana/web3.js';

export const FNDRY_TOKEN_MINT = new PublicKey('C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS');
export const FNDRY_DECIMALS = 9;

// Configure via VITE_ESCROW_WALLET. In production, derive a PDA from the escrow program.
const escrowAddress = import.meta.env.VITE_ESCROW_WALLET as string | undefined;
export const ESCROW_WALLET = new PublicKey(
  escrowAddress || 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS',
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
