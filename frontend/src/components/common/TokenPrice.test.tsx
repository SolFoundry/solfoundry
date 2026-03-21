import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenPrice } from './TokenPrice';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockResponse = {
  pairs: [
    {
      priceUsd: '0.0042',
      marketCap: 24_200,
      volume: { h24: 9_500 },
      priceChange: { h24: 3.56 },
    },
  ],
};

describe('TokenPrice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('shows loading state while first request is pending', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<TokenPrice mode="compact" />);

    expect(screen.getByRole('status', { name: /loading token price/i })).toBeInTheDocument();
  });

  it('renders compact mode with price and 24h change', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockResponse) });
    render(<TokenPrice mode="compact" />);

    await waitFor(() => {
      expect(screen.getByText('$0.0042')).toBeInTheDocument();
    });
    expect(screen.getByText('+3.56%')).toBeInTheDocument();
    expect(screen.queryByText('Market Cap')).not.toBeInTheDocument();
  });

  it('renders full mode with market cap and 24h volume formatting', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockResponse) });
    render(<TokenPrice mode="full" />);

    await waitFor(() => {
      expect(screen.getByText('$0.0042')).toBeInTheDocument();
    });
    expect(screen.getByText('24h Change')).toBeInTheDocument();
    expect(screen.getByText('Market Cap')).toBeInTheDocument();
    expect(screen.getByText('$24.2K')).toBeInTheDocument();
    expect(screen.getByText('24h Volume')).toBeInTheDocument();
    expect(screen.getByText('$9.5K')).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    render(<TokenPrice mode="compact" />);

    await waitFor(() => {
      expect(screen.getByText('Price unavailable')).toBeInTheDocument();
    });
  });

  it('auto-refreshes every 60 seconds', async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockResponse) });

    render(<TokenPrice mode="compact" />);
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});