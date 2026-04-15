import { apiClient, setAuthToken, ApiError } from '../services/apiClient';
import type { User } from '../types/user';

/**
 * Authentication tokens issued by the backend after a successful OAuth or credential login.
 */
export interface AuthTokens {
  /** JWT access token used to authenticate API requests. */
  access_token: string;
  /** Long-lived token used to obtain a new access token when it expires. */
  refresh_token: string;
  /** Token type (typically "Bearer"). */
  token_type: string;
}

/**
 * Full response returned by the GitHub OAuth callback endpoint.
 * Contains auth tokens plus the authenticated user's profile.
 */
export interface GitHubCallbackResponse extends AuthTokens {
  /** Authenticated user profile. */
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
  if (!cid) {
    throw new Error('Missing GitHub OAuth client configuration: VITE_GITHUB_CLIENT_ID is not set');
  }
  const uri = redirectUri ?? `${window.location.origin}/github/callback`;
  const csrf = state ?? generateState();
  // Persist CSRF state for validation in callback
  sessionStorage.setItem('oauth_state', csrf);
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
    // Only fall back for genuine network errors (TypeError) or HTTP 5xx/503/504/404
    const isNetworkError = err instanceof TypeError;
    const isServerError = err instanceof ApiError && (
      err.status === 404 ||
      err.status === 503 ||
      err.status === 504 ||
      err.status >= 500
    );
    if (isNetworkError || isServerError) {
      console.warn('[auth] Backend /api/auth/github/authorize unavailable, using direct OAuth URL:', err);
      return buildGitHubAuthorizeUrl();
    }
    // For other errors (e.g., invalid response body), rethrow
    throw err;
  }
}

/**
 * Exchange a GitHub OAuth authorization code for JWT auth tokens and user info.
 * Called by the GitHub callback page after the user approves the OAuth request.
 *
 * @param code  - The authorization code returned by GitHub in the callback URL
 * @param state - The CSRF state token returned by GitHub (optional, validated server-side)
 */
export async function exchangeGitHubCode(code: string, state?: string): Promise<GitHubCallbackResponse> {
  return apiClient<GitHubCallbackResponse>('/api/auth/github', {
    method: 'POST',
    body: { code, ...(state ? { state } : {}) },
  });
}

/**
 * Fetch the currently authenticated user's profile from the backend.
 * Requires a valid access token in the Authorization header.
 */
export async function getMe(): Promise<User> {
  return apiClient<User>('/api/auth/me');
}

/**
 * Refresh the access token using a valid refresh token.
 * Returns a new set of access + refresh tokens on success.
 *
 * @param refreshToken - The refresh token previously issued during login
 */
export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  return apiClient<AuthTokens>('/api/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  });
}

/**
 * Clear all authentication data from localStorage and memory.
 */
export function clearAuthStorage(): void {
  localStorage.removeItem('sf_access_token');
  localStorage.removeItem('sf_refresh_token');
  localStorage.removeItem('sf_user');
  setAuthToken(null);
}

/**
 * Revoke the current session (server-side logout).
 * Clears local tokens afterwards regardless of server response.
 */
export async function logout(): Promise<void> {
  try {
    await apiClient<void>('/api/auth/logout', { method: 'POST' });
    clearAuthStorage();
  } finally {
    clearAuthStorage();
  }
}
