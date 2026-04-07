/**
 * Shared fetch wrapper -- auth, retry, structured errors, and timeout.
 * Caching handled by React Query at the hook layer.
 * @module services/apiClient
 */

/** Default request timeout in milliseconds (15 seconds). */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Structured error from non-OK responses.
 * Extends native Error so that `instanceof Error` checks work correctly
 * (e.g. in React Query error handlers and error boundaries).
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, message: string, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Base URL for all API requests.
 * Reads VITE_API_URL at build time; defaults to the FastAPI dev server.
 * Endpoints already include the /api prefix, so this is just the host.
 */
const API_BASE: string =
  import.meta.env?.VITE_API_URL != null && import.meta.env.VITE_API_URL !== ''
    ? (import.meta.env.VITE_API_URL as string)
    : '';

let authToken: string | null = null;

/** Store or clear the JWT for authenticated requests. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** Return the current JWT (or null). */
export function getAuthToken(): string | null {
  return authToken;
}

/** Callback invoked when a token refresh fails (session fully expired). */
let onAuthExpired: (() => void) | null = null;

/** Register a handler (typically AuthContext's logout) for expired sessions. */
export function setOnAuthExpired(cb: (() => void) | null): void {
  onAuthExpired = cb;
}

/** Shared promise to deduplicate concurrent refresh calls. */
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem('sf_refresh_token');
  if (!refreshToken) throw new Error('No refresh token');

  const response = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) throw new Error('Refresh failed');

  const data = await response.json();
  return data.access_token as string;
}

/**
 * Runtime type guard -- validates that all three required properties
 * exist AND have the correct types (not just key presence).
 */
export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.status === 'number' &&
    typeof candidate.message === 'string' &&
    typeof candidate.code === 'string'
  );
}

/**
 * Send HTTP request with auth, retry on 5xx/429, abort timeout, and
 * structured ApiError on failure.
 */
export async function apiClient<T>(
  endpoint: string,
  options: Omit<RequestInit, 'body'> & {
    params?: Record<string, string | number | boolean | undefined>;
    retries?: number;
    /** JSON-serializable object; sent as application/json (not raw RequestInit.body). */
    body?: unknown;
    timeoutMs?: number;
    /** @internal — set by the refresh-retry logic to prevent infinite loops. */
    _isRetryAfterRefresh?: boolean;
  } = {},
): Promise<T> {
  const {
    params,
    retries = 2,
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers: extraHeaders,
    _isRetryAfterRefresh,
    ...fetchOptions
  } = options;

  // Build URL with query params
  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '')
        searchParams.set(key, String(value));
    }
    const queryString = searchParams.toString();
    if (queryString) url += (url.includes('?') ? '&' : '?') + queryString;
  }

  // Determine method
  const method = (
    fetchOptions.method ?? (body ? 'POST' : 'GET')
  ).toUpperCase();

  // Only attach Content-Type when there is a body to send
  const headers: Record<string, string> = {
    ...(extraHeaders as Record<string, string>),
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  let lastError: ApiError = new ApiError(0, 'Request failed', 'UNKNOWN');

  for (let attempt = 0; attempt <= retries; attempt++) {
    // AbortController for per-request timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        let parsed: Record<string, string> = {};
        try {
          parsed = await response.json();
        } catch {
          /* response may not be JSON */
        }
        const error = new ApiError(
          response.status,
          parsed.message ?? parsed.detail ?? response.statusText,
          parsed.code ?? `HTTP_${response.status}`,
        );
        // 401: attempt token refresh once, then retry the original request
        if (response.status === 401 && !_isRetryAfterRefresh) {
          try {
            if (!refreshPromise) {
              refreshPromise = refreshAccessToken();
            }
            const newToken = await refreshPromise;
            refreshPromise = null;
            setAuthToken(newToken);
            localStorage.setItem('sf_access_token', newToken);
            return apiClient<T>(endpoint, { ...options, _isRetryAfterRefresh: true });
          } catch {
            refreshPromise = null;
            onAuthExpired?.();
            throw error;
          }
        }
        // 4xx (except 429) are not retried
        if (response.status < 500 && response.status !== 429) throw error;
        lastError = error;
      } else {
        // Handle 204 No Content and other empty responses gracefully
        const contentType = response.headers.get('content-type') ?? '';
        if (
          response.status === 204 ||
          response.headers.get('content-length') === '0'
        ) {
          return undefined as unknown as T;
        }
        if (contentType.includes('application/json')) {
          return (await response.json()) as T;
        }
        // Attempt JSON parse; return empty object on failure
        try {
          return (await response.json()) as T;
        } catch {
          return undefined as unknown as T;
        }
      }
    } catch (caught: unknown) {
      if (caught instanceof ApiError && caught.status > 0 && caught.status < 500 && caught.status !== 429) {
        throw caught;
      }
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        lastError = new ApiError(0, 'Request timed out', 'TIMEOUT');
      } else if (caught instanceof ApiError) {
        lastError = caught;
      } else {
        lastError = new ApiError(
          0,
          caught instanceof Error ? caught.message : 'Network error',
          'NETWORK_ERROR',
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }

    // Exponential backoff between retries
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
    }
  }
  throw lastError;
}
