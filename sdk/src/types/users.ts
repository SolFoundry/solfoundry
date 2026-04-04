import type { JsonObject, PaginatedResponse, ResourceId, SortOrder, Timestamps } from "./common.js";

/**
 * SolFoundry user resource.
 */
export interface User extends Timestamps {
  /**
   * Unique user identifier.
   */
  id: ResourceId;
  /**
   * Public display name.
   */
  displayName: string;
  /**
   * Primary email address.
   */
  email?: string;
  /**
   * Short bio for the user profile.
   */
  bio?: string;
  /**
   * Avatar URL.
   */
  avatarUrl?: string;
  /**
   * External wallet address.
   */
  walletAddress?: string;
  /**
   * Additional provider-defined attributes.
   */
  metadata?: JsonObject;
}

/**
 * Authentication response returned after login or token refresh.
 */
export interface AuthSession {
  /**
   * Bearer token used for API requests.
   */
  accessToken: string;
  /**
   * Optional refresh token.
   */
  refreshToken?: string;
  /**
   * Token expiration time in seconds.
   */
  expiresIn?: number;
  /**
   * Authenticated user.
   */
  user: User;
}

/**
 * User login payload.
 */
export interface LoginInput {
  /**
   * User email.
   */
  email: string;
  /**
   * User password.
   */
  password: string;
}

/**
 * User registration payload.
 */
export interface RegisterInput {
  /**
   * Public display name.
   */
  displayName: string;
  /**
   * User email.
   */
  email: string;
  /**
   * User password.
   */
  password: string;
  /**
   * Optional wallet address.
   */
  walletAddress?: string;
}

/**
 * Editable profile fields.
 */
export interface UpdateUserProfileInput {
  /**
   * Public display name.
   */
  displayName?: string;
  /**
   * Short bio.
   */
  bio?: string;
  /**
   * Avatar URL.
   */
  avatarUrl?: string;
  /**
   * Wallet address.
   */
  walletAddress?: string;
  /**
   * Additional provider-defined attributes.
   */
  metadata?: JsonObject;
}

/**
 * Query options for listing users.
 */
export interface ListUsersParams {
  /**
   * Pagination cursor.
   */
  cursor?: string;
  /**
   * Page size.
   */
  limit?: number;
  /**
   * Free-text search query.
   */
  search?: string;
  /**
   * Sort order for creation time.
   */
  sort?: SortOrder;
}

/**
 * Paginated user list.
 */
export type UserListResponse = PaginatedResponse<User>;
