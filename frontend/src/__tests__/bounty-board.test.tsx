/**
 * Bounty board test suite.
 * Tests for BountyCard, EmptyState, useBountyBoard hook, and BountyBoard component.
 * All components using React Query are wrapped in QueryClientProvider.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BountyCard, formatTimeRemaining, formatReward } from '../components/bounties/BountyCard';
import { EmptyState } from '../components/bounties/EmptyState';
import { useBountyBoard } from '../hooks/useBountyBoard';
import { mockBounties } from '../data/mockBounties';
import type { Bounty } from '../types/bounty';
import React from 'react';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/** Successful fetch response helper. */
function okJson(data: unknown): Response {
  return {
    ok: true, status: 200, statusText: 'OK',
    json: () => Promise.resolve(data),
    headers: new Headers(), redirected: false, type: 'basic' as ResponseType, url: '',
    clone: function () { return this; }, body: null, bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

/** Failed fetch response helper. */
function failJson(status: number): Response {
  return {
    ok: false, status, statusText: 'Error',
    json: () => Promise.resolve({ message: 'error' }),
    headers: new Headers(), redirected: false, type: 'basic' as ResponseType, url: '',
    clone: function () { return this; }, body: null, bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve('{"message":"error"}'),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

beforeEach(() => mockFetch.mockReset());

/** Create a QueryClient wrapper for hooks and components. */
function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const testBounty: Bounty = {
  id: 't1', title: 'Test', description: 'D', tier: 'T2',
  skills: ['React', 'TS', 'Rust', 'Sol'], rewardAmount: 3500,
  currency: 'USDC', deadline: new Date(Date.now() + 5 * 864e5).toISOString(),
  status: 'open', submissionCount: 3, createdAt: new Date().toISOString(), projectName: 'TP',
};

describe('BountyCard', () => {
  it('renders info and handles click', async () => {
    const handleClick = vi.fn();
    render(<BountyCard bounty={testBounty} onClick={handleClick} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('3.5k')).toBeInTheDocument();
    expect(screen.getByText('T2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /test/i }));
    expect(handleClick).toHaveBeenCalledWith('t1');
  });

  it('expired shows text, urgent shows indicator testid', () => {
    const { rerender } = render(
      <BountyCard bounty={{ ...testBounty, deadline: new Date(Date.now() - 1000).toISOString() }} onClick={() => {}} />,
    );
    expect(screen.getByText('Expired')).toBeInTheDocument();
    rerender(
      <BountyCard bounty={{ ...testBounty, deadline: new Date(Date.now() + 12 * 36e5).toISOString() }} onClick={() => {}} />,
    );
    expect(screen.getByTestId('urgent-indicator')).toBeInTheDocument();
  });
});

describe('Helpers + components', () => {
  it('formatTimeRemaining and formatReward', () => {
    expect(formatTimeRemaining(new Date(Date.now() - 1000).toISOString())).toBe('Expired');
    expect(formatReward(3500)).toBe('3.5k');
    expect(formatReward(350)).toBe('350');
  });

  it('BountyCard shows status indicator', () => {
    render(<BountyCard bounty={testBounty} onClick={() => {}} />);
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('EmptyState renders with reset button', async () => {
    const handleReset = vi.fn();
    render(<EmptyState onReset={handleReset} />);
    await userEvent.click(screen.getByRole('button', { name: /clear all filters/i }));
    expect(handleReset).toHaveBeenCalledOnce();
  });
});

describe('useBountyBoard with React Query', () => {
  it('fetches bounties from the API and returns them', async () => {
    const apiBounties = mockBounties.map(bounty => ({
      id: bounty.id, title: bounty.title, description: bounty.description,
      tier: bounty.tier === 'T1' ? 1 : bounty.tier === 'T2' ? 2 : 3,
      required_skills: bounty.skills, reward_amount: bounty.rewardAmount,
      deadline: bounty.deadline, status: bounty.status.replace('-', '_'),
      submission_count: bounty.submissionCount, created_at: bounty.createdAt,
      created_by: bounty.projectName,
    }));

    mockFetch.mockImplementation((urlArg: unknown) => {
      const url = String(urlArg ?? '');
      if (url.includes('/search')) {
        return Promise.resolve(okJson({ items: apiBounties, total: apiBounties.length, page: 1, per_page: 20, query: '' }));
      }
      if (url.includes('/hot')) return Promise.resolve(okJson([]));
      if (url.includes('/recommended')) return Promise.resolve(okJson([]));
      return Promise.resolve(okJson({ items: apiBounties }));
    });

    const { result } = renderHook(() => useBountyBoard(), { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.bounties.length).toBeGreaterThan(0);
  });

  it('handles API failure gracefully with empty results', async () => {
    mockFetch.mockResolvedValue(failJson(404));

    const { result } = renderHook(() => useBountyBoard(), { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    // Should not crash, returns empty array on failure
    expect(Array.isArray(result.current.bounties)).toBe(true);
  });

  it('supports sort and filter state changes', async () => {
    mockFetch.mockResolvedValue(okJson({ items: [], total: 0, page: 1, per_page: 20, query: '' }));

    const { result } = renderHook(() => useBountyBoard(), { wrapper: createQueryWrapper() });

    act(() => { result.current.setFilter('tier', 'T1'); });
    expect(result.current.filters.tier).toBe('T1');

    act(() => { result.current.setSortBy('reward_high'); });
    expect(result.current.sortBy).toBe('reward_high');

    act(() => { result.current.resetFilters(); });
    expect(result.current.filters.tier).toBe('all');
  });
});
