import { AuthManager } from "../auth/AuthManager.js";
import { SolFoundryError } from "../errors/SolFoundryError.js";
import type {
  ApiProblem,
  JsonObject,
  RateLimitState,
  RequestOptions,
  RetryConfig,
  SolFoundryClientConfig,
} from "../types/index.js";
import { RateLimiter } from "./RateLimiter.js";

const DEFAULT_BASE_URL = "https://api.solfoundry.com/v1";
const DEFAULT_RETRYABLE_STATUS_CODES = [408, 425, 429, 500, 502, 503, 504];
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 250,
  maxDelayMs: 4_000,
  retryableStatusCodes: DEFAULT_RETRYABLE_STATUS_CODES,
};

/**
 * Shared HTTP implementation used by resource APIs.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly retryConfig: Required<RetryConfig>;
  private readonly rateLimiter: RateLimiter;
  private readonly respectRetryAfter: boolean;
  private readonly onResponse?: SolFoundryClientConfig["onResponse"];
  private rateLimitState: RateLimitState = {};

  public constructor(
    private readonly authManager: AuthManager,
    config: SolFoundryClientConfig = {},
  ) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    this.defaultHeaders = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...config.headers,
    };
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.retryConfig = {
      maxRetries: config.retry?.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries,
      baseDelayMs: config.retry?.baseDelayMs ?? DEFAULT_RETRY_CONFIG.baseDelayMs,
      maxDelayMs: config.retry?.maxDelayMs ?? DEFAULT_RETRY_CONFIG.maxDelayMs,
      retryableStatusCodes:
        config.retry?.retryableStatusCodes ?? DEFAULT_RETRY_CONFIG.retryableStatusCodes,
    };
    this.rateLimiter = new RateLimiter(config.rateLimit?.minIntervalMs ?? 0);
    this.respectRetryAfter = config.rateLimit?.respectRetryAfter ?? true;
    this.onResponse = config.onResponse;

    if (!this.fetchImpl) {
      throw new SolFoundryError(
        "No fetch implementation available. Provide `fetch` in the client configuration.",
      );
    }
  }

  /**
   * Returns the latest observed rate-limit state.
   */
  public getRateLimitState(): RateLimitState {
    return { ...this.rateLimitState };
  }

  /**
   * Executes a typed API request.
   */
  public async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const responseType = options.responseType ?? "json";
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.retryConfig.maxRetries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? this.timeoutMs);

      try {
        await this.rateLimiter.acquire();

        const headers = {
          ...this.defaultHeaders,
          ...(options.skipAuth ? {} : await this.authManager.getAuthHeaders()),
          ...options.headers,
        };

        const response = await this.fetchImpl(url, {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });
        const rateLimitState = this.parseRateLimitState(response.headers);
        this.rateLimitState = rateLimitState;
        this.onResponse?.(response, this.getRateLimitState());

        if (!response.ok) {
          const failure = await this.buildHttpError(response, rateLimitState);
          if (this.shouldRetryStatus(response.status, attempt)) {
            await this.sleep(this.getRetryDelayMs(attempt, rateLimitState.retryAfterMs));
            attempt += 1;
            continue;
          }

          throw failure;
        }

        if (responseType === "void" || response.status === 204) {
          return undefined as T;
        }

        if (responseType === "text") {
          return (await response.text()) as T;
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error;
        if (!this.shouldRetryError(error, attempt)) {
          if (error instanceof SolFoundryError) {
            throw error;
          }

          throw new SolFoundryError("Request failed", {
            cause: error,
            rateLimit: this.getRateLimitState(),
          });
        }

        await this.sleep(this.getRetryDelayMs(attempt));
        attempt += 1;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new SolFoundryError("Request failed after exhausting retries", {
      cause: lastError,
      rateLimit: this.getRateLimitState(),
    });
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined | null>,
  ): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) {
          continue;
        }

        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  private shouldRetryStatus(status: number, attempt: number): boolean {
    return (
      attempt < this.retryConfig.maxRetries &&
      this.retryConfig.retryableStatusCodes.includes(status)
    );
  }

  private shouldRetryError(error: unknown, attempt: number): boolean {
    if (attempt >= this.retryConfig.maxRetries) {
      return false;
    }

    if (error instanceof SolFoundryError) {
      return error.status !== undefined && this.shouldRetryStatus(error.status, attempt);
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      return true;
    }

    return true;
  }

  private parseRateLimitState(headers: Headers): RateLimitState {
    const limit = this.parseOptionalNumber(headers.get("x-ratelimit-limit"));
    const remaining = this.parseOptionalNumber(headers.get("x-ratelimit-remaining"));
    const reset = this.parseOptionalNumber(headers.get("x-ratelimit-reset"));
    const retryAfterMs = this.parseRetryAfterMs(headers.get("retry-after"));

    return {
      limit,
      remaining,
      resetAt: reset !== undefined ? reset * 1_000 : undefined,
      retryAfterMs,
    };
  }

  private parseOptionalNumber(value: string | null): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private parseRetryAfterMs(value: string | null): number | undefined {
    if (!value) {
      return undefined;
    }

    const seconds = Number(value);
    if (Number.isFinite(seconds)) {
      return seconds * 1_000;
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? undefined : Math.max(timestamp - Date.now(), 0);
  }

  private getRetryDelayMs(attempt: number, retryAfterMs?: number): number {
    if (this.respectRetryAfter && retryAfterMs !== undefined) {
      return retryAfterMs;
    }

    const exponential = this.retryConfig.baseDelayMs * 2 ** attempt;
    const jitter = Math.floor(Math.random() * this.retryConfig.baseDelayMs);
    return Math.min(exponential + jitter, this.retryConfig.maxDelayMs);
  }

  private async buildHttpError(
    response: Response,
    rateLimitState: RateLimitState,
  ): Promise<SolFoundryError> {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as ApiProblem | JsonObject;
      const problem = this.toApiProblem(payload);

      return new SolFoundryError(problem?.message ?? response.statusText, {
        status: response.status,
        problem,
        responseBody: payload,
        rateLimit: rateLimitState,
      });
    }

    const text = await response.text();
    return new SolFoundryError(text || response.statusText, {
      status: response.status,
      responseBody: text,
      rateLimit: rateLimitState,
    });
  }

  private toApiProblem(payload: ApiProblem | JsonObject): ApiProblem | undefined {
    if (typeof payload.message === "string") {
      return {
        code: typeof payload.code === "string" ? payload.code : undefined,
        message: payload.message,
        details: this.isJsonObject(payload.details) ? payload.details : undefined,
      };
    }

    return undefined;
  }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
