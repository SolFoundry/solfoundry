import { PublicKey, type TransactionSignature } from '@solana/web3.js';
import { BN, type Idl } from '@coral-xyz/anchor';
import { BaseClient, type ProgramClientConfig } from './BaseClient.js';
import idl from '../../idl/bounty_registry.json' with { type: 'json' };

const PROGRAM_ID = new PublicKey('DwCJkFvRD7NJqzUnPo1njptVScDJsMS6ezZPNXxRrQxe');
const REGISTRY_SEED = Buffer.from('registry');

export class BountyRegistryClient extends BaseClient {
  constructor(config: ProgramClientConfig) {
    super(idl as unknown as Idl, config, PROGRAM_ID);
  }

  static deriveBountyRecordPDA(bountyId: BN, programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [REGISTRY_SEED, bountyId.toArrayLike(Buffer, 'le', 8)],
      programId,
    );
  }

  async registerBounty(
    bountyId: BN,
    title: string,
    tier: number,
    rewardAmount: BN,
    githubIssue: string,
  ): Promise<TransactionSignature> {
    const [bountyRecord] = BountyRegistryClient.deriveBountyRecordPDA(bountyId, this.programId);
    return this.program.methods
      .registerBounty(bountyId, title, tier, rewardAmount, githubIssue)
      .accounts({ admin: this.provider.wallet.publicKey, bountyRecord })
      .rpc();
  }
async registerBounty(
    bountyId: BN,
    title: string,
    tier: number,
    rewardAmount: BN,
    githubIssue: string,
  ): Promise<TransactionSignature> {
    if (!bountyId || !title || !githubIssue || rewardAmount.lte(new BN(0))) {
      throw new Error('Invalid bounty data: bountyId, title, githubIssue, and rewardAmount are required, and rewardAmount must be greater than zero.');
    }
    const [bountyRecord] = BountyRegistryClient.deriveBountyRecordPDA(bountyId, this.programId);
    try {
      return await this.program.methods
        .registerBounty(bountyId, title, tier, rewardAmount, githubIssue)
        .accounts({ admin: this.provider.wallet.publicKey, bountyRecord })
        .rpc();
    } catch (error) {
      throw new Error(`Failed to register bounty: ${error.message}`);
    }
  }
      .updateStatus(newStatus, contributor)
      .accounts({ admin: this.provider.wallet.publicKey, bountyRecord })
      .rpc();
  }

  async recordCompletion(
    bountyId: BN,
    githubPr: string,
    reviewScores: number[],
    finalScore: number,
    prHash: number[],
  ): Promise<TransactionSignature> {
    const [bountyRecord] = BountyRegistryClient.deriveBountyRecordPDA(bountyId, this.programId);
    return this.program.methods
      .recordCompletion(githubPr, reviewScores, finalScore, prHash)
      .accounts({ admin: this.provider.wallet.publicKey, bountyRecord })
      .rpc();
  }

  async closeBounty(bountyId: BN): Promise<TransactionSignature> {
    const [bountyRecord] = BountyRegistryClient.deriveBountyRecordPDA(bountyId, this.programId);
    return this.program.methods
      .closeBounty()
      .accounts({ admin: this.provider.wallet.publicKey, bountyRecord })
      .rpc();
  }

  async fetchBountyRecord(bountyId: BN): Promise<unknown> {
    const [bountyRecord] = BountyRegistryClient.deriveBountyRecordPDA(bountyId, this.programId);
    return (this.program.account as any)['bountyRecord'].fetch(bountyRecord);
  }

  async fetchBountyRecordByAddress(address: PublicKey): Promise<unknown> {
    return (this.program.account as any)['bountyRecord'].fetch(address);
  }
}
