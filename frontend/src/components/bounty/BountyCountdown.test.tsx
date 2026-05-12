import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { render, screen } from '@testing-library/react';
import { BountyCountdown, getBountyTimeRemaining } from './BountyCountdown';

describe('getBountyTimeRemaining', () => {
  const now = new Date('2026-05-12T12:00:00Z').getTime();

  it('formats days and hours for future deadlines', () => {
    const result = getBountyTimeRemaining('2026-05-14T15:30:00Z', now);
    expect(result.label).toBe('2d 3h left');
    expect(result.urgency).toBe('normal');
  });

  it('marks deadlines under 24 hours as warning', () => {
    const result = getBountyTimeRemaining('2026-05-13T06:30:00Z', now);
    expect(result.label).toBe('18h 30m left');
    expect(result.urgency).toBe('warning');
  });

  it('marks deadlines under one hour as urgent', () => {
    const result = getBountyTimeRemaining('2026-05-12T12:30:00Z', now);
    expect(result.label).toBe('30m left');
    expect(result.urgency).toBe('urgent');
  });

  it('shows expired for past or invalid deadlines', () => {
    expect(getBountyTimeRemaining('2026-05-12T11:59:00Z', now).label).toBe('Expired');
    expect(getBountyTimeRemaining('not-a-date', now).urgency).toBe('expired');
  });
});

describe('BountyCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the countdown and urgency data attribute', () => {
    render(<BountyCountdown deadline="2026-05-12T12:45:00Z" />);
    const countdown = screen.getByTestId('bounty-countdown');

    expect(countdown).toHaveTextContent('45m left');
    expect(countdown).toHaveAttribute('data-urgency', 'urgent');
  });

  it('updates without a page refresh', () => {
    render(<BountyCountdown deadline="2026-05-12T13:30:00Z" />);
    expect(screen.getByTestId('bounty-countdown')).toHaveTextContent('1h 30m left');

    act(() => {
      vi.advanceTimersByTime(31 * 60 * 1000);
    });
    expect(screen.getByTestId('bounty-countdown')).toHaveTextContent('59m left');
  });

  it('renders nothing when no deadline is provided', () => {
    render(<BountyCountdown deadline={null} />);
    expect(screen.queryByTestId('bounty-countdown')).not.toBeInTheDocument();
  });
});
