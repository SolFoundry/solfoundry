/**
 * Pagination utilities for the SolFoundry SDK.
 */
export interface PaginatedResponse<T> { items: T[]; total: number; skip: number; limit: number; }

export function hasMore(r: PaginatedResponse<unknown>): boolean { return r.skip + r.items.length < r.total; }
export function totalPages(r: PaginatedResponse<unknown>): number { return Math.ceil(r.total / r.limit); }
export function currentPage(r: PaginatedResponse<unknown>): number { return Math.floor(r.skip / r.limit) + 1; }
export function nextOffset(r: PaginatedResponse<unknown>): number { return r.skip + r.items.length; }
export function prevOffset(r: PaginatedResponse<unknown>): number { return Math.max(0, r.skip - r.limit); }

export function pageSizeOptions(sizes: number[] = [10, 20, 50, 100]): { value: number; label: string }[] {
  return sizes.map(s => ({ value: s, label: `${s} per page` }));
}

export function generatePageNumbers(current: number, total: number, neighbors = 1): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  const s = Math.max(2, current - neighbors), e = Math.min(total - 1, current + neighbors);
  if (s > 2) pages.push('...');
  for (let i = s; i <= e; i++) pages.push(i);
  if (e < total - 1) pages.push('...');
  pages.push(total);
  return pages;
}

export async function fetchAll<T>(fn: (skip: number, limit: number) => Promise<PaginatedResponse<T>>, limit = 100, maxPages = 100): Promise<T[]> {
  const all: T[] = []; let skip = 0, pages = 0;
  while (pages < maxPages) { const r = await fn(skip, limit); all.push(...r.items); if (!hasMore(r)) break; skip = nextOffset(r); pages++; }
  return all;
}
