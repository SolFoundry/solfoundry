import { PublicKey, type TransactionSignature } from '@solana/web3.js';
import { BN, type Idl } from '@coral-xyz/anchor';
import { BaseClient, type ProgramClientConfig } from './BaseClient.js';
import idl from '../../idl/fndry_staking.json' with { type: 'json' };

const PROGRAM_ID = new PublicKey('Wkvaa5DdWWN1GWAa4UX26CJzGuU5otXF7obLL27TFET');
const CONFIG_SEED = Buffer.from('config');
const STAKE_SEED = Buffer.from('stake');
const VAULT_AUTHORITY_SEED = Buffer.from('vault_authority');

export class StakingClient extends BaseClient {
  constructor(config: ProgramClientConfig) {
    super(idl as unknown as Idl, config, PROGRAM_ID);
  }

  static deriveConfigPDA(programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([CONFIG_SEED], programId);
  }

  static deriveStakeAccountPDA(user: PublicKey, programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([STAKE_SEED, user.toBuffer()], programId);
  }

  static deriveVaultAuthorityPDA(programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([VAULT_AUTHORITY_SEED], programId);
  }

  async initialize(): Promise<TransactionSignature> {
    return this.program.methods.initialize().rpc();
  }

  async stake(amount: BN): Promise<TransactionSignature> {
    return this.program.methods.stake(amount).rpc();
  }

  async unstakeInitiate(amount: BN): Promise<TransactionSignature> {
    return this.program.methods.unstakeInitiate(amount).rpc();
  }

  async unstakeComplete(): Promise<TransactionSignature> {
    return this.program.methods.unstakeComplete().rpc();
  }

  async claimRewards(): Promise<TransactionSignature> {
    return this.program.methods.claimRewards().rpc();
  }

  async compound(): Promise<TransactionSignature> {
    return this.program.methods.compound().rpc();
  }

  async slash(userPubkey: PublicKey, amount: BN): Promise<TransactionSignature> {
    return this.program.methods.slash(userPubkey, amount).rpc();
  }

  async toggleAutoCompound(enabled: boolean): Promise<TransactionSignature> {
    return this.program.methods.toggleAutoCompound(enabled).rpc();
  }

  async updateConfig(params: {
    tierThresholds?: BN[] | null;
    tierApyBps?: number[] | null;
    cooldownSeconds?: BN | null;
    paused?: boolean | null;
  }): Promise<TransactionSignature> {
    return this.program.methods
      .updateConfig({
        tierThresholds: params.tierThresholds ?? null,
        tierApyBps: params.tierApyBps ?? null,
        cooldownSeconds: params.cooldownSeconds ?? null,
        paused: params.paused ?? null,
      })
      .rpc();
  }

  async fetchConfig(): Promise<unknown> {
    const [configPDA] = StakingClient.deriveConfigPDA(this.programId);
    return (this.program.account as any)['stakingConfig'].fetch(configPDA);
  }

  async fetchStakeAccount(user: PublicKey): Promise<unknown> {
    const [stakeAccountPDA] = StakingClient.deriveStakeAccountPDA(user, this.programId);
    return (this.program.account as any)['stakeAccount'].fetch(stakeAccountPDA);
  }
}
