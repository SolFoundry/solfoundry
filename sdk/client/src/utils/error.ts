/**
 * Custom error class for SolFoundry API errors.
 *
 * Provides structured error information including HTTP status code,
 * API error code, and optional details.
 */
export class SolFoundryError extends Error {
  /** HTTP status code */
  public readonly statusCode: number;
  /** API-specific error code */
  public readonly code: string;
  /** Additional error details */
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SolFoundryError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  /** Returns true if this is a client error (4xx) */
  get isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /** Returns true if this is a server error (5xx) */
  get isServerError(): boolean {
    return this.statusCode >= 500;
  }

  /** Returns true if the error is retryable */
  get isRetryable(): boolean {
    return this.statusCode === 429 || this.statusCode >= 500;
  }

  override toString(): string {
    return `SolFoundryError [${this.code}] (${this.statusCode}): ${this.message}`;
  }
}
