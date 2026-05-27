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
 * Get the GitHub OAuth authorize URL.
 * Falls back to client-side construction when the backend is unavailable.
 */
export async function getGitHubAuthorizeUrl(): Promise<string> {
  try {
    const data = await apiClient<{ authorize_url: string }>('/api/auth/github/authorize');
    return data.authorize_url;
  } catch {
    // Fallback: build the URL client-side using the Vite env var.
    // This fixes the 404 when the backend (separate repo) isn't deployed.
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    if (!clientId) {
      throw new Error('GitHub OAuth not configured. Set VITE_GITHUB_CLIENT_ID.');
    }
    const redirectUri = `${window.location.origin}/auth/github/callback`;
    const state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    // Store state for CSRF verification
    sessionStorage.setItem('github_oauth_state', state);
    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user&state=${state}`;
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
