/**
 * Type definitions and utility functions for the bounty registry SDK.
 *
 * Provides the program ID constant, PDA derivation helper, status enum,
 * and typed interfaces for on-chain bounty records.
 */

import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/**
 * The bounty registry program ID.
 * Must match the `declare_id!` in the Anchor program.
 */
export const PROGRAM_ID = new PublicKey(
  "DwCJkFvRD7NJqzUnPo1njptVScDJsMS6ezZPNXxRrQxe"
);

/** PDA seed prefix used for all bounty record accounts. */
export const REGISTRY_SEED = Buffer.from("registry");

/**
 * Lifecycle status of a bounty in the registry.
 *
 * Mirrors the on-chain `BountyStatus` enum. The state machine permits:
 * - Open -> Claimed -> InReview -> Completed
 * - Open -> Cancelled
 * - Claimed -> Cancelled
 */
export enum BountyStatus {
  /** Bounty is open and available for claiming. */
  Open = 0,
  /** A contributor has claimed the bounty and is working on it. */
  Claimed = 1,
  /** The contributor's PR is under multi-LLM review. */
  InReview = 2,
  /** The bounty has been completed and the PR merged (terminal). */
  Completed = 3,
  /** The bounty has been cancelled (terminal). */
  Cancelled = 4,
}

/**
 * Typed representation of an on-chain bounty record.
 *
 * All fields mirror the Anchor `BountyRecord` account structure.
 * Numeric values use `BN` for safe large-number handling.
 */
export interface BountyRecordData {
  /** Unique numeric identifier for this bounty. */
  bountyId: BN;
  /** Human-readable bounty title (max 64 characters). */
  title: string;
  /** Bounty tier (1, 2, or 3). */
  tier: number;
  /** Reward amount in smallest token unit. */
  rewardAmount: BN;
  /** Current lifecycle status. */
  status: { [key: string]: object };
  /** Admin pubkey who registered the bounty. */
  creator: PublicKey;
  /** Contributor pubkey (null if unclaimed). */
  contributor: PublicKey | null;
  /** GitHub issue reference. */
  githubIssue: string;
  /** GitHub PR reference (empty until completion). */
  githubPr: string;
  /** Review scores from each of the five LLM models (0-1000). */
  reviewScores: number[];
  /** Aggregated final review score (0-1000). */
  finalScore: number;
  /** SHA-256 hash of the merged PR diff (null until completion). */
  prHash: number[] | null;
  /** Unix timestamp of bounty registration. */
  createdAt: BN;
  /** Unix timestamp of last status update. */
  updatedAt: BN;
  /** Unix timestamp of completion (null if not completed). */
  completedAt: BN | null;
  /** PDA bump seed. */
  bump: number;
}

/**
 * Filter criteria for listing bounty records.
 *
 * Used by `listBounties` to apply client-side filtering on
 * fetched accounts.
 */
export interface BountyFilter {
  /** Filter by contributor public key. */
  contributor?: PublicKey;
  /** Filter by bounty status. */
  status?: BountyStatus;
  /** Filter by tier. */
  tier?: number;
}

/**
 * Derive the PDA address for a bounty record.
 *
 * Uses the seeds `["registry", bounty_id.to_le_bytes()]` as defined
 * in the Anchor program.
 *
 * @param bountyId - The unique numeric bounty identifier.
 * @param programId - The program ID (defaults to PROGRAM_ID).
 * @returns A tuple of [publicKey, bump] for the bounty record PDA.
 */
export function deriveBountyPda(
  bountyId: number | BN,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  const bountyIdBn = typeof bountyId === "number" ? new BN(bountyId) : bountyId;
  const bountyIdBuffer = bountyIdBn.toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddressSync(
    [REGISTRY_SEED, bountyIdBuffer],
    programId
  );
}
