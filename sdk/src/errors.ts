/**
 * Typed error hierarchy for the SolFoundry SDK.
 *
 * Every error class maps to a specific failure mode from the backend API,
 * carrying the HTTP status code and machine-readable error code for
 * programmatic handling without string parsing.
 *
 * @module errors
 */

import type { ApiErrorResponse } from './types.js';

/**
 * Base error for all SolFoundry SDK failures.
 *
 * Provides a structured error with HTTP status, machine-readable code,
 * and optional request ID for correlating with server-side logs.
 */
export class SolFoundryError extends Error {
  /** HTTP status code returned by the API (0 for network/client errors). */
  public readonly statusCode: number;

  /** Machine-readable error code (e.g., "VALIDATION_ERROR", "AUTH_ERROR"). */
  public readonly code: string;

  /** Server-assigned request correlation ID for debugging. */
  public readonly requestId: string | null;

  /**
   * Create a new SolFoundryError.
   *
   * @param message - Human-readable error description.
   * @param statusCode - HTTP status code from the API response.
   * @param code - Machine-readable error code string.
   * @param requestId - Request correlation ID from the server.
   */
  constructor(
    message: string,
    statusCode: number = 0,
    code: string = 'UNKNOWN_ERROR',
    requestId: string | null = null,
  ) {
    super(message);
    this.name = 'SolFoundryError';
    this.statusCode = statusCode;
    this.code = code;
    this.requestId = requestId;
  }

  /**
   * Create a SolFoundryError from a raw API error response body.
   *
   * @param statusCode - The HTTP status code of the response.
   * @param body - The parsed JSON error response from the API.
   * @returns A new SolFoundryError subclass appropriate for the status code.
   */
  static fromApiResponse(statusCode: number, body: ApiErrorResponse): SolFoundryError {
    const message = body.message || 'Unknown error';
    const code = body.code || `HTTP_${statusCode}`;
    const requestId = body.request_id || null;

    switch (statusCode) {
      case 400:
        return new ValidationError(message, code, requestId);
      case 401:
        return new AuthenticationError(message, code, requestId);
      case 403:
        return new AuthorizationError(message, code, requestId);
      case 404:
        return new NotFoundError(message, code, requestId);
      case 409:
        return new ConflictError(message, code, requestId);
      case 423:
        return new LockError(message, code, requestId);
      case 429:
        return new RateLimitError(message, code, requestId);
      case 502:
        return new UpstreamError(message, code, requestId);
      default:
        if (statusCode >= 500) {
          return new ServerError(message, statusCode, code, requestId);
        }
        return new SolFoundryError(message, statusCode, code, requestId);
    }
  }
}

/**
 * Raised when request data fails validation (HTTP 400).
 *
 * Common causes: invalid field values, constraint violations,
 * malformed request body.
 */
export class ValidationError extends SolFoundryError {
  constructor(message: string, code: string = 'VALIDATION_ERROR', requestId: string | null = null) {
    super(message, 400, code, requestId);
    this.name = 'ValidationError';
  }
}

/**
 * Raised when authentication is required but missing or invalid (HTTP 401).
 *
 * The caller should obtain a valid JWT token via GitHub OAuth or
 * Solana wallet authentication before retrying.
 */
export class AuthenticationError extends SolFoundryError {
  constructor(message: string, code: string = 'AUTH_ERROR', requestId: string | null = null) {
    super(message, 401, code, requestId);
    this.name = 'AuthenticationError';
  }
}

/**
 * Raised when the authenticated user lacks permission (HTTP 403).
 *
 * Typically occurs when a user tries to modify a bounty they do not own
 * or access a resource restricted to a higher tier.
 */
export class AuthorizationError extends SolFoundryError {
  constructor(message: string, code: string = 'FORBIDDEN', requestId: string | null = null) {
    super(message, 403, code, requestId);
    this.name = 'AuthorizationError';
  }
}

