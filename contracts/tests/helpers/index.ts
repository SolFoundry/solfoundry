/**
 * Shared test helpers for SolFoundry Solana program tests.
 *
 * Provides utilities for:
 * - Funding keypairs with SOL via airdrop
 * - Creating SPL token mints and accounts
 * - Minting tokens to test accounts
 * - Deriving PDAs for bounty-registry and staking programs
 * - Advancing the local validator clock for time-dependent tests
 * - Generating deterministic test fixtures (mock PR hashes, etc.)
 *
 * Usage:
 * ```typescript
 * import { createFundedKeypair, deriveBountyPda, advanceClock } from "../helpers";
 * ```
 */

import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  Connection,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";

// ─────────────────────────────────────────────────────────────────
// Token constants (matches program constants)
// ─────────────────────────────────────────────────────────────────

/** Number of decimal places for $FNDRY tokens. */
export const TOKEN_DECIMALS = 6;

/** One $FNDRY token in base units (1_000_000). */
export const ONE_TOKEN = new BN(1_000_000);

/** Bronze tier minimum: 10,000 $FNDRY. */
export const BRONZE_MIN = new BN(10_000).mul(ONE_TOKEN);

/** Silver tier minimum: 50,000 $FNDRY. */
export const SILVER_MIN = new BN(50_000).mul(ONE_TOKEN);

/** Gold tier minimum: 100,000 $FNDRY. */
export const GOLD_MIN = new BN(100_000).mul(ONE_TOKEN);

/** Default reward pool seed amount: 1,000,000 $FNDRY. */
export const REWARD_POOL_SEED_AMOUNT = new BN(1_000_000).mul(ONE_TOKEN);

/** Cooldown duration for unstaking in seconds (7 days). */
export const COOLDOWN_SECONDS = 7 * 24 * 60 * 60;

// ─────────────────────────────────────────────────────────────────
// SOL / account helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Airdrop SOL to a public key and wait for confirmation.
 *
 * @param provider - Anchor provider with an active connection.
 * @param pubkey   - The recipient public key.
 * @param sol      - Amount in SOL (default 10).
 */
