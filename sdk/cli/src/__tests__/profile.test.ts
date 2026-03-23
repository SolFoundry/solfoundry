import { describe, it, expect, vi, beforeEach } from 'vitest';
import { profileCommand } from '../commands/profile.js';

const mockGet = vi.fn();
const mockClient = {
  contributors: { get: mockGet },
} as unknown as Parameters<typeof profileCommand>[0];

const defaultOpts = { json: false };

const fakeContributor = {
  id: 'c1',
  username: 'octocat',
  display_name: 'The Octocat',
  reputation_score: 75.5,
  tier: 2,
  total_bounties_completed: 10,
  total_earnings: 5000,
  skills: ['typescript', 'rust'],
  badges: ['first_bounty', 'speed_demon'],
  wallet_address: 'WalletXyz789',
  created_at: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.resetAllMocks();
  process.exitCode = undefined;
});

describe('profileCommand', () => {
  it('prints contributor profile', async () => {
    mockGet.mockResolvedValue(fakeContributor);
    await profileCommand(mockClient, 'octocat', defaultOpts);
    expect(mockGet).toHaveBeenCalledWith('octocat');
    expect(console.log).toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it('outputs JSON when --json flag set', async () => {
    mockGet.mockResolvedValue(fakeContributor);
    await profileCommand(mockClient, 'octocat', { json: true });
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(fakeContributor, null, 2));
  });

  it('sets exitCode 1 when username is empty', async () => {
    await profileCommand(mockClient, '', defaultOpts);
    expect(process.exitCode).toBe(1);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('sets exitCode 1 on 404', async () => {
    mockGet.mockRejectedValue(new Error('404 not found'));
    await profileCommand(mockClient, 'nobody', defaultOpts);
    expect(process.exitCode).toBe(1);
  });

  it('sets exitCode 1 on generic API error', async () => {
    mockGet.mockRejectedValue(new Error('timeout'));
    await profileCommand(mockClient, 'alice', defaultOpts);
    expect(process.exitCode).toBe(1);
  });

  it('handles contributor with no skills, badges, or wallet', async () => {
    mockGet.mockResolvedValue({
      ...fakeContributor,
      skills: [],
      badges: [],
      wallet_address: null,
    });
    await profileCommand(mockClient, 'newbie', defaultOpts);
    expect(process.exitCode).toBeUndefined();
  });

  it('handles undefined optional fields gracefully', async () => {
    mockGet.mockResolvedValue({ username: 'sparse' });
    await profileCommand(mockClient, 'sparse', defaultOpts);
    expect(process.exitCode).toBeUndefined();
  });
});
