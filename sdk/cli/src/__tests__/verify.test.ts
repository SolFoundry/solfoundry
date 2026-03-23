import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyCommand, fetchTransaction, getSignatureStatus } from '../commands/verify.js';

const VALID_SIG = '5KtPn1LGuxhFiwjxErkxTb7XxtzsHPFQPRHBFgR9ynB7kHYceBkP3icT2nYx7sRTJ';
// Pad to 88 chars to be a valid format
const VALID_TX = VALID_SIG.padEnd(88, '1');

const defaultOpts = { rpc: 'https://api.mainnet-beta.solana.com', json: false };

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  process.exitCode = undefined;
});

// ---------------------------------------------------------------------------
// fetchTransaction
// ---------------------------------------------------------------------------
describe('fetchTransaction', () => {
  it('returns null when transaction not found', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: null }),
    });
    const result = await fetchTransaction('https://rpc', VALID_TX, mockFetch as unknown as typeof fetch);
    expect(result).toBeNull();
  });

  it('throws on HTTP error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchTransaction('https://rpc', VALID_TX, mockFetch as unknown as typeof fetch)).rejects.toThrow('500');
  });

  it('throws on RPC error response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: { message: 'Transaction not found' } }),
    });
    await expect(fetchTransaction('https://rpc', VALID_TX, mockFetch as unknown as typeof fetch)).rejects.toThrow('Transaction not found');
  });
});

// ---------------------------------------------------------------------------
// getSignatureStatus
// ---------------------------------------------------------------------------
describe('getSignatureStatus', () => {
  it('returns confirmed:true for finalized tx', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { value: [{ confirmationStatus: 'finalized', err: null, slot: 123456 }] },
      }),
    });
    const s = await getSignatureStatus('https://rpc', VALID_TX, mockFetch as unknown as typeof fetch);
    expect(s.confirmed).toBe(true);
    expect(s.slot).toBe(123456);
  });

  it('returns confirmed:true for confirmed status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { value: [{ confirmationStatus: 'confirmed', err: null, slot: 999 }] },
      }),
    });
    const s = await getSignatureStatus('https://rpc', VALID_TX, mockFetch as unknown as typeof fetch);
    expect(s.confirmed).toBe(true);
  });

  it('returns confirmed:false for processed status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { value: [{ confirmationStatus: 'processed', err: null, slot: 1 }] },
      }),
    });
    const s = await getSignatureStatus('https://rpc', VALID_TX, mockFetch as unknown as typeof fetch);
    expect(s.confirmed).toBe(false);
  });

  it('returns confirmed:false when tx not found', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { value: [null] } }),
    });
    const s = await getSignatureStatus('https://rpc', VALID_TX, mockFetch as unknown as typeof fetch);
    expect(s.confirmed).toBe(false);
  });

  it('throws on HTTP error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(getSignatureStatus('https://rpc', VALID_TX, mockFetch as unknown as typeof fetch)).rejects.toThrow('429');
  });

  it('throws on RPC error payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: { message: 'Rate limited' } }),
    });
    await expect(getSignatureStatus('https://rpc', VALID_TX, mockFetch as unknown as typeof fetch)).rejects.toThrow('Rate limited');
  });
});

// ---------------------------------------------------------------------------
// verifyCommand
// ---------------------------------------------------------------------------
describe('verifyCommand', () => {
  it('sets exitCode 1 for empty tx hash', async () => {
    await verifyCommand('', defaultOpts);
    expect(process.exitCode).toBe(1);
  });

  it('sets exitCode 1 for invalid signature format', async () => {
    await verifyCommand('not-a-valid-sig', defaultOpts);
    expect(process.exitCode).toBe(1);
  });

  it('sets exitCode 1 on RPC fetch error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    await verifyCommand(VALID_TX, defaultOpts, mockFetch as unknown as typeof fetch);
    expect(process.exitCode).toBe(1);
  });

  it('sets exitCode 1 when tx not confirmed', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { value: [null] } }),
    });
    await verifyCommand(VALID_TX, defaultOpts, mockFetch as unknown as typeof fetch);
    expect(process.exitCode).toBe(1);
  });

  it('sets exitCode 1 when tx has on-chain error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { value: [{ confirmationStatus: 'finalized', err: { InstructionError: [0, 'Custom'] }, slot: 99 }] },
      }),
    });
    await verifyCommand(VALID_TX, defaultOpts, mockFetch as unknown as typeof fetch);
    expect(process.exitCode).toBe(1);
  });

  it('succeeds for confirmed tx with no error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { value: [{ confirmationStatus: 'finalized', err: null, slot: 123456 }] },
      }),
    });
    await verifyCommand(VALID_TX, defaultOpts, mockFetch as unknown as typeof fetch);
    expect(process.exitCode).toBeUndefined();
    expect(console.log).toHaveBeenCalled();
  });

  it('outputs JSON when --json flag set for confirmed tx', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { value: [{ confirmationStatus: 'finalized', err: null, slot: 789 }] },
      }),
    });
    await verifyCommand(VALID_TX, { ...defaultOpts, json: true }, mockFetch as unknown as typeof fetch);
    const logArgs = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(logArgs);
    expect(parsed.signature).toBe(VALID_TX);
    expect(parsed.confirmed).toBe(true);
  });
});
