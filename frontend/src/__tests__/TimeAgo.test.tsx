import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TimeAgo, formatRelativeTime } from '../components/ui/TimeAgo';

// =============================================================================
// formatRelativeTime — unit tests for the pure formatting logic
// =============================================================================

describe('formatRelativeTime', () => {
  const now = new Date('2025-06-15T12:00:00.000Z');

  it('returns "just now" for 0 seconds ago', () => {
    expect(formatRelativeTime(now, now)).toBe('just now');
  });

  it('returns "just now" for 59 seconds ago', () => {
    const past = new Date(now.getTime() - 59_000);
    expect(formatRelativeTime(past, now)).toBe('just now');
  });

  it('returns "just now" for future dates', () => {
    const future = new Date(now.getTime() + 5_000);
    expect(formatRelativeTime(future, now)).toBe('just now');
  });

  it('returns "1m ago" for exactly 60 seconds ago', () => {
    const past = new Date(now.getTime() - 60_000);
    expect(formatRelativeTime(past, now)).toBe('1m ago');
  });

  it('returns "5m ago" for 5 minutes ago', () => {
    const past = new Date(now.getTime() - 5 * 60_000);
    expect(formatRelativeTime(past, now)).toBe('5m ago');
  });

  it('returns "59m ago" for 59 minutes ago', () => {
    const past = new Date(now.getTime() - 59 * 60_000);
    expect(formatRelativeTime(past, now)).toBe('59m ago');
  });

  it('returns "1h ago" for exactly 1 hour ago', () => {
    const past = new Date(now.getTime() - 60 * 60_000);
    expect(formatRelativeTime(past, now)).toBe('1h ago');
  });

  it('returns "2h ago" for 2 hours ago', () => {
    const past = new Date(now.getTime() - 2 * 60 * 60_000);
    expect(formatRelativeTime(past, now)).toBe('2h ago');
  });

  it('returns "23h ago" for 23 hours ago', () => {
    const past = new Date(now.getTime() - 23 * 60 * 60_000);
    expect(formatRelativeTime(past, now)).toBe('23h ago');
  });

  it('returns "1d ago" for exactly 1 day ago', () => {
    const past = new Date(now.getTime() - 24 * 60 * 60_000);
    expect(formatRelativeTime(past, now)).toBe('1d ago');
  });

  it('returns "3d ago" for 3 days ago', () => {
    const past = new Date(now.getTime() - 3 * 24 * 60 * 60_000);
    expect(formatRelativeTime(past, now)).toBe('3d ago');
  });

  it('returns "6d ago" for 6 days ago', () => {
    const past = new Date(now.getTime() - 6 * 24 * 60 * 60_000);
    expect(formatRelativeTime(past, now)).toBe('6d ago');
  });

  it('returns "Mar 15" for same-year date ≥7 days ago', () => {
    // now is 2025-06-15; 10 days prior is 2025-06-05
    const past = new Date('2025-06-05T08:00:00.000Z');
    expect(formatRelativeTime(past, now)).toBe('Jun 5');
  });

  it('returns "Mar 15" for a date in March of the same year', () => {
    const past = new Date('2025-03-15T10:30:00.000Z');
    expect(formatRelativeTime(past, now)).toBe('Mar 15');
  });

  it('includes the year for dates in a prior year', () => {
    const past = new Date('2024-11-01T00:00:00.000Z');
    expect(formatRelativeTime(past, now)).toBe('Nov 1, 2024');
  });
});

// =============================================================================
// TimeAgo component — render & auto-update tests
// =============================================================================

describe('TimeAgo component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders relative time for a Date object', () => {
    const date = new Date(Date.now() - 5 * 60_000);
    render(<TimeAgo date={date} />);
    expect(screen.getByText('5m ago')).toBeInTheDocument();
  });

  it('renders relative time for an ISO string', () => {
    const iso = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    render(<TimeAgo date={iso} />);
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });

  it('renders relative time for a unix ms timestamp', () => {
    const ts = Date.now() - 3 * 24 * 60 * 60_000;
    render(<TimeAgo date={ts} />);
    expect(screen.getByText('3d ago')).toBeInTheDocument();
  });

  it('renders a <time> element with dateTime attribute', () => {
    const date = new Date('2025-01-10T10:00:00.000Z');
    render(<TimeAgo date={date} />);
    const el = screen.getByRole('time');
    expect(el.tagName).toBe('TIME');
    expect(el).toHaveAttribute('dateTime', date.toISOString());
  });

  it('renders a title tooltip with full datetime text', () => {
    const date = new Date(Date.now() - 10 * 60_000);
    render(<TimeAgo date={date} />);
    const el = screen.getByRole('time');
    expect(el).toHaveAttribute('title');
    expect(el.getAttribute('title')!.length).toBeGreaterThan(0);
  });

  it('applies custom className to the <time> element', () => {
    const date = new Date(Date.now() - 60_000);
    render(<TimeAgo date={date} className="text-gray-500 text-xs" />);
    const el = screen.getByRole('time');
    expect(el).toHaveClass('text-gray-500', 'text-xs');
  });

  it('renders "just now" for very recent dates', () => {
    render(<TimeAgo date={new Date(Date.now() - 5_000)} />);
    expect(screen.getByText('just now')).toBeInTheDocument();
  });

  it('auto-updates after one minute passes', async () => {
    // Start at 55 seconds ago — should read "just now"
    const date = new Date(Date.now() - 55_000);
    render(<TimeAgo date={date} />);
    expect(screen.getByText('just now')).toBeInTheDocument();

    // Advance time by 60 seconds — the interval fires, Date.now() has moved
    // forward 60 s so the date is now 115 s ago → "1m ago"
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText('1m ago')).toBeInTheDocument();
  });
});
