/** Centralized API client with auth, env-based URL, retry, and cache. @module services/apiClient */
export interface ApiError { status: number; message: string; code: string; }
const BASE: string = (import.meta.env?.VITE_API_URL as string) || '';
let token: string | null = null;
/** Store/clear JWT for API calls. */
export function setAuthToken(t: string | null): void { token = t; }
/** Return current auth token. */
export function getAuthToken(): string | null { return token; }
const cache = new Map<string, { d: unknown; e: number }>();
/** Clear response cache. */
export function clearApiCache(): void { cache.clear(); }
/** Type-guard for ApiError. */
export function isApiError(e: unknown): e is ApiError { return typeof e === 'object' && e !== null && 'status' in e && 'message' in e; }
/** Typed fetch with auth headers, retry (exponential backoff), and TTL cache. */
export async function apiClient<T>(ep: string, o: RequestInit & { params?: Record<string, string | number | boolean | undefined>; retries?: number; cacheTtl?: number; body?: unknown } = {}): Promise<T> {
  const { params, retries = 2, cacheTtl = 0, body, headers: hx, ...r } = o;
  let url = `${BASE}${ep}`;
  if (params) { const s = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') s.set(k, String(v)); const q = s.toString(); if (q) url += `?${q}`; }
  const m = (r.method ?? (body ? 'POST' : 'GET')).toUpperCase();
  if (m === 'GET' && cacheTtl > 0) { const c = cache.get(url); if (c && c.e > Date.now()) return c.d as T; }
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...(hx as Record<string, string>) };
  if (token) h['Authorization'] = `Bearer ${token}`;
  let last: ApiError = { status: 0, message: 'Request failed', code: 'UNKNOWN' };
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { ...r, method: m, headers: h, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) { let b: Record<string, string> = {}; try { b = await res.json(); } catch { /* */ } const err: ApiError = { status: res.status, message: b.message ?? b.detail ?? res.statusText, code: b.code ?? `HTTP_${res.status}` }; if (res.status < 500 && res.status !== 429) throw err; last = err; }
      else { const d = (await res.json()) as T; if (m === 'GET' && cacheTtl > 0) cache.set(url, { d, e: Date.now() + cacheTtl }); return d; }
    } catch (e: unknown) { if (isApiError(e) && e.status > 0 && e.status < 500 && e.status !== 429) throw e; last = isApiError(e) ? e : { status: 0, message: e instanceof Error ? e.message : 'Network error', code: 'NETWORK_ERROR' }; }
    if (i < retries) await new Promise(w => setTimeout(w, 300 * 2 ** i));
  }
  throw last;
}
