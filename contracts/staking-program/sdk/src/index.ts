/**
 * FNDRY Staking SDK — TypeScript client for the FNDRY staking program.
 *
 * Provides typed wrappers around each program instruction, PDA derivation
 * helpers, reward calculation utilities, and type definitions matching
 * the on-chain account structures.
 *
 * @module fndry-staking-sdk
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Keypair,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Seed prefix for the global staking configuration PDA. */
export const CONFIG_SEED = "config";

/** Seed prefix for per-user stake account PDAs. */
export const STAKE_SEED = "stake";

/** Seed prefix for per-user stake vault token account PDAs. */
export const STAKE_VAULT_SEED = "stake_vault";

/** Seed prefix for the vault authority PDA. */
export const VAULT_AUTHORITY_SEED = "vault_authority";

/** Seed prefix for the reward pool token account PDA. */
export const REWARD_POOL_SEED = "reward_pool";

/** Seven-day cooldown in seconds. */
export const COOLDOWN_SECONDS = 7 * 24 * 60 * 60;

/** Seconds in a year (365 days). */
export const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

/** Basis points divisor (10,000 = 100%). */
export const BPS_DIVISOR = 10_000;

// ---------------------------------------------------------------------------
// Staking tier definitions
// ---------------------------------------------------------------------------

/** Staking tier thresholds and APY rates. */
export interface StakingTierInfo {
  /** Human-readable tier name. */
  name: string;
  /** Minimum stake amount in base token units (6 decimals). */
  minStake: BN;
  /** Annual percentage yield in basis points. */
  apyBps: number;
  /** Reputation multiplier for this tier. */
  reputationMultiplier: number;
}

/** Default staking tier configurations. */
export const STAKING_TIERS: StakingTierInfo[] = [
  {
    name: "Bronze",
    minStake: new BN(10_000_000_000),   // 10,000 $FNDRY
    apyBps: 500,                         // 5.00%
    reputationMultiplier: 1.5,
  },
  {
    name: "Silver",
    minStake: new BN(50_000_000_000),   // 50,000 $FNDRY
    apyBps: 800,                         // 8.00%
    reputationMultiplier: 1.5,
  },
  {
    name: "Gold",
    minStake: new BN(100_000_000_000),  // 100,000 $FNDRY
    apyBps: 1200,                        // 12.00%
    reputationMultiplier: 1.5,
  },
];

// ---------------------------------------------------------------------------
// PDA derivation helpers
// ---------------------------------------------------------------------------

/**
 * Derives the global staking config PDA address.
 *
 * @param programId - The staking program ID.
 * @returns A tuple of [PDA address, bump seed].
 */
export function findConfigPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    programId
  );
}

/**
 * Derives a user's stake account PDA address.
 *
 * @param userPubkey - The user's wallet public key.
 * @param programId - The staking program ID.
 * @returns A tuple of [PDA address, bump seed].
 */
export function findStakeAccountPda(
  userPubkey: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(STAKE_SEED), userPubkey.toBuffer()],
    programId
  );
}

/**
 * Derives a user's stake vault token account PDA address.
 *
 * @param userPubkey - The user's wallet public key.
 * @param programId - The staking program ID.
 * @returns A tuple of [PDA address, bump seed].
 */
export function findStakeVaultPda(
  userPubkey: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(STAKE_VAULT_SEED), userPubkey.toBuffer()],
    programId
  );
}

/**
 * Derives the vault authority PDA address.
 *
 * @param programId - The staking program ID.
 * @returns A tuple of [PDA address, bump seed].
 */
export function findVaultAuthorityPda(
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_AUTHORITY_SEED)],
    programId
  );
}

/**
 * Derives the reward pool token account PDA address.
 *
 * @param programId - The staking program ID.
 * @returns A tuple of [PDA address, bump seed].
 */
export function findRewardPoolPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(REWARD_POOL_SEED)],
    programId
  );
}

// ---------------------------------------------------------------------------
// Reward calculation utility
// ---------------------------------------------------------------------------

/**
 * Calculates expected rewards for a staking position.
 *
 * Uses the same formula as the on-chain program:
 * `reward = amount * apy_bps * duration_seconds / (10_000 * SECONDS_PER_YEAR)`
 *
 * @param amount - Staked amount in base token units.
 * @param durationSeconds - Duration of the stake in seconds.
 * @param apyBps - Annual percentage yield in basis points.
 * @returns The calculated reward amount in base token units.
 */
export function calculateRewards(
  amount: BN,
  durationSeconds: BN,
  apyBps: number
): BN {
  if (amount.isZero() || apyBps === 0 || durationSeconds.isNeg() || durationSeconds.isZero()) {
    return new BN(0);
  }

  const numerator = amount
    .mul(new BN(apyBps))
    .mul(durationSeconds);

  const denominator = new BN(BPS_DIVISOR).mul(new BN(SECONDS_PER_YEAR));

  return numerator.div(denominator);
}

/**
 * Determines the staking tier for a given amount.
 *
 * @param amount - The staked amount in base token units.
 * @returns The tier info, or null if below minimum threshold.
 */
