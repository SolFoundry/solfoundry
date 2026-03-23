import { describe, it, expect, vi, beforeEach } from 'vitest';
import { statusCommand } from '../commands/status.js';

const mockGet = vi.fn();
const mockEscrow = vi.fn();
const mockClient = {
  bounties: { get: mockGet },
  escrow: { getStatus: mockEscrow },
} as unknown as Parameters<typeof statusCommand>[0];

const defaultOpts = { json: false };

const fakeBounty = {
  id: 'bounty-uuid',
  title: 'Implement feature X',
  status: 'open',
  tier: 1,
  reward_amount: 500,
  created_by: 'alice',
  deadline: '2025-12-31T00:00:00Z',
  description: 'A test bounty description',
};

const fakeEscrow = {
  state: 'active',
  amount: 500,
  creator_wallet: 'WalletAbc123',
  winner_wallet: null,
  expires_at: null,
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.resetAllMocks();
  process.exitCode = undefined;
});

describe('statusCommand', () => {
  it('prints bounty and escrow details', async () => {
    mockGet.mockResolvedValue(fakeBounty);
    mockEscrow.mockResolvedValue(fakeEscrow);

    await statusCommand(mockClient, 'bounty-uuid', defaultOpts);
    expect(mockGet).toHaveBeenCalledWith('bounty-uuid');
    expect(mockEscrow).toHaveBeenCalledWith('bounty-uuid');
    expect(console.log).toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it('works without escrow (escrow throws)', async () => {
    mockGet.mockResolvedValue(fakeBounty);
    mockEscrow.mockRejectedValue(new Error('No escrow'));

    await statusCommand(mockClient, 'bounty-uuid', defaultOpts);
    expect(process.exitCode).toBeUndefined();
    expect(console.log).toHaveBeenCalled();
  });

  it('outputs JSON when --json flag set', async () => {
    mockGet.mockResolvedValue(fakeBounty);
    mockEscrow.mockResolvedValue(fakeEscrow);

    await statusCommand(mockClient, 'bounty-uuid', { json: true });
    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify({ bounty: fakeBounty, escrow: fakeEscrow }, null, 2),
    );
  });

  it('sets exitCode 1 when bounty-id is empty', async () => {
    await statusCommand(mockClient, '', defaultOpts);
    expect(process.exitCode).toBe(1);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('sets exitCode 1 on 404', async () => {
    mockGet.mockRejectedValue(new Error('404 not found'));
    await statusCommand(mockClient, 'missing', defaultOpts);
    expect(process.exitCode).toBe(1);
  });

  it('sets exitCode 1 on generic API error', async () => {
    mockGet.mockRejectedValue(new Error('timeout'));
    await statusCommand(mockClient, 'b1', defaultOpts);
    expect(process.exitCode).toBe(1);
  });

  it('truncates long descriptions', async () => {
    mockGet.mockResolvedValue({ ...fakeBounty, description: 'x'.repeat(200) });
    mockEscrow.mockRejectedValue(new Error('nope'));
    await statusCommand(mockClient, 'b1', defaultOpts);
    expect(console.log).toHaveBeenCalled();
  });
});
