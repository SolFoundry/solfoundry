import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BountyGrid } from '../components/bounty/BountyGrid';
import type { Bounty } from '../types/bounty';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal(
  'IntersectionObserver',
  vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(() => []),
  })),
);

const bounties: Bounty[] = [
  {
    id: 'auth-session',
    title: 'Fix auth session refresh',
    description: 'Keep users signed in after token renewal.',
    status: 'open',
    tier: 'T1',
    reward_amount: 100000,
    reward_token: 'FNDRY',
    github_issue_url: 'https://github.com/solfoundry/solfoundry/issues/1',
    skills: ['TypeScript'],
    submission_count: 0,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'escrow-payout',
    title: 'Escrow payout fix',
    description: 'Resolve wallet transfer confirmation failures.',
    status: 'open',
    tier: 'T1',
    reward_amount: 100000,
    reward_token: 'FNDRY',
    github_issue_url: 'https://github.com/solfoundry/solfoundry/issues/2',
    skills: ['Solidity'],
    submission_count: 1,
    created_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 'indexer-rust',
    title: 'Indexer optimization',
    description: 'Reduce event processing latency.',
    status: 'open',
    tier: 'T1',
    reward_amount: 100000,
    reward_token: 'FNDRY',
    github_issue_url: 'https://github.com/solfoundry/solfoundry/issues/3',
    skills: ['Rust'],
    submission_count: 0,
    created_at: '2026-01-03T00:00:00Z',
  },
];

function okJson(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderBountyGrid() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BountyGrid />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BountyGrid search', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(okJson({ items: bounties, total: bounties.length, limit: 12, offset: 0 }));
  });

  it('filters bounties by title', async () => {
    renderBountyGrid();

    await waitFor(() => expect(screen.getByText('Fix auth session refresh')).toBeInTheDocument());
    await userEvent.type(screen.getByRole('searchbox', { name: /search bounties/i }), 'escrow');

    await waitFor(() => {
      expect(screen.getByText('Escrow payout fix')).toBeInTheDocument();
      expect(screen.queryByText('Fix auth session refresh')).not.toBeInTheDocument();
      expect(screen.queryByText('Indexer optimization')).not.toBeInTheDocument();
    });
  });

  it('filters bounties by description and skills', async () => {
    renderBountyGrid();

    await waitFor(() => expect(screen.getByText('Escrow payout fix')).toBeInTheDocument());
    await userEvent.type(screen.getByRole('searchbox', { name: /search bounties/i }), 'wallet');

    await waitFor(() => {
      expect(screen.getByText('Escrow payout fix')).toBeInTheDocument();
      expect(screen.queryByText('Fix auth session refresh')).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /clear bounty search/i }));
    await userEvent.type(screen.getByRole('searchbox', { name: /search bounties/i }), 'rust');

    await waitFor(() => expect(screen.getByText('Indexer optimization')).toBeInTheDocument());
    expect(screen.queryByText('Escrow payout fix')).not.toBeInTheDocument();
  });

  it('clears the search query', async () => {
    renderBountyGrid();

    await waitFor(() => expect(screen.getByText('Indexer optimization')).toBeInTheDocument());
    await userEvent.type(screen.getByRole('searchbox', { name: /search bounties/i }), 'rust');
    await waitFor(() => expect(screen.queryByText('Escrow payout fix')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /clear bounty search/i }));

    await waitFor(() => expect(screen.getByText('Escrow payout fix')).toBeInTheDocument());
    expect(screen.getByText('Fix auth session refresh')).toBeInTheDocument();
  });
});
