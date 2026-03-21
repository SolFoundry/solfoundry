/**
 * @file Tests for the TokenomicsPage component and its integration points.
 * Queries use ARIA roles and visible text per testing-library best practices.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TokenomicsPage } from '../components/tokenomics/TokenomicsPage';
import { MOCK_TOKENOMICS, MOCK_TREASURY } from '../data/mockTokenomics';

const mockFetch = vi.fn();
global.fetch = mockFetch;

/** Helper: wraps data in a successful fetch Response shape. */
function okJson(data: unknown) { return { ok: true, json: () => Promise.resolve(data) }; }

/** Helper: returns a non-OK fetch Response. */
function failResp() { return { ok: false, json: () => Promise.resolve({}) }; }

beforeEach(() => { mockFetch.mockReset(); });

describe('TokenomicsPage', () => {
  it('renders a loading indicator while data is being fetched', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<TokenomicsPage />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });

  it('displays all key supply metrics after successful fetch', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tokenomics') ? okJson(MOCK_TOKENOMICS) : okJson(MOCK_TREASURY)));
    render(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/FNDRY Tokenomics/));
    expect(screen.getByText(/Total Supply/)).toBeInTheDocument();
    expect(screen.getByText(/Circulating/)).toBeInTheDocument();
    expect(screen.getByText(/^Treasury$/)).toBeInTheDocument();
    expect(screen.getByText(/Distributed/)).toBeInTheDocument();
  });

  it('shows the token contract address', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tokenomics') ? okJson(MOCK_TOKENOMICS) : okJson(MOCK_TREASURY)));
    render(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByText(/C2TvY8E8/)).toBeInTheDocument());
  });

  it('renders the distribution chart with an accessible figure role', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tokenomics') ? okJson(MOCK_TOKENOMICS) : okJson(MOCK_TREASURY)));
    render(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByRole('figure', { name: /distribution/i })).toBeInTheDocument());
  });

  it('shows an alert with the error message when fetching fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    render(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/network error/i));
  });

  it('displays buyback and burn stats', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tokenomics') ? okJson(MOCK_TOKENOMICS) : okJson(MOCK_TREASURY)));
    render(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByText(/Buybacks/)).toBeInTheDocument());
    expect(screen.getByText(/Total Burned/)).toBeInTheDocument();
  });

  it('shows a truncated treasury wallet address', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tokenomics') ? okJson(MOCK_TOKENOMICS) : okJson(MOCK_TREASURY)));
    render(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByText(/57uMiMHn/)).toBeInTheDocument());
  });

  it('falls back to mock data when the API returns a non-OK response', async () => {
    mockFetch.mockResolvedValue(failResp());
    render(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/FNDRY Tokenomics/));
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
