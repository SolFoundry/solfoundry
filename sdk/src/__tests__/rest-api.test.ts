import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MarketplaceApiClient,
  MarketplaceBountiesClient,
  MarketplaceSubmissionsClient,
  UsersClient,
} from '../rest-api.js';
import type { HttpClient } from '../client.js';

function createMockHttpClient(): HttpClient {
  return {
    request: vi.fn(),
    setAuthToken: vi.fn(),
    getAuthToken: vi.fn(),
  } as unknown as HttpClient;
}

describe('MarketplaceApiClient', () => {
  let http: HttpClient;

  beforeEach(() => {
    http = createMockHttpClient();
  });

  it('wires bounties, submissions, and users clients', () => {
    const api = new MarketplaceApiClient(http);
    expect(api.bounties).toBeInstanceOf(MarketplaceBountiesClient);
    expect(api.submissions).toBeInstanceOf(MarketplaceSubmissionsClient);
    expect(api.users).toBeInstanceOf(UsersClient);
  });

  it('calls GET /api/bounties', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    const api = new MarketplaceApiClient(http);
    await api.bounties.list({ status: 'open', limit: 20, offset: 0 });

    expect(http.request).toHaveBeenCalledWith({
      path: '/api/bounties',
      method: 'GET',
      params: { status: 'open', limit: 20, offset: 0 },
    });
  });

  it('calls submissions endpoints', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const api = new MarketplaceApiClient(http);
    await api.submissions.listForBounty('bounty-1');

    expect(http.request).toHaveBeenCalledWith({
      path: '/api/bounties/bounty-1/submissions',
      method: 'GET',
    });
  });

  it('calls users endpoints with auth where required', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', username: 'alice' });

    const api = new MarketplaceApiClient(http);
    await api.users.me();
    await api.users.updateMe({ username: 'alice2' });

    expect(http.request).toHaveBeenNthCalledWith(1, {
      path: '/api/users/me',
      method: 'GET',
      requiresAuth: true,
    });

    expect(http.request).toHaveBeenNthCalledWith(2, {
      path: '/api/users/me',
      method: 'PATCH',
      body: { username: 'alice2' },
      requiresAuth: true,
    });
  });
});
