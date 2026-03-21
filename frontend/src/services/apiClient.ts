/**
 * Shared fetch wrapper — auth, retry, structured errors.
 * Caching handled by React Query at the hook layer.
 * @module services/apiClient
 */

/** Structured error from non-OK responses. */
export interface ApiError { status: number; message: string; code: string; }

const API_BASE: string = (import.meta.env?.VITE_API_URL as string) || '';
let authToken: string | null = null;

/** Store or clear the JWT for authenticated requests. */
export function setAuthToken(token: string | null): void { authToken = token; }
/** Return the current JWT (or null). */
export function getAuthToken(): string | null { return authToken; }
/** Runtime check: is value an ApiError? */
export function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && 'status' in value && 'message' in value && 'code' in value;
}

/** Send HTTP request with auth, retry on 5xx/429, and throw typed ApiError. */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit & { params?: Record<string, string | number | boolean | undefined>; retries?: number; body?: unknown } = {},
): Promise<T> {
  const { params, retries = 2, body, headers: extraHeaders, ...fetchOptions } = options;
  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') searchParams.set(key, String(value));
    }
    const queryString = searchParams.toString();
    if (queryString) url += (url.includes('?') ? '&' : '?') + queryString;
  }
  const method = (fetchOptions.method ?? (body ? 'POST' : 'GET')).toUpperCase();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(extraHeaders as Record<string, string>) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let lastError: ApiError = { status: 0, message: 'Request failed', code: 'UNKNOWN' };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { ...fetchOptions, method, headers, body: body ? JSON.stringify(body) : undefined });
      if (!response.ok) {
        let parsed: Record<string, string> = {};
        try { parsed = await response.json(); } catch { /* may not be JSON */ }
        const error: ApiError = { status: response.status, message: parsed.message ?? parsed.detail ?? response.statusText, code: parsed.code ?? `HTTP_${response.status}` };
        if (response.status < 500 && response.status !== 429) throw error;
        lastError = error;
      } else {
        return (await response.json()) as T;
      }
    } catch (caught: unknown) {
      if (isApiError(caught) && caught.status > 0 && caught.status < 500 && caught.status !== 429) throw caught;
      lastError = isApiError(caught) ? caught : { status: 0, message: caught instanceof Error ? caught.message : 'Network error', code: 'NETWORK_ERROR' };
    }
    if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
  }
  throw lastError;
}
