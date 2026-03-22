/**
 * TimeAgo component tests
 * @module components/common/__tests__/TimeAgo.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimeAgo, formatTimeAgo, formatFullDate } from '../TimeAgo';

describe('formatTimeAgo', () => {
  beforeEach(() => {
    // Mock current time to 2026-03-22 12:00:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for very recent dates', () => {
    expect(formatTimeAgo(new Date('2026-03-22T11:59:55Z'))).toBe('just now');
    expect(formatTimeAgo(new Date('2026-03-22T11:59:50Z'))).toBe('just now');
  });

  it('returns seconds for recent dates under a minute', () => {
    expect(formatTimeAgo(new Date('2026-03-22T11:59:30Z'))).toBe('30s ago');
    expect(formatTimeAgo(new Date('2026-03-22T11:59:01Z'))).toBe('59s ago');
  });

  it('returns minutes for dates under an hour', () => {
    expect(formatTimeAgo(new Date('2026-03-22T11:59:00Z'))).toBe('1m ago');
    expect(formatTimeAgo(new Date('2026-03-22T11:55:00Z'))).toBe('5m ago');
    expect(formatTimeAgo(new Date('2026-03-22T11:00:00Z'))).toBe('60m ago');
  });

  it('returns hours for dates under a day', () => {
    expect(formatTimeAgo(new Date('2026-03-22T11:00:00Z'))).toBe('1h ago');
    expect(formatTimeAgo(new Date('2026-03-22T06:00:00Z'))).toBe('6h ago');
    expect(formatTimeAgo(new Date('2026-03-22T00:00:00Z'))).toBe('12h ago');
  });

  it('returns days for dates under 7 days', () => {
    expect(formatTimeAgo(new Date('2026-03-21T12:00:00Z'))).toBe('1d ago');
    expect(formatTimeAgo(new Date('2026-03-20T12:00:00Z'))).toBe('2d ago');
    expect(formatTimeAgo(new Date('2026-03-15T12:00:00Z'))).toBe('7d ago');
  });

  it('returns date string for dates over 7 days', () => {
    expect(formatTimeAgo(new Date('2026-03-14T12:00:00Z'))).toBe('Mar 14');
    expect(formatTimeAgo(new Date('2026-02-22T12:00:00Z'))).toBe('Feb 22');
    expect(formatTimeAgo(new Date('2025-12-25T12:00:00Z'))).toBe('Dec 25');
  });

  it('handles future dates', () => {
    expect(formatTimeAgo(new Date('2026-03-22T12:00:05Z'))).toBe('just now');
    expect(formatTimeAgo(new Date('2026-03-22T12:05:00Z'))).toBe('in 5m');
    expect(formatTimeAgo(new Date('2026-03-22T14:00:00Z'))).toBe('in 2h');
    expect(formatTimeAgo(new Date('2026-03-25T12:00:00Z'))).toBe('in 3d');
  });
});

describe('formatFullDate', () => {
  it('formats date with timezone', () => {
    const result = formatFullDate('2026-03-22T12:00:00Z');
    expect(result).toContain('Mar');
    expect(result).toContain('22');
    expect(result).toContain('2026');
    expect(result).toContain(':'); // time separator
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

  it('renders relative time', () => {
    render(<TimeAgo date="2026-03-22T11:30:00Z" />);
    expect(screen.getByText('30m ago')).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    render(<TimeAgo date="2026-03-22T11:30:00Z" className="text-gray-500" />);
    const time = screen.getByText('30m ago');
    expect(time).toHaveClass('text-gray-500');
    expect(time).toHaveClass('cursor-help');
  });

  it('has datetime attribute', () => {
    render(<TimeAgo date="2026-03-22T11:30:00Z" />);
    const time = screen.getByText('30m ago');
    expect(time).toHaveAttribute('datetime', '2026-03-22T11:30:00.000Z');
  });

  it('has title tooltip with full date', () => {
    render(<TimeAgo date="2026-03-22T11:30:00Z" />);
    const time = screen.getByText('30m ago');
    expect(time).toHaveAttribute('title');
    expect(time.getAttribute('title')).toContain('Mar');
    expect(time.getAttribute('title')).toContain('2026');
  });

  it('auto-updates on interval for recent dates', () => {
    render(<TimeAgo date="2026-03-22T11:55:00Z" updateInterval={60000} />);
    expect(screen.getByText('5m ago')).toBeInTheDocument();

    // Advance time by 1 minute
    vi.advanceTimersByTime(60000);
    expect(screen.getByText('6m ago')).toBeInTheDocument();
  });

  it('accepts Date object', () => {
    render(<TimeAgo date={new Date('2026-03-22T10:00:00Z')} />);
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });

  it('accepts timestamp number', () => {
    render(<TimeAgo date={new Date('2026-03-22T10:00:00Z').getTime()} />);
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });
});
