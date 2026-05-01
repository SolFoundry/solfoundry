import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exchangeGitHubCode, getGitHubAuthorizeUrl } from '../api/auth';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const authResponse = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  token_type: 'bearer',
  user: {
    id: '1',
    username: 'octocat',
    avatar_url: 'https://github.com/octocat.png',
  },
};

describe('GitHub auth API', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('uses browser navigation for GitHub authorize', async () => {
    await expect(getGitHubAuthorizeUrl()).resolves.toBe('/api/auth/github/authorize');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('exchanges the OAuth code through the callback endpoint', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(authResponse));

    await expect(exchangeGitHubCode('code-123', 'state-456')).resolves.toEqual(authResponse);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/auth/github/callback');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual({
      code: 'code-123',
      state: 'state-456',
    });
  });

  it('falls back to GET callback exchange when POST is not supported', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ detail: 'Not found' }, 404))
      .mockResolvedValueOnce(jsonResponse(authResponse));

    await expect(exchangeGitHubCode('code-123', 'state-456')).resolves.toEqual(authResponse);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [url, options] = mockFetch.mock.calls[1];
    expect(url).toBe('/api/auth/github/callback?code=code-123&state=state-456');
    expect(options.method).toBe('GET');
  });

  it('falls back to the legacy exchange endpoint', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ detail: 'Not found' }, 404))
      .mockResolvedValueOnce(jsonResponse({ detail: 'Method not allowed' }, 405))
      .mockResolvedValueOnce(jsonResponse(authResponse));

    await expect(exchangeGitHubCode('code-123')).resolves.toEqual(authResponse);

    expect(mockFetch).toHaveBeenCalledTimes(3);
    const [url, options] = mockFetch.mock.calls[2];
    expect(url).toBe('/api/auth/github');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual({ code: 'code-123' });
  });
});
