/**
 * Core HTTP client for the SolFoundry API with connection management,
 * exponential backoff retry logic, and token-bucket rate limiting.
 *
 * This module is the foundation for all API interaction. Higher-level
 * resource modules (bounties, escrow, contributors) delegate their
 * HTTP calls through this client.
 *
 * @module client
 */

import type { ApiErrorResponse, SolFoundryClientConfig } from './types.js';
import {
  NetworkError,
  RetryExhaustedError,
  SolFoundryError,
} from './errors.js';

/** HTTP methods supported by the client. */
type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/**
 * Options for a single HTTP request, passed through the retry and
 * rate-limiting pipeline.
 */
export interface RequestOptions {
  /** URL path relative to the base URL (e.g., "/api/bounties"). */
  readonly path: string;
  /** HTTP method. */
  readonly method: HttpMethod;
  /** Query string parameters (appended as ?key=value). */
  readonly params?: Record<string, string | number | boolean | undefined>;
  /** JSON request body for POST/PATCH requests. */
  readonly body?: unknown;
  /** Whether this request requires authentication. Defaults to false. */
  readonly requiresAuth?: boolean;
}

/**
 * Simple token-bucket rate limiter that enforces a maximum number
 * of requests per second using a sliding window.
 *
 * Tokens refill continuously. When no tokens are available, the
 * limiter calculates the exact wait time needed.
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private lastRefillTime: number;
  private readonly refillRatePerMs: number;

  /**
   * Create a new rate limiter.
   *
   * @param maxRequestsPerSecond - Maximum sustained request rate.
   */
  constructor(maxRequestsPerSecond: number) {
    this.maxTokens = maxRequestsPerSecond;
    this.tokens = maxRequestsPerSecond;
    this.lastRefillTime = Date.now();
    this.refillRatePerMs = maxRequestsPerSecond / 1000;
  }

  /**
   * Wait until a token is available, then consume it.
   *
   * Resolves immediately if tokens are available; otherwise sleeps
   * for the minimum time needed for one token to refill.
   */
  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRatePerMs);
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens -= 1;
  }

  /**
   * Refill tokens based on elapsed time since the last refill.
   * Tokens are capped at the maximum bucket size.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefillTime = now;
  }
}

/**
 * Determine whether a failed request should be retried based on
 * the error type and HTTP status code.
 *
 * Retryable conditions:
 * - Network errors (connection refused, DNS failure, timeout)
 * - HTTP 429 (rate limited by server)
 * - HTTP 502, 503, 504 (upstream/transient server errors)
 *
 * @param error - The error to evaluate.
 * @returns True if the request should be retried.
 */
export function isRetryable(error: SolFoundryError): boolean {
  if (error instanceof NetworkError) {
    return true;
  }
  const retryableStatuses = new Set([429, 502, 503, 504]);
  return retryableStatuses.has(error.statusCode);
}

/**
 * Calculate exponential backoff delay with jitter for a given retry attempt.
 *
 * Uses the formula: min(baseDelay * 2^attempt + jitter, maxDelay)
 * where jitter is a random value in [0, baseDelay).
 *
 * @param attempt - Zero-based retry attempt number.
 * @param baseDelayMs - Base delay in milliseconds. Defaults to 500.
 * @param maxDelayMs - Maximum delay cap in milliseconds. Defaults to 10000.
 * @returns Delay in milliseconds before the next retry.
 */
