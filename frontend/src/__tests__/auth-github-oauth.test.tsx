import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  getGitHubAuthorizeUrl,
  validateGitHubOAuthState,
} from '../api/auth';
import { setAuthToken } from '../services/apiClient';
import { AuthProvider } from '../contexts/AuthContext';
import { GitHubCallbackPage } from '../pages/GitHubCallbackPage';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(body: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
    headers: new Headers({ 'content-type': 'application/json' }),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => mockResponse(body, status, statusText),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

function renderCallback(initialEntry: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/" element={<div>Home</div>} />
          <Route path="/auth/github/callback" element={<GitHubCallbackPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
  setAuthToken(null);
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GitHub OAuth helpers', () => {
  it('uses the backend authorize URL and remembers its state', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        authorize_url: 'https://github.com/login/oauth/authorize?client_id=abc&state=server-state',
      }),
    );

    const authorizeUrl = await getGitHubAuthorizeUrl();

    expect(authorizeUrl).toContain('github.com/login/oauth/authorize');
    expect(localStorage.getItem('sf_github_oauth_state')).toBe('server-state');
  });

  it('falls back to a direct GitHub authorize URL when the backend route is unavailable', async () => {
    vi.stubEnv('VITE_GITHUB_CLIENT_ID', 'client-123');
    mockFetch.mockResolvedValueOnce(mockResponse({ detail: 'Not Found' }, 404, 'Not Found'));

    const authorizeUrl = await getGitHubAuthorizeUrl();
    const parsed = new URL(authorizeUrl);

    expect(parsed.origin + parsed.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('client-123');
    expect(parsed.searchParams.get('redirect_uri')).toBe(`${window.location.origin}/auth/github/callback`);
    expect(parsed.searchParams.get('scope')).toBe('read:user user:email');
    expect(parsed.searchParams.get('state')).toBe(localStorage.getItem('sf_github_oauth_state'));
  });

  it('validates and consumes the stored OAuth state', () => {
    localStorage.setItem('sf_github_oauth_state', 'expected-state');

    expect(validateGitHubOAuthState('expected-state')).toBe(true);
    expect(localStorage.getItem('sf_github_oauth_state')).toBeNull();
  });

  it('rejects mismatched OAuth state and consumes it', () => {
    localStorage.setItem('sf_github_oauth_state', 'expected-state');

    expect(validateGitHubOAuthState('different-state')).toBe(false);
    expect(localStorage.getItem('sf_github_oauth_state')).toBeNull();
  });
});

describe('GitHubCallbackPage', () => {
  it('exchanges a valid callback code and stores JWT/user session data', async () => {
    localStorage.setItem('sf_github_oauth_state', 'valid-state');
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'bearer',
        user: {
          id: 'user-1',
          username: 'octocat',
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
          github_id: '1',
        },
      }),
    );

    renderCallback('/auth/github/callback?code=abc123&state=valid-state');

    await screen.findByText('Home');
    expect(localStorage.getItem('sf_access_token')).toBe('access-token');
    expect(localStorage.getItem('sf_refresh_token')).toBe('refresh-token');
    expect(localStorage.getItem('sf_user')).toContain('octocat');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('shows a graceful error and skips token exchange when state is invalid', async () => {
    localStorage.setItem('sf_github_oauth_state', 'valid-state');

    renderCallback('/auth/github/callback?code=abc123&state=wrong-state');

    expect(await screen.findByText('GitHub sign-in failed')).toBeInTheDocument();
    expect(screen.getByText('GitHub sign-in session expired. Please try again.')).toBeInTheDocument();
    await waitFor(() => expect(mockFetch).not.toHaveBeenCalled());
  });
});