/**
 * Raised when a requested resource does not exist (HTTP 404).
 *
 * Common for bounty, contributor, submission, and escrow lookups
 * with invalid or non-existent UUIDs.
 */
export class NotFoundError extends SolFoundryError {
  constructor(message: string, code: string = 'NOT_FOUND', requestId: string | null = null) {
    super(message, 404, code, requestId);
    this.name = 'NotFoundError';
  }
}

/**
 * Raised when a state conflict prevents the operation (HTTP 409).
 *
 * Examples: duplicate escrow creation, invalid state transition,
 * double-spend detection.
 */
export class ConflictError extends SolFoundryError {
  constructor(message: string, code: string = 'CONFLICT', requestId: string | null = null) {
    super(message, 409, code, requestId);
    this.name = 'ConflictError';
  }
}

/**
 * Raised when a resource is locked for concurrent access (HTTP 423).
 *
 * Typically occurs during payout processing when a per-bounty lock
 * is already held by another request.
 */
export class LockError extends SolFoundryError {
  constructor(message: string, code: string = 'LOCKED', requestId: string | null = null) {
    super(message, 423, code, requestId);
    this.name = 'LockError';
  }
}

/**
 * Raised when the client exceeds the API rate limit (HTTP 429).
 *
 * The SDK's built-in rate limiter should prevent this under normal use.
 * If this error occurs, the caller should back off before retrying.
 */
export class RateLimitError extends SolFoundryError {
  constructor(message: string, code: string = 'RATE_LIMITED', requestId: string | null = null) {
    super(message, 429, code, requestId);
    this.name = 'RateLimitError';
  }
}

/**
 * Raised when an upstream dependency (e.g., Solana RPC) fails (HTTP 502).
 *
 * This indicates that the SolFoundry backend could not complete
 * an on-chain operation. The request may be retried.
 */
export class UpstreamError extends SolFoundryError {
  constructor(message: string, code: string = 'UPSTREAM_ERROR', requestId: string | null = null) {
    super(message, 502, code, requestId);
    this.name = 'UpstreamError';
  }
}

/**
 * Raised for generic server-side failures (HTTP 5xx).
 *
 * These are transient errors that may resolve on retry.
 */
export class ServerError extends SolFoundryError {
  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    requestId: string | null = null,
  ) {
    super(message, statusCode, code, requestId);
    this.name = 'ServerError';
  }
}

/**
 * Raised when a network request fails before reaching the server.
 *
 * Causes include DNS resolution failure, connection refused,
 * timeout, or other transport-level errors.
 */
export class NetworkError extends SolFoundryError {
  /** The underlying error that caused the network failure. */
  public readonly cause: Error;

  /**
   * Create a NetworkError wrapping the original transport failure.
   *
   * @param message - Human-readable description of the failure.
   * @param cause - The underlying error (e.g., fetch TypeError).
   */
  constructor(message: string, cause: Error) {
    super(message, 0, 'NETWORK_ERROR', null);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/**
 * Raised when all retry attempts have been exhausted.
 *
 * Contains the last error encountered so the caller can inspect
 * the root cause of the persistent failure.
 */
export class RetryExhaustedError extends SolFoundryError {
  /** The last error encountered before giving up. */
  public readonly lastError: SolFoundryError;

  /** Total number of attempts that were made. */
  public readonly attempts: number;

  /**
   * Create a RetryExhaustedError after all retries failed.
   *
   * @param attempts - Total number of attempts made.
   * @param lastError - The error from the final attempt.
   */
  constructor(attempts: number, lastError: SolFoundryError) {
    super(
      `All ${attempts} retry attempts exhausted. Last error: ${lastError.message}`,
      lastError.statusCode,
      'RETRY_EXHAUSTED',
      lastError.requestId,
    );
    this.name = 'RetryExhaustedError';
    this.lastError = lastError;
    this.attempts = attempts;
  }
}
