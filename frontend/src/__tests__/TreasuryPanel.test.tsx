/**
 * Tests for the TreasuryPanel admin component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../hooks/useAdminData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useAdminData')>();
  return {
    ...actual,
    getAdminToken: vi.fn(() => 'test-key'),
    useTreasuryDashboard: vi.fn(),
    adminFetch: vi.fn(),
  };
});

import * as adminData from '../hooks/useAdminData';
import { TreasuryPanel } from '../components/admin/TreasuryPanel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Wrapper({ children, qc }: { children: ReactNode; qc: QueryClient }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function buildDashboard(overrides = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const dailyPoints = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return { date: d.toISOString().slice(0, 10), outflow: i === 29 ? 1500 : 0, inflow: 0 };
  });

  return {
    sol_balance: 125.5,
    fndry_balance: 800_000,
    treasury_wallet: 'AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1',
    total_paid_out_fndry: 200_000,
    total_paid_out_sol: 5.0,
    total_payouts: 40,
    daily_points: dailyPoints,
    burn_rate: {
      daily_avg_7d: 100,
      daily_avg_30d: 80,
      daily_avg_90d: 60,
      runway_days_7d: 8000,
      runway_days_30d: 10000,
    },
    spending_by_tier: [
      { tier: 1, label: 'T1 — Starter', total_fndry: 5_000, count: 10 },
      { tier: 2, label: 'T2 — Pro', total_fndry: 15_000, count: 5 },
      { tier: 3, label: 'T3 — Expert', total_fndry: 30_000, count: 2 },
    ],
    recent_transactions: [
      {
        id: 'tx1',
        type: 'payout' as const,
        amount: 1_000,
        token: 'FNDRY',
        recipient: 'alice',
        description: 'Fix auth bug',
        tx_hash: null,
        solscan_url: null,
        status: 'confirmed',
        created_at: new Date().toISOString(),
      },
      {
        id: 'tx2',
        type: 'buyback' as const,
        amount: 3.0,
        token: 'SOL',
        recipient: null,
        description: 'Buyback — 30,000 FNDRY acquired',
        tx_hash: '5fXabcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
        solscan_url: 'https://solscan.io/tx/5fXabcdef',
        status: 'confirmed',
        created_at: new Date().toISOString(),
      },
    ],
    last_updated: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TreasuryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('renders heading while loading', () => {
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        dataUpdatedAt: 0,
        refetch: vi.fn(),
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      expect(screen.getByText('Treasury Dashboard')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when query fails', () => {
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        dataUpdatedAt: 0,
        refetch: vi.fn(),
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      expect(screen.getByTestId('treasury-error')).toBeInTheDocument();
    });
  });

  describe('loaded state — balance cards', () => {
    it('renders FNDRY balance card', () => {
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data: buildDashboard(),
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch: vi.fn(),
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      expect(screen.getByTestId('fndry-balance')).toBeInTheDocument();
      expect(screen.getByTestId('fndry-balance')).toHaveTextContent('800.0k');
    });

    it('renders SOL balance card', () => {
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data: buildDashboard(),
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch: vi.fn(),
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      expect(screen.getByTestId('sol-balance')).toBeInTheDocument();
      expect(screen.getByTestId('sol-balance')).toHaveTextContent('125.5');
    });

    it('renders total payouts count', () => {
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data: buildDashboard(),
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch: vi.fn(),
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      expect(screen.getByTestId('total-payouts')).toHaveTextContent('40');
    });

    it('renders treasury wallet link', () => {
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data: buildDashboard(),
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch: vi.fn(),
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      const link = screen.getByTestId('treasury-wallet-link');
      expect(link).toHaveAttribute('href', expect.stringContaining('solscan.io/account'));
    });
  });

  describe('loaded state — sparkline chart', () => {
    it('renders outflow sparkline', () => {
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data: buildDashboard(),
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch: vi.fn(),
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      expect(screen.getByTestId('outflow-sparkline')).toBeInTheDocument();
    });
  });

  describe('loaded state — burn rate', () => {
    it('renders burn rate section', () => {
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data: buildDashboard(),
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch: vi.fn(),
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      expect(screen.getByTestId('burn-rate-cards')).toBeInTheDocument();
    });

    it('shows runway days when burn rate > 0', () => {
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data: buildDashboard(),
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch: vi.fn(),
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      expect(screen.getByText(/Runway:/)).toBeInTheDocument();
    });
  });

  describe('loaded state — tier spending', () => {
    it('renders tier bars for all 3 tiers', () => {
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data: buildDashboard(),
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch: vi.fn(),
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      expect(screen.getByTestId('tier-bar-1')).toBeInTheDocument();
      expect(screen.getByTestId('tier-bar-2')).toBeInTheDocument();
      expect(screen.getByTestId('tier-bar-3')).toBeInTheDocument();
    });

    it('shows "No paid bounties" when all tiers have zero spend', () => {
      const data = buildDashboard({
        spending_by_tier: [
          { tier: 1, label: 'T1 — Starter', total_fndry: 0, count: 0 },
          { tier: 2, label: 'T2 — Pro', total_fndry: 0, count: 0 },
          { tier: 3, label: 'T3 — Expert', total_fndry: 0, count: 0 },
        ],
      });
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data,
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch: vi.fn(),
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      expect(screen.getByText('No paid bounties yet')).toBeInTheDocument();
    });
  });

  describe('loaded state — recent transactions table', () => {
    it('renders transaction table', () => {
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data: buildDashboard(),
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch: vi.fn(),
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      expect(screen.getByTestId('tx-table')).toBeInTheDocument();
    });

    it('renders solscan link for transactions with tx_hash', () => {
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data: buildDashboard(),
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch: vi.fn(),
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      const link = screen.getByTestId('tx-explorer-link-tx2');
      expect(link).toHaveAttribute('href', 'https://solscan.io/tx/5fXabcdef');
    });

    it('shows empty state when no transactions', () => {
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data: buildDashboard({ recent_transactions: [] }),
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch: vi.fn(),
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      expect(screen.getByText('No transactions yet')).toBeInTheDocument();
    });
  });

  describe('CSV export', () => {
    it('renders export CSV button', () => {
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data: buildDashboard(),
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch: vi.fn(),
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      expect(screen.getByTestId('export-csv-btn')).toBeInTheDocument();
    });
  });

  describe('refresh button', () => {
    it('calls refetch when refresh button clicked', () => {
      const refetch = vi.fn();
      vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
        data: buildDashboard(),
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch,
      } as any);

      const qc = makeQC();
      render(<Wrapper qc={qc}><TreasuryPanel /></Wrapper>);
      fireEvent.click(screen.getByTestId('refresh-btn'));
      expect(refetch).toHaveBeenCalledOnce();
    });
  });
});
