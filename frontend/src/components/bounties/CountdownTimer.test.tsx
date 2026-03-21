import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { CountdownTimer } from './CountdownTimer';

// ─── Helpers ────────────────────────────────────────────────────────────────

function futureISO(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function pastISO(offsetMs: number): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

const ONE_MIN = 60_000;
const ONE_HOUR = 60 * ONE_MIN;
const ONE_DAY = 24 * ONE_HOUR;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CountdownTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows days, hours, and minutes for a far-future deadline', () => {
    const deadline = futureISO(2 * ONE_DAY + 14 * ONE_HOUR + 32 * ONE_MIN);
    render(<CountdownTimer deadline={deadline} />);
    expect(screen.getByText('02')).toBeInTheDocument(); // days
    expect(screen.getByText('14')).toBeInTheDocument(); // hours
    expect(screen.getByText('32')).toBeInTheDocument(); // minutes
  });

  it('uses green (normal) color when > 24h remaining', () => {
    const deadline = futureISO(25 * ONE_HOUR);
    const { container } = render(<CountdownTimer deadline={deadline} />);
    // Check that the urgency classes for 'normal' are applied
    expect(container.querySelector('.text-\\[\\#14F195\\]')).not.toBeNull();
  });

  it('uses amber color when < 24h remaining', () => {
    const deadline = futureISO(12 * ONE_HOUR);
    const { container } = render(<CountdownTimer deadline={deadline} />);
    expect(container.querySelector('.text-amber-400')).not.toBeNull();
  });

  it('uses red color when < 6h remaining', () => {
    const deadline = futureISO(3 * ONE_HOUR);
    const { container } = render(<CountdownTimer deadline={deadline} />);
    expect(container.querySelector('.text-red-400')).not.toBeNull();
  });

  it('shows "Expired" when deadline has passed', () => {
    const deadline = pastISO(ONE_HOUR);
    render(<CountdownTimer deadline={deadline} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('shows "Expired" for a deadline exactly at the current time', () => {
    const deadline = new Date(Date.now()).toISOString();
    render(<CountdownTimer deadline={deadline} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('renders compact mode without time unit boxes', () => {
    const deadline = futureISO(2 * ONE_HOUR);
    const { container } = render(<CountdownTimer deadline={deadline} compact />);
    // In compact mode there should be no sub-components with flex-col
    expect(container.querySelectorAll('.flex-col').length).toBe(0);
  });

  it('updates display every minute via setInterval', () => {
    // Start with 61 minutes remaining
    const deadline = futureISO(61 * ONE_MIN);
    render(<CountdownTimer deadline={deadline} />);

    // Initially shows 1 hour 1 minute
    expect(screen.getByText('01')).toBeInTheDocument(); // hours (01)

    // Advance 60 seconds — now 1 minute dropped
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    // Still in the future but now 1 hour 0 minutes
    expect(screen.getByText('00')).toBeInTheDocument(); // minutes
  });

  it('cleans up interval on unmount', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const deadline = futureISO(ONE_DAY);
    const { unmount } = render(<CountdownTimer deadline={deadline} />);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('handles invalid/empty deadline gracefully by showing Expired', () => {
    // An invalid date string → NaN → diff is NaN → treated as expired
    render(<CountdownTimer deadline="not-a-date" />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });
});
