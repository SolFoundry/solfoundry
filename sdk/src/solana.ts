/**
 * Solana blockchain helpers for the SolFoundry SDK.
 *
 * Provides PDA (Program Derived Address) derivation, account
 * deserialization, SPL token transaction building, and RPC
 * connection management. These utilities wrap `@solana/web3.js`
 * to simplify common on-chain operations for SolFoundry integrations.
 *
 * @module solana
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  type Commitment,
  type ConnectionConfig,
} from '@solana/web3.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The $FNDRY SPL token mint address on Solana mainnet. */
export const FNDRY_TOKEN_MINT = new PublicKey('C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS');

/** SPL Token program ID. */
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

/** Associated Token Account program ID. */
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

/** SolFoundry treasury wallet address. */
export const TREASURY_WALLET = new PublicKey('57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp');

/** Default Solana mainnet-beta RPC endpoint. */
export const DEFAULT_RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';

/** Number of decimal places for the $FNDRY token. */
export const FNDRY_DECIMALS = 9;

// ---------------------------------------------------------------------------
// PDA derivation
// ---------------------------------------------------------------------------

/**
 * Derive the Associated Token Account (ATA) address for a wallet and mint.
 *
 * ATAs are deterministic addresses derived from the owner's public key,
 * the token mint, and the SPL Token and Associated Token programs. This
 * function computes the address without making any RPC calls.
 *
 * @param owner - The wallet public key that owns the token account.
 * @param mint - The SPL token mint address. Defaults to $FNDRY.
 * @returns The derived ATA public key and the bump seed.
 */
export async function findAssociatedTokenAddress(
  owner: PublicKey,
  mint: PublicKey = FNDRY_TOKEN_MINT,
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}

/**
 * Derive a generic Program Derived Address (PDA) from arbitrary seeds.
 *
 * PDAs are off-curve public keys that can only be signed by the program
 * they are derived from. Common uses include escrow accounts, vaults,
 * and registry entries.
 *
 * @param seeds - Array of seed buffers for the PDA derivation.
 * @param programId - The program ID that owns the PDA.
 * @returns The derived PDA public key and the bump seed.
 */
export async function findProgramAddress(
  seeds: Buffer[],
  programId: PublicKey,
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(seeds, programId);
}

/**
 * Derive a bounty escrow PDA from a bounty ID and program ID.
 *
 * The escrow PDA holds staked $FNDRY tokens for a specific bounty.
 * The seeds are ["escrow", bountyIdBytes].
 *
 * @param bountyId - The bounty UUID string used as a seed.
 * @param programId - The escrow program's public key.
 * @returns The derived escrow PDA and its bump seed.
 */
export async function findEscrowAddress(
  bountyId: string,
  programId: PublicKey,
): Promise<[PublicKey, number]> {
  const seeds = [
    Buffer.from('escrow'),
    Buffer.from(bountyId),
  ];
  return PublicKey.findProgramAddress(seeds, programId);
}

/**
 * Derive a contributor reputation PDA from a wallet address and program ID.
 *
 * The reputation PDA stores on-chain reputation data for a contributor.
 * The seeds are ["reputation", walletPubkeyBytes].
 *
 * @param wallet - The contributor's Solana wallet public key.
 * @param programId - The reputation program's public key.
 * @returns The derived reputation PDA and its bump seed.
 */
export async function findReputationAddress(
  wallet: PublicKey,
  programId: PublicKey,
): Promise<[PublicKey, number]> {
  const seeds = [
    Buffer.from('reputation'),
    wallet.toBuffer(),
  ];
  return PublicKey.findProgramAddress(seeds, programId);
}

// ---------------------------------------------------------------------------
// Account deserialization
// ---------------------------------------------------------------------------

/** Deserialized SOL balance for a wallet. */
export interface SolBalance {
  /** Wallet address as a base-58 string. */
  readonly wallet: string;
  /** Balance in SOL (not lamports). */
  readonly balanceSol: number;
  /** Balance in lamports. */
  readonly balanceLamports: number;
}

/** Deserialized SPL token balance for a wallet. */
export interface TokenBalance {
  /** Wallet address as a base-58 string. */
  readonly wallet: string;
  /** Token mint address as a base-58 string. */
  readonly mint: string;
  /** Token balance in UI units (adjusted for decimals). */
  readonly balance: number;
  /** Token balance in raw units (smallest denomination). */
  readonly rawBalance: string;
  /** Number of decimal places. */
  readonly decimals: number;
}

/**
 * Fetch the native SOL balance for a wallet address.
 *
 * @param connection - Active Solana RPC connection.
 * @param wallet - The wallet public key to query.
 * @returns Deserialized SOL balance in both SOL and lamports.
 */
export async function getSolBalance(
  connection: Connection,
  wallet: PublicKey,
): Promise<SolBalance> {
  const lamports = await connection.getBalance(wallet);
  return {
    wallet: wallet.toBase58(),
    balanceSol: lamports / 1e9,
    balanceLamports: lamports,
  };
}

/**
 * Fetch the SPL token balance for a specific mint held by a wallet.
 *
 * Queries all token accounts owned by the wallet for the given mint
 * and sums their balances. Returns zero if no token account exists.
 *
 * @param connection - Active Solana RPC connection.
 * @param wallet - The wallet public key to query.
 * @param mint - The SPL token mint address. Defaults to $FNDRY.
 * @returns Deserialized token balance with raw and UI amounts.
 */
