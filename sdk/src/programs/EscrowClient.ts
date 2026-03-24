import { Connection, PublicKey } from '@solana/web3.js';
import type { Wallet } from '@coral-xyz/anchor';

const DEFAULT_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
const ESCROW_SEED = Buffer.from('escrow');

export interface EscrowProgramClientConfig {
  readonly connection: Connection;
  readonly wallet: Wallet;
  readonly programId?: PublicKey;
}

export class EscrowProgramClient {
  readonly connection: Connection;
  readonly wallet: Wallet;
  readonly programId: PublicKey;

  constructor(config: EscrowProgramClientConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.programId = config.programId ?? DEFAULT_PROGRAM_ID;
  }

  static deriveEscrowPDA(
    bountyId: Uint8Array,
    programId: PublicKey = DEFAULT_PROGRAM_ID,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([ESCROW_SEED, bountyId], programId);
  }

  async createEscrow(): Promise<string> {
    throw new Error('EscrowProgramClient: program not yet deployed');
  }

  async fundEscrow(): Promise<string> {
    throw new Error('EscrowProgramClient: program not yet deployed');
  }

  async releaseEscrow(): Promise<string> {
    throw new Error('EscrowProgramClient: program not yet deployed');
  }

  async refundEscrow(): Promise<string> {
    throw new Error('EscrowProgramClient: program not yet deployed');
  }

  async fetchEscrow(): Promise<unknown> {
    throw new Error('EscrowProgramClient: program not yet deployed');
  }
}
