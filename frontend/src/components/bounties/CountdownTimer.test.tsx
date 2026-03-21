import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CountdownTimer } from './CountdownTimer';

describe('CountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with future date (> 24h) in green', () => {
    // 2 days in the future
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    render(<CountdownTimer deadline={futureDate} />);
    
    expect(screen.getByText(/2d/)).toBeInTheDocument();
    expect(screen.getByText(/\d+h/)).toBeInTheDocument();
    expect(screen.getByText(/\d+m/)).toBeInTheDocument();
  });

  it('shows yellow/amber when < 24h remaining', () => {
    // 12 hours in the future
    const futureDate = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    render(<CountdownTimer deadline={futureDate} />);
    
    expect(screen.getByText(/12h/)).toBeInTheDocument();
    const container = screen.getByText(/12h/).closest('span');
    expect(container?.className).toContain('text-amber-400');
  });

  it('shows red when < 6h remaining', () => {
    // 3 hours in the future
    const futureDate = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    render(<CountdownTimer deadline={futureDate} />);
    
    expect(screen.getByText(/3h/)).toBeInTheDocument();
    const container = screen.getByText(/3h/).closest('span');
    expect(container?.className).toContain('text-red-400');
  });

  it('shows "Expired" when deadline has passed', () => {
    // 1 hour in the past
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    render(<CountdownTimer deadline={pastDate} />);
    
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('updates every minute', () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    render(<CountdownTimer deadline={futureDate} />);
    
    // Initial render
    expect(screen.getByText(/60m/)).toBeInTheDocument();
    
    // Advance 1 minute
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    
    // Should show 59m now
    expect(screen.getByText(/59m/)).toBeInTheDocument();
  });

  it('compact mode shows shorter format', () => {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000 + 32 * 60 * 1000).toISOString();
    render(<CountdownTimer deadline={futureDate} compact />);
    
    // Should show "2d 14h 32m" format
    expect(screen.getByText(/2d 14h \d+m/)).toBeInTheDocument();
  });

  it('full mode shows labels', () => {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    render(<CountdownTimer deadline={futureDate} compact={false} />);
    
    expect(screen.getByText('days')).toBeInTheDocument();
    expect(screen.getByText('hrs')).toBeInTheDocument();
    expect(screen.getByText('min')).toBeInTheDocument();
  });

  it('handles 0 days correctly', () => {
    // 5 hours in the future (< 1 day)
    const futureDate = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    render(<CountdownTimer deadline={futureDate} compact />);
    
    // Should not show "0d"
    expect(screen.queryByText(/0d/)).not.toBeInTheDocument();
    expect(screen.getByText(/5h/)).toBeInTheDocument();
  });

  it('cleans up interval on unmount', () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { unmount } = render(<CountdownTimer deadline={futureDate} />);
    
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    unmount();
    
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});