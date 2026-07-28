/**
 * Tests for the UserClient resource module.
 *
 * Verifies that each method constructs the correct HTTP request
 * (path, method, params, body) and delegates to the HttpClient.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserClient } from '../users.js';
import type { HttpClient } from '../client.js';
import type {
  UserProfile,
  UserActivityResponse,
  UserContributionStats,
  UserNotificationResponse,
} from '../types.js';

/** Create a mock HttpClient with a vi.fn() for request. */
function createMockHttpClient(): HttpClient {
  return {
    request: vi.fn(),
    setAuthToken: vi.fn(),
    getAuthToken: vi.fn(),
  } as unknown as HttpClient;
}

/** Create a minimal user profile fixture. */
function createUserProfileFixture(overrides?: Partial<UserProfile>): UserProfile {
  return {
    id: 'user-123',
    username: 'testuser',
    display_name: 'Test User',
    email: 'test@example.com',
    wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    avatar_url: null,
    bio: 'A test user',
    skills: ['typescript', 'python'],
    badges: ['early-adopter'],
    reputation_score: 42,
    total_bounties_completed: 5,
    total_earned: 1500,
    tier_unlocked: 2,
    created_at: '2026-03-22T00:00:00Z',
    updated_at: '2026-03-22T00:00:00Z',
    ...overrides,
  };
}

describe('UserClient', () => {
  let http: HttpClient;
  let client: UserClient;

  beforeEach(() => {
    http = createMockHttpClient();
    client = new UserClient(http);
  });

  describe('getProfile', () => {
    it('should call GET /api/users/me with auth', async () => {
      const mockProfile = createUserProfileFixture();
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      const result = await client.getProfile();

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/users/me',
        method: 'GET',
        requiresAuth: true,
      });
      expect(result).toEqual(mockProfile);
    });
  });

  describe('updateProfile', () => {
    it('should call PATCH /api/users/me with auth and body', async () => {
      const updateData = { display_name: 'New Name', bio: 'Updated bio' };
      const mockProfile = createUserProfileFixture({ display_name: 'New Name', bio: 'Updated bio' });
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      const result = await client.updateProfile(updateData);

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/users/me',
        method: 'PATCH',
        body: updateData,
        requiresAuth: true,
      });
      expect(result.display_name).toBe('New Name');
    });
  });

  describe('getActivity', () => {
    it('should call GET /api/users/me/activity with auth', async () => {
      const mockResponse: UserActivityResponse = {
        items: [],
        total: 0,
        skip: 0,
        limit: 20,
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await client.getActivity();

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/users/me/activity',
        method: 'GET',
        params: { skip: undefined, limit: undefined },
        requiresAuth: true,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should pass pagination params', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [],
        total: 0,
        skip: 10,
        limit: 5,
      });

      await client.getActivity({ skip: 10, limit: 5 });

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/users/me/activity',
        method: 'GET',
        params: { skip: 10, limit: 5 },
        requiresAuth: true,
      });
    });
  });

  describe('getContributionStats', () => {
    it('should call GET /api/users/me/stats with auth', async () => {
      const mockStats: UserContributionStats = {
        total_bounties_completed: 5,
        total_bounties_in_progress: 2,
        total_fndry_earned: 1500,
        average_review_score: 8.2,
        auto_approved_count: 3,
        tier_unlocked: 2,
        bounties_by_tier: { '1': 3, '2': 2 },
        total_submissions: 8,
        approval_rate: 0.75,
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockStats);

      const result = await client.getContributionStats();

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/users/me/stats',
        method: 'GET',
        requiresAuth: true,
      });
      expect(result).toEqual(mockStats);
    });
  });

  describe('listNotifications', () => {
    it('should call GET /api/users/me/notifications with auth', async () => {
      const mockResponse: UserNotificationResponse = {
        items: [],
        total: 0,
        unread_count: 0,
        skip: 0,
        limit: 20,
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await client.listNotifications();

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/users/me/notifications',
        method: 'GET',
        params: { unread_only: undefined, skip: undefined, limit: undefined },
        requiresAuth: true,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should pass filter params', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [],
        total: 0,
        unread_count: 0,
        skip: 0,
        limit: 10,
      });

      await client.listNotifications({ unread_only: true, skip: 0, limit: 10 });

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/users/me/notifications',
        method: 'GET',
        params: { unread_only: true, skip: 0, limit: 10 },
        requiresAuth: true,
      });
    });
  });

  describe('markNotificationRead', () => {
    it('should call POST /api/users/me/notifications/:id/read with auth', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue({
        notification: { id: 'notif-1', read: true },
        unread_count: 3,
      });

      const result = await client.markNotificationRead('notif-1');

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/users/me/notifications/notif-1/read',
        method: 'POST',
        requiresAuth: true,
      });
      expect(result.notification.read).toBe(true);
    });
  });

  describe('markAllNotificationsRead', () => {
    it('should call POST /api/users/me/notifications/read-all with auth', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      const result = await client.markAllNotificationsRead();

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/users/me/notifications/read-all',
        method: 'POST',
        requiresAuth: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getNotificationPreferences', () => {
    it('should call GET /api/users/me/notifications/preferences with auth', async () => {
      const mockPrefs = {
        email_on_review: true,
        email_on_completion: true,
        email_on_payout: true,
        email_on_new_bounty: false,
        in_app_notifications: true,
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockPrefs);

      const result = await client.getNotificationPreferences();

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/users/me/notifications/preferences',
        method: 'GET',
        requiresAuth: true,
      });
      expect(result).toEqual(mockPrefs);
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should call PATCH /api/users/me/notifications/preferences with auth', async () => {
      const updateData = { email_on_new_bounty: true };
      const mockPrefs = {
        email_on_review: true,
        email_on_completion: true,
        email_on_payout: true,
        email_on_new_bounty: true,
        in_app_notifications: true,
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(mockPrefs);

      const result = await client.updateNotificationPreferences(updateData);

      expect(http.request).toHaveBeenCalledWith({
        path: '/api/users/me/notifications/preferences',
        method: 'PATCH',
        body: updateData,
        requiresAuth: true,
      });
      expect(result.email_on_new_bounty).toBe(true);
    });
  });
});