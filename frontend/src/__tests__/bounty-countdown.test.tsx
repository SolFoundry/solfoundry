import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BountyCountdown, formatCountdown } from '../components/bounty/BountyCountdown';

describe('formatCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-06T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats remaining time as days hours minutes', () => {
    expect(formatCountdown('2026-04-07T02:30:00Z')).toBe('1d 2h 30m');
  });

  it('returns expired after deadline passes', () => {
    expect(formatCountdown('2026-04-05T23:00:00Z')).toBe('Expired');
  });
});

describe('BountyCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-06T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders warning color for less than 24 hours', () => {
    render(<BountyCountdown deadline="2026-04-06T12:00:00Z" />);
    const text = screen.getByText('0d 12h 0m');
    expect(text.parentElement).toHaveClass('text-status-warning');
  });

  it('renders urgent color for less than 1 hour', () => {
    render(<BountyCountdown deadline="2026-04-06T00:45:00Z" />);
    const text = screen.getByText('0d 0h 45m');
    expect(text.parentElement).toHaveClass('text-status-error');
  });

  it('renders expired state', () => {
    render(<BountyCountdown deadline="2026-04-05T23:45:00Z" />);
    const text = screen.getByText('Expired');
    expect(text.parentElement).toHaveClass('text-status-error');
  });
});
