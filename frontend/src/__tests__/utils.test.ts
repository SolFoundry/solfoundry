import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatCurrency, formatCompactNumber, timeAgo } from '../lib/utils';

describe('formatCompactNumber', () => {
  it('returns short form for thousands', () => {
    expect(formatCompactNumber(1_000)).toBe('1K');
    expect(formatCompactNumber(2_500)).toBe('2.5K');
  });
  it('returns short form for millions', () => {
    expect(formatCompactNumber(1_000_000)).toBe('1M');
    expect(formatCompactNumber(1_200_000)).toBe('1.2M');
  });
  it('returns plain number under 1000', () => {
    expect(formatCompactNumber(123)).toBe('123');
  });
});

describe('formatCurrency', () => {
  it('formats USDC as dollars', () => {
    expect(formatCurrency(250, 'USDC')).toBe('$250');
  });
  it('formats FNDRY with compact suffix', () => {
    expect(formatCurrency(100_000, 'FNDRY')).toBe('100K FNDRY');
  });
});

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('returns "just now" for very recent timestamps', () => {
    expect(timeAgo('2026-05-12T11:59:30.000Z')).toBe('just now');
  });
  it('returns minutes for the last hour', () => {
    expect(timeAgo('2026-05-12T11:45:00.000Z')).toBe('15m ago');
  });
  it('returns empty string for null/invalid', () => {
    expect(timeAgo(null)).toBe('');
    expect(timeAgo('not-a-date')).toBe('');
  });
});
