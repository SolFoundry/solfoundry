import { describe, it, expect, vi } from 'vitest';
import { compose, loggingMiddleware, authMiddleware, cacheMiddleware, errorNormalizerMiddleware } from '../middleware.js';
import type { MiddlewareContext } from '../middleware.js';

function mockCtx(overrides?: Partial<MiddlewareContext>): MiddlewareContext {
  return { request: { path: '/api/test', method: 'GET' }, retryCount: 0, startTime: Date.now(), metadata: {}, ...overrides };
}

describe('compose', () => {
  it('executes middleware in order', async () => {
    const order: number[] = [];
    const pipeline = compose([async (_c, n) => { order.push(1); await n(); order.push(4); }, async (_c, n) => { order.push(2); await n(); order.push(3); }]);
    await pipeline(mockCtx(), async () => {});
    expect(order).toEqual([1, 2, 3, 4]);
  });
  it('works with empty pipeline', async () => { const ctx = mockCtx(); await compose([])(ctx, async () => { ctx.response = 'ok'; }); expect(ctx.response).toBe('ok'); });
});

describe('authMiddleware', () => {
  it('sets token from provider', async () => { const ctx = mockCtx(); await authMiddleware(() => 'tok')(ctx, async () => {}); expect(ctx.metadata['authToken']).toBe('tok'); });
  it('skips when requiresAuth=false', async () => { const ctx = mockCtx({ request: { path: '/api/p', method: 'GET', requiresAuth: false } }); await authMiddleware(() => 'tok')(ctx, async () => {}); expect(ctx.metadata['authToken']).toBeUndefined(); });
});

describe('cacheMiddleware', () => {
  it('caches GET responses', async () => {
    const mw = cacheMiddleware(5000); let calls = 0;
    const ctx1 = mockCtx(); await mw(ctx1, async () => { calls++; ctx1.response = 'd1'; });
    const ctx2 = mockCtx(); await mw(ctx2, async () => { calls++; ctx2.response = 'd2'; });
    expect(calls).toBe(1); expect(ctx2.response).toBe('d1');
  });
  it('does not cache POST', async () => {
    const mw = cacheMiddleware(5000); let calls = 0;
    const ctx1 = mockCtx({ request: { path: '/api/t', method: 'POST' } }); await mw(ctx1, async () => { calls++; });
    const ctx2 = mockCtx({ request: { path: '/api/t', method: 'POST' } }); await mw(ctx2, async () => { calls++; });
    expect(calls).toBe(2);
  });
});

describe('errorNormalizerMiddleware', () => {
  it('adds API detail to error', async () => { const ctx = mockCtx({ error: new Error('fail'), metadata: { apiResponse: { detail: 'not found' } } }); await errorNormalizerMiddleware()(ctx, async () => {}); expect((ctx.error as Error).message).toContain('not found'); });
  it('passes through clean responses', async () => { const ctx = mockCtx({ response: 'ok' }); await errorNormalizerMiddleware()(ctx, async () => {}); expect(ctx.response).toBe('ok'); });
});
