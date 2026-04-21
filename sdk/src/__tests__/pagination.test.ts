import { describe, it, expect } from 'vitest';
import { hasMore, totalPages, currentPage, nextOffset, prevOffset, generatePageNumbers, fetchAll, pageSizeOptions } from '../pagination.js';
import type { PaginatedResponse } from '../pagination.js';

const r = (o?: Partial<PaginatedResponse<unknown>>) => ({ items: [1, 2, 3], total: 10, skip: 0, limit: 3, ...o });

describe('hasMore', () => { it('true when more', () => expect(hasMore(r())).toBe(true)); it('false when done', () => expect(hasMore(r({ total: 3 }))).toBe(false)); });
describe('totalPages', () => { it('calculates', () => expect(totalPages(r({ total: 10, limit: 3 }))).toBe(4)); it('single page', () => expect(totalPages(r({ total: 5, limit: 20 }))).toBe(1)); });
describe('currentPage', () => { it('page 1', () => expect(currentPage(r({ skip: 0 }))).toBe(1)); it('page 3', () => expect(currentPage(r({ skip: 20, limit: 10 }))).toBe(3)); });
describe('nextOffset', () => { it('skip + length', () => expect(nextOffset(r({ skip: 0, items: [1, 2, 3] }))).toBe(3)); });
describe('prevOffset', () => { it('0 for first', () => expect(prevOffset(r({ skip: 0 }))).toBe(0)); it('prev page', () => expect(prevOffset(r({ skip: 20, limit: 10 }))).toBe(10)); });
describe('generatePageNumbers', () => { it('small total', () => expect(generatePageNumbers(2, 5)).toEqual([1, 2, 3, 4, 5])); it('includes ellipsis', () => expect(generatePageNumbers(10, 20)).toContain('...')); });
describe('pageSizeOptions', () => { it('defaults', () => expect(pageSizeOptions()).toHaveLength(4)); });
describe('fetchAll', () => { it('fetches all', async () => { const fn = async (s: number) => ({ items: s === 0 ? [1, 2] : [3], total: 3, skip: s, limit: 2 }); expect(await fetchAll(fn, 2)).toEqual([1, 2, 3]); }); });
