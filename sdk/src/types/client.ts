import type { JsonObject, RateLimitState } from "./common.js";

/**
 * Supported authentication configuration.
 */
export interface SolFoundryAuthConfig {
  /**
   * Static bearer token used for all requests.
   */
  accessToken?: string;
  /**
   * API key sent as `X-API-Key`.
   */
  apiKey?: string;
  /**
   * Custom callback for resolving a bearer token lazily.
   */
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
}

/**
 * Retry configuration for transient failures.
 */
export interface RetryConfig {
  /**
   * Maximum number of retries after the initial request.
   */
  maxRetries?: number;
  /**
   * Base delay used for exponential backoff in milliseconds.
   */
  baseDelayMs?: number;
  /**
   * Maximum delay between retry attempts in milliseconds.
   */
  maxDelayMs?: number;
  /**
   * HTTP status codes eligible for retry.
   */
  retryableStatusCodes?: number[];
}

/**
 * Client-side rate limiter configuration.
 */
export interface RateLimitConfig {
  /**
   * Minimum delay between outbound requests in milliseconds.
   */
  minIntervalMs?: number;
  /**
   * When true, honor server-provided `Retry-After` headers.
   */
  respectRetryAfter?: boolean;
}

/**
 * SDK client configuration.
 */
export interface SolFoundryClientConfig {
  /**
   * Base URL for the SolFoundry API.
   */
  baseUrl?: string;
  /**
   * Authentication settings.
   */
  auth?: SolFoundryAuthConfig;
  /**
   * Additional default headers.
   */
  headers?: Record<string, string>;
  /**
   * Optional custom fetch implementation.
   */
  fetch?: typeof globalThis.fetch;
  /**
   * Request timeout in milliseconds.
   */
  timeoutMs?: number;
  /**
   * Retry behavior for transient failures.
   */
  retry?: RetryConfig;
  /**
   * Client-side rate limiting behavior.
   */
  rateLimit?: RateLimitConfig;
  /**
   * Hook invoked after each response.
   */
  onResponse?: (response: Response, rateLimitState: RateLimitState) => void;
}

/**
 * Low-level request options.
 */
export interface RequestOptions {
  /**
   * Query string parameters.
   */
  query?: Record<string, string | number | boolean | undefined | null>;
  /**
   * JSON payload sent to the API.
   */
  body?: JsonObject;
  /**
   * Additional per-request headers.
   */
  headers?: Record<string, string>;
  /**
   * Override timeout for a single request.
   */
  timeoutMs?: number;
  /**
   * Skip authentication headers.
   */
  skipAuth?: boolean;
  /**
   * Expected response type.
   */
  responseType?: "json" | "text" | "void";
}
