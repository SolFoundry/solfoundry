import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TokenomicsPage } from '../components/tokenomics/TokenomicsPage';
import { MOCK_TOKENOMICS, MOCK_TREASURY } from '../data/mockTokenomics';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) { return { ok: true, json: () => Promise.resolve(data) }; }
function failResp() { return { ok: false, json: () => Promise.resolve({}) }; }

beforeEach(() => { mockFetch.mockReset(); });

describe('TokenomicsPage', () => {
  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<TokenomicsPage />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });

  it('displays tokenomics data after fetch', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tokenomics') ? okJson(MOCK_TOKENOMICS) : okJson(MOCK_TREASURY)));
    render(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByText('FNDRY Tokenomics')).toBeInTheDocument());
    expect(screen.getByText(/Total Supply/)).toBeInTheDocument();
    expect(screen.getByText(/Circulating/)).toBeInTheDocument();
    expect(screen.getByText(/Treasury/)).toBeInTheDocument();
    expect(screen.getByText(/Distributed/)).toBeInTheDocument();
  });

  it('shows contract address', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tokenomics') ? okJson(MOCK_TOKENOMICS) : okJson(MOCK_TREASURY)));
    render(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByText(/C2TvY8E8/)).toBeInTheDocument());
  });

  it('renders distribution breakdown with role=figure', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tokenomics') ? okJson(MOCK_TOKENOMICS) : okJson(MOCK_TREASURY)));
    render(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByRole('figure', { name: /distribution/i })).toBeInTheDocument());
  });

  it('shows error state on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    render(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/error/i));
  });

  it('shows buyback and burn stats', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tokenomics') ? okJson(MOCK_TOKENOMICS) : okJson(MOCK_TREASURY)));
    render(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByText(/Buybacks/)).toBeInTheDocument());
    expect(screen.getByText(/Total Burned/)).toBeInTheDocument();
  });

  it('shows treasury wallet address (truncated)', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url.includes('tokenomics') ? okJson(MOCK_TOKENOMICS) : okJson(MOCK_TREASURY)));
    render(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByText(/57uMiMHn/)).toBeInTheDocument());
  });

  it('falls back to mock data when API returns non-ok', async () => {
    mockFetch.mockResolvedValue(failResp());
    render(<TokenomicsPage />);
    await waitFor(() => expect(screen.getByText('FNDRY Tokenomics')).toBeInTheDocument());
  });
});
