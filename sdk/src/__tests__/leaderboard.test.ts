import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpClient } from '../client.js';
import { LeaderboardClient } from '../leaderboard.js';

describe('LeaderboardClient', () => {
  let mockHttp: HttpClient;
  let client: LeaderboardClient;

  beforeEach(() => {
    mockHttp = new HttpClient({ baseUrl: 'https://api.test' });
    client = new LeaderboardClient(mockHttp);
  });

  it('getGlobal matches the leaderboard specifications', async () => {
    const mockResponse = {
      leaderboard: [
        {
          id: 'usr_1',
          username: 'MaxVoss',
          reputation_score: 9999,
          total_earned: 50000,
          skills: ['Rust', 'TypeScript']
        }
      ],
      aggregated_at: '2026-06-02T12:00:00Z'
    };

    vi.spyOn(mockHttp, 'request').mockResolvedValue(mockResponse);

    const result = await client.getGlobal(10);

    expect(mockHttp.request).toHaveBeenCalledWith({
      path: '/api/leaderboard',
      method: 'GET',
      params: { limit: 10 }
    });
    expect(result.leaderboard[0].username).toBe('MaxVoss');
  });

  it('authenticateGithub forwards authorization code to api endpoint', async () => {
    const mockSession = {
      profile: {
        id: 'usr_1',
        username: 'MaxVoss'
      },
      token: 'jwt-auth-session-key-12345678'
    };

    vi.spyOn(mockHttp, 'request').mockResolvedValue(mockSession);

    const result = await client.authenticateGithub('github-oauth-authorized-code');

    expect(mockHttp.request).toHaveBeenCalledWith({
      path: '/api/auth/github',
      method: 'POST',
      body: { code: 'github-oauth-authorized-code' }
    });
    expect(result.token).toBe('jwt-auth-session-key-12345678');
  });
});
