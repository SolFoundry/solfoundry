import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BountyCountdown } from './BountyCountdown';

describe('BountyCountdown', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows days, hours, and minutes remaining with normal urgency', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T00:00:00Z'));

    render(<BountyCountdown deadline="2026-05-13T03:04:00Z" />);

    expect(screen.getByText('2d 3h 4m')).toBeInTheDocument();
    expect(screen.getByLabelText(/2 days, 3 hours, 4 minutes remaining/i)).toHaveClass('text-text-muted');
  });

  it('uses warning and urgent colors as the deadline approaches', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T00:00:00Z'));

    const { rerender } = render(<BountyCountdown deadline="2026-05-11T12:00:00Z" />);

    expect(screen.getByText('12h 0m')).toHaveClass('text-status-warning');

    rerender(<BountyCountdown deadline="2026-05-11T00:45:00Z" />);

    expect(screen.getByText('45m')).toHaveClass('text-status-error');
  });

  it('updates without a page refresh and shows expired after the deadline passes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T00:00:00Z'));

    render(<BountyCountdown deadline="2026-05-11T00:01:00Z" />);

    expect(screen.getByText('1m')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    expect(screen.getByText('Expired')).toBeInTheDocument();
  });
});
