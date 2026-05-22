import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { CountdownTimer } from '../components/bounty/CountdownTimer';
import { BountyCard } from '../components/bounty/BountyCard';
import { BountyDetail } from '../components/bounty/BountyDetail';
import { formatTimeRemaining } from '../lib/utils';
import type { Bounty } from '../types/bounty';

const baseBounty: Bounty = {
  id: 'b-1',
  title: 'Countdown timer bounty',
  description: 'Implement a live countdown timer.',
  status: 'open',
  tier: 'T1',
  reward_amount: 3500,
  reward_token: 'USDC',
  skills: ['TypeScript'],
  deadline: new Date('2026-05-23T00:00:00.000Z').toISOString(),
  submission_count: 4,
  created_at: new Date('2026-05-20T12:00:00.000Z').toISOString(),
  org_name: 'SolFoundry',
  repo_name: 'solfoundry',
  github_issue_url: 'https://github.com/SolFoundry/solfoundry/issues/826',
};

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function renderDetail(bounty: Bounty) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <BountyDetail bounty={bounty} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('bounty countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats days, hours, and minutes remaining', () => {
    expect(formatTimeRemaining('2026-05-24T15:04:00.000Z', Date.parse('2026-05-22T12:00:00.000Z'))).toBe('2d 3h 4m');
  });

  it('updates in real time and switches urgency state', () => {
    renderWithRouter(
      <CountdownTimer deadline={new Date('2026-05-22T12:45:00.000Z').toISOString()} />,
    );

    expect(screen.getByTestId('urgent-indicator')).toBeInTheDocument();
    expect(screen.getByText('0h 45m')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    expect(screen.getByText('0h 40m')).toBeInTheDocument();

    act(() => {
      vi.setSystemTime(new Date('2026-05-23T12:01:00.000Z'));
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('expired-indicator')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('renders on bounty cards and detail pages', () => {
    renderWithRouter(<BountyCard bounty={baseBounty} />);
    expect(screen.getByTestId('warning-indicator')).toBeInTheDocument();

    renderDetail(baseBounty);
    expect(screen.getAllByTestId('warning-indicator').length).toBeGreaterThanOrEqual(2);
  });
});
