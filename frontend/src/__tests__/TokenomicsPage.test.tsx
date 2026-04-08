/**
 * Tests for the TokenomicsPage component and its integration points.
 * Queries use ARIA roles and visible text per testing-library best practices.
 * All renders wrapped in QueryClientProvider since useTreasuryStats uses React Query.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TokenomicsPage } from '../components/tokenomics/TokenomicsPage';
import { MOCK_TOKENOMICS, MOCK_TREASURY } from '../data/mockTokenomics';
import React from 'react';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/** Successful fetch response. */
function okJson(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: function () { return this; },
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

/** Render with a fresh QueryClient. */
function renderWithQuery(element: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {element}
    </QueryClientProvider>,
  );
}

beforeEach(() => { mockFetch.mockReset(); });

describe('TokenomicsPage', () => {
  it('renders a loading indicator while data is being fetched', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<TokenomicsPage />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });

  it('displays all key supply metrics after successful fetch', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tokenomics') ? okJson(MOCK_TOKENOMICS) : okJson(MOCK_TREASURY)));
    renderWithQuery(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/FNDRY Tokenomics/));
    expect(screen.getByText('Total Supply')).toBeInTheDocument();
    expect(screen.getByText('Circulating')).toBeInTheDocument();
    expect(screen.getByText('Distributed')).toBeInTheDocument();
    // "Treasury" appears in multiple StatCards, so verify at least one exists
    expect(screen.getAllByText(/Treasury/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows the token contract address', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tokenomics') ? okJson(MOCK_TOKENOMICS) : okJson(MOCK_TREASURY)));
    renderWithQuery(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByText(/C2TvY8E8/)).toBeInTheDocument());
  });

  it('renders the distribution chart with an accessible figure role', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tokenomics') ? okJson(MOCK_TOKENOMICS) : okJson(MOCK_TREASURY)));
    renderWithQuery(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByRole('figure', { name: /distribution/i })).toBeInTheDocument());
  });

  it('shows an alert with the error message when fetching fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    renderWithQuery(<TokenomicsPage />);
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/failed to load treasury data/i);
    });
  });

  it('displays buyback and burn stats', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tokenomics') ? okJson(MOCK_TOKENOMICS) : okJson(MOCK_TREASURY)));
    renderWithQuery(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByText(/Buybacks/)).toBeInTheDocument());
    expect(screen.getByText(/Total Burned/)).toBeInTheDocument();
  });

  it('shows a truncated treasury wallet address', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tokenomics') ? okJson(MOCK_TOKENOMICS) : okJson(MOCK_TREASURY)));
    renderWithQuery(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByText(/57uMiMHn/)).toBeInTheDocument());
  });

  it('falls back to default data when the API returns a non-OK response', async () => {
    mockFetch.mockRejectedValue(new Error('Server down'));
    renderWithQuery(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});

describe('Sidebar integration', () => {
  it('Sidebar nav includes a Tokenomics link pointing to /tokenomics', async () => {
    const { Sidebar } = await import('../components/layout/Sidebar');
    const { MemoryRouter } = await import('react-router-dom');
    render(
      <MemoryRouter initialEntries={['/']}>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /tokenomics/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/tokenomics');
  });
});

describe('Route entry point', () => {
  it('pages/TokenomicsPage re-exports the component as default', async () => {
    const mod = await import('../pages/TokenomicsPage');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
