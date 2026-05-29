import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BountyCountdown } from '../components/bounty/BountyCountdown';
import React from 'react';

describe('BountyCountdown Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders correctly with days, hours, and minutes remaining', () => {
    const futureDate = new Date(Date.now() + (2 * 24 * 60 * 60 * 1000) + (5 * 60 * 60 * 1000) + (30 * 60 * 1000));
    render(<BountyCountdown deadline={futureDate.toISOString()} />);
    
    expect(screen.getByText('2d 5h 30m')).toBeInTheDocument();
    expect(screen.getByText('2d 5h 30m')).toHaveClass('text-emerald');
  });

  it('changes color class to warning when under 24 hours remaining', () => {
    const warnDate = new Date(Date.now() + (12 * 60 * 60 * 1000) + (15 * 60 * 1000));
    render(<BountyCountdown deadline={warnDate.toISOString()} />);
    
    expect(screen.getByText('12h 15m')).toBeInTheDocument();
    expect(screen.getByText('12h 15m')).toHaveClass('text-status-warning');
  });

  it('changes color class to error/urgent when under 1 hour remaining', () => {
    const urgentDate = new Date(Date.now() + (45 * 60 * 1000));
    render(<BountyCountdown deadline={urgentDate.toISOString()} />);
    
    expect(screen.getByText('45m')).toBeInTheDocument();
    expect(screen.getByText('45m')).toHaveClass('text-status-error');
  });

  it('displays Expired when deadline has passed', () => {
    const pastDate = new Date(Date.now() - 1000);
    render(<BountyCountdown deadline={pastDate.toISOString()} />);
    
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toHaveClass('text-status-error');
  });

  it('updates remaining time in real-time every second', () => {
    const targetDate = new Date(Date.now() + (10 * 60 * 1000)); // 10 minutes in future
    render(<BountyCountdown deadline={targetDate.toISOString()} />);
    
    expect(screen.getByText('10m')).toBeInTheDocument();
    
    // Advance timers by 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(screen.getByText('9m')).toBeInTheDocument();
  });
});
