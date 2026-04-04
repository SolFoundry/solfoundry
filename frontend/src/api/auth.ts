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

export async function getGitHubAuthorizeUrl(): Promise<string> {
  const data = await apiClient<{ url: string }>('/api/auth/github/authorize');
  return data.url;
}

export async function exchangeGitHubCode(code: string): Promise<GitHubCallbackResponse> {
  return apiClient<GitHubCallbackResponse>('/api/auth/github', {
    method: 'POST',
    body: { code },
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
