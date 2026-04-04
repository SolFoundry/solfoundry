import { BountiesApi } from "../api/BountiesApi.js";
import { SubmissionsApi } from "../api/SubmissionsApi.js";
import { UsersApi } from "../api/UsersApi.js";
import { AuthManager } from "../auth/AuthManager.js";
import { HttpClient } from "./HttpClient.js";
import type { AuthSession, RateLimitState, SolFoundryClientConfig } from "../types/index.js";

/**
 * Main entry point for interacting with the SolFoundry API.
 */
export class SolFoundryClient {
  /**
   * Bounty resource API.
   */
  public readonly bounties: BountiesApi;

  /**
   * Submission resource API.
   */
  public readonly submissions: SubmissionsApi;

  /**
   * User and authentication API.
   */
  public readonly users: UsersApi;

  private readonly authManager: AuthManager;
  private readonly httpClient: HttpClient;

  public constructor(config: SolFoundryClientConfig = {}) {
    this.authManager = new AuthManager(config.auth);
    this.httpClient = new HttpClient(this.authManager, config);
    this.bounties = new BountiesApi(this.httpClient);
    this.submissions = new SubmissionsApi(this.httpClient);
    this.users = new UsersApi(this.httpClient);
  }

  /**
   * Replaces the active bearer token.
   */
  public setAccessToken(token: string | undefined): void {
    this.authManager.setAccessToken(token);
  }

  /**
   * Replaces the active API key.
   */
  public setApiKey(apiKey: string | undefined): void {
    this.authManager.setApiKey(apiKey);
  }

  /**
   * Stores a new authenticated session returned by the API.
   */
  public setSession(session: Pick<AuthSession, "accessToken" | "refreshToken">): void {
    this.authManager.setSession(session);
  }

  /**
   * Clears all locally stored authentication state.
   */
  public clearSession(): void {
    this.authManager.clear();
  }

  /**
   * Returns the latest observed rate-limit headers.
   */
  public getRateLimitState(): RateLimitState {
    return this.httpClient.getRateLimitState();
  }
}
