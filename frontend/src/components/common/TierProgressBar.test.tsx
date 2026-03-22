import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TierProgressBar } from './TierProgressBar';

describe('TierProgressBar', () => {
  it('shows T1 as current tier for a new user (0/0/0)', () => {
    render(<TierProgressBar completedT1={0} completedT2={0} completedT3={0} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Tier progress: currently T1');
  });

  it('shows T2 as current tier when T1 requirement met (4 T1s)', () => {
    render(<TierProgressBar completedT1={4} completedT2={0} completedT3={0} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Tier progress: currently T2');
  });

  it('shows T3 via path A (3 T2 merges)', () => {
    render(<TierProgressBar completedT1={4} completedT2={3} completedT3={0} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Tier progress: currently T3');
  });

  it('shows T3 via path B (5+ T1s and 1+ T2)', () => {
    render(<TierProgressBar completedT1={5} completedT2={1} completedT3={0} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Tier progress: currently T3');
  });

  it('shows T3 when T3 bounties are completed', () => {
    render(<TierProgressBar completedT1={5} completedT2={3} completedT3={2} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Tier progress: currently T3');
  });

  it('stays at T1 with 3 T1 merges (one short)', () => {
    render(<TierProgressBar completedT1={3} completedT2={0} completedT3={0} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Tier progress: currently T1');
  });

  it('shows correct stat counts', () => {
    render(<TierProgressBar completedT1={2} completedT2={1} completedT3={0} />);
    const statsRow = screen.getByText(/T1 merges:/).parentElement;
    expect(statsRow).toHaveTextContent('T1 merges: 2');
    expect(statsRow).toHaveTextContent('T2 merges: 1');
  });

  it('shows T3 max-tier badge when T3 is unlocked', () => {
    render(<TierProgressBar completedT1={5} completedT2={3} completedT3={1} />);
    expect(screen.getByText(/Max tier/)).toBeInTheDocument();
  });

  it('does not crash with very high values', () => {
    expect(() =>
      render(<TierProgressBar completedT1={100} completedT2={50} completedT3={20} />)
    ).not.toThrow();
  });
});
