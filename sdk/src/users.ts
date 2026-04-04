/**
 * User authentication and profile management module for the SolFoundry SDK.
 *
 * Provides methods for GitHub OAuth authentication, JWT session management,
 * and user profile retrieval. All authentication methods return typed
 * token responses that can be used to configure the SDK client.
 *
 * @module users
 */

import type { HttpClient } from './client.js';

// ---------------------------------------------------------------------------
// Auth types
// ---------------------------------------------------------------------------

/**
 * OAuth tokens issued after successful authentication.
 * Contains the JWT access token used for authenticated API requests,
 * and a refresh token for renewing expired sessions.
 */
export interface AuthTokens {
  /** JWT bearer access token — pass to {@link SolFoundry.setAuthToken}. */
  readonly access_token: string;
  /** Refresh token — store securely and use to call {@link UsersClient.refreshTokens}. */
  readonly refresh_token: string;
  /** Token type (always "Bearer"). */
  readonly token_type: string;
}

/**
 * Response from the GitHub OAuth callback exchange.
 * Contains both tokens and the authenticated user's profile.
 */
export interface GitHubAuthResponse extends AuthTokens {
  /** Full authenticated user profile. */
  readonly user: UserResponse;
}

/**
 * Minimal user profile returned during authentication.
 * Mirrors the fields stored in the JWT claims.
 */
export interface UserResponse {
  /** Unique UUID of the user. */
  readonly id: string;
  /** GitHub username. */
  readonly username: string;
  /** Primary email address (null if not granted). */
  readonly email: string | null;
  /** GitHub avatar URL. */
  readonly avatar_url: string | null;
  /** Registered Solana wallet address (null if not yet linked). */
  readonly wallet_address: string | null;
  /** Whether the wallet signature has been verified. */
  readonly wallet_verified: boolean;
  /** GitHub numeric user ID. */
  readonly github_id: string | null;
  /** ISO 8601 account creation timestamp. */
  readonly created_at: string | null;
}

// ---------------------------------------------------------------------------
// Users client
// ---------------------------------------------------------------------------

/**
 * Client for user authentication and profile management.
 *
 * Handles the full OAuth lifecycle: initiating GitHub sign-in,
 * exchanging the OAuth code for tokens, refreshing expired sessions,
 * and fetching the authenticated user's profile.
 *
 * @example
 * ```typescript
 * import { UsersClient } from '@solfoundry/sdk';
 *
 * const users = new UsersClient(httpClient);
 *
 * // Exchange a GitHub OAuth code (obtained from the callback URL)
 * // for JWT tokens and the user profile.
 * const auth = await users.exchangeGitHubCode('oauth-code-from-callback');
 * console.log(`Welcome, ${auth.user.username}!`);
 *
 * // Configure the SDK with the returned access token
 * sf.setAuthToken(auth.access_token);
 *
 * // Refresh an expired access token
 * const refreshed = await users.refreshTokens(auth.refresh_token);
 * sf.setAuthToken(refreshed.access_token);
 * ```
 */
export class UsersClient {
  private readonly http: HttpClient;

  /**
   * Create a new UsersClient.
   *
   * @param http - The configured HTTP client for API communication.
   */
  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Exchange a GitHub OAuth authorization code for JWT tokens.
   *
   * Called after the user is redirected back from GitHub to your
   * callback URL. The `code` parameter is in the query string.
   *
   * @param code - The temporary authorization code from GitHub's redirect.
   * @param state - The CSRF state token originally passed to GitHub (optional, for validation).
   * @returns Auth tokens and the authenticated user profile.
   * @throws {ValidationError} If the code is invalid or expired.
   * @throws {AuthenticationError} If the GitHub OAuth flow failed.
   */
  async exchangeGitHubCode(code: string, state?: string): Promise<GitHubAuthResponse> {
    return this.http.request<GitHubAuthResponse>('/api/auth/github', {
      method: 'POST',
      body: { code, ...(state ? { state } : {}) },
    });
  }

  /**
   * Retrieve the currently authenticated user's profile.
   *
   * Requires a valid access token (call {@link setAuthToken} first or
   * pass `authToken` to {@link SolFoundry.create}).
   *
   * @returns The full user profile for the currently authenticated user.
   * @throws {AuthenticationError} If no valid access token is present.
   */
  async me(): Promise<UserResponse> {
    return this.http.request<UserResponse>('/api/auth/me', {
      method: 'GET',
    });
  }

  /**
   * Refresh an expired access token using the refresh token.
   *
   * Both tokens are obtained from {@link exchangeGitHubCode} or
   * a previous call to this method. After refresh, the old access
   * token is invalidated.
   *
   * @param refreshToken - The refresh token from the original auth response.
   * @returns New auth tokens (access + refresh).
   * @throws {AuthenticationError} If the refresh token is invalid or expired.
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    return this.http.request<AuthTokens>('/api/auth/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
    });
  }

  /**
   * Revoke the current session (server-side logout).
   *
   * Invalidates the server-side session. The access token will no
   * longer be accepted. Note: this is best-effort; always clear
   * local tokens regardless of the server response.
   *
   * @throws {NetworkError} If the server cannot be reached.
   */
  async logout(): Promise<void> {
    await this.http.request<void>('/api/auth/logout', {
      method: 'POST',
    });
  }

  /**
   * Get the URL for GitHub OAuth authorization.
   *
   * Redirect the user to this URL to begin the GitHub OAuth flow.
   * After authorization, GitHub will redirect back to your registered
   * callback URL with a `code` parameter.
   *
   * @returns The GitHub authorization URL to redirect the user to.
   * @throws {ServerError} If the backend is unavailable.
   */
  async getGitHubAuthorizeUrl(): Promise<string> {
    const data = await this.http.request<{ authorize_url: string }>(
      '/api/auth/github/authorize',
      { method: 'GET', retries: 0 },
    );
    return data.authorize_url;
  }
}

// ---------------------------------------------------------------------------
// SolFoundry factory integration
// ---------------------------------------------------------------------------

export type { UserResponse as User };
