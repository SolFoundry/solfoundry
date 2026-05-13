/**
 * SolFoundry SDK — Authentication Client.
 *
 * Manages GitHub OAuth flow and JWT token lifecycle for the SolFoundry API.
 *
 * @module auth
 */

import type { HttpClient } from './client.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** JWT tokens returned after successful authentication. */
export interface AuthTokens {
  /** Short-lived access token (JWT). */
  access_token: string;
  /** Long-lived refresh token used to obtain new access tokens. */
  refresh_token: string;
  /** Token type (always "Bearer"). */
  token_type: string;
}

/** Response from the GitHub OAuth callback — tokens plus the authenticated user. */
export interface GitHubAuthResponse extends AuthTokens {
  /** The newly authenticated user profile. */
  user: AuthUser;
}

/** Authenticated user profile returned with login / refresh. */
export interface AuthUser {
  /** Unique user ID (UUID). */
  id: string;
  /** GitHub user ID. */
  github_id?: number | null;
  /** Display username. */
  username: string;
  /** Email address (may be null if GitHub didn't provide one). */
  email?: string | null;
  /** Avatar URL from GitHub. */
  avatar_url?: string | null;
  /** Solana wallet address for bounty payouts. */
  wallet_address?: string | null;
  /** ISO 8601 creation timestamp. */
  created_at?: string | null;
}

/** Configuration for {@link AuthClient}. */
export interface AuthClientConfig {
  /** GitHub OAuth App client ID (public, safe to embed in frontend). */
  githubClientId?: string;
  /** GitHub OAuth App client secret (server-side only). */
  githubClientSecret?: string;
  /** OAuth redirect URI. Defaults to the current origin + /callback. */
  redirectUri?: string;
  /** Scopes requested from GitHub. Defaults to "read:user user:email". */
  githubScopes?: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Client for the SolFoundry authentication API.
 *
 * Provides methods for the full GitHub OAuth 2.0 PKCE flow, token refresh,
 * and fetching the current authenticated user.
 *
 * @example
 * ```typescript
 * const auth = new AuthClient(http);
 *
 * // Step 1: Redirect the user to GitHub for authorization
 * const authorizeUrl = await auth.getGitHubAuthorizeUrl();
 * window.location.href = authorizeUrl;
 *
 * // Step 2: After callback, exchange the code for tokens
 * const { access_token, user } = await auth.exchangeGitHubCode(code, state);
 * console.log(`Logged in as ${user.username}`);
 *
 * // Later: refresh an expired access token
 * const tokens = await auth.refreshTokens(refreshToken);
 * ```
 */
export class AuthClient {
  private readonly http: HttpClient;

  /**
   * Create an AuthClient.
   *
   * @param http - The shared {@link HttpClient} instance.
   */
  constructor(http: HttpClient) {
    this.http = http;
  }

  // -----------------------------------------------------------------------
  // GitHub OAuth
  // -----------------------------------------------------------------------

  /**
   * Get the GitHub OAuth authorize URL to redirect the user to.
   *
   * The URL includes the client ID, redirect URI, scope, and a randomly
   * generated `state` parameter for CSRF protection.
   *
   * @returns The fully formed GitHub authorize URL.
   * @throws {UpstreamError} If the SolFoundry backend fails to generate the URL.
   */
  async getGitHubAuthorizeUrl(): Promise<string> {
    const data = await this.http.request<{ authorize_url: string }>({
      path: '/api/auth/github/authorize',
      method: 'GET',
    });
    return data.authorize_url;
  }

  /**
   * Exchange a GitHub OAuth authorization code for SolFoundry JWT tokens.
   *
   * Call this in your OAuth callback handler after the user authorizes
   * the application on GitHub. The backend exchanges the code for a
   * GitHub access token, creates or fetches the SolFoundry user, and
   * returns JWT tokens.
   *
   * @param code - The authorization code from the GitHub callback.
   * @param state - The state parameter from the callback (for CSRF validation).
   * @returns JWT tokens plus the authenticated user profile.
   * @throws {AuthenticationError} If the code is invalid or expired.
   * @throws {UpstreamError} If the GitHub token exchange fails.
   */
  async exchangeGitHubCode(code: string, state?: string): Promise<GitHubAuthResponse> {
    return this.http.request<GitHubAuthResponse>({
      path: '/api/auth/github',
      method: 'POST',
      body: { code, ...(state ? { state } : {}) },
    });
  }

  // -----------------------------------------------------------------------
  // Token Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Refresh the access token using a valid refresh token.
   *
   * The SolFoundry backend issues short-lived access tokens (JWTs) and
   * longer-lived refresh tokens. When an access token expires (HTTP 401),
   * use this method to obtain a new pair without re-authenticating via GitHub.
   *
   * @param refreshToken - The refresh token (from the last auth or refresh).
   * @returns New access and refresh tokens.
   * @throws {AuthenticationError} If the refresh token is invalid or revoked.
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    return this.http.request<AuthTokens>({
      path: '/api/auth/refresh',
      method: 'POST',
      body: { refresh_token: refreshToken },
    });
  }

  // -----------------------------------------------------------------------
  // Current User
  // -----------------------------------------------------------------------

  /**
   * Fetch the currently authenticated user's profile.
   *
   * Requires a valid access token to be set on the underlying
   * {@link HttpClient}.
   *
   * @returns The authenticated user profile.
   * @throws {AuthenticationError} If no valid token is set.
   */
  async getMe(): Promise<AuthUser> {
    return this.http.request<AuthUser>({
      path: '/api/auth/me',
      method: 'GET',
      requiresAuth: true,
    });
  }
}
