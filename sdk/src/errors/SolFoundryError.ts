import type { ApiProblem, JsonObject, RateLimitState } from "../types/index.js";

/**
 * Base SDK error with request context attached.
 */
export class SolFoundryError extends Error {
  /**
   * HTTP status when available.
   */
  public readonly status?: number;

  /**
   * API error payload when available.
   */
  public readonly problem?: ApiProblem;

  /**
   * Raw response body when parsing fails or a text response is returned.
   */
  public readonly responseBody?: JsonObject | string;

  /**
   * Active rate-limit state at the time the error was raised.
   */
  public readonly rateLimit?: RateLimitState;

  public constructor(
    message: string,
    options: {
      status?: number;
      problem?: ApiProblem;
      responseBody?: JsonObject | string;
      rateLimit?: RateLimitState;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "SolFoundryError";
    this.status = options.status;
    this.problem = options.problem;
    this.responseBody = options.responseBody;
    this.rateLimit = options.rateLimit;
  }
}