export async function airdropSol(
  provider: anchor.AnchorProvider,
  pubkey: PublicKey,
  sol = 10
): Promise<void> {
  const sig = await provider.connection.requestAirdrop(
    pubkey,
    sol * LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(sig, "confirmed");
}

/**
 * Generate a fresh keypair and pre-fund it with SOL.
 *
 * @param provider - Anchor provider.
 * @param sol      - Amount in SOL (default 10).
 * @returns Funded keypair ready for signing transactions.
 */
export async function createFundedKeypair(
  provider: anchor.AnchorProvider,
  sol = 10
): Promise<Keypair> {
  const kp = Keypair.generate();
  await airdropSol(provider, kp.publicKey, sol);
  return kp;
}

// ─────────────────────────────────────────────────────────────────
// SPL Token helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Create a new SPL token mint.
 *
 * @param provider   - Anchor provider (payer is `provider.wallet`).
 * @param decimals   - Token decimal places (default 6).
 * @param mintAuthority - Mint authority public key (defaults to wallet).
 * @returns The new mint address.
 */
export async function createTestMint(
  provider: anchor.AnchorProvider,
  decimals = TOKEN_DECIMALS,
  mintAuthority?: PublicKey
): Promise<PublicKey> {
  const authority = mintAuthority ?? provider.wallet.publicKey;
  return createMint(
    provider.connection,
    (provider.wallet as anchor.Wallet).payer,
    authority,
    null,
    decimals
  );
}

/**
 * Create a new SPL token account.
 *
 * @param provider - Anchor provider.
 * @param mint     - The token mint address.
 * @param owner    - The owner of the new token account.
 * @returns The new token account address.
 */
export async function createTokenAccount(
  provider: anchor.AnchorProvider,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  return createAccount(
    provider.connection,
    (provider.wallet as anchor.Wallet).payer,
    mint,
    owner
  );
}

/**
 * Mint tokens into a token account.
 *
 * @param provider     - Anchor provider.
 * @param mint         - The token mint.
 * @param destination  - The destination token account.
 * @param authority    - The mint authority (defaults to wallet).
 * @param amount       - Amount in base units as a BN.
 */
export async function fundTokenAccount(
  provider: anchor.AnchorProvider,
  mint: PublicKey,
  destination: PublicKey,
  amount: BN,
  authority?: PublicKey
): Promise<void> {
  const mintAuth = authority ?? provider.wallet.publicKey;
  await mintTo(
    provider.connection,
    (provider.wallet as anchor.Wallet).payer,
    mint,
    destination,
    mintAuth,
    BigInt(amount.toString())
  );
}

/**
 * Get the token balance of an account.
 *
 * @param provider - Anchor provider.
 * @param account  - Token account address.
 * @returns Balance as a BN.
 */
export async function getTokenBalance(
  provider: anchor.AnchorProvider,
  account: PublicKey
): Promise<BN> {
  const info = await getAccount(provider.connection, account);
  return new BN(info.amount.toString());
}

// ─────────────────────────────────────────────────────────────────
// Bounty registry PDA helpers
// ─────────────────────────────────────────────────────────────────

/** PDA seed prefix for bounty records. */
const REGISTRY_SEED = Buffer.from("registry");

/**
 * Derive the PDA for a bounty record.
 *
 * @param bountyId  - Numeric bounty identifier.
 * @param programId - Bounty registry program address.
 * @returns [pda, bump] tuple.
 */
export function deriveBountyPda(
  bountyId: number | BN,
  programId: PublicKey
): [PublicKey, number] {
  const id = bountyId instanceof BN ? bountyId : new BN(bountyId);
  const idBuffer = id.toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddressSync(
    [REGISTRY_SEED, idBuffer],
    programId
  );
}

// ─────────────────────────────────────────────────────────────────
// Staking program PDA helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Derive all PDAs required for the staking program in one call.
 *
 * @param programId - Staking program address.
 * @returns Object with all static PDA addresses and bumps.
 */
export function deriveStakingPdas(programId: PublicKey): {
  configPda: PublicKey;
  configBump: number;
  vaultAuthority: PublicKey;
  vaultAuthorityBump: number;
  rewardPoolPda: PublicKey;
  rewardPoolBump: number;
} {
  const [configPda, configBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
  const [vaultAuthority, vaultAuthorityBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    programId
  );
  const [rewardPoolPda, rewardPoolBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("reward_pool")],
    programId
  );
  return {
    configPda,
    configBump,
    vaultAuthority,
    vaultAuthorityBump,
    rewardPoolPda,
    rewardPoolBump,
  };
}

/**
 * Derive the per-user staking PDAs.
 *
 * @param user      - The user's public key.
 * @param programId - Staking program address.
 * @returns Object with user-specific PDA addresses.
 */
export function deriveUserStakingPdas(
  user: PublicKey,
  programId: PublicKey
): {
  stakeAccountPda: PublicKey;
  stakeAccountBump: number;
  stakeVaultPda: PublicKey;
  stakeVaultBump: number;
} {
  const [stakeAccountPda, stakeAccountBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake"), user.toBuffer()],
    programId
  );
  const [stakeVaultPda, stakeVaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake_vault"), user.toBuffer()],
    programId
  );
  return { stakeAccountPda, stakeAccountBump, stakeVaultPda, stakeVaultBump };
}

// ─────────────────────────────────────────────────────────────────
// Clock / time helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Advance the local validator clock by burning fake transactions.
 *
 * Each slot is ~400ms on localnet. We approximate `seconds * 2.5`
 * slots to advance time. For precise warp, use bankrun's
 * `context.setClock()` instead.
 *
 * @param provider - Anchor provider.
 * @param seconds  - Number of seconds to advance.
 */
export async function advanceClock(
  provider: anchor.AnchorProvider,
  seconds: number
): Promise<void> {
  const slotsToAdvance = Math.ceil(seconds * 2.5);
  // Burning airdrop transactions generates slot activity.
  for (let i = 0; i < Math.min(slotsToAdvance, 50); i++) {
    await provider.connection.requestAirdrop(Keypair.generate().publicKey, 1);
  }
}

/**
 * Advance clock precisely using bankrun's Clock override.
 * Only available in bankrun test contexts.
 *
 * @param context  - bankrun ProgramTestContext.
 * @param seconds  - Seconds to add to the current unix timestamp.
 */
export async function warpClock(
  context: { setClock: (c: any) => Promise<void>; banksClient: any },
  seconds: number
): Promise<void> {
  const clock = await context.banksClient.getClock();
  await context.setClock({
    ...clock,
    unixTimestamp: clock.unixTimestamp + BigInt(seconds),
  });
}

// ─────────────────────────────────────────────────────────────────
// Test fixtures / deterministic data
// ─────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic 32-byte mock PR hash for testing.
 *
 * @param seed - A short string to seed the hash values.
 * @returns A 32-element number array.
 */
export function mockPrHash(seed: string): number[] {
  const hash = new Array(32).fill(0);
  for (let i = 0; i < seed.length && i < 32; i++) {
    hash[i] = seed.charCodeAt(i);
  }
  return hash;
}

/**
 * Build a valid GitHub issue URL for a given issue number.
 *
 * @param issueNumber - GitHub issue number.
 * @returns Full GitHub issue URL string.
 */
export function githubIssueUrl(issueNumber: number): string {
  return `https://github.com/SolFoundry/solfoundry/issues/${issueNumber}`;
}

/**
 * Build a valid GitHub PR URL for a given PR number.
 *
 * @param prNumber - GitHub PR number.
 * @returns Full GitHub PR URL string.
 */
export function githubPrUrl(prNumber: number): string {
  return `https://github.com/SolFoundry/solfoundry/pull/${prNumber}`;
}

/**
 * Generate five deterministic review scores (800–1000 range) for testing.
 *
 * @returns Array of 5 u16 scores suitable for `record_completion`.
 */
export function defaultReviewScores(): number[] {
  return [850, 900, 750, 800, 950];
}

/**
 * Calculate the expected final score as the average of five review scores.
 *
 * @param scores - Array of exactly 5 scores (0–1000 each).
 * @returns The integer average.
 */
export function expectedFinalScore(scores: number[]): number {
  return Math.floor(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// ─────────────────────────────────────────────────────────────────
// Transaction helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Confirm a transaction and throw if it fails.
 *
 * @param provider - Anchor provider.
 * @param sig      - Transaction signature.
 */
export async function confirmTx(
  provider: anchor.AnchorProvider,
  sig: string
): Promise<void> {
  await provider.connection.confirmTransaction(sig, "confirmed");
}

/**
 * Assert that an async call throws an AnchorError with a specific error code.
 *
 * @param fn        - Async function expected to throw.
 * @param errorCode - Expected `error.error.errorCode.code` string.
 */
export async function expectAnchorError(
  fn: () => Promise<unknown>,
  errorCode: string
): Promise<void> {
  const { AnchorError } = await import("@coral-xyz/anchor");
  try {
    await fn();
    throw new Error(`Expected AnchorError '${errorCode}' but no error was thrown`);
  } catch (err: any) {
    if (err instanceof AnchorError) {
      if (err.error.errorCode.code !== errorCode) {
        throw new Error(
          `Expected error '${errorCode}' but got '${err.error.errorCode.code}'`
        );
      }
    } else if (err.message?.includes("Expected AnchorError")) {
      throw err;
    } else {
      throw new Error(`Unexpected error type: ${err}`);
    }
  }
}
