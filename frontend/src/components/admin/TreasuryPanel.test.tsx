/**
 * Treasury admin panel — CSV helper and mocked data states.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { TreasuryDashboardResponse } from '../../types/admin';
import { TreasuryPanel, treasuryDashboardToCsv } from './TreasuryPanel';

beforeAll(() => {
  global.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ publicKey: null, connected: false }),
}));

vi.mock('../../hooks/useAdminData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useAdminData')>();
  return {
    ...actual,
    useTreasuryDashboard: vi.fn(),
    parseTreasuryOwnerWallets: vi.fn(() => new Set<string>()),
  };
});

import * as adminData from '../../hooks/useAdminData';

const mockDash: TreasuryDashboardResponse = {
  treasury_wallet: 'Treasury11111111111111111111111111111111111111',
  fndry_balance: 500_000,
  series: {
    daily: [{ period: '2026-03-01', inflow_fndry: 10, outflow_fndry: 5 }],
    weekly: [{ period: '2026-03-03', inflow_fndry: 10, outflow_fndry: 5 }],
    monthly: [{ period: '2026-03', inflow_fndry: 10, outflow_fndry: 5 }],
  },
  recent_transactions: [
    {
      id: '1',
      kind: 'payout',
      label: 'Test bounty',
      amount_fndry: 100,
      occurred_at: '2026-03-23T12:00:00.000Z',
      explorer_url: 'https://solscan.io/tx/abc',
      tx_hash: 'abc',
    },
  ],
  runway: {
    avg_daily_outflow_fndry: 2,
    estimated_runway_days: 250_000,
    window_days: 30,
    total_outflow_window_fndry: 60,
  },
  tier_spending_fndry: { '1': 1000, '2': 2000 },
  generated_at: '2026-03-23T12:00:00.000Z',
};

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('treasuryDashboardToCsv', () => {
  it('includes meta, tier rows, and recent transactions', () => {
    const csv = treasuryDashboardToCsv(mockDash);
    expect(csv).toContain('meta,treasury_wallet,');
    expect(csv).toContain('tier_spending,tier_1,1000');
    expect(csv).toContain('recent_transactions,payout,');
  });
});

describe('TreasuryPanel', () => {
  beforeEach(() => {
    vi.mocked(adminData.parseTreasuryOwnerWallets).mockReturnValue(new Set());
    vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
      data: mockDash,
      isLoading: false,
      isFetching: false,
      error: null,
    } as ReturnType<typeof adminData.useTreasuryDashboard>);
  });

  it('renders balance and export when data loads', () => {
    render(wrap(<TreasuryPanel />));
    expect(screen.getByTestId('treasury-panel')).toBeInTheDocument();
    expect(screen.getByText(/Treasury \$FNDRY/i)).toBeInTheDocument();
    expect(screen.getByTestId('treasury-export-csv')).toBeInTheDocument();
    expect(screen.getByTestId('treasury-tx-table')).toBeInTheDocument();
  });

  it('triggers CSV download on export click', () => {
    const prevCreate = URL.createObjectURL;
    const prevRevoke = URL.revokeObjectURL;
    let createCalls = 0;
    URL.createObjectURL = () => {
      createCalls += 1;
      return 'blob:mock';
    };
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(wrap(<TreasuryPanel />));
    fireEvent.click(screen.getByTestId('treasury-export-csv'));

    expect(createCalls).toBe(1);
    expect(clickSpy).toHaveBeenCalled();
    URL.createObjectURL = prevCreate;
    URL.revokeObjectURL = prevRevoke;
    clickSpy.mockRestore();
  });

  it('switches chart granularity tabs', () => {
    render(wrap(<TreasuryPanel />));
    fireEvent.click(screen.getByTestId('treasury-chart-weekly'));
    expect(screen.getByTestId('treasury-chart')).toBeInTheDocument();
  });
});
