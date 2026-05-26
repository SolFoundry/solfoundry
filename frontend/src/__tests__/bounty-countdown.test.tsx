import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BountyCountdown, getCountdownState } from '../components/bounty/BountyCountdown';
import { BountyCard } from '../components/bounty/BountyCard';
import type { Bounty } from '../types/bounty';

const BASE_TIME = new Date('2026-05-26T12:00:00Z').getTime();

const bounty: Bounty = {
  id: 'bounty-826',
  title: 'Countdown timer bounty',
  description: 'Create a countdown timer component.',
  status: 'open',
  tier: 'T1',
  reward_amount: 100000,
  reward_token: 'FNDRY',
  skills: ['TypeScript'],
  submission_count: 3,
  deadline: new Date(BASE_TIME + 26 * 60 * 60 * 1000).toISOString(),
  created_at: new Date(BASE_TIME).toISOString(),
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE_TIME);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getCountdownState', () => {
  it('formats normal, warning, urgent, and expired states', () => {
    expect(getCountdownState(new Date(BASE_TIME + 26 * 60 * 60 * 1000).toISOString(), BASE_TIME)).toMatchObject({
      label: '1d 2h 0m',
      urgency: 'normal',
      isExpired: false,
    });

    expect(getCountdownState(new Date(BASE_TIME + 23 * 60 * 60 * 1000).toISOString(), BASE_TIME)).toMatchObject({
      label: '23h 0m',
      urgency: 'warning',
      isExpired: false,
    });

    expect(getCountdownState(new Date(BASE_TIME + 45 * 60 * 1000).toISOString(), BASE_TIME)).toMatchObject({
      label: '45m',
      urgency: 'urgent',
      isExpired: false,
    });

    expect(getCountdownState(new Date(BASE_TIME - 1000).toISOString(), BASE_TIME)).toMatchObject({
      label: 'Expired',
      urgency: 'expired',
      isExpired: true,
    });
  });
});

describe('BountyCountdown', () => {
  it('updates without a page refresh', () => {
    render(<BountyCountdown deadline={new Date(BASE_TIME + 90 * 1000).toISOString()} />);

    expect(screen.getByText('2m')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(61 * 1000);
    });

    expect(screen.getByText('1m')).toBeInTheDocument();
  });

  it('renders on bounty cards with urgency metadata', () => {
    render(
      <MemoryRouter>
        <BountyCard bounty={{ ...bounty, deadline: new Date(BASE_TIME + 45 * 60 * 1000).toISOString() }} />
      </MemoryRouter>,
    );

    expect(screen.getByText('45m').closest('[data-urgency]')).toHaveAttribute('data-urgency', 'urgent');
  });
});
