/**
 * User resource module for the SolFoundry SDK.
 *
 * Provides methods for managing user profiles, viewing activity
 * history, and retrieving contribution statistics. All user
 * operations require authentication.
 *
 * @module users
 */

import type { HttpClient } from './client.js';
import type {
  UserActivityResponse,
  UserContributionStats,
  UserNotificationPreferences,
  UserProfile,
  UserProfileUpdate,
  UserNotificationResponse,
  UserNotificationUpdate,
} from './types.js';

/**
 * Client for interacting with the SolFoundry user API.
 *
 * Wraps `/api/users` and `/api/notifications` endpoints with
 * type-safe methods. Requires authentication for all operations.
 *
 * @example
 * ```typescript
 * const users = new UserClient(httpClient);
 *
 * // Get the authenticated user's profile
 * const profile = await users.getProfile();
 * console.log(profile.username, profile.reputation_score);
 *
 * // Update display name
 * await users.updateProfile({ display_name: 'Alice' });
 * ```
 */
export class UserClient {
  private readonly http: HttpClient;

  /**
   * Create a new UserClient.
   *
   * @param http - The configured HTTP client for API communication.
   */
  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Get the authenticated user's profile.
   *
   * Returns the full profile of the currently authenticated user,
   * including reputation score, tier progression, and earned badges.
   *
   * @returns The authenticated user's profile.
   * @throws {AuthenticationError} If not authenticated.
   */
  async getProfile(): Promise<UserProfile> {
    return this.http.request<UserProfile>({
      path: '/api/users/me',
      method: 'GET',
      requiresAuth: true,
    });
  }

  /**
   * Update the authenticated user's profile.
   *
   * Partially updates the user's profile. Only provided fields are
   * updated; omitted fields remain unchanged.
   *
   * @param data - Fields to update (all optional).
   * @returns The updated user profile.
   * @throws {AuthenticationError} If not authenticated.
   * @throws {ValidationError} If the update data is invalid.
   */
  async updateProfile(data: UserProfileUpdate): Promise<UserProfile> {
    return this.http.request<UserProfile>({
      path: '/api/users/me',
      method: 'PATCH',
      body: data,
      requiresAuth: true,
    });
  }

  /**
   * Get the authenticated user's activity history.
   *
   * Returns a paginated list of recent activities including bounty
   * submissions, reviews, payouts, and profile updates.
   *
   * @param options - Optional pagination parameters.
   * @param options.skip - Pagination offset (default 0).
   * @param options.limit - Page size (default 20, max 100).
   * @returns Paginated activity history.
   * @throws {AuthenticationError} If not authenticated.
   */
  async getActivity(options?: {
    skip?: number;
    limit?: number;
  }): Promise<UserActivityResponse> {
    return this.http.request<UserActivityResponse>({
      path: '/api/users/me/activity',
      method: 'GET',
      params: {
        skip: options?.skip,
        limit: options?.limit,
      },
      requiresAuth: true,
    });
  }

  /**
   * Get the authenticated user's contribution statistics.
   *
   * Returns aggregated statistics including total bounties completed,
   * total $FNDRY earned, average review score, and tier progression.
   *
   * @returns Contribution statistics for the authenticated user.
   * @throws {AuthenticationError} If not authenticated.
   */
  async getContributionStats(): Promise<UserContributionStats> {
    return this.http.request<UserContributionStats>({
      path: '/api/users/me/stats',
      method: 'GET',
      requiresAuth: true,
    });
  }

  /**
   * List notifications for the authenticated user.
   *
   * Returns a paginated list of notifications including bounty updates,
   * submission reviews, and payout confirmations.
   *
   * @param options - Optional filtering and pagination.
   * @param options.unread_only - Filter to only unread notifications.
   * @param options.skip - Pagination offset (default 0).
   * @param options.limit - Page size (default 20, max 100).
   * @returns Paginated notification list.
   * @throws {AuthenticationError} If not authenticated.
   */
  async listNotifications(options?: {
    unread_only?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<UserNotificationResponse> {
    return this.http.request<UserNotificationResponse>({
      path: '/api/users/me/notifications',
      method: 'GET',
      params: {
        unread_only: options?.unread_only,
        skip: options?.skip,
        limit: options?.limit,
      },
      requiresAuth: true,
    });
  }

  /**
   * Mark a notification as read.
   *
   * @param notificationId - The UUID of the notification to mark as read.
   * @returns The updated notification.
   * @throws {NotFoundError} If the notification does not exist.
   * @throws {AuthenticationError} If not authenticated.
   */
  async markNotificationRead(notificationId: string): Promise<UserNotificationUpdate> {
    return this.http.request<UserNotificationUpdate>({
      path: `/api/users/me/notifications/${notificationId}/read`,
      method: 'POST',
      requiresAuth: true,
    });
  }

  /**
   * Mark all notifications as read for the authenticated user.
   *
   * @returns Confirmation of the bulk update.
   * @throws {AuthenticationError} If not authenticated.
   */
  async markAllNotificationsRead(): Promise<{ success: boolean }> {
    return this.http.request<{ success: boolean }>({
      path: '/api/users/me/notifications/read-all',
      method: 'POST',
      requiresAuth: true,
    });
  }

  /**
   * Get the authenticated user's notification preferences.
   *
   * Returns which notification types are enabled (email, in-app, etc.).
   *
   * @returns Current notification preferences.
   * @throws {AuthenticationError} If not authenticated.
   */
  async getNotificationPreferences(): Promise<UserNotificationPreferences> {
    return this.http.request<UserNotificationPreferences>({
      path: '/api/users/me/notifications/preferences',
      method: 'GET',
      requiresAuth: true,
    });
  }

  /**
   * Update the authenticated user's notification preferences.
   *
   * @param data - Preference fields to update (all optional).
   * @returns Updated notification preferences.
   * @throws {AuthenticationError} If not authenticated.
   * @throws {ValidationError} If the preference data is invalid.
   */
  async updateNotificationPreferences(
    data: Partial<UserNotificationPreferences>,
  ): Promise<UserNotificationPreferences> {
    return this.http.request<UserNotificationPreferences>({
      path: '/api/users/me/notifications/preferences',
      method: 'PATCH',
      body: data,
      requiresAuth: true,
    });
  }
}