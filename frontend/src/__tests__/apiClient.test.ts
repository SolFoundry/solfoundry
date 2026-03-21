/**
 * Tests for the shared API client — auth, retry, structured errors.
 * @module __tests__/apiClient.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, setAuthToken, getAuthToken, isApiError, type ApiError } from '../services/apiClient';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/** Helper to create a mock Response object. */
function mockResponse(body: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => mockResponse(body, status, statusText),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
  setAuthToken(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiClient', () => {
  it('should make a GET request and return parsed JSON', async () => {
    const responseData = { items: [{ id: 1, title: 'Bounty' }] };
    mockFetch.mockResolvedValueOnce(mockResponse(responseData));

    const result = await apiClient<typeof responseData>('/api/bounties');

    expect(result).toEqual(responseData);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/bounties');
    expect(options.method).toBe('GET');
  });

  it('should append query params to the URL', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));

    await apiClient('/api/bounties', { params: { limit: 10, status: 'open', empty: undefined } });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).toContain('status=open');
    expect(calledUrl).not.toContain('empty');
  });

  it('should include auth header when token is set', async () => {
    setAuthToken('test-jwt-token');
    mockFetch.mockResolvedValueOnce(mockResponse({}));

    await apiClient('/api/profile');

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer test-jwt-token');
  });

  it('should not include auth header when token is null', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}));

    await apiClient('/api/bounties');

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('should throw ApiError for 4xx responses', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ message: 'Not found', code: 'NOT_FOUND' }, 404, 'Not Found'));

    await expect(apiClient('/api/bounties/999')).rejects.toMatchObject({
      status: 404,
      message: 'Not found',
      code: 'NOT_FOUND',
    });
  });

  it('should retry on 5xx responses', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ message: 'Server error' }, 500))
      .mockResolvedValueOnce(mockResponse({ message: 'Server error' }, 500))
      .mockResolvedValueOnce(mockResponse({ data: 'success' }));

    const result = await apiClient<{ data: string }>('/api/data', { retries: 2 });
    expect(result.data).toBe('success');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should retry on 429 (rate limit) responses', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ message: 'Too many requests' }, 429))
      .mockResolvedValueOnce(mockResponse({ result: 'ok' }));

    const result = await apiClient<{ result: string }>('/api/data', { retries: 1 });
    expect(result.result).toBe('ok');
  });

  it('should throw after exhausting retries on 5xx', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ message: 'Server error' }, 500))
      .mockResolvedValueOnce(mockResponse({ message: 'Server error' }, 500));

    await expect(apiClient('/api/fail', { retries: 1 })).rejects.toMatchObject({
      status: 500,
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should handle network errors with NETWORK_ERROR code', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(apiClient('/api/data', { retries: 0 })).rejects.toMatchObject({
      status: 0,
      message: 'Failed to fetch',
      code: 'NETWORK_ERROR',
    });
  });

  it('should send POST with JSON body', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ id: 1 }));

    await apiClient('/api/bounties', { body: { title: 'New bounty' } });

    const options = mockFetch.mock.calls[0][1];
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify({ title: 'New bounty' }));
  });

  it('should not retry 4xx errors (except 429)', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ message: 'Bad request' }, 400));

    await expect(apiClient('/api/data', { retries: 3 })).rejects.toMatchObject({ status: 400 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('setAuthToken / getAuthToken', () => {
  it('should store and retrieve the token', () => {
    expect(getAuthToken()).toBeNull();
    setAuthToken('my-token');
    expect(getAuthToken()).toBe('my-token');
    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
  });
});

describe('isApiError', () => {
  it('should return true for valid ApiError objects', () => {
    const error: ApiError = { status: 404, message: 'Not found', code: 'NOT_FOUND' };
    expect(isApiError(error)).toBe(true);
  });

  it('should return false for plain Error objects', () => {
    expect(isApiError(new Error('fail'))).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isApiError(null)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
  });

  it('should return false for incomplete objects', () => {
    expect(isApiError({ status: 404 })).toBe(false);
    expect(isApiError({ status: 404, message: 'test' })).toBe(false);
  });
});
