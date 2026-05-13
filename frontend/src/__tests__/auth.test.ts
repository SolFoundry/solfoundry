import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildGitHubAuthorizeUrl, exchangeGitHubCode, getGitHubAuthorizeUrl } from '../api/auth';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(body: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as Response;
}

describe('GitHub OAuth URL handling', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    sessionStorage.clear();
    vi.stubEnv('VITE_GITHUB_CLIENT_ID', 'test-client-id');
  });

  it('builds a direct GitHub authorize URL with callback and state', () => {
    const url = new URL(buildGitHubAuthorizeUrl());

    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(`${window.location.origin}/auth/github/callback`);
    expect(url.searchParams.get('scope')).toBe('read:user user:email');
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(sessionStorage.getItem('sf_github_oauth_state')).toBe(url.searchParams.get('state'));
  });

  it('prefers backend-provided authorize URL when available', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ authorize_url: 'https://example.test/oauth' }));

    await expect(getGitHubAuthorizeUrl()).resolves.toBe('https://example.test/oauth');
  });

  it('falls back to direct GitHub authorize URL when backend authorize endpoint is unavailable', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ detail: 'Not found' }, 404, 'Not Found'));

    const url = new URL(await getGitHubAuthorizeUrl());

    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
  });

  it('rejects callback exchanges when OAuth state does not match', async () => {
    sessionStorage.setItem('sf_github_oauth_state', 'expected-state');

    await expect(exchangeGitHubCode('code-123', 'wrong-state')).rejects.toThrow('Invalid GitHub OAuth state');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
