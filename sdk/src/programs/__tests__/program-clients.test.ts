import { describe, it, expect } from 'vitest';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Wallet, BN } from '@coral-xyz/anchor';
import { BountyRegistryClient } from '../BountyRegistryClient.js';
import { StakingClient } from '../StakingClient.js';
import { EscrowProgramClient } from '../EscrowClient.js';
import { ReputationClient } from '../ReputationClient.js';
import { TreasuryClient } from '../TreasuryClient.js';

function createTestConfig() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const wallet = new Wallet(Keypair.generate());
  return { connection, wallet };
}

describe('BountyRegistryClient', () => {
  it('initializes with default program ID', () => {
    const config = createTestConfig();
    const client = new BountyRegistryClient(config);
    expect(client.programId.toBase58()).toBe('DwCJkFvRD7NJqzUnPo1njptVScDJsMS6ezZPNXxRrQxe');
  });

  it('exposes the provider connection', () => {
    const config = createTestConfig();
    const client = new BountyRegistryClient(config);
    expect(client.connection).toBe(config.connection);
  });

  it('derives bounty record PDA deterministically', () => {
    const bountyId = new BN(42);
    const [pda1] = BountyRegistryClient.deriveBountyRecordPDA(bountyId);
    const [pda2] = BountyRegistryClient.deriveBountyRecordPDA(bountyId);
    expect(pda1.toBase58()).toBe(pda2.toBase58());
  });

  it('derives different PDAs for different bounty IDs', () => {
    const [pda1] = BountyRegistryClient.deriveBountyRecordPDA(new BN(1));
    const [pda2] = BountyRegistryClient.deriveBountyRecordPDA(new BN(2));
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });

  it('has all instruction methods', () => {
    const config = createTestConfig();
    const client = new BountyRegistryClient(config);
    expect(typeof client.registerBounty).toBe('function');
    expect(typeof client.updateStatus).toBe('function');
    expect(typeof client.recordCompletion).toBe('function');
    expect(typeof client.closeBounty).toBe('function');
    expect(typeof client.fetchBountyRecord).toBe('function');
    expect(typeof client.fetchBountyRecordByAddress).toBe('function');
  });
});

describe('StakingClient', () => {
  it('initializes with default program ID', () => {
    const config = createTestConfig();
    const client = new StakingClient(config);
    expect(client.programId.toBase58()).toBe('Wkvaa5DdWWN1GWAa4UX26CJzGuU5otXF7obLL27TFET');
  });

  it('derives config PDA deterministically', () => {
    const [pda1] = StakingClient.deriveConfigPDA();
    const [pda2] = StakingClient.deriveConfigPDA();
    expect(pda1.toBase58()).toBe(pda2.toBase58());
  });

  it('derives stake account PDA per user', () => {
    const user1 = Keypair.generate().publicKey;
    const user2 = Keypair.generate().publicKey;
    const [pda1] = StakingClient.deriveStakeAccountPDA(user1);
    const [pda2] = StakingClient.deriveStakeAccountPDA(user2);
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });

  it('derives vault authority PDA', () => {
    const [pda, bump] = StakingClient.deriveVaultAuthorityPDA();
    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });

  it('has all instruction methods', () => {
    const config = createTestConfig();
    const client = new StakingClient(config);
    expect(typeof client.initialize).toBe('function');
    expect(typeof client.stake).toBe('function');
    expect(typeof client.unstakeInitiate).toBe('function');
    expect(typeof client.unstakeComplete).toBe('function');
    expect(typeof client.claimRewards).toBe('function');
    expect(typeof client.compound).toBe('function');
    expect(typeof client.slash).toBe('function');
    expect(typeof client.toggleAutoCompound).toBe('function');
    expect(typeof client.updateConfig).toBe('function');
    expect(typeof client.fetchConfig).toBe('function');
    expect(typeof client.fetchStakeAccount).toBe('function');
  });
});

