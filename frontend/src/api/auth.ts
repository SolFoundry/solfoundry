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

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_OAUTH_STATE_KEY = 'sf_github_oauth_state';
const GITHUB_OAUTH_SCOPE = 'read:user user:email';

function getGitHubClientId(): string | null {
  const clientId = import.meta.env?.VITE_GITHUB_CLIENT_ID;
  return typeof clientId === 'string' && clientId.trim() !== '' ? clientId.trim() : null;
}

function createOAuthState(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Build a GitHub OAuth authorize URL directly in the frontend.
 * This bypasses the backend /api/auth/github/authorize endpoint
 * which may be unavailable or return 404.
 */
export function buildGitHubAuthorizeUrl(): string {
  const clientId = getGitHubClientId();
  if (!clientId) {
    throw new Error('VITE_GITHUB_CLIENT_ID environment variable is required for GitHub OAuth.');
  }

  const state = createOAuthState();
  sessionStorage.setItem(GITHUB_OAUTH_STATE_KEY, state);

  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', `${window.location.origin}/auth/github/callback`);
  url.searchParams.set('scope', GITHUB_OAUTH_SCOPE);
  url.searchParams.set('state', state);
  return url.toString();
}

/**
 * Retrieve the stored OAuth state for CSRF validation.
 * Returns the state value and removes it from sessionStorage (one-time use).
 */
export function consumeOAuthState(): string | null {
  try {
    const state = sessionStorage.getItem(GITHUB_OAUTH_STATE_KEY);
    sessionStorage.removeItem(GITHUB_OAUTH_STATE_KEY);
    return state;
  } catch {
    return null;
  }
}

/**
 * Redirect the user to GitHub OAuth authorization.
 * First tries the backend-provided URL, falls back to a direct URL.
 */
export async function redirectToGitHubSignIn(): Promise<void> {
  // Try backend-provided authorize URL first
  try {
    const data = await apiClient<{ authorize_url: string }>('/api/auth/github/authorize');
    if (data?.authorize_url) {
      window.location.href = data.authorize_url;
      return;
    }
  } catch {
    // Backend endpoint unavailable — fall through to direct URL
  }

  // Fallback: build the URL directly using the GitHub client ID
  try {
    const url = buildGitHubAuthorizeUrl();
    window.location.href = url;
  } catch (err) {
    console.error('GitHub OAuth is not configured. Missing VITE_GITHUB_CLIENT_ID.', err);
    // Redirect to home with an error indicator
    window.location.href = '/?auth_error=oauth_not_configured';
  }
}

/**
 * Fetch the GitHub OAuth authorize URL from the backend.
 * Deprecated — use redirectToGitHubSignIn() instead.
 */
export async function getGitHubAuthorizeUrl(): Promise<string> {
  const data = await apiClient<{ authorize_url: string }>('/api/auth/github/authorize');
  return data.authorize_url;
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