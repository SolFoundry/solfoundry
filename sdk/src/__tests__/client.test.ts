/**
 * Tests for the core HTTP client including rate limiter, retry logic,
 * URL building, and request execution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  HttpClient,
  RateLimiter,
  buildUrl,
  calculateBackoff,
  isRetryable,
} from '../client.js';
import {
  NetworkError,
  NotFoundError,
  RateLimitError,
  RetryExhaustedError,
  ServerError,
  SolFoundryError,
  ValidationError,
} from '../errors.js';

// ---------------------------------------------------------------------------
// buildUrl
// ---------------------------------------------------------------------------

describe('buildUrl', () => {
  it('should join base URL and path with single slash', () => {
    expect(buildUrl('https://api.example.com', '/api/bounties')).toBe(
      'https://api.example.com/api/bounties',
    );
  });

  it('should handle trailing slash on base URL', () => {
    expect(buildUrl('https://api.example.com/', '/api/bounties')).toBe(
      'https://api.example.com/api/bounties',
    );
  });

  it('should handle missing leading slash on path', () => {
    expect(buildUrl('https://api.example.com', 'api/bounties')).toBe(
      'https://api.example.com/api/bounties',
    );
  });

  it('should append query parameters', () => {
    const url = buildUrl('https://api.example.com', '/api/bounties', {
      status: 'open',
      limit: 10,
    });
    expect(url).toContain('status=open');
    expect(url).toContain('limit=10');
    expect(url).toContain('?');
  });

  it('should omit undefined query parameters', () => {
    const url = buildUrl('https://api.example.com', '/api/bounties', {
      status: 'open',
      tier: undefined,
    });
    expect(url).toContain('status=open');
    expect(url).not.toContain('tier');
  });

  it('should handle empty params object', () => {
    const url = buildUrl('https://api.example.com', '/api/bounties', {});
    expect(url).toBe('https://api.example.com/api/bounties');
  });

  it('should handle boolean parameters', () => {
    const url = buildUrl('https://api.example.com', '/path', { active: true });
    expect(url).toContain('active=true');
  });
});

// ---------------------------------------------------------------------------
// calculateBackoff
// ---------------------------------------------------------------------------

describe('calculateBackoff', () => {
  it('should increase delay exponentially', () => {
    // Since there is jitter, we test that attempt 2 base is larger than attempt 0 base
    const delays: number[] = [];
    for (let i = 0; i < 5; i++) {
      delays.push(calculateBackoff(i, 100, 50000));
    }
    // Base delays: 100, 200, 400, 800, 1600 (plus up to 100ms jitter)
    // attempt 3 base (800) should generally be larger than attempt 0 (100+jitter)
    expect(delays[3]).toBeGreaterThan(100);
  });

  it('should cap at maxDelayMs', () => {
    const delay = calculateBackoff(20, 500, 10000);
    expect(delay).toBeLessThanOrEqual(10000);
  });

  it('should use default values', () => {
    const delay = calculateBackoff(0);
    // Base delay default is 500, jitter up to 500, so max is 1000
    expect(delay).toBeGreaterThanOrEqual(500);
    expect(delay).toBeLessThanOrEqual(1000);
  });
});

// ---------------------------------------------------------------------------
// isRetryable
// ---------------------------------------------------------------------------

describe('isRetryable', () => {
  it('should return true for NetworkError', () => {
    const error = new NetworkError('timeout', new Error('timeout'));
    expect(isRetryable(error)).toBe(true);
  });

  it('should return true for 429 RateLimitError', () => {
    const error = new RateLimitError('rate limited');
    expect(isRetryable(error)).toBe(true);
  });

  it('should return true for 502 UpstreamError', () => {
    const error = new ServerError('bad gateway', 502);
    expect(isRetryable(error)).toBe(true);
  });

  it('should return true for 503 ServerError', () => {
    const error = new ServerError('unavailable', 503);
    expect(isRetryable(error)).toBe(true);
  });

  it('should return true for 504 ServerError', () => {
    const error = new ServerError('timeout', 504);
    expect(isRetryable(error)).toBe(true);
  });

  it('should return false for 400 ValidationError', () => {
    const error = new ValidationError('bad input');
    expect(isRetryable(error)).toBe(false);
  });

  it('should return false for 404 NotFoundError', () => {
    const error = new NotFoundError('missing');
    expect(isRetryable(error)).toBe(false);
  });

  it('should return false for 500 ServerError', () => {
    const error = new ServerError('internal error', 500);
    expect(isRetryable(error)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RateLimiter
// ---------------------------------------------------------------------------

describe('RateLimiter', () => {
  it('should allow requests up to the limit immediately', async () => {
    const limiter = new RateLimiter(5);
    const start = Date.now();

    // 5 tokens available immediately
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    const elapsed = Date.now() - start;
    // Should complete almost instantly (allow 100ms for test overhead)
    expect(elapsed).toBeLessThan(100);
  });

  it('should delay when tokens are exhausted', async () => {
    const limiter = new RateLimiter(2);
    // Drain all tokens
    await limiter.acquire();
    await limiter.acquire();

    const start = Date.now();
    await limiter.acquire(); // Should wait for refill
    const elapsed = Date.now() - start;

    // At 2 per second, refill takes ~500ms per token
    expect(elapsed).toBeGreaterThanOrEqual(100); // Allow some slack
  });
});

// ---------------------------------------------------------------------------
// HttpClient
// ---------------------------------------------------------------------------

describe('HttpClient', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should make GET requests successfully', async () => {
    const mockResponse = { items: [], total: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      maxRetries: 0,
      maxRequestsPerSecond: 100,
    });

    const result = await client.request({ path: '/api/bounties', method: 'GET' });
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('should include auth header when token is set', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      authToken: 'test-jwt-token',
      maxRetries: 0,
      maxRequestsPerSecond: 100,
    });

    await client.request({ path: '/test', method: 'GET' });

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = fetchCall[1].headers;
    expect(headers['Authorization']).toBe('Bearer test-jwt-token');
  });

  it('should send JSON body for POST requests', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: '123' }),
    });

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      maxRetries: 0,
      maxRequestsPerSecond: 100,
    });

    const body = { title: 'Test bounty', reward_amount: 500 };
    await client.request({ path: '/api/bounties', method: 'POST', body });

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].body).toBe(JSON.stringify(body));
    expect(fetchCall[1].method).toBe('POST');
  });

  it('should throw NotFoundError for 404 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({
        message: 'Bounty not found',
        request_id: 'req-123',
        code: 'NOT_FOUND',
      }),
    });

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      maxRetries: 0,
      maxRequestsPerSecond: 100,
    });

    await expect(
      client.request({ path: '/api/bounties/bad-id', method: 'GET' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw ValidationError for 400 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({
        message: 'Invalid title length',
        request_id: null,
        code: 'VALIDATION_ERROR',
      }),
    });

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      maxRetries: 0,
      maxRequestsPerSecond: 100,
    });

    await expect(
      client.request({ path: '/test', method: 'POST', body: {} }),
    ).rejects.toThrow(ValidationError);
  });

  it('should handle non-JSON error response bodies', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('not JSON')),
    });

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      maxRetries: 0,
      maxRequestsPerSecond: 100,
    });

    await expect(
      client.request({ path: '/test', method: 'GET' }),
    ).rejects.toThrow(ServerError);
  });

  it('should throw NetworkError on fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      maxRetries: 0,
      maxRequestsPerSecond: 100,
    });

    await expect(
      client.request({ path: '/test', method: 'GET' }),
    ).rejects.toThrow(NetworkError);
  });

  it('should retry on 502 and eventually succeed', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve({
          ok: false,
          status: 502,
          json: () => Promise.resolve({
            message: 'Bad Gateway',
            request_id: null,
            code: 'UPSTREAM_ERROR',
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
    });

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      maxRetries: 3,
      maxRequestsPerSecond: 100,
    });

    const result = await client.request<{ success: boolean }>({
      path: '/test',
      method: 'GET',
    });

    expect(result.success).toBe(true);
    expect(callCount).toBe(3);
  });

  it('should throw RetryExhaustedError when all retries fail', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({
        message: 'Service unavailable',
        request_id: null,
        code: 'SERVICE_UNAVAILABLE',
      }),
    });

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      maxRetries: 2,
      maxRequestsPerSecond: 100,
    });

    await expect(
      client.request({ path: '/test', method: 'GET' }),
    ).rejects.toThrow(RetryExhaustedError);
  });

  it('should not retry non-retryable errors', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          message: 'Not found',
          request_id: null,
          code: 'NOT_FOUND',
        }),
      });
    });

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      maxRetries: 3,
      maxRequestsPerSecond: 100,
    });

    await expect(
      client.request({ path: '/test', method: 'GET' }),
    ).rejects.toThrow(NotFoundError);

    expect(callCount).toBe(1); // No retries for 404
  });

  it('should handle 204 No Content responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      maxRetries: 0,
      maxRequestsPerSecond: 100,
    });

    const result = await client.request({ path: '/test', method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('should update auth token via setAuthToken', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      maxRetries: 0,
      maxRequestsPerSecond: 100,
    });

    expect(client.getAuthToken()).toBeUndefined();

    client.setAuthToken('new-token');
    expect(client.getAuthToken()).toBe('new-token');

    await client.request({ path: '/test', method: 'GET' });

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].headers['Authorization']).toBe('Bearer new-token');
  });

  it('should clear auth token when set to undefined', () => {
    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      authToken: 'initial',
      maxRetries: 0,
      maxRequestsPerSecond: 100,
    });

    expect(client.getAuthToken()).toBe('initial');
    client.setAuthToken(undefined);
    expect(client.getAuthToken()).toBeUndefined();
  });

  it('should append query params to GET requests', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      maxRetries: 0,
      maxRequestsPerSecond: 100,
    });

    await client.request({
      path: '/api/bounties',
      method: 'GET',
      params: { status: 'open', limit: 10 },
    });

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = fetchCall[0] as string;
    expect(url).toContain('status=open');
    expect(url).toContain('limit=10');
  });

  it('should retry on NetworkError', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new TypeError('network error'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      });
    });

    const client = new HttpClient({
      baseUrl: 'https://api.test.com',
      maxRetries: 2,
      maxRequestsPerSecond: 100,
    });

    const result = await client.request<{ ok: boolean }>({
      path: '/test',
      method: 'GET',
    });

    expect(result.ok).toBe(true);
    expect(callCount).toBe(2);
  });
});
