/**
 * Generic primitive-backed dictionary.
 */
export type JsonObject = Record<string, unknown>;

/**
 * Shared identifier type used by API resources.
 */
export type ResourceId = string;

/**
 * Cursor metadata returned by paginated SolFoundry endpoints.
 */
export interface PaginationMeta {
  /**
   * Cursor for the next page of results.
   */
  nextCursor?: string;
  /**
   * Cursor for the previous page of results.
   */
  previousCursor?: string;
  /**
   * Number of items returned in the current page.
   */
  count: number;
  /**
   * Total number of items if supplied by the server.
   */
  total?: number;
}

/**
 * Standard paginated response shape.
 */
export interface PaginatedResponse<T> {
  /**
   * Page items.
   */
  items: T[];
  /**
   * Pagination metadata.
   */
  meta: PaginationMeta;
}

/**
 * Sort direction accepted by collection endpoints.
 */
export type SortOrder = "asc" | "desc";

/**
 * Shared timestamp fields returned by the API.
 */
export interface Timestamps {
  /**
   * ISO-8601 creation timestamp.
   */
  createdAt: string;
  /**
   * ISO-8601 update timestamp.
   */
  updatedAt: string;
}

/**
 * Metadata about the active rate-limit window.
 */
export interface RateLimitState {
  /**
   * Maximum requests allowed in the current server window.
   */
  limit?: number;
  /**
   * Remaining requests in the current server window.
   */
  remaining?: number;
  /**
   * UTC epoch milliseconds when the window resets.
   */
  resetAt?: number;
  /**
   * Server-advised wait time in milliseconds before retrying.
   */
  retryAfterMs?: number;
}

/**
 * Problem details shape returned by the API.
 */
export interface ApiProblem {
  /**
   * Machine-readable error code.
   */
  code?: string;
  /**
   * Human-readable error message.
   */
  message: string;
  /**
   * Additional error details.
   */
  details?: JsonObject;
}