export function calculateBackoff(
  attempt: number,
  baseDelayMs: number = 500,
  maxDelayMs: number = 10000,
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelayMs;
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Build a full URL from a base URL, path, and optional query parameters.
 *
 * Handles trailing slashes on baseUrl and leading slashes on path
 * to avoid double slashes. Undefined parameter values are omitted.
 *
 * @param baseUrl - The API base URL.
 * @param path - The endpoint path.
 * @param params - Optional query string parameters.
 * @returns The fully constructed URL string.
 */
export function buildUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let url = `${normalizedBase}${normalizedPath}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  return url;
}

/**
 * Core HTTP client for communicating with the SolFoundry REST API.
 *
 * Provides connection management (configurable base URL, auth token,
 * timeout), automatic retry with exponential backoff for transient
 * failures, and token-bucket rate limiting to stay within API quotas.
 *
 * Usage:
 * ```typescript
 * const client = new HttpClient({
 *   baseUrl: 'https://api.solfoundry.io',
 *   authToken: 'eyJ...',
 *   maxRetries: 3,
 *   maxRequestsPerSecond: 10,
 * });
 *
 * const bounties = await client.request<BountyListResponse>({
 *   path: '/api/bounties',
 *   method: 'GET',
 *   params: { limit: '20' },
 * });
 * ```
 */
export class HttpClient {
  private readonly baseUrl: string;
  private authToken: string | undefined;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly rateLimiter: RateLimiter;

  /**
   * Create a new HTTP client for the SolFoundry API.
   *
   * @param config - Client configuration including base URL, auth, and tuning.
   */
  constructor(config: SolFoundryClientConfig) {
    this.baseUrl = config.baseUrl;
    this.authToken = config.authToken;
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.rateLimiter = new RateLimiter(config.maxRequestsPerSecond ?? 10);
  }

  /**
   * Update the authentication token for subsequent requests.
   *
   * Call this after obtaining a new JWT through OAuth or wallet auth,
   * or pass undefined to clear authentication.
   *
   * @param token - The new JWT bearer token, or undefined to clear.
   */
  setAuthToken(token: string | undefined): void {
    this.authToken = token;
  }

  /**
   * Get the currently configured authentication token.
   *
   * @returns The JWT token string, or undefined if not authenticated.
   */
  getAuthToken(): string | undefined {
    return this.authToken;
  }

  /**
   * Execute an HTTP request with rate limiting and automatic retries.
   *
   * The request passes through the rate limiter first, then is executed
   * with the configured timeout. On transient failure (network error,
   * 429, 5xx), the request is retried with exponential backoff up to
   * `maxRetries` times.
   *
   * @typeParam T - Expected response body type.
   * @param options - Request configuration (path, method, params, body).
   * @returns The parsed JSON response body typed as T.
   * @throws {SolFoundryError} On API errors (4xx/5xx).
   * @throws {NetworkError} On transport-level failures.
   * @throws {RetryExhaustedError} When all retries fail.
   */
  async request<T>(options: RequestOptions): Promise<T> {
    let lastError: SolFoundryError | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0 && lastError) {
        const delay = calculateBackoff(attempt - 1);
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }

      await this.rateLimiter.acquire();

      try {
        return await this.executeRequest<T>(options);
      } catch (error) {
        if (error instanceof SolFoundryError) {
          lastError = error;
          if (!isRetryable(error) || attempt === this.maxRetries) {
            throw attempt > 0 && isRetryable(error)
              ? new RetryExhaustedError(attempt + 1, error)
              : error;
          }
        } else {
          throw error;
        }
      }
    }

    /* istanbul ignore next -- safety net: should not reach here */
    throw lastError ?? new SolFoundryError('Unexpected retry loop exit');
  }

  /**
   * Execute a single HTTP request without retry logic.
   *
   * Builds the URL, sets headers (including auth if configured),
   * sends the request with the configured timeout, and parses the
   * response. Non-2xx responses are converted to typed errors.
   *
   * @typeParam T - Expected response body type.
   * @param options - Request configuration.
   * @returns The parsed JSON response body.
   * @throws {SolFoundryError} On non-2xx responses.
   * @throws {NetworkError} On transport failures.
   */
  private async executeRequest<T>(options: RequestOptions): Promise<T> {
    const url = buildUrl(this.baseUrl, options.path, options.params);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const fetchOptions: RequestInit = {
        method: options.method,
        headers,
        signal: controller.signal,
      };

      if (options.body !== undefined && (options.method === 'POST' || options.method === 'PATCH')) {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        let errorBody: ApiErrorResponse;
        try {
          errorBody = (await response.json()) as ApiErrorResponse;
        } catch {
          errorBody = {
            message: response.statusText || `HTTP ${response.status}`,
            request_id: null,
            code: `HTTP_${response.status}`,
          };
        }
        throw SolFoundryError.fromApiResponse(response.status, errorBody);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof SolFoundryError) {
        throw error;
      }
      if (error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError')) {
        const message = error instanceof DOMException
          ? `Request timed out after ${this.timeoutMs}ms`
          : `Network error: ${error.message}`;
        throw new NetworkError(message, error);
      }
      throw new NetworkError(`Unexpected fetch error: ${String(error)}`, error as Error);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
