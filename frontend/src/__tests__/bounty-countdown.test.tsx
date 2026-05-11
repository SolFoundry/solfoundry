import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BountyCountdown } from '../components/bounty/BountyCountdown';

const now = new Date('2026-05-11T12:00:00Z');

describe('BountyCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows days, hours, and minutes remaining', () => {
    render(<BountyCountdown deadline="2026-05-13T14:30:00Z" />);

    expect(screen.getByTestId('bounty-countdown')).toHaveTextContent('2d 2h 30m');
    expect(screen.getByTestId('bounty-countdown')).toHaveAttribute('data-urgency', 'normal');
  });

  it('uses warning urgency when less than 24 hours remain', () => {
    render(<BountyCountdown deadline="2026-05-12T10:00:00Z" />);

    expect(screen.getByTestId('bounty-countdown')).toHaveTextContent('22h 0m');
    expect(screen.getByTestId('bounty-countdown')).toHaveAttribute('data-urgency', 'warning');
  });

  it('uses urgent urgency when less than 1 hour remains', () => {
    render(<BountyCountdown deadline="2026-05-11T12:45:00Z" />);

    expect(screen.getByTestId('bounty-countdown')).toHaveTextContent('45m');
    expect(screen.getByTestId('bounty-countdown')).toHaveAttribute('data-urgency', 'urgent');
  });

  it('shows expired when the deadline has passed', () => {
    render(<BountyCountdown deadline="2026-05-11T11:59:00Z" />);

    expect(screen.getByTestId('bounty-countdown')).toHaveTextContent('Expired');
    expect(screen.getByTestId('bounty-countdown')).toHaveAttribute('data-urgency', 'expired');
  });
});
