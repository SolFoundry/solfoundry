import { PublicKey } from '@solana/web3.js';

export const FNDRY_TOKEN_MINT = new PublicKey('C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS');
export const FNDRY_TOKEN_CA = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';
export const FNDRY_DECIMALS = 9;

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// Unified SolFoundry PDA program (escrow + reputation + treasury)
// Deployed on devnet: BE7wn4oCTwCfCocZ1uyCmpNZjqprin9SLUDKvyweoXEN
const escrowProgramAddress = import.meta.env.VITE_ESCROW_PROGRAM_ID as string | undefined;
export const ESCROW_PROGRAM_ID = new PublicKey(
  escrowProgramAddress || 'BE7wn4oCTwCfCocZ1uyCmpNZjqprin9SLUDKvyweoXEN',
);

// Configure via VITE_ESCROW_WALLET. In production, derive a PDA from the escrow program.
const escrowAddress = import.meta.env.VITE_ESCROW_WALLET as string | undefined;
export const ESCROW_WALLET = new PublicKey(
  escrowAddress || 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS',
);

// Phase 3: Staking wallet (configure via VITE_STAKING_WALLET)
const stakingAddress = import.meta.env.VITE_STAKING_WALLET as string | undefined;
export const STAKING_WALLET = new PublicKey(
  stakingAddress || 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS',
);

/**
 * Derive the escrow PDA for a given bounty ID.
 * Uses u64 little-endian encoding to match the on-chain program's PDA seeds:
 *   seeds = ["escrow", bounty_id.to_le_bytes()]
 */
export async function deriveEscrowPda(
  bountyId: string | number,
): Promise<[PublicKey, number]> {
  const id = typeof bountyId === 'string' ? parseInt(bountyId, 10) : bountyId;
  // Encode as u64 little-endian (8 bytes) to match Rust's u64.to_le_bytes()
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(id));
  return PublicKey.findProgramAddress(
    [Buffer.from('escrow'), buf],
    ESCROW_PROGRAM_ID,
  );
}

/**
 * Derive the vault PDA for a given escrow PDA.
 * seeds = ["vault", escrow_pda]
 */
export async function deriveVaultPda(
  escrowPda: PublicKey,
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [Buffer.from('vault'), escrowPda.toBuffer()],
    ESCROW_PROGRAM_ID,
  );
}

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
