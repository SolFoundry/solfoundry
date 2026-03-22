/**
 * Tests for the useEscrow hook's query key factory.
 * Validates escrow query key generation for cache consistency.
 *
 * The constants module is mocked to avoid PublicKey construction
 * in the test environment (no Solana buffers needed for key tests).
 *
 * @module hooks/__tests__/useEscrow.test
 */

import { describe, it, expect, vi } from 'vitest';

/** Mock Solana constants to prevent PublicKey initialization errors. */
vi.mock('../../config/constants', () => ({
  FNDRY_TOKEN_MINT: { toBuffer: () => Buffer.alloc(32) },
  FNDRY_DECIMALS: 9,
  ESCROW_WALLET: { toBase58: () => 'MockEscrow1111111111111111111111111111111' },
  TOKEN_PROGRAM_ID: { toBuffer: () => Buffer.alloc(32) },
  ASSOCIATED_TOKEN_PROGRAM_ID: { toBuffer: () => Buffer.alloc(32) },
  findAssociatedTokenAddress: vi.fn(),
  solscanTxUrl: vi.fn(),
  solscanAddressUrl: vi.fn(),
}));

/** Mock escrow service to avoid API imports. */
vi.mock('../../services/escrowService', () => ({
  fetchEscrowAccount: vi.fn(),
  recordDeposit: vi.fn(),
  recordRelease: vi.fn(),
  recordRefund: vi.fn(),
}));

import { escrowKeys } from '../useEscrow';

describe('escrowKeys', () => {
  it('generates correct base key', () => {
    expect(escrowKeys.all).toEqual(['escrow']);
  });

  it('generates correct account key with bounty ID', () => {
    const key = escrowKeys.account('bounty-abc');
    expect(key).toEqual(['escrow', 'account', 'bounty-abc']);
  });

  it('generates correct transactions key with bounty ID', () => {
    const key = escrowKeys.transactions('bounty-xyz');
    expect(key).toEqual(['escrow', 'transactions', 'bounty-xyz']);
  });

  it('generates unique keys for different bounty IDs', () => {
    const key1 = escrowKeys.account('bounty-1');
    const key2 = escrowKeys.account('bounty-2');
    expect(key1).not.toEqual(key2);
  });

  it('account key includes the base key as prefix', () => {
    const key = escrowKeys.account('test-id');
    expect(key[0]).toBe('escrow');
    expect(key[1]).toBe('account');
    expect(key[2]).toBe('test-id');
  });
});
