/**
 * Auth API service — wraps all /api/auth/* and /api/users/me/* endpoints.
 */
import { apiClient } from './apiClient';

// apiClient's body type conflicts with RequestInit — cast to bypass the intersection
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function call<T>(endpoint: string, opts: { method?: string; body?: unknown; params?: Record<string,string|number|boolean|undefined>; retries?: number }): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return apiClient<T>(endpoint, opts as any);
}

export interface WalletAuthPayload {
  wallet_address: string;
  signature: string;
  message: string;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    username: string;
    email?: string | null;
    avatar_url?: string | null;
    wallet_address?: string | null;
    wallet_verified: boolean;
    github_id?: string | null;
  };
}

export interface WalletMessageResponse {
  message: string;
  nonce: string;
  expires_at: string;
}

export interface UserProfile {
  user_id: string;
  username: string;
  display_name: string;
  email?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  skills: string[];
  social_links: Record<string, string>;
  email_notifications_enabled: boolean;
  notification_preferences: Record<string, boolean>;
  reputation_score: number;
  total_bounties_completed: number;
  total_earnings: number;
  wallet_address?: string | null;
  wallet_verified: boolean;
}

/** Get a challenge message to sign with a Solana wallet. */
export async function getWalletAuthMessage(walletAddress: string): Promise<WalletMessageResponse> {
  return apiClient<WalletMessageResponse>('/api/auth/wallet/message', {
    params: { wallet_address: walletAddress },
  });
}

/** Authenticate using a signed wallet message — returns JWTs + user. */
export async function authenticateWithWallet(payload: WalletAuthPayload): Promise<AuthTokenResponse> {
  return call<AuthTokenResponse>('/api/auth/wallet', { method: 'POST', body: payload });
}

/** Exchange a GitHub OAuth code for JWTs + user. */
export async function authenticateWithGitHub(code: string): Promise<AuthTokenResponse> {
  return call<AuthTokenResponse>('/api/auth/github', { method: 'POST', body: { code } });
}

/** Get the GitHub OAuth authorization URL. */
export async function getGitHubAuthorizeUrl(): Promise<{ authorize_url: string; state: string }> {
  return apiClient('/api/auth/github/authorize');
}

/** Refresh the access token using a refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string }> {
  return call('/api/auth/refresh', { method: 'POST', body: { refresh_token: refreshToken } });
}

/** Get the current user's full profile (auth + contributor merged). */
export async function getMyProfile(): Promise<UserProfile> {
  return apiClient<UserProfile>('/api/users/me/profile');
}

/** Update the current user's profile fields. */
export async function updateMyProfile(data: {
  display_name?: string;
  bio?: string;
  skills?: string[];
  social_links?: Record<string, string>;
  avatar_url?: string;
}): Promise<UserProfile> {
  return call<UserProfile>('/api/users/me/profile', { method: 'PATCH', body: data });
}

/** Update notification preferences. */
export async function updateMySettings(data: {
  email_notifications_enabled?: boolean;
  notification_preferences?: Record<string, boolean>;
}): Promise<UserProfile> {
  return call<UserProfile>('/api/users/me/settings', { method: 'PATCH', body: data });
}
