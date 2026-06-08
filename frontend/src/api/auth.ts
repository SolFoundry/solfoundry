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

/** Client ID for GitHub OAuth — must match the registered OAuth App */
const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string || '';

/** Build a direct GitHub OAuth authorize URL (fallback when API unavailable) */
function buildDirectGitHubUrl(): string {
  const redirectUri = `${window.location.origin}/auth/github/callback`;
  const state = crypto.randomUUID();
  sessionStorage.setItem('gh_oauth_state', state);
  return `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user+user:email&state=${state}`;
}

export async function getGitHubAuthorizeUrl(): Promise<string> {
  try {
    const data = await apiClient<{ authorize_url: string }>('/api/auth/github/authorize', { timeoutMs: 5000 });
    return data.authorize_url || buildDirectGitHubUrl();
  } catch {
    // API unavailable — use direct GitHub OAuth URL
    if (GITHUB_CLIENT_ID) return buildDirectGitHubUrl();
    // Last resort: redirect to backend endpoint (may work with server-side redirect)
    return '/api/auth/github/authorize';
  }
}

export async function exchangeGitHubCode(code: string, state?: string): Promise<GitHubCallbackResponse> {
  // Verify state to prevent CSRF
  const savedState = sessionStorage.getItem('gh_oauth_state');
  if (savedState && state && savedState !== state) {
    throw new Error('OAuth state mismatch — possible CSRF attack');
  }
  sessionStorage.removeItem('gh_oauth_state');

  try {
    return await apiClient<GitHubCallbackResponse>('/api/auth/github', {
      method: 'POST',
      body: { code, ...(state ? { state } : {}) },
    });
  } catch (err: any) {
    // Rate-limited or expired code
    if (err?.status === 429) throw new Error('Too many requests. Please wait and try again.');
    if (err?.status === 400) throw new Error('Invalid or expired authorization code. Please sign in again.');
    throw err;
  }
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
