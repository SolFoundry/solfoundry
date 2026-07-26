import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildGitHubAuthorizeUrl, exchangeGitHubCode, consumeOAuthState } from '../api/auth';

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

  it('throws when VITE_GITHUB_CLIENT_ID is missing', () => {
    vi.stubEnv('VITE_GITHUB_CLIENT_ID', '');
    expect(() => buildGitHubAuthorizeUrl()).toThrow('VITE_GITHUB_CLIENT_ID');
  });

  it('consumes and removes the OAuth state from sessionStorage', () => {
    sessionStorage.setItem('sf_github_oauth_state', 'test-state-123');
    const state = consumeOAuthState();
    expect(state).toBe('test-state-123');
    expect(sessionStorage.getItem('sf_github_oauth_state')).toBeNull();
  });

  it('returns null when no OAuth state is stored', () => {
    expect(consumeOAuthState()).toBeNull();
  });
});

describe('exchangeGitHubCode', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends code and state to the backend', async () => {
    const mockUser = { id: '1', username: 'testuser', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' };
    const mockResponseData = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
      user: mockUser,
    };
    mockFetch.mockResolvedValueOnce(mockResponse(mockResponseData));

    const result = await exchangeGitHubCode('test-code', 'test-state');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/github'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('test-code'),
      }),
    );
    expect(result.access_token).toBe('test-access-token');
    expect(result.user.username).toBe('testuser');
  });
});