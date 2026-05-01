import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CountdownTimer, getCountdownState } from '../components/bounty/CountdownTimer';

describe('getCountdownState', () => {
  const now = new Date('2026-05-01T12:00:00Z').getTime();

  it('formats days, hours, and minutes remaining', () => {
    const state = getCountdownState('2026-05-03T14:30:00Z', now);

    expect(state.label).toBe('2d 2h 30m');
    expect(state.urgency).toBe('normal');
  });

  it('marks deadlines under 24 hours as warning', () => {
    const state = getCountdownState('2026-05-02T06:00:00Z', now);

    expect(state.label).toBe('18h 0m');
    expect(state.urgency).toBe('warning');
  });

  it('marks deadlines under 1 hour as urgent', () => {
    const state = getCountdownState('2026-05-01T12:45:00Z', now);

    expect(state.label).toBe('45m');
    expect(state.urgency).toBe('urgent');
  });

  it('marks past deadlines as expired', () => {
    const state = getCountdownState('2026-05-01T11:59:00Z', now);

    expect(state.label).toBe('Expired');
    expect(state.urgency).toBe('expired');
  });
});

describe('CountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates without a page refresh', () => {
    render(<CountdownTimer deadline="2026-05-01T12:02:00Z" />);

    expect(screen.getByRole('timer')).toHaveTextContent('2m');

    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    expect(screen.getByRole('timer')).toHaveTextContent('1m');
  });

  it('exposes urgency state for visual indicators', () => {
    render(<CountdownTimer deadline="2026-05-01T12:30:00Z" />);

    expect(screen.getByTestId('bounty-countdown')).toHaveAttribute('data-urgency', 'urgent');
  });
});
