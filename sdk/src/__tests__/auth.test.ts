/**
 * Tests for AuthClient.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthClient } from '../auth.js';
import type { HttpClient } from '../client.js';

// ---------------------------------------------------------------------------
// Mock HttpClient
// ---------------------------------------------------------------------------

function createMockHttpClient(): HttpClient {
  return {
    request: vi.fn(),
    setAuthToken: vi.fn(),
    getAuthToken: vi.fn(),
  } as unknown as HttpClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthClient', () => {
  let client: AuthClient;
  let http: HttpClient;

  beforeEach(() => {
    http = createMockHttpClient();
    client = new AuthClient(http);
  });

  describe('getGitHubAuthorizeUrl', () => {
    it('should return the authorize URL from the backend', async () => {
      const mockUrl = 'https://github.com/login/oauth/authorize?client_id=abc123';
      vi.mocked(http.request).mockResolvedValue({ authorize_url: mockUrl });

      const url = await client.getGitHubAuthorizeUrl();

      expect(url).toBe(mockUrl);
      expect(http.request).toHaveBeenCalledWith({
        path: '/api/auth/github/authorize',
        method: 'GET',
      });
    });

    it('should propagate errors from the backend', async () => {
      vi.mocked(http.request).mockRejectedValue(new Error('Upstream error'));

      await expect(client.getGitHubAuthorizeUrl()).rejects.toThrow('Upstream error');
    });
  });

  describe('exchangeGitHubCode', () => {
    it('should POST the code and state to the callback endpoint', async () => {
      const mockResponse = {
        access_token: 'jwt-access',
        refresh_token: 'jwt-refresh',
        token_type: 'Bearer',
        user: { id: 'user-1', username: 'octocat' },
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const result = await client.exchangeGitHubCode('auth-code-123', 'csrf-state');

      expect(result).toEqual(mockResponse);
      expect(http.request).toHaveBeenCalledWith({
        path: '/api/auth/github',
        method: 'POST',
        body: { code: 'auth-code-123', state: 'csrf-state' },
      });
    });

    it('should omit state when not provided', async () => {
      const mockResponse = {
        access_token: 'jwt-access',
        refresh_token: 'jwt-refresh',
        token_type: 'Bearer',
        user: { id: 'user-1', username: 'octocat' },
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const result = await client.exchangeGitHubCode('auth-code-123');

      expect(result).toEqual(mockResponse);
      expect(http.request).toHaveBeenCalledWith({
        path: '/api/auth/github',
        method: 'POST',
        body: { code: 'auth-code-123' },
      });
    });
  });

  describe('refreshTokens', () => {
    it('should POST the refresh token to the refresh endpoint', async () => {
      const mockTokens = {
        access_token: 'new-jwt',
        refresh_token: 'new-refresh',
        token_type: 'Bearer',
      };
      vi.mocked(http.request).mockResolvedValue(mockTokens);

      const result = await client.refreshTokens('old-refresh-token');

      expect(result).toEqual(mockTokens);
      expect(http.request).toHaveBeenCalledWith({
        path: '/api/auth/refresh',
        method: 'POST',
        body: { refresh_token: 'old-refresh-token' },
      });
    });
  });

  describe('getMe', () => {
    it('should GET the current user profile with auth', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'octocat',
        avatar_url: 'https://github.com/octocat.png',
      };
      vi.mocked(http.request).mockResolvedValue(mockUser);

      const result = await client.getMe();

      expect(result).toEqual(mockUser);
      expect(http.request).toHaveBeenCalledWith({
        path: '/api/auth/me',
        method: 'GET',
        requiresAuth: true,
      });
    });
  });
});
