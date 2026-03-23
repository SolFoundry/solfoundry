import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet, type Idl } from '@coral-xyz/anchor';

export interface ProgramClientConfig {
  readonly connection: Connection;
  readonly wallet: Wallet;
  readonly programId?: PublicKey;
}

export abstract class BaseClient {
  readonly program: Program;
  readonly provider: AnchorProvider;

  protected constructor(
    idl: Idl,
    config: ProgramClientConfig,
    defaultProgramId: PublicKey,
  ) {
    const programId = config.programId ?? defaultProgramId;
    this.provider = new AnchorProvider(config.connection, config.wallet, {
      commitment: 'confirmed',
    });
    this.program = new Program(idl, this.provider);
    if (this.program.programId.toBase58() !== programId.toBase58()) {
      throw new Error(
        `Program ID mismatch: IDL declares ${this.program.programId.toBase58()}, expected ${programId.toBase58()}`,
      );
    }
  }

  get programId(): PublicKey {
    return this.program.programId;
  }

  get connection(): Connection {
    return this.provider.connection;
  }
}
