import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { BountyRegistryClient } from "../../../contracts/bounty-registry/sdk/src/client";
import { BountyMetadata } from "./types";
import * as anchor from "@coral-xyz/anchor";

export class BountyPoster {
  private client: BountyRegistryClient;

  constructor(
    connection: Connection,
    wallet: Keypair,
    programId: PublicKey
  ) {
    // Mocking a provider for the SDK
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(wallet),
      { commitment: "confirmed" }
    );
    this.client = new BountyRegistryClient(provider, programId);
  }

  async postToRegistry(bounty: BountyMetadata) {
    try {
      console.log(`Registering bounty for issue: ${bounty.title}`);
      
      // Check if already exists (Logic would check a local DB or on-chain PDA)
      // For this implementation, we call the SDK's registerBounty
      const tx = await this.client.registerBounty({
        title: bounty.title,
        description: bounty.description,
        rewardAmount: new anchor.BN(bounty.rewardAmount),
        tier: bounty.tier,
        githubId: bounty.githubIssueId.toString(),
      });

      console.log(`Bounty registered successfully. TX: ${tx}`);
      return tx;
    } catch (error) {
      console.error(`Failed to post bounty ${bounty.githubIssueId}:`, error);
      throw error;
    }
  }
}
