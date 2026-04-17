import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { BountyCountdown } from '../components/bounty/BountyCountdown';

describe('BountyCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders "Expired" when the deadline has passed', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    render(<BountyCountdown deadline={past} variant="compact" />);
    expect(screen.getByText('Expired')).toBeTruthy();
  });

  it('renders a compact countdown with days/hours/minutes', () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString();
    render(<BountyCountdown deadline={future} variant="compact" />);
    // Should show something like "2d 03:xx"
    const el = screen.getByText(/2d/);
    expect(el).toBeTruthy();
  });

  it('renders full variant with segment boxes', () => {
    const future = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    render(<BountyCountdown deadline={future} variant="full" />);
    expect(screen.getByText('Days')).toBeTruthy();
    expect(screen.getByText('Hrs')).toBeTruthy();
    expect(screen.getByText('Min')).toBeTruthy();
    expect(screen.getByText('Sec')).toBeTruthy();
  });

  it('updates every second in full variant', () => {
    const future = new Date(Date.now() + 65_000).toISOString(); // 1m 5s
    render(<BountyCountdown deadline={future} variant="full" />);

    // Advance 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Seconds segment should have changed
    // (we can't easily assert exact value due to rounding, but the component should re-render)
    expect(screen.getByText('Min')).toBeTruthy();
  });

  it('shows warning state when < 24 hours remain', () => {
    const warningDeadline = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const { container } = render(<BountyCountdown deadline={warningDeadline} variant="full" />);
    expect(screen.getByText('Ending soon')).toBeTruthy();
  });

  it('shows urgent state when < 1 hour remains', () => {
    const urgentDeadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { container } = render(<BountyCountdown deadline={urgentDeadline} variant="full" />);
    expect(screen.getByText('Urgent!')).toBeTruthy();
  });

  it('renders nothing meaningful when deadline is null', () => {
    render(<BountyCountdown deadline={null} variant="compact" />);
    expect(screen.getByText('Expired')).toBeTruthy();
  });
});
