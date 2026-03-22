/**
 * @jest-environment jsdom
 */
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeAgo, formatTimeAgo } from './TimeAgo';

describe('formatTimeAgo', () => {
  const now = new Date('2026-03-22T12:00:00Z');

  it('returns "just now" for timestamps less than 30 seconds ago', () => {
    const date = new Date('2026-03-22T11:59:45Z'); // 15 seconds ago
    expect(formatTimeAgo(date, now)).toBe('just now');
  });

  it('returns "just now" for future timestamps', () => {
    const date = new Date('2026-03-22T12:05:00Z'); // 5 minutes in the future
    expect(formatTimeAgo(date, now)).toBe('just now');
  });

  it('returns minutes for timestamps 1-59 minutes ago', () => {
    const date1 = new Date('2026-03-22T11:55:00Z'); // 5 minutes ago
    expect(formatTimeAgo(date1, now)).toBe('5m ago');

    const date2 = new Date('2026-03-22T11:01:00Z'); // 59 minutes ago
    expect(formatTimeAgo(date2, now)).toBe('59m ago');
  });

  it('returns hours for timestamps 1-23 hours ago', () => {
    const date1 = new Date('2026-03-22T10:00:00Z'); // 2 hours ago
    expect(formatTimeAgo(date1, now)).toBe('2h ago');

    const date2 = new Date('2026-03-21T13:00:00Z'); // 23 hours ago
    expect(formatTimeAgo(date2, now)).toBe('23h ago');
  });

  it('returns days for timestamps 1-6 days ago', () => {
    const date1 = new Date('2026-03-21T12:00:00Z'); // 1 day ago
    expect(formatTimeAgo(date1, now)).toBe('1d ago');

    const date2 = new Date('2026-03-16T12:00:00Z'); // 6 days ago
    expect(formatTimeAgo(date2, now)).toBe('6d ago');
  });

  it('returns abbreviated date for timestamps 7+ days ago', () => {
    const date = new Date('2026-03-15T12:00:00Z'); // 7 days ago
    expect(formatTimeAgo(date, now)).toBe('Mar 15');
  });

  it('returns abbreviated date for timestamps months ago', () => {
    const date = new Date('2026-01-10T12:00:00Z');
    expect(formatTimeAgo(date, now)).toBe('Jan 10');
  });
});

describe('TimeAgo component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders relative time from ISO string', () => {
    const fiveMinutesAgo = new Date('2026-03-22T11:55:00Z').toISOString();
    render(<TimeAgo date={fiveMinutesAgo} live={false} />);
    expect(screen.getByText('5m ago')).toBeTruthy();
  });

  it('renders relative time from Date object', () => {
    const twoHoursAgo = new Date('2026-03-22T10:00:00Z');
    render(<TimeAgo date={twoHoursAgo} live={false} />);
    expect(screen.getByText('2h ago')).toBeTruthy();
  });

  it('renders "just now" for very recent timestamps', () => {
    const tenSecondsAgo = new Date('2026-03-22T11:59:50Z').toISOString();
    render(<TimeAgo date={tenSecondsAgo} live={false} />);
    expect(screen.getByText('just now')).toBeTruthy();
  });

  it('uses <time> element with correct datetime attribute', () => {
    const date = '2026-03-22T11:55:00.000Z';
    render(<TimeAgo date={date} live={false} />);
    const timeEl = screen.getByText('5m ago');
    expect(timeEl.tagName).toBe('TIME');
    expect(timeEl.getAttribute('datetime')).toContain('2026-03-22');
  });

  it('has a title attribute with full datetime', () => {
    const date = '2026-03-22T11:55:00.000Z';
    render(<TimeAgo date={date} live={false} />);
    const timeEl = screen.getByText('5m ago');
    expect(timeEl.getAttribute('title')).toBeTruthy();
    // Title should contain the full date
    expect(timeEl.getAttribute('title')).toContain('2026');
  });

  it('applies custom className', () => {
    render(<TimeAgo date={new Date().toISOString()} className="custom-time" live={false} />);
    const timeEl = screen.getByText('just now');
    expect(timeEl.className).toContain('custom-time');
  });

  it('auto-updates when live=true for recent timestamps', () => {
    const fiveMinutesAgo = new Date('2026-03-22T11:55:00Z').toISOString();
    render(<TimeAgo date={fiveMinutesAgo} live={true} updateInterval={60000} />);
    expect(screen.getByText('5m ago')).toBeTruthy();

    // Advance time by 1 minute
    act(() => {
      vi.setSystemTime(new Date('2026-03-22T12:01:00Z'));
      vi.advanceTimersByTime(60000);
    });

    expect(screen.getByText('6m ago')).toBeTruthy();
  });

  it('renders abbreviated date for old timestamps', () => {
    const oldDate = new Date('2026-03-01T12:00:00Z').toISOString();
    render(<TimeAgo date={oldDate} live={false} />);
    expect(screen.getByText('Mar 1')).toBeTruthy();
  });

  it('handles timezone correctly with ISO strings', () => {
    // UTC timestamp
    const utcDate = '2026-03-22T11:00:00Z';
    render(<TimeAgo date={utcDate} live={false} />);
    // 1 hour ago
    expect(screen.getByText('1h ago')).toBeTruthy();
  });

  it('wraps content in a Tooltip for hover display', () => {
    render(<TimeAgo date="2026-03-22T11:55:00.000Z" live={false} />);
    // The Tooltip renders a role="tooltip" element
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });
});
