import { apiClient, isApiError } from '../services/apiClient';
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
    ? (import.meta.env.VITE_API_URL as string).replace(/\/$/, '')
    : '';

const GITHUB_AUTHORIZE_PATH = '/api/auth/github/authorize';
const GITHUB_CALLBACK_PATH = '/api/auth/github/callback';
const LEGACY_GITHUB_CALLBACK_PATH = '/api/auth/github';

export async function getGitHubAuthorizeUrl(): Promise<string> {
  return `${API_BASE}${GITHUB_AUTHORIZE_PATH}`;
}

export async function exchangeGitHubCode(code: string, state?: string): Promise<GitHubCallbackResponse> {
  const body = { code, ...(state ? { state } : {}) };

  try {
    return await apiClient<GitHubCallbackResponse>(GITHUB_CALLBACK_PATH, {
      method: 'POST',
      body,
    });
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 405)) {
      try {
        return await apiClient<GitHubCallbackResponse>(GITHUB_CALLBACK_PATH, {
          params: { code, ...(state ? { state } : {}) },
        });
      } catch (fallbackError) {
        if (isApiError(fallbackError) && (fallbackError.status === 404 || fallbackError.status === 405)) {
          return apiClient<GitHubCallbackResponse>(LEGACY_GITHUB_CALLBACK_PATH, {
            method: 'POST',
            body,
          });
        }
        throw fallbackError;
      }
    }
    throw error;
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
