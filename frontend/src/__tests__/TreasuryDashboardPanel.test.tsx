/**
 * Treasury dashboard — owner gate and loaded state (network mocked).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { TreasuryDashboardResponse } from '../types/admin';

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(() => ({
    publicKey: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    connecting: false,
    connected: false,
  })),
}));

vi.mock('../components/wallet/WalletProvider', () => ({
  useNetwork: () => ({ network: 'mainnet-beta' as const }),
}));

vi.mock('../hooks/useAdminData', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useAdminData')>();
  return {
    ...actual,
    useTreasuryDashboard: vi.fn(),
    parseTreasuryOwnerWallets: vi.fn(() => [] as string[]),
  };
});

import { useWallet } from '@solana/wallet-adapter-react';
import * as adminData from '../hooks/useAdminData';
import { TreasuryDashboardPanel } from '../components/admin/TreasuryDashboardPanel';

const MOCK_DASHBOARD: TreasuryDashboardResponse = {
  treasury_pda_address: 'TreasuryPDA1111111111111111111111111111111111',
  fndry_balance: 275000,
  last_updated: new Date().toISOString(),
  chart: {
    daily: Array.from({ length: 3 }, (_, i) => ({
      period_start: `2025-01-${String(i + 1).padStart(2, '0')}`,
      inflow: 100,
      outflow: 50,
    })),
    weekly: [],
    monthly: [],
  },
  recent_transactions: [],
  projections: {
    current_balance_fndry: 275000,
    avg_daily_outflow_fndry: 10,
    runway_days: 100,
    window_days: 30,
    note: null,
  },
  tier_spending: [
    { tier: 1, total_fndry: 1000, bounty_count: 2 },
    { tier: 2, total_fndry: 500, bounty_count: 1 },
    { tier: 3, total_fndry: 0, bounty_count: 0 },
  ],
};

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('TreasuryDashboardPanel', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    vi.mocked(adminData.parseTreasuryOwnerWallets).mockReturnValue([]);
    vi.mocked(adminData.useTreasuryDashboard).mockReturnValue({
      data: MOCK_DASHBOARD,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof adminData.useTreasuryDashboard>);
    vi.mocked(useWallet).mockReturnValue({
      publicKey: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      connecting: false,
      connected: false,
    } as ReturnType<typeof useWallet>);
  });

  it('prompts for wallet when owner allowlist is configured', () => {
    vi.mocked(adminData.parseTreasuryOwnerWallets).mockReturnValue(['AbcdWallet11111111111111111111111111111111']);
    render(
      <Wrapper>
        <TreasuryDashboardPanel />
      </Wrapper>,
    );
    expect(screen.getByTestId('treasury-wallet-gate')).toBeTruthy();
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeTruthy();
  });

  it('shows treasury balance when loaded without owner env', () => {
    render(
      <Wrapper>
        <TreasuryDashboardPanel />
      </Wrapper>,
    );
    expect(screen.getByTestId('treasury-dashboard')).toBeTruthy();
    expect(screen.getByTestId('treasury-fndry-balance').textContent).toMatch(/275/);
  });
});
