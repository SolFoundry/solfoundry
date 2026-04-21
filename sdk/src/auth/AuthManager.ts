import type { AuthSession, SolFoundryAuthConfig } from "../types/index.js";

/**
 * Manages runtime authentication state for the SDK.
 */
export class AuthManager {
  private accessToken?: string;
  private refreshToken?: string;
  private apiKey?: string;
  private getAccessToken?: () => string | undefined | Promise<string | undefined>;

  public constructor(config: SolFoundryAuthConfig = {}) {
    this.accessToken = config.accessToken;
    this.apiKey = config.apiKey;
    this.getAccessToken = config.getAccessToken;
  }

  /**
   * Returns headers required for authenticating an API request.
   */
  public async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    const token = (await this.getAccessToken?.()) ?? this.accessToken;

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    return headers;
  }

  /**
   * Replaces the current access token.
   */
  public setAccessToken(token: string | undefined): void {
    this.accessToken = token;
  }

  /**
   * Replaces the current API key.
   */
  public setApiKey(apiKey: string | undefined): void {
    this.apiKey = apiKey;
  }

  /**
   * Stores a new authenticated session.
   */
  public setSession(session: Pick<AuthSession, "accessToken" | "refreshToken">): void {
    this.accessToken = session.accessToken;
    this.refreshToken = session.refreshToken;
  }

  /**
   * Returns the stored refresh token if one exists.
   */
  public getRefreshToken(): string | undefined {
    return this.refreshToken;
  }

  /**
   * Clears the current session tokens while preserving any configured API key.
   */
  public clear(): void {
    this.accessToken = undefined;
    this.refreshToken = undefined;
  }

  /**
   * Clears all stored authentication state, including the API key.
   */
  public clearAllAuth(): void {
    this.clear();
    this.apiKey = undefined;
  }
}
