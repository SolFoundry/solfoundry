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

const API_BASE: string =
  import.meta.env?.VITE_API_URL != null && import.meta.env.VITE_API_URL !== ''
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, '')
    : '';

export function getGitHubAuthorizeEndpoint(): string {
  return API_BASE ? `${API_BASE}/api/auth/github/authorize` : '/api/auth/github/authorize';
}

export async function getGitHubAuthorizeUrl(): Promise<string> {
  const data = await apiClient<{ authorize_url?: string }>('/api/auth/github/authorize');
  if (data.authorize_url && data.authorize_url.trim()) {
    return data.authorize_url;
  }
  return getGitHubAuthorizeEndpoint();
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
