import { apiClient } from '../services/apiClient';
import type { User } from '../types/user';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface GitHubCallbackResponse extends AuthTokens {
  user: User;
}

/**
 * Build the GitHub OAuth authorize URL directly using the configured client ID.
 * Used as fallback when the backend /api/auth/github/authorize endpoint is unavailable.
 *
 * @param clientId - GitHub OAuth App client ID (defaults to VITE_GITHUB_CLIENT_ID)
 * @param redirectUri - Callback URL (defaults to /github/callback)
 * @param state - CSRF state token for security
 */
export function buildGitHubAuthorizeUrl(
  clientId?: string,
  redirectUri?: string,
  state?: string,
): string {
  const cid = clientId ?? import.meta.env?.VITE_GITHUB_CLIENT_ID ?? '';
  const uri = redirectUri ?? `${window.location.origin}/github/callback`;
  const csrf = state ?? generateState();
  const params = new URLSearchParams({
    client_id: cid,
    redirect_uri: uri,
    scope: 'read:user user:email',
    state: csrf,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/** Generate a random state token for CSRF protection. */
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Retrieve the GitHub OAuth authorize URL from the backend.
 * Falls back to building the URL directly if the backend is unavailable.
 */
export async function getGitHubAuthorizeUrl(): Promise<string> {
  try {
    const data = await apiClient<{ authorize_url: string }>('/api/auth/github/authorize', {
      retries: 0, // Fail fast — don't retry on 404
    });
    if (!data.authorize_url || typeof data.authorize_url !== 'string') {
      throw new Error('Invalid authorize_url from server');
    }
    return data.authorize_url;
  } catch (err) {
    // Backend unavailable — build URL directly as fallback
    console.warn('[auth] Backend /api/auth/github/authorize unavailable, using direct OAuth URL:', err);
    return buildGitHubAuthorizeUrl();
  }
}

export async function exchangeGitHubCode(code: string, state?: string): Promise<GitHubCallbackResponse> {
  return apiClient<GitHubCallbackResponse>('/api/auth/github', {
    method: 'POST',
    body: { code, ...(state ? { state } : {}) },
  });
}

export async function getMe(): Promise<User> {
  return apiClient<User>('/api/auth/me');
}

export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  return apiClient<AuthTokens>('/api/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  });
}

/**
 * Revoke the current session (server-side logout).
 * Clears local tokens afterwards regardless of server response.
 */
export async function logout(): Promise<void> {
  try {
    await apiClient<void>('/api/auth/logout', { method: 'POST' });
  } catch {
    // Best-effort — clear local tokens even if server logout fails
  }
}
