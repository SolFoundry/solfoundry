import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { TimeAgo } from './TimeAgo';

describe('TimeAgo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders "just now" for very recent dates', () => {
    const now = new Date();
    render(<TimeAgo date={now} />);
    expect(screen.getByText('just now')).toBeInTheDocument();
  });

  it('renders minutes ago for recent items', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    render(<TimeAgo date={fiveMinutesAgo} />);
    expect(screen.getByText('5m ago')).toBeInTheDocument();
  });

  it('renders hours ago for items within a day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    render(<TimeAgo date={threeHoursAgo} />);
    expect(screen.getByText('3h ago')).toBeInTheDocument();
  });

  it('renders days ago for items within a week', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    render(<TimeAgo date={fiveDaysAgo} />);
    expect(screen.getByText('5d ago')).toBeInTheDocument();
  });

  it('renders date format for items older than 7 days', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    render(<TimeAgo date={tenDaysAgo} />);
    
    // Should show date format like "Dec 12" (not "10d ago")
    const text = screen.getByText((content) => content.match(/[A-Z][a-z]{2} \d{1,2}/));
    expect(text).toBeInTheDocument();
  });

  it('renders weeks ago for items within a month', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    render(<TimeAgo date={twoWeeksAgo} />);
    expect(screen.getByText('2w ago')).toBeInTheDocument();
  });

  it('renders months ago for items within a year', () => {
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    render(<TimeAgo date={threeMonthsAgo} />);
    expect(screen.getByText('3mo ago')).toBeInTheDocument();
  });

  it('renders years ago for old items', () => {
    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
    render(<TimeAgo date={twoYearsAgo} />);
    expect(screen.getByText('2y ago')).toBeInTheDocument();
  });

  it('shows full date in tooltip', () => {
    const date = new Date('2024-03-15T14:30:00');
    render(<TimeAgo date={date} />);
    
    const element = screen.getByText((content) => content.includes('ago') || content.match(/[A-Z][a-z]{2} \d{1,2}/));
    expect(element).toHaveAttribute('title');
  });

  it('hides tooltip when showTooltip is false', () => {
    const date = new Date('2024-03-15T14:30:00');
    render(<TimeAgo date={date} showTooltip={false} />);
    
    const element = screen.getByText((content) => content.includes('ago') || content.match(/[A-Z][a-z]{2} \d{1,2}/));
    expect(element).not.toHaveAttribute('title');
  });

  it('supports custom className', () => {
    const now = new Date();
    render(<TimeAgo date={now} className="custom-class" />);
    expect(screen.getByText('just now')).toHaveClass('custom-class');
  });

  it('accepts ISO string date', () => {
    const isoString = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    render(<TimeAgo date={isoString} />);
    expect(screen.getByText('30m ago')).toBeInTheDocument();
  });

  it('accepts timestamp number', () => {
    const timestamp = Date.now() - 2 * 60 * 60 * 1000;
    render(<TimeAgo date={timestamp} />);
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });

  it('handles invalid dates gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<TimeAgo date="invalid-date" />);
    expect(consoleSpy).toHaveBeenCalledWith('Invalid date provided to TimeAgo:', 'invalid-date');
    consoleSpy.mockRestore();
  });

  it('auto-updates for recent items', () => {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    render(<TimeAgo date={oneMinuteAgo} />);
    
    expect(screen.getByText('1m ago')).toBeInTheDocument();

    // Fast-forward 2 minutes
    act(() => {
      jest.advanceTimersByTime(2 * 60 * 1000);
    });

    // Should now show "3m ago"
    expect(screen.getByText('3m ago')).toBeInTheDocument();
  });

  it('does not auto-update for old items when autoUpdate is false', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    render(<TimeAgo date={oneHourAgo} autoUpdate={false} />);
    
    const initialText = screen.getByText('1h ago').textContent;

    // Fast-forward 10 minutes
    act(() => {
      jest.advanceTimersByTime(10 * 60 * 1000);
    });

    // Should still show the same text
    expect(screen.getByText(initialText!)).toBeInTheDocument();
  });

  it('stops auto-updating after 1 hour', () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    render(<TimeAgo date={thirtyMinutesAgo} />);
    
    expect(screen.getByText('30m ago')).toBeInTheDocument();

    // Fast-forward 35 minutes (now it's 1h5m old)
    act(() => {
      jest.advanceTimersByTime(35 * 60 * 1000);
    });

    // Should show "1h ago" and stop updating
    expect(screen.getByText('1h ago')).toBeInTheDocument();
  });

  it('handles future dates gracefully', () => {
    const futureDate = new Date(Date.now() + 5 * 60 * 1000);
    render(<TimeAgo date={futureDate} />);
    expect(screen.getByText('just now')).toBeInTheDocument();
  });
});
