/**
 * HTTP client for the SolFoundry API.
 * Mirrors the frontend apiClient at frontend/src/services/apiClient.ts
 * Uses Node.js https module for VS Code extension compatibility.
 */

import * as https from 'https';
import * as http from 'http';
import * as url from 'url';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  authToken?: string;
  timeoutMs?: number;
  retries?: number;
}

export async function apiClient<T>(
  endpoint: string,
  options: (ApiClientOptions & {
    method?: string;
    params?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
  }) = {} as any,
): Promise<T> {
  const {
    baseUrl,
    authToken,
    timeoutMs = 15000,
    retries = 2,
    method,
    params,
    body,
  } = options;

  const parsedUrl = new url.URL(baseUrl);
  const isHttps = parsedUrl.protocol === 'https:';
  const transport = isHttps ? https : http;

  // Build full URL with query params
  let fullUrl = `${baseUrl}${endpoint}`;
  if (params) {
    const searchParams = new url.URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        searchParams.set(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
    }
  }

  const requestUrl = new url.URL(fullUrl);
  const httpMethod = (method ?? (body ? 'POST' : 'GET')).toUpperCase();

  const reqOptions: https.RequestOptions = {
    hostname: requestUrl.hostname,
    port: requestUrl.port || (isHttps ? 443 : 80),
    path: requestUrl.pathname + requestUrl.search,
    method: httpMethod,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    },
    timeout: timeoutMs,
  };

  let lastError: ApiError = new ApiError(0, 'Request failed', 'UNKNOWN');

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>(
        (resolve, reject) => {
          const req = transport.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk: Buffer) => { data += chunk; });
            res.on('end', () => {
              resolve({
                status: res.statusCode || 0,
                headers: res.headers,
                body: data,
              });
            });
          });

          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new ApiError(0, 'Request timed out', 'TIMEOUT'));
          });

          if (body) {
            req.write(JSON.stringify(body));
          }
          req.end();
        }
      );

      // Handle empty responses
      if (response.status === 204 || response.body.length === 0) {
        return undefined as unknown as T;
      }

      if (response.status >= 400) {
        let parsed: Record<string, string> = {};
        try {
          parsed = JSON.parse(response.body);
        } catch {
          // Non-JSON error response
        }
        const error = new ApiError(
          response.status,
          parsed.message ?? parsed.detail ?? `HTTP ${response.status}`,
          parsed.code ?? `HTTP_${response.status}`
        );

        // Retry on 5xx or 429
        if (response.status >= 500 || response.status === 429) {
          lastError = error;
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
            continue;
          }
        }
        throw error;
      }

      // Parse successful JSON response
      try {
        return JSON.parse(response.body) as T;
      } catch {
        return undefined as unknown as T;
      }
    } catch (caught: unknown) {
      if (caught instanceof ApiError && caught.status > 0 && caught.status < 500 && caught.status !== 429) {
        throw caught;
      }
      if (caught instanceof ApiError) {
        lastError = caught;
      } else {
        lastError = new ApiError(
          0,
          caught instanceof Error ? caught.message : 'Network error',
          'NETWORK_ERROR'
        );
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
      }
    }
  }

  throw lastError;
}
