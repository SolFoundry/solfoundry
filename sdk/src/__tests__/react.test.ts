import { describe, it, expect, vi } from 'vitest';
import { createHooks } from '../react/useBounties.js';
import type { HttpClient } from '../client.js';

const mockBountyList = { bounties: [{ id: 'b1', title: 'Test', description: '', tier: 2, category: 'backend', reward_amount: 500, status: 'open', creator_type: 'platform', github_issue_url: null, required_skills: [], deadline: null, created_by: 'u1', created_at: '2026-04-21T00:00:00Z', updated_at: '2026-04-21T00:00:00Z', github_issue_number: null, github_repo: null, winner_submission_id: null, winner_wallet: null, payout_tx_hash: null, payout_at: null, claimed_by: null, claimed_at: null, claim_deadline: null, submissions: [], submission_count: 0 }], total: 1, skip: 0, limit: 20 };

function mockHttp(responses: Record<string, any> = {}): HttpClient {
  return { request: vi.fn(async (opts: any) => responses[opts.path] ?? mockBountyList), setAuthToken: vi.fn(), getAuthToken: vi.fn() } as unknown as HttpClient;
}

describe('createHooks', () => {
  it('returns all four hooks', () => { const h = createHooks(mockHttp()); expect(h).toHaveProperty('useBounties'); expect(h).toHaveProperty('useBounty'); expect(h).toHaveProperty('useContributor'); expect(h).toHaveProperty('useStats'); });
  it('creates different hooks per http instance', () => { expect(createHooks(mockHttp()).useBounties).not.toBe(createHooks(mockHttp()).useBounties); });
});
describe('hook types', () => {
  it('useBounties is a function', () => { expect(typeof createHooks(mockHttp()).useBounties).toBe('function'); });
  it('useBounty is a function', () => { expect(typeof createHooks(mockHttp()).useBounty).toBe('function'); });
  it('useContributor is a function', () => { expect(typeof createHooks(mockHttp()).useContributor).toBe('function'); });
  it('useStats is a function', () => { expect(typeof createHooks(mockHttp()).useStats).toBe('function'); });
});
