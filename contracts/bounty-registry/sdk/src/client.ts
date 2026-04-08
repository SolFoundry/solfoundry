/**
 * High-level client for interacting with the SolFoundry bounty registry program.
 *
 * Wraps the Anchor-generated program interface to provide typed methods
 * for registering bounties, managing their lifecycle, recording completions,
 * and querying on-chain records.
 *
 * @example
 * ```typescript
 * const client = new BountyRegistryClient(provider);
 *
 * // Register a new bounty
 * await client.registerBounty(42, "Fix auth bug", 2, 500_000, "https://github.com/SolFoundry/solfoundry/issues/42");
 *
 * // Query by contributor
 * const bounties = await client.listByContributor(contributorPubkey);
 * ```
 */

import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { deriveBountyPda, REGISTRY_SEED } from "./types";
import type { BountyRecordData, BountyFilter } from "./types";
import { BountyStatus } from "./types";

/**
 * Client for the SolFoundry bounty registry Anchor program.
 *
 * Provides typed wrappers for all four program instructions
 * (register, update_status, record_completion, close) and
 * query methods for fetching bounty records by ID, contributor,
 * or status.
 */
export class BountyRegistryClient {
  /** The Anchor program instance. */
  public readonly program: Program;

  /** The Anchor provider (connection + wallet). */
  public readonly provider: AnchorProvider;

  /**
   * Create a new BountyRegistryClient.
   *
   * @param provider - Anchor provider with connection and wallet.
   * @param program - Pre-initialised Anchor program instance.
   */
  constructor(provider: AnchorProvider, program: Program) {
    this.provider = provider;
    this.program = program;
  }

