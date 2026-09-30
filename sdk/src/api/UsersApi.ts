import { BaseApi } from "./BaseApi.js";
import type {
  AuthSession,
  ListUsersParams,
  LoginInput,
  RegisterInput,
  UpdateUserProfileInput,
  User,
  UserListResponse,
} from "../types/index.js";

/**
 * User, authentication, and profile endpoints.
 */
export class UsersApi extends BaseApi {
  /**
   * Authenticates a user with email and password.
   */
  public async login(input: LoginInput): Promise<AuthSession> {
    return this.httpClient.request<AuthSession>("POST", "/auth/login", {
      body: input,
      skipAuth: true,
    });
  }

  /**
   * Registers a new user account.
   */
  public async register(input: RegisterInput): Promise<AuthSession> {
    return this.httpClient.request<AuthSession>("POST", "/auth/register", {
      body: input,
      skipAuth: true,
    });
  }

  /**
   * Refreshes the current access token using a refresh token.
   */
  public async refresh(refreshToken: string): Promise<AuthSession> {
    return this.httpClient.request<AuthSession>("POST", "/auth/refresh", {
      body: { refreshToken },
      skipAuth: true,
    });
  }

  /**
   * Invalidates the current user session.
   */
  public async logout(refreshToken?: string): Promise<void> {
    return this.httpClient.request<void>("POST", "/auth/logout", {
      body: refreshToken ? { refreshToken } : {},
      responseType: "void",
    });
  }

  /**
   * Returns the authenticated user profile.
   */
  public async getMe(): Promise<User> {
    return this.httpClient.request<User>("GET", "/users/me");
  }

  /**
   * Updates the authenticated user profile.
   */
  public async updateMe(input: UpdateUserProfileInput): Promise<User> {
    return this.httpClient.request<User>("PATCH", "/users/me", { body: input });
  }

  /**
   * Returns a paginated list of users.
   */
  public async list(params: ListUsersParams = {}): Promise<UserListResponse> {
    return this.httpClient.request<UserListResponse>("GET", "/users", { query: params });
  }

  /**
   * Fetches a user profile by id.
   */
  public async getById(userId: string): Promise<User> {
    return this.httpClient.request<User>("GET", `/users/${encodeURIComponent(userId)}`);
  }
}
