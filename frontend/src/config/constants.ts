import { PublicKey } from '@solana/web3.js';

const FNDRY_MINT_FALLBACK = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';

/** Base58 pubkey from env, or fallback if unset / invalid (bad env breaks the whole app at import time). */
function publicKeyFromEnv(
  raw: string | undefined,
  fallback: string,
  envName: string,
): PublicKey {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return new PublicKey(fallback);
  try {
    return new PublicKey(trimmed);
  } catch {
    if (import.meta.env.DEV) {
      console.warn(
        `[constants] ${envName} is not a valid Solana address; using fallback escrow wallet.`,
      );
    }
    return new PublicKey(fallback);
  }
}

export const FNDRY_TOKEN_MINT = new PublicKey(FNDRY_MINT_FALLBACK);
export const FNDRY_TOKEN_CA = FNDRY_MINT_FALLBACK;
export const FNDRY_DECIMALS = 9;

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// Configure via VITE_ESCROW_WALLET. In production, derive a PDA from the escrow program.
export const ESCROW_WALLET = publicKeyFromEnv(
  import.meta.env.VITE_ESCROW_WALLET as string | undefined,
  FNDRY_MINT_FALLBACK,
  'VITE_ESCROW_WALLET',
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
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return address;
}
