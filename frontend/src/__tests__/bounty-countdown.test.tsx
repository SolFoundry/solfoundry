import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { BountyCountdown, getCountdownParts } from '../components/bounty/BountyCountdown';

describe('BountyCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-13T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders days, hours, and minutes for active bounties', () => {
    render(<BountyCountdown deadline="2026-06-15T14:30:00.000Z" />);

    expect(screen.getByLabelText('Bounty deadline countdown: 2d 2h 30m')).toBeInTheDocument();
  });

  it('marks deadlines under 24 hours as warning', () => {
    const parts = getCountdownParts('2026-06-14T11:59:00.000Z', Date.now());

    expect(parts?.urgency).toBe('warning');
  });

  it('marks deadlines under 1 hour as urgent', () => {
    const parts = getCountdownParts('2026-06-13T12:30:00.000Z', Date.now());

    expect(parts?.urgency).toBe('urgent');
  });

  it('shows one minute for active deadlines under one minute', () => {
    render(<BountyCountdown deadline="2026-06-13T12:00:30.000Z" />);

    expect(screen.getByLabelText('Bounty deadline countdown: 1m')).toBeInTheDocument();
  });

  it('shows one minute at the exact 60 second boundary', () => {
    render(<BountyCountdown deadline="2026-06-13T12:01:00.000Z" />);

    expect(screen.getByLabelText('Bounty deadline countdown: 1m')).toBeInTheDocument();
  });

  it('shows expired after the deadline passes', () => {
    render(<BountyCountdown deadline="2026-06-13T11:59:00.000Z" />);

    expect(screen.getByLabelText('Bounty deadline countdown: Expired')).toBeInTheDocument();
  });
});
