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

export function buildGitHubAuthorizeUrl(): string {
  const clientId = getGitHubClientId();
  if (!clientId) {
    throw new Error('VITE_GITHUB_CLIENT_ID is required for GitHub OAuth fallback');
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

export async function getGitHubAuthorizeUrl(): Promise<string> {
  try {
    const data = await apiClient<{ authorize_url: string }>('/api/auth/github/authorize');
    if (data.authorize_url) return data.authorize_url;
  } catch {
    return buildGitHubAuthorizeUrl();
  }

  return buildGitHubAuthorizeUrl();
}

export async function redirectToGitHubSignIn(): Promise<void> {
  window.location.href = await getGitHubAuthorizeUrl();
}

export async function exchangeGitHubCode(code: string, state?: string): Promise<GitHubCallbackResponse> {
  const expectedState = sessionStorage.getItem(GITHUB_OAUTH_STATE_KEY);
  if (expectedState && state !== expectedState) {
    throw new Error('Invalid GitHub OAuth state');
  }
  sessionStorage.removeItem(GITHUB_OAUTH_STATE_KEY);

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
