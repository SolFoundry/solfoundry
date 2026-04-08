/**
 * @module __tests__/BountyAnalyticsPage.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { BountyAnalyticsPage } from '../pages/BountyAnalyticsPage';
import { AuthProvider } from '../contexts/AuthContext';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

function mockJsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as Response;
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter>
          <BountyAnalyticsPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('BountyAnalyticsPage', () => {
  it('renders heading and metric cards when API succeeds', async () => {
    const volume = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      count: 10 + i,
    }));
    const payouts = volume.map((v, i) => ({
      date: v.date,
      amountUsd: 1000 + i * 50,
    }));
    const contributors = {
      new_contributors_last_30d: 42,
      active_contributors_last_30d: 300,
      retention_rate: 0.71,
      weekly_growth: [{ week_start: '2026-03-31', new_contributors: 12 }],
    };

    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const u = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      if (u.includes('/api/stats')) {
        return Promise.resolve(
          mockJsonResponse({ open_bounties: 7, total_contributors: 100, total_bounties: 50 }),
        );
      }
      if (u.includes('/bounty-volume')) return Promise.resolve(mockJsonResponse(volume));
      if (u.includes('/payouts')) return Promise.resolve(mockJsonResponse(payouts));
      if (u.includes('/contributors')) return Promise.resolve(mockJsonResponse(contributors));
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });

    renderPage();

    expect(screen.getByTestId('bounty-analytics-page')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
    expect(screen.getByText(/Bounty analytics/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Export CSV/i })).toHaveAttribute(
      'href',
      '/api/analytics/reports/export.csv',
    );
  });
});
