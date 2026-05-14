import { apiClient } from '../services/apiClient';
import type { User } from '../types/user';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_CALLBACK_PATH = '/auth/github/callback';
const GITHUB_SCOPE = 'read:user user:email';
const GITHUB_OAUTH_STATE_KEY = 'sf_github_oauth_state';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface GitHubCallbackResponse extends AuthTokens {
  user: User;
}

function createOAuthState(): string {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getAppOrigin(): string {
  return typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : '';
}

function rememberOAuthStateFromUrl(authorizeUrl: string): void {
  try {
    const parsed = new URL(authorizeUrl, getAppOrigin());
    const state = parsed.searchParams.get('state');
    if (state) {
      localStorage.setItem(GITHUB_OAUTH_STATE_KEY, state);
    }
  } catch {
    /* Ignore malformed URLs from the API and let the redirect fail naturally. */
  }
}

function buildDirectGitHubAuthorizeUrl(): string {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined;
  if (!clientId) {
    throw new Error('GitHub OAuth client ID is not configured');
  }

  const state = createOAuthState();
  localStorage.setItem(GITHUB_OAUTH_STATE_KEY, state);

  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', `${getAppOrigin()}${GITHUB_CALLBACK_PATH}`);
  authorizeUrl.searchParams.set('scope', GITHUB_SCOPE);
  authorizeUrl.searchParams.set('state', state);

  return authorizeUrl.toString();
}

export function validateGitHubOAuthState(receivedState: string | null): boolean {
  const expectedState = localStorage.getItem(GITHUB_OAUTH_STATE_KEY);
  if (!expectedState) return true;

  localStorage.removeItem(GITHUB_OAUTH_STATE_KEY);
  return receivedState === expectedState;
}

export function clearGitHubOAuthState(): void {
  localStorage.removeItem(GITHUB_OAUTH_STATE_KEY);
}

export async function getGitHubAuthorizeUrl(): Promise<string> {
  try {
    const data = await apiClient<{ authorize_url: string }>('/api/auth/github/authorize');
    if (data.authorize_url) {
      rememberOAuthStateFromUrl(data.authorize_url);
      return data.authorize_url;
    }
  } catch {
    return buildDirectGitHubAuthorizeUrl();
  }

  return buildDirectGitHubAuthorizeUrl();
}

export async function redirectToGitHubSignIn(): Promise<void> {
  window.location.assign(await getGitHubAuthorizeUrl());
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
