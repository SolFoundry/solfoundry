import { Connection, PublicKey } from '@solana/web3.js';
import type { Wallet } from '@coral-xyz/anchor';

const DEFAULT_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
const TREASURY_SEED = Buffer.from('treasury');

export interface TreasuryClientConfig {
  readonly connection: Connection;
  readonly wallet: Wallet;
  readonly programId?: PublicKey;
}

export class TreasuryClient {
  readonly connection: Connection;
  readonly wallet: Wallet;
  readonly programId: PublicKey;

  constructor(config: TreasuryClientConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.programId = config.programId ?? DEFAULT_PROGRAM_ID;
  }

  static deriveTreasuryPDA(
    programId: PublicKey = DEFAULT_PROGRAM_ID,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([TREASURY_SEED], programId);
  }

  async deposit(): Promise<string> {
    throw new Error('TreasuryClient: program not yet deployed');
  }

  async withdraw(): Promise<string> {
    throw new Error('TreasuryClient: program not yet deployed');
  }

  async fetchTreasury(): Promise<unknown> {
    throw new Error('TreasuryClient: program not yet deployed');
  }
}
