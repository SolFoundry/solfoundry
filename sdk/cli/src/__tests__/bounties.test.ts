import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bountiesCommand } from '../commands/bounties.js';

const mockList = vi.fn();
const mockClient = {
  bounties: { list: mockList },
} as unknown as Parameters<typeof bountiesCommand>[0];

const defaultOpts = { status: 'open', limit: '20', json: false };

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.resetAllMocks();
  process.exitCode = undefined;
});

describe('bountiesCommand', () => {
  it('prints table when bounties returned', async () => {
    mockList.mockResolvedValue({
      bounties: [
        { id: 'b1', title: 'Fix bug', tier: 1, reward_amount: 500, status: 'open', deadline: null },
      ],
      total: 1,
    });

    await bountiesCommand(mockClient, defaultOpts);
    expect(mockList).toHaveBeenCalledWith({ status: 'open', limit: 20 });
    expect(console.log).toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it('handles items array shape', async () => {
    mockList.mockResolvedValue({
      items: [{ id: 'b2', title: 'Add feature', tier: 2, reward_amount: 1000, status: 'open', deadline: '2025-12-31' }],
      total: 1,
    });
    await bountiesCommand(mockClient, defaultOpts);
    expect(console.log).toHaveBeenCalled();
  });

  it('prints empty message when no bounties', async () => {
    mockList.mockResolvedValue({ bounties: [], total: 0 });
    await bountiesCommand(mockClient, defaultOpts);
    expect(console.log).toHaveBeenCalled();
  });

  it('outputs JSON when --json flag is set', async () => {
    const result = { bounties: [], total: 0 };
    mockList.mockResolvedValue(result);
    await bountiesCommand(mockClient, { ...defaultOpts, json: true });
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(result, null, 2));
  });

  it('sets exitCode 1 on API error', async () => {
    mockList.mockRejectedValue(new Error('network error'));
    await bountiesCommand(mockClient, defaultOpts);
    expect(process.exitCode).toBe(1);
  });

  it('rejects invalid tier value', async () => {
    await bountiesCommand(mockClient, { ...defaultOpts, tier: '5' });
    expect(process.exitCode).toBe(1);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('accepts valid tier values', async () => {
    mockList.mockResolvedValue({ bounties: [], total: 0 });
    for (const tier of ['1', '2', '3']) {
      vi.resetAllMocks();
      process.exitCode = undefined;
      vi.spyOn(console, 'log').mockImplementation(() => {});
      mockList.mockResolvedValue({ bounties: [], total: 0 });
      await bountiesCommand(mockClient, { ...defaultOpts, tier });
      expect(process.exitCode).toBeUndefined();
    }
  });

  it('clamps limit to 1-100', async () => {
    mockList.mockResolvedValue({ bounties: [], total: 0 });
    await bountiesCommand(mockClient, { ...defaultOpts, limit: '999' });
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  it('handles array response shape', async () => {
    mockList.mockResolvedValue([
      { id: 'b3', title: 'Arr bounty', tier: 1, reward_amount: 200, status: 'open' },
    ]);
    await bountiesCommand(mockClient, defaultOpts);
    expect(console.log).toHaveBeenCalled();
  });
});
