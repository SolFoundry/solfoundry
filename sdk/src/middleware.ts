/**
 * HTTP middleware pipeline for the SolFoundry SDK.
 */
import type { RequestOptions, ApiErrorResponse } from './types.js';

export interface MiddlewareContext {
  readonly request: RequestOptions;
  response?: unknown;
  error?: Error;
  retryCount: number;
  startTime: number;
  metadata: Record<string, unknown>;
}

export type Middleware = (ctx: MiddlewareContext, next: () => Promise<void>) => Promise<void>;
export type LogFn = (level: 'debug' | 'info' | 'warn' | 'error', message: string, ctx?: MiddlewareContext) => void;

export function loggingMiddleware(log?: LogFn): Middleware {
  const logger = log ?? ((_l, m) => console[_l](m));
  return async (ctx, next) => {
    logger('info', `→ ${ctx.request.method} ${ctx.request.path}`, ctx);
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.error ? logger('error', `← ${ctx.request.method} ${ctx.request.path} ${ms}ms ERROR`, ctx) : logger('info', `← ${ctx.request.method} ${ctx.request.path} ${ms}ms OK`, ctx);
  };
}

export function authMiddleware(tokenProvider: () => string | Promise<string | undefined>): Middleware {
  return async (ctx, next) => {
    if (ctx.request.requiresAuth !== false) { const token = await tokenProvider(); if (token) ctx.metadata['authToken'] = token; }
    await next();
  };
}

export function cacheMiddleware(ttlMs: number = 30_000): Middleware {
  const cache = new Map<string, { data: unknown; expiresAt: number }>();
  return async (ctx, next) => {
    if (ctx.request.method !== 'GET') { await next(); return; }
    const key = `${ctx.request.method}:${ctx.request.path}:${JSON.stringify(ctx.request.params ?? {})}`;
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expiresAt) { ctx.response = cached.data; return; }
    await next();
    if (ctx.response && !ctx.error) cache.set(key, { data: ctx.response, expiresAt: Date.now() + ttlMs });
  };
}

export function errorNormalizerMiddleware(): Middleware {
  return async (ctx, next) => {
    await next();
    if (ctx.error) {
      const msg = ctx.error instanceof Error ? ctx.error.message : String(ctx.error);
      const api = ctx.metadata['apiResponse'] as ApiErrorResponse | undefined;
      if (api?.detail) ctx.error = new Error(`${msg}: ${api.detail}`);
    }
  };
}

export function compose(middlewares: Middleware[]): Middleware {
  return async (ctx, next) => {
    let index = -1;
    const dispatch = async (i: number) => {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      i < middlewares.length ? await middlewares[i](ctx, () => dispatch(i + 1)) : await next();
    };
    await dispatch(0);
  };
}
