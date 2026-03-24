import { Connection, PublicKey } from '@solana/web3.js';
import type { Wallet } from '@coral-xyz/anchor';

const DEFAULT_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
const REPUTATION_SEED = Buffer.from('reputation');

export interface ReputationClientConfig {
  readonly connection: Connection;
  readonly wallet: Wallet;
  readonly programId?: PublicKey;
}

export class ReputationClient {
  readonly connection: Connection;
  readonly wallet: Wallet;
  readonly programId: PublicKey;

  constructor(config: ReputationClientConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.programId = config.programId ?? DEFAULT_PROGRAM_ID;
  }

  static deriveReputationPDA(
    user: PublicKey,
    programId: PublicKey = DEFAULT_PROGRAM_ID,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([REPUTATION_SEED, user.toBuffer()], programId);
  }

  async initializeReputation(): Promise<string> {
    throw new Error('ReputationClient: program not yet deployed');
  }

  async updateScore(): Promise<string> {
    throw new Error('ReputationClient: program not yet deployed');
  }

  async fetchReputation(): Promise<unknown> {
    throw new Error('ReputationClient: program not yet deployed');
  }
}
