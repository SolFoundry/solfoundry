import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiClientMock } = vi.hoisted(() => ({
  apiClientMock: vi.fn(),
}));

vi.mock('../services/apiClient', () => ({
  apiClient: apiClientMock,
}));

import { getGitHubAuthorizeEndpoint, getGitHubAuthorizeUrl } from '../api/auth';

describe('auth api helpers', () => {
  beforeEach(() => {
    apiClientMock.mockReset();
  });

  it('returns API authorize URL from backend response when provided', async () => {
    apiClientMock.mockResolvedValueOnce({ authorize_url: 'https://github.com/login/oauth/authorize?client_id=test' });

    const result = await getGitHubAuthorizeUrl();

    expect(result).toBe('https://github.com/login/oauth/authorize?client_id=test');
    expect(apiClientMock).toHaveBeenCalledWith('/api/auth/github/authorize');
  });

  it('falls back to authorize endpoint when backend response is missing authorize_url', async () => {
    apiClientMock.mockResolvedValueOnce({});

    const result = await getGitHubAuthorizeUrl();

    expect(result).toBe(getGitHubAuthorizeEndpoint());
  });

  it('uses local relative authorize endpoint by default', () => {
    expect(getGitHubAuthorizeEndpoint()).toBe('/api/auth/github/authorize');
  });
});
