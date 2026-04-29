/**
 * CountdownTimer test suite.
 *
 * Tests the CountdownTimer component and useCountdown hook for:
 * - Correct time breakdown (days, hours, minutes, seconds)
 * - Urgency level transitions (normal → warning → urgent → expired)
 * - Expired state display
 * - Compact and normal rendering modes
 * - Real-time updates via setInterval
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import React from 'react';
import { CountdownTimer } from '../components/CountdownTimer';
import { useCountdown } from '../hooks/useCountdown';
import { renderHook } from '@testing-library/react';

// Mock Date.now for consistent test results
const FIXED_NOW = new Date('2026-04-28T12:00:00Z').getTime();
const originalDateNow = Date.now;

beforeEach(() => {
  vi.useFakeTimers();
  Date.now = vi.fn(() => FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
  Date.now = originalDateNow;
});

// ──────────────────────────────────────────────
// useCountdown hook tests
// ──────────────────────────────────────────────

describe('useCountdown', () => {
  it('returns correct breakdown for a future deadline', () => {
    // 3 days, 5 hours, 30 minutes from FIXED_NOW
    const deadline = new Date(FIXED_NOW + 3 * 86400000 + 5 * 3600000 + 30 * 60000).toISOString();

    const { result } = renderHook(() => useCountdown(deadline));

    expect(result.current.days).toBe(3);
    expect(result.current.hours).toBe(5);
    expect(result.current.minutes).toBe(30);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.urgency).toBe('normal');
  });

  it('returns warning urgency when less than 24 hours remain', () => {
    // 12 hours from FIXED_NOW
    const deadline = new Date(FIXED_NOW + 12 * 3600000).toISOString();

    const { result } = renderHook(() => useCountdown(deadline));

    expect(result.current.urgency).toBe('warning');
    expect(result.current.days).toBe(0);
    expect(result.current.hours).toBe(12);
    expect(result.current.isExpired).toBe(false);
  });

  it('returns urgent urgency when less than 1 hour remains', () => {
    // 30 minutes from FIXED_NOW
    const deadline = new Date(FIXED_NOW + 30 * 60000).toISOString();

    const { result } = renderHook(() => useCountdown(deadline));

    expect(result.current.urgency).toBe('urgent');
    expect(result.current.hours).toBe(0);
    expect(result.current.minutes).toBe(30);
  });

  it('returns expired state when deadline has passed', () => {
    // 1 hour ago
    const deadline = new Date(FIXED_NOW - 3600000).toISOString();

    const { result } = renderHook(() => useCountdown(deadline));

    expect(result.current.isExpired).toBe(true);
    expect(result.current.urgency).toBe('expired');
    expect(result.current.totalSeconds).toBe(0);
  });

  it('returns expired state when deadline is null', () => {
    const { result } = renderHook(() => useCountdown(null));

    expect(result.current.isExpired).toBe(true);
    expect(result.current.urgency).toBe('expired');
  });

  it('returns expired state when deadline is undefined', () => {
    const { result } = renderHook(() => useCountdown(undefined));

    expect(result.current.isExpired).toBe(true);
  });

  it('updates every second via interval', () => {
    // 1 minute from FIXED_NOW
    const deadline = new Date(FIXED_NOW + 60000).toISOString();

    const { result } = renderHook(() => useCountdown(deadline));

    expect(result.current.minutes).toBe(1);

    // Advance timer by 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(result.current.minutes).toBe(0);
    expect(result.current.seconds).toBe(30);
  });

  it('stops updating after expiration', () => {
    // 2 seconds from FIXED_NOW
    const deadline = new Date(FIXED_NOW + 2000).toISOString();

    const { result } = renderHook(() => useCountdown(deadline));

    expect(result.current.isExpired).toBe(false);

    // Advance past expiration
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.isExpired).toBe(true);

    // Advance further — should stay expired
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(result.current.isExpired).toBe(true);
  });

  it('recalculates when deadline changes', () => {
    const deadline1 = new Date(FIXED_NOW + 86400000).toISOString(); // 1 day
    const { result, rerender } = renderHook(
      ({ dl }) => useCountdown(dl),
      { initialProps: { dl: deadline1 } },
    );

    expect(result.current.days).toBe(1);

    // Change to 2 days
    const deadline2 = new Date(FIXED_NOW + 2 * 86400000).toISOString();
    rerender({ dl: deadline2 });

    expect(result.current.days).toBe(2);
  });
});

// ──────────────────────────────────────────────
// CountdownTimer component tests
// ──────────────────────────────────────────────

describe('CountdownTimer', () => {
  it('renders expired state when deadline has passed', () => {
    const deadline = new Date(FIXED_NOW - 3600000).toISOString();

    render(<CountdownTimer deadline={deadline} />);

    expect(screen.getByTestId('countdown-expired')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('renders expired state when deadline is null', () => {
    render(<CountdownTimer deadline={null} />);

    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('renders countdown with time units in normal mode', () => {
    // 1 day, 2 hours, 30 minutes
    const deadline = new Date(
      FIXED_NOW + 86400000 + 2 * 3600000 + 30 * 60000,
    ).toISOString();

    render(<CountdownTimer deadline={deadline} />);

    const timer = screen.getByTestId('countdown-timer');
    expect(timer).toBeInTheDocument();
    // Check formatted output contains expected values
    expect(timer.textContent).toContain('01d');
    expect(timer.textContent).toContain('02h');
    expect(timer.textContent).toContain('30m');
  });

  it('renders compact mode correctly', () => {
    // 5 hours, 15 minutes
    const deadline = new Date(
      FIXED_NOW + 5 * 3600000 + 15 * 60000,
    ).toISOString();

    render(<CountdownTimer deadline={deadline} compact />);

    const timer = screen.getByTestId('countdown-timer');
    expect(timer.textContent).toContain('5h');
    expect(timer.textContent).toContain('15m');
  });

  it('applies warning color class when urgency is warning', () => {
    // 12 hours remaining
    const deadline = new Date(FIXED_NOW + 12 * 3600000).toISOString();

    const { container } = render(<CountdownTimer deadline={deadline} />);

    const timer = container.querySelector('[data-testid="countdown-timer"]');
    expect(timer).toHaveClass('text-status-warning');
  });

  it('applies urgent color class when urgency is urgent', () => {
    // 30 minutes remaining
    const deadline = new Date(FIXED_NOW + 30 * 60000).toISOString();

    const { container } = render(<CountdownTimer deadline={deadline} />);

    const timer = container.querySelector('[data-testid="countdown-timer"]');
    expect(timer).toHaveClass('text-status-error');
  });

  it('shows clock icon by default', () => {
    const deadline = new Date(FIXED_NOW + 86400000).toISOString();

    const { container } = render(<CountdownTimer deadline={deadline} />);

    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('hides clock icon when showIcon is false', () => {
    const deadline = new Date(FIXED_NOW + 86400000).toISOString();

    const { container } = render(
      <CountdownTimer deadline={deadline} showIcon={false} />,
    );

    const icon = container.querySelector('svg');
    expect(icon).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const deadline = new Date(FIXED_NOW + 86400000).toISOString();

    const { container } = render(
      <CountdownTimer deadline={deadline} className="my-custom-class" />,
    );

    const timer = container.querySelector('[data-testid="countdown-timer"]');
    expect(timer).toHaveClass('my-custom-class');
  });

  it('updates display as time passes', () => {
    // 1 minute 30 seconds remaining
    const deadline = new Date(FIXED_NOW + 90000).toISOString();

    const { container } = render(<CountdownTimer deadline={deadline} />);

    let timer = container.querySelector('[data-testid="countdown-timer"]');
    expect(timer?.textContent).toContain('01m');

    // Advance 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    timer = container.querySelector('[data-testid="countdown-timer"]');
    expect(timer?.textContent).toContain('00m');
    expect(timer?.textContent).toContain('60'); // 90 - 30 = 60 seconds total, but displayed as minutes
  });

  it('shows aria-label with human-readable time', () => {
    // 1 day, 2 hours, 30 minutes
    const deadline = new Date(
      FIXED_NOW + 86400000 + 2 * 3600000 + 30 * 60000,
    ).toISOString();

    render(<CountdownTimer deadline={deadline} />);

    const timer = screen.getByTestId('countdown-timer');
    expect(timer).toHaveAttribute(
      'aria-label',
      '1 days, 2 hours, 30 minutes remaining',
    );
  });
});
