import type { ApiProblem, RateLimitState } from "../types/index.js";

/**
 * Base SDK error with request context attached.
 */
export class SolFoundryError extends Error {
  /**
   * HTTP status when available.
   */
  public readonly status: number | undefined;

  /**
   * API error payload when available.
   */
  public readonly problem: ApiProblem | undefined;

  /**
   * Raw response body when parsing fails or a text response is returned.
   */
  public readonly responseBody: unknown;

  /**
   * Active rate-limit state at the time the error was raised.
   */
  public readonly rateLimit: RateLimitState | undefined;

  public constructor(
    message: string,
    options: {
      status?: number | undefined;
      problem?: ApiProblem | undefined;
      responseBody?: unknown;
      rateLimit?: RateLimitState | undefined;
      cause?: unknown;
    } = {},
  ) {
    super(
      message,
      Object.prototype.hasOwnProperty.call(options, "cause")
        ? { cause: options.cause }
        : undefined,
    );
    this.name = "SolFoundryError";
    this.status = options.status;
    this.problem = options.problem;
    this.responseBody = options.responseBody;
    this.rateLimit = options.rateLimit;
  }
}