export function getTierForAmount(amount: BN): StakingTierInfo | null {
  let bestTier: StakingTierInfo | null = null;
  for (const tier of STAKING_TIERS) {
    if (amount.gte(tier.minStake)) {
      bestTier = tier;
    }
  }
  return bestTier;
}

// ---------------------------------------------------------------------------
// On-chain account type interfaces
// ---------------------------------------------------------------------------

/** On-chain StakingConfig account data. */
export interface StakingConfigAccount {
  /** Admin authority public key. */
  admin: PublicKey;
  /** $FNDRY token mint. */
  tokenMint: PublicKey;
  /** Reward pool vault token account. */
  rewardPoolVault: PublicKey;
  /** Config PDA bump seed. */
  configBump: number;
  /** Vault authority PDA bump seed. */
  vaultAuthorityBump: number;
  /** Tier thresholds (Bronze, Silver, Gold). */
  tierThresholds: BN[];
  /** APY in basis points per tier. */
  tierApyBps: number[];
  /** Cooldown duration in seconds. */
  cooldownSeconds: BN;
  /** Total tokens currently staked globally. */
  totalStaked: BN;
  /** Total rewards distributed to date. */
  totalRewardsDistributed: BN;
  /** Number of active stake accounts. */
  activeStakers: BN;
  /** Whether the program is paused. */
  paused: boolean;
}

/** On-chain StakeAccount data. */
export interface StakeAccountData {
  /** Owner wallet public key. */
  owner: PublicKey;
  /** Amount of $FNDRY currently staked. */
  amount: BN;
  /** Unix timestamp of initial stake. */
  stakedAt: BN;
  /** Unix timestamp of last reward claim. */
  lastClaim: BN;
  /** Total lifetime rewards earned. */
  rewardsEarned: BN;
  /** Pending unclaimed rewards. */
  pendingRewards: BN;
  /** Whether an unstake cooldown is active. */
  cooldownActive: boolean;
  /** Unix timestamp when cooldown started. */
  cooldownStart: BN;
  /** Amount being unstaked in cooldown. */
  cooldownAmount: BN;
  /** Whether auto-compound is enabled. */
  autoCompound: boolean;
  /** PDA bump seed. */
  bump: number;
}

// ---------------------------------------------------------------------------
// Client class
// ---------------------------------------------------------------------------

/**
 * High-level client for interacting with the FNDRY staking program.
 *
 * Wraps Anchor's generated program methods with additional PDA
 * derivation, account setup, and error handling.
 */
export class FndryStakingClient {
  /** The underlying Anchor program instance. */
  readonly program: Program;
  /** The $FNDRY token mint public key. */
  readonly tokenMint: PublicKey;

  /**
   * Creates a new FNDRY staking client.
   *
   * @param program - The Anchor program instance (from IDL).
   * @param tokenMint - The $FNDRY token mint public key.
   */
  constructor(program: Program, tokenMint: PublicKey) {
    this.program = program;
    this.tokenMint = tokenMint;
  }

  /**
   * Derives all PDAs needed for the staking program.
   *
   * @returns An object containing all PDA addresses and bumps.
   */
  getPdas() {
    const [config, configBump] = findConfigPda(this.program.programId);
    const [vaultAuthority, vaultAuthorityBump] = findVaultAuthorityPda(
      this.program.programId
    );
    const [rewardPool, rewardPoolBump] = findRewardPoolPda(
      this.program.programId
    );

    return {
      config,
      configBump,
      vaultAuthority,
      vaultAuthorityBump,
      rewardPool,
      rewardPoolBump,
    };
  }

  /**
   * Derives per-user PDAs for a given wallet.
   *
   * @param userPubkey - The user's wallet public key.
   * @returns An object containing the user's stake account and vault PDAs.
   */
  getUserPdas(userPubkey: PublicKey) {
    const [stakeAccount, stakeAccountBump] = findStakeAccountPda(
      userPubkey,
      this.program.programId
    );
    const [stakeVault, stakeVaultBump] = findStakeVaultPda(
      userPubkey,
      this.program.programId
    );

    return {
      stakeAccount,
      stakeAccountBump,
      stakeVault,
      stakeVaultBump,
    };
  }

  /**
   * Fetches the global staking configuration account.
   *
   * @returns The deserialized StakingConfig account data.
   */
  async fetchConfig(): Promise<StakingConfigAccount> {
    const { config } = this.getPdas();
    return (await this.program.account.stakingConfig.fetch(
      config
    )) as unknown as StakingConfigAccount;
  }

  /**
   * Fetches a user's stake account data.
   *
   * @param userPubkey - The user's wallet public key.
   * @returns The deserialized StakeAccount data, or null if not found.
   */
  async fetchStakeAccount(
    userPubkey: PublicKey
  ): Promise<StakeAccountData | null> {
    const { stakeAccount } = this.getUserPdas(userPubkey);
    try {
      return (await this.program.account.stakeAccount.fetch(
        stakeAccount
      )) as unknown as StakeAccountData;
    } catch {
      return null;
    }
  }
}
