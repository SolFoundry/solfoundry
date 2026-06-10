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

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';

/**
 * Generate a cryptographically-random state string for CSRF protection.
 */
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get the GitHub OAuth authorize URL.
 *
 * Primary: fetch from backend API (returns 404 when backend is offline).
 * Fallback: construct directly from VITE_GITHUB_CLIENT_ID env var.
 */
export async function getGitHubAuthorizeUrl(): Promise<string> {
  // Try backend API first
  try {
    const data = await apiClient<{ authorize_url: string }>('/api/auth/github/authorize');
    if (data?.authorize_url) return data.authorize_url;
  } catch {
    // Backend unavailable 鈥?fall through to frontend fallback
  }

  // Fallback: build the URL ourselves
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined;
  if (!clientId) {
    throw new Error(
      'VITE_GITHUB_CLIENT_ID is not configured. ' +
      'Set it in your .env file or ensure the backend /api/auth/github/authorize endpoint is running.',
    );
  }

  const redirectUri = `${window.location.origin}/github/callback`;
  const state = generateState();

  // Store state for CSRF verification on callback
  try {
    sessionStorage.setItem('sf_oauth_state', state);
  } catch {
    // sessionStorage may be unavailable 鈥?non-critical
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: 'read:user user:email',
  });

  return `${GITHUB_AUTH_URL}?${params.toString()}`;
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
