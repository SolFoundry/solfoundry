import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BountyCountdownTimer } from './BountyCountdownTimer';

describe('BountyCountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders expired state when deadline has passed', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    render(<BountyCountdownTimer deadline={pastDate} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('renders countdown with days remaining', () => {
    const futureDate = new Date(Date.now() + 3 * 86400000).toISOString();
    render(<BountyCountdownTimer deadline={futureDate} />);
    expect(screen.getByText('days')).toBeInTheDocument();
    expect(screen.getByText('hrs')).toBeInTheDocument();
    expect(screen.getByText('min')).toBeInTheDocument();
    expect(screen.getByText('sec')).toBeInTheDocument();
  });

  it('shows warning state when < 24 hours remain', () => {
    const futureDate = new Date(Date.now() + 12 * 3600000).toISOString();
    render(<BountyCountdownTimer deadline={futureDate} />);
    expect(screen.getByText('Ending Soon')).toBeInTheDocument();
  });

  it('shows urgent state when < 1 hour remains', () => {
    const futureDate = new Date(Date.now() + 30 * 60000).toISOString();
    render(<BountyCountdownTimer deadline={futureDate} />);
    expect(screen.getByText('Final Hour!')).toBeInTheDocument();
  });

  it('renders compact mode correctly', () => {
    const futureDate = new Date(Date.now() + 2 * 86400000).toISOString();
    render(<BountyCountdownTimer deadline={futureDate} compact />);
    expect(screen.queryByText('days')).not.toBeInTheDocument();
  });

  it('updates in real-time', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    render(<BountyCountdownTimer deadline={futureDate} />);

    // Advance time by 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Timer should still be running (not expired)
    expect(screen.queryByText('Expired')).not.toBeInTheDocument();
  });

  it('transitions to expired when deadline passes', () => {
    const futureDate = new Date(Date.now() + 1000).toISOString();
    render(<BountyCountdownTimer deadline={futureDate} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Expired')).toBeInTheDocument();
  });
});