describe('EscrowProgramClient (stub)', () => {
  it('initializes with default program ID', () => {
    const config = createTestConfig();
    const client = new EscrowProgramClient(config);
    expect(client.programId).toBeInstanceOf(PublicKey);
  });

  it('derives escrow PDA', () => {
    const bountyIdBytes = Buffer.from('test-bounty');
    const [pda] = EscrowProgramClient.deriveEscrowPDA(bountyIdBytes);
    expect(pda).toBeInstanceOf(PublicKey);
  });

  it('stub methods throw not-deployed error', async () => {
    const config = createTestConfig();
    const client = new EscrowProgramClient(config);
    await expect(client.createEscrow()).rejects.toThrow('not yet deployed');
    await expect(client.fundEscrow()).rejects.toThrow('not yet deployed');
    await expect(client.releaseEscrow()).rejects.toThrow('not yet deployed');
    await expect(client.refundEscrow()).rejects.toThrow('not yet deployed');
    await expect(client.fetchEscrow()).rejects.toThrow('not yet deployed');
  });
});

describe('ReputationClient (stub)', () => {
  it('initializes with default program ID', () => {
    const config = createTestConfig();
    const client = new ReputationClient(config);
    expect(client.programId).toBeInstanceOf(PublicKey);
  });

  it('derives reputation PDA per user', () => {
    const user = Keypair.generate().publicKey;
    const [pda] = ReputationClient.deriveReputationPDA(user);
    expect(pda).toBeInstanceOf(PublicKey);
  });

  it('stub methods throw not-deployed error', async () => {
    const config = createTestConfig();
    const client = new ReputationClient(config);
    await expect(client.initializeReputation()).rejects.toThrow('not yet deployed');
    await expect(client.updateScore()).rejects.toThrow('not yet deployed');
    await expect(client.fetchReputation()).rejects.toThrow('not yet deployed');
  });
});

describe('TreasuryClient (stub)', () => {
  it('initializes with default program ID', () => {
    const config = createTestConfig();
    const client = new TreasuryClient(config);
    expect(client.programId).toBeInstanceOf(PublicKey);
  });

  it('derives treasury PDA', () => {
    const [pda] = TreasuryClient.deriveTreasuryPDA();
    expect(pda).toBeInstanceOf(PublicKey);
  });

  it('stub methods throw not-deployed error', async () => {
    const config = createTestConfig();
    const client = new TreasuryClient(config);
    await expect(client.deposit()).rejects.toThrow('not yet deployed');
    await expect(client.withdraw()).rejects.toThrow('not yet deployed');
    await expect(client.fetchTreasury()).rejects.toThrow('not yet deployed');
  });
});

describe('IDL loading', () => {
  it('bounty registry IDL loads the correct program address', async () => {
    const idl = await import('../../../idl/bounty_registry.json');
    expect(idl.address).toBe('DwCJkFvRD7NJqzUnPo1njptVScDJsMS6ezZPNXxRrQxe');
    expect(idl.metadata.name).toBe('bounty_registry');
  });

  it('fndry staking IDL loads the correct program address', async () => {
    const idl = await import('../../../idl/fndry_staking.json');
    expect(idl.address).toBe('Wkvaa5DdWWN1GWAa4UX26CJzGuU5otXF7obLL27TFET');
    expect(idl.metadata.name).toBe('fndry_staking');
  });

  it('bounty registry IDL has all expected instructions', async () => {
    const idl = await import('../../../idl/bounty_registry.json');
    const instructionNames = idl.instructions.map((ix: { name: string }) => ix.name);
    expect(instructionNames).toContain('register_bounty');
    expect(instructionNames).toContain('update_status');
    expect(instructionNames).toContain('record_completion');
    expect(instructionNames).toContain('close_bounty');
  });

  it('fndry staking IDL has all expected instructions', async () => {
    const idl = await import('../../../idl/fndry_staking.json');
    const instructionNames = idl.instructions.map((ix: { name: string }) => ix.name);
    expect(instructionNames).toContain('initialize');
    expect(instructionNames).toContain('stake');
    expect(instructionNames).toContain('unstake_initiate');
    expect(instructionNames).toContain('unstake_complete');
    expect(instructionNames).toContain('claim_rewards');
    expect(instructionNames).toContain('compound');
    expect(instructionNames).toContain('slash');
    expect(instructionNames).toContain('toggle_auto_compound');
    expect(instructionNames).toContain('update_config');
  });
});