export async function getTokenBalance(
  connection: Connection,
  wallet: PublicKey,
  mint: PublicKey = FNDRY_TOKEN_MINT,
): Promise<TokenBalance> {
  const accounts = await connection.getParsedTokenAccountsByOwner(wallet, { mint });

  let totalBalance = 0;
  let totalRaw = BigInt(0);
  let decimals = FNDRY_DECIMALS;

  for (const account of accounts.value) {
    const parsed = account.account.data.parsed;
    if (parsed?.info?.tokenAmount) {
      totalBalance += parsed.info.tokenAmount.uiAmount ?? 0;
      totalRaw += BigInt(parsed.info.tokenAmount.amount ?? '0');
      decimals = parsed.info.tokenAmount.decimals ?? decimals;
    }
  }

  return {
    wallet: wallet.toBase58(),
    mint: mint.toBase58(),
    balance: totalBalance,
    rawBalance: totalRaw.toString(),
    decimals,
  };
}

// ---------------------------------------------------------------------------
// Transaction building
// ---------------------------------------------------------------------------

/**
 * Build an SPL token transfer instruction.
 *
 * Creates a token transfer instruction for the SPL Token program.
 * The caller is responsible for signing and sending the transaction.
 *
 * Note: This builds a raw instruction. For production use with
 * SolFoundry, escrow operations are handled server-side via the
 * REST API. This helper is provided for advanced integrations.
 *
 * @param source - The source token account (ATA) public key.
 * @param destination - The destination token account (ATA) public key.
 * @param authority - The owner/authority of the source token account.
 * @param amount - The raw token amount (in smallest units) to transfer.
 * @returns A TransactionInstruction for the SPL token transfer.
 */
export function buildTokenTransferInstruction(
  source: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  amount: bigint,
): TransactionInstruction {
  // SPL Token Transfer instruction layout:
  // [3] (u8 instruction index for Transfer) + amount (u64 LE)
  const dataBuffer = Buffer.alloc(9);
  dataBuffer.writeUInt8(3, 0); // Transfer instruction index
  dataBuffer.writeBigUInt64LE(amount, 1);

  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data: dataBuffer,
  });
}

/**
 * Build a complete SPL token transfer transaction.
 *
 * Combines the transfer instruction with a recent blockhash and
 * fee payer, ready for signing. The caller must sign the transaction
 * with the authority's keypair before submitting.
 *
 * @param connection - Active Solana RPC connection for fetching blockhash.
 * @param source - The source token account (ATA) public key.
 * @param destination - The destination token account (ATA) public key.
 * @param authority - The owner/authority of the source token account.
 * @param amount - The raw token amount (in smallest units) to transfer.
 * @returns An unsigned Transaction ready for signing.
 */
export async function buildTokenTransferTransaction(
  connection: Connection,
  source: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  amount: bigint,
): Promise<Transaction> {
  const instruction = buildTokenTransferInstruction(source, destination, authority, amount);
  const transaction = new Transaction().add(instruction);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = authority;

  return transaction;
}

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

/**
 * Create a configured Solana RPC connection with sensible defaults.
 *
 * Applies a default commitment level of "confirmed" and enables
 * WebSocket subscriptions for real-time updates.
 *
 * @param endpoint - The RPC endpoint URL. Defaults to mainnet-beta.
 * @param commitment - Transaction commitment level. Defaults to "confirmed".
 * @param config - Additional connection configuration options.
 * @returns A configured Solana Connection instance.
 */
export function createConnection(
  endpoint: string = DEFAULT_RPC_ENDPOINT,
  commitment: Commitment = 'confirmed',
  config?: ConnectionConfig,
): Connection {
  return new Connection(endpoint, {
    commitment,
    ...config,
  });
}

/**
 * Validate that a string is a valid Solana base-58 public key.
 *
 * Attempts to construct a PublicKey from the input. Returns false
 * if the string is not a valid base-58 encoded 32-byte key.
 *
 * @param address - The string to validate as a Solana address.
 * @returns True if the address is a valid Solana public key.
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert a UI amount (e.g., 1.5 FNDRY) to raw token units.
 *
 * Multiplies the amount by 10^decimals to get the smallest
 * denomination value suitable for on-chain instructions.
 *
 * @param amount - The UI amount (e.g., 1.5).
 * @param decimals - Number of decimal places. Defaults to FNDRY_DECIMALS (9).
 * @returns The raw amount as a bigint.
 */
export function toRawAmount(amount: number, decimals: number = FNDRY_DECIMALS): bigint {
  return BigInt(Math.round(amount * Math.pow(10, decimals)));
}

/**
 * Convert raw token units to a human-readable UI amount.
 *
 * Divides the raw amount by 10^decimals to get the display value.
 *
 * @param rawAmount - The raw amount in smallest denomination (as bigint or string).
 * @param decimals - Number of decimal places. Defaults to FNDRY_DECIMALS (9).
 * @returns The UI-friendly amount as a number.
 */
export function toUiAmount(rawAmount: bigint | string, decimals: number = FNDRY_DECIMALS): number {
  const raw = typeof rawAmount === 'string' ? BigInt(rawAmount) : rawAmount;
  return Number(raw) / Math.pow(10, decimals);
}

// Re-export commonly used web3.js types for convenience
export { Connection, PublicKey, Transaction, SystemProgram };