  /**
   * Register a new bounty in the on-chain registry.
   *
   * Creates a PDA derived from `["registry", bountyId]` and initialises
   * all metadata fields. The connected wallet acts as the admin.
   *
   * @param bountyId - Unique numeric bounty identifier.
   * @param title - Human-readable title (max 64 chars).
   * @param tier - Bounty tier (1, 2, or 3).
   * @param rewardAmount - Reward in smallest token unit (metadata only).
   * @param githubIssue - GitHub issue URL or identifier (max 128 chars).
   * @returns The transaction signature.
   */
  async registerBounty(
    bountyId: number,
    title: string,
    tier: number,
    rewardAmount: number,
    githubIssue: string
  ): Promise<string> {
    const [bountyPda] = deriveBountyPda(bountyId, this.program.programId);

    return await (this.program.methods as any)
      .registerBounty(
        new BN(bountyId),
        title,
        tier,
        new BN(rewardAmount),
        githubIssue
      )
      .accounts({
        admin: this.provider.wallet.publicKey,
        bountyRecord: bountyPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Transition a bounty to a new lifecycle status.
   *
   * Enforces the state machine: Open->Claimed->InReview->Completed,
   * with Open/Claimed->Cancelled allowed.
   *
   * @param bountyId - The bounty to update.
   * @param newStatus - Target status (use BountyStatus enum).
   * @param contributor - Required when transitioning to Claimed.
   * @returns The transaction signature.
   */
  async updateStatus(
    bountyId: number,
    newStatus: BountyStatus,
    contributor?: PublicKey
  ): Promise<string> {
    const [bountyPda] = deriveBountyPda(bountyId, this.program.programId);

    return await (this.program.methods as any)
      .updateStatus(newStatus, contributor || null)
      .accounts({
        admin: this.provider.wallet.publicKey,
        bountyRecord: bountyPda,
      })
      .rpc();
  }

  /**
   * Record completion details for a reviewed bounty.
   *
   * Stores the PR reference, five individual review scores, the
   * aggregated final score, and a SHA-256 hash of the merged PR diff.
   * The bounty must be in InReview status.
   *
   * @param bountyId - The bounty to complete.
   * @param githubPr - GitHub PR URL or identifier (max 128 chars).
   * @param reviewScores - Array of exactly 5 scores (0-1000).
   * @param finalScore - Aggregated final score (0-1000).
   * @param prHash - SHA-256 hash of the merged PR diff (32 bytes).
   * @returns The transaction signature.
   */
  async recordCompletion(
    bountyId: number,
    githubPr: string,
    reviewScores: number[],
    finalScore: number,
    prHash: number[]
  ): Promise<string> {
    const [bountyPda] = deriveBountyPda(bountyId, this.program.programId);

    return await (this.program.methods as any)
      .recordCompletion(githubPr, reviewScores, finalScore, prHash)
      .accounts({
        admin: this.provider.wallet.publicKey,
        bountyRecord: bountyPda,
      })
      .rpc();
  }

  /**
   * Close (cancel) a bounty.
   *
   * Only permitted from Open or Claimed status. Once cancelled,
   * no further mutations are allowed.
   *
   * @param bountyId - The bounty to cancel.
   * @returns The transaction signature.
   */
  async closeBounty(bountyId: number): Promise<string> {
    const [bountyPda] = deriveBountyPda(bountyId, this.program.programId);

    return await (this.program.methods as any)
      .closeBounty()
      .accounts({
        admin: this.provider.wallet.publicKey,
        bountyRecord: bountyPda,
      })
      .rpc();
  }

  /**
   * Fetch a single bounty record by its numeric ID.
   *
   * @param bountyId - The bounty identifier.
   * @returns The on-chain bounty record data, or null if not found.
   */
  async fetchBounty(bountyId: number): Promise<BountyRecordData | null> {
    const [bountyPda] = deriveBountyPda(bountyId, this.program.programId);
    try {
      const account = await (this.program.account as any).bountyRecord.fetch(bountyPda);
      return account as BountyRecordData;
    } catch {
      return null;
    }
  }

  /**
   * Fetch the raw account info and PDA address for a bounty.
   *
   * Useful when you need both the data and the PDA pubkey.
   *
   * @param bountyId - The bounty identifier.
   * @returns Object with `address` and `data`, or null if not found.
   */
  async fetchBountyWithAddress(
    bountyId: number
  ): Promise<{ address: PublicKey; data: BountyRecordData } | null> {
    const [bountyPda] = deriveBountyPda(bountyId, this.program.programId);
    try {
      const account = await (this.program.account as any).bountyRecord.fetch(bountyPda);
      return { address: bountyPda, data: account as BountyRecordData };
    } catch {
      return null;
    }
  }

  /**
   * List all bounty records, optionally filtered by criteria.
   *
   * Fetches all program accounts of type `BountyRecord` and applies
   * client-side filtering based on the provided filter. For large
   * registries, consider using `getProgramAccounts` with memcmp
   * filters directly.
   *
   * @param filter - Optional filter criteria (contributor, status, tier).
   * @returns Array of matching bounty records with their PDA addresses.
   */
  async listBounties(
    filter?: BountyFilter
  ): Promise<Array<{ address: PublicKey; data: BountyRecordData }>> {
    const allAccounts = await (this.program.account as any).bountyRecord.all();

    let results = allAccounts.map((account: any) => ({
      address: account.publicKey as PublicKey,
      data: account.account as BountyRecordData,
    }));

    if (filter) {
      results = results.filter(
        (item: { address: PublicKey; data: BountyRecordData }) => {
          if (
            filter.contributor &&
            (!item.data.contributor ||
              !item.data.contributor.equals(filter.contributor))
          ) {
            return false;
          }
          if (filter.status !== undefined) {
            const statusKey = Object.keys(item.data.status)[0];
            const statusValue =
              BountyStatus[
                statusKey.charAt(0).toUpperCase() +
                  statusKey.slice(1) as keyof typeof BountyStatus
              ];
            if (statusValue !== filter.status) {
              return false;
            }
          }
          if (filter.tier !== undefined && item.data.tier !== filter.tier) {
            return false;
          }
          return true;
        }
      );
    }

    return results;
  }

  /**
   * List all bounty records assigned to a specific contributor.
   *
   * Convenience wrapper around `listBounties` with contributor filter.
   *
   * @param contributor - The contributor's public key.
   * @returns Array of matching bounty records.
   */
  async listByContributor(
    contributor: PublicKey
  ): Promise<Array<{ address: PublicKey; data: BountyRecordData }>> {
    return this.listBounties({ contributor });
  }

  /**
   * List all bounty records with a specific status.
   *
   * Convenience wrapper around `listBounties` with status filter.
   *
   * @param status - The target status to filter by.
   * @returns Array of matching bounty records.
   */
  async listByStatus(
    status: BountyStatus
  ): Promise<Array<{ address: PublicKey; data: BountyRecordData }>> {
    return this.listBounties({ status });
  }

  /**
   * Derive the PDA address for a bounty record without fetching.
   *
   * @param bountyId - The bounty identifier.
   * @returns The PDA public key.
   */
  getBountyAddress(bountyId: number): PublicKey {
    const [bountyPda] = deriveBountyPda(bountyId, this.program.programId);
    return bountyPda;
  }
}
