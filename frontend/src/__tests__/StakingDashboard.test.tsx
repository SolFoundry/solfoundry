/**
 * Tests for the Staking UI components and hooks.
 * Mocks: wallet adapter, staking data hooks, useFndryBalance.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPosition = {
  wallet_address: 'WALLET_A',
  staked_amount: 5000,
  tier: 'bronze',
  apy: 0.05,
  rep_boost: 1.0,
  staked_at: '2026-01-01T00:00:00Z',
  last_reward_claim: '2026-01-01T00:00:00Z',
  rewards_earned: 10.5,
  rewards_available: 3.2,
  cooldown_started_at: null,
  cooldown_ends_at: null,
  cooldown_active: false,
  unstake_ready: false,
  unstake_amount: 0,
};

const mockPositionCooldown = {
  ...mockPosition,
  cooldown_active: true,
  cooldown_started_at: new Date(Date.now() - 86400000).toISOString(),
  cooldown_ends_at: new Date(Date.now() + 6 * 86400000).toISOString(),
  unstake_amount: 2000,
};

const mockPositionReady = {
  ...mockPosition,
  cooldown_active: false,
  unstake_ready: true,
  cooldown_ends_at: new Date(Date.now() - 1000).toISOString(),
  unstake_amount: 2000,
};

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(() => ({ publicKey: { toBase58: () => 'WALLET_A' } })),
  useConnection: vi.fn(() => ({ connection: {} })),
}));

vi.mock('../hooks/useFndryToken', () => ({
  useFndryBalance: vi.fn(() => ({ balance: 10000, rawBalance: null, loading: false, error: null, refetch: vi.fn() })),
}));

vi.mock('../hooks/useStaking', () => ({
  useStakingTx: vi.fn(() => ({
    stakeTokens: vi.fn().mockResolvedValue('sig_stake'),
    unstakeTokens: vi.fn().mockResolvedValue('sig_unstake'),
    transaction: { status: 'idle', signature: null, error: null },
    reset: vi.fn(),
  })),
}));

vi.mock('../hooks/useStakingData', () => ({
  useStakingPosition: vi.fn(() => ({ data: mockPosition, refetch: vi.fn(), isLoading: false })),
  useStakingHistory: vi.fn(() => ({
    data: {
      items: [
        { id: '1', wallet_address: 'WALLET_A', event_type: 'stake', amount: 5000, rewards_amount: null, signature: 'sig_abc', created_at: '2026-01-01T00:00:00Z' },
      ],
      total: 1,
    },
    isLoading: false,
  })),
  useStakingStats: vi.fn(() => ({
    data: { total_staked: 500000, total_stakers: 42, total_rewards_paid: 1234, avg_apy: 0.09, tier_distribution: { bronze: 20, silver: 10, gold: 5, diamond: 2, none: 5 } },
  })),
  useRecordStake: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue(mockPosition), isPending: false })),
  useInitiateUnstake: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue(mockPositionCooldown), isPending: false })),
  useCompleteUnstake: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue(mockPosition), isPending: false })),
  useClaimRewards: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({ amount_claimed: 3.2, position: mockPosition }), isPending: false })),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={makeClient()}>{ui}</QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// StakingDashboard
// ---------------------------------------------------------------------------

describe('StakingDashboard', () => {
  const { StakingDashboard } = await import('../components/staking/StakingDashboard');

  it('renders staked amount', () => {
    wrap(<StakingDashboard />);
    expect(screen.getByText('5,000')).toBeTruthy();
  });

  it('renders tier', () => {
    wrap(<StakingDashboard />);
    expect(screen.getByText('bronze')).toBeTruthy();
  });

  it('renders wallet balance', () => {
    wrap(<StakingDashboard />);
    expect(screen.getByText('10,000')).toBeTruthy();
  });

  it('renders stake button', () => {
    wrap(<StakingDashboard />);
    expect(screen.getByTestId('stake-btn')).toBeTruthy();
  });

  it('renders unstake button when staked', () => {
    wrap(<StakingDashboard />);
    expect(screen.getByTestId('unstake-btn')).toBeTruthy();
  });

  it('opens stake modal on stake button click', async () => {
    wrap(<StakingDashboard />);
    fireEvent.click(screen.getByTestId('stake-btn'));
    await waitFor(() => expect(screen.getByTestId('modal-submit-btn')).toBeTruthy());
  });

  it('renders global stats', () => {
    wrap(<StakingDashboard />);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders history row', () => {
    wrap(<StakingDashboard />);
    expect(screen.getByText('Staked')).toBeTruthy();
  });

  it('shows connect prompt when wallet disconnected', async () => {
    const { useWallet } = await import('@solana/wallet-adapter-react');
    vi.mocked(useWallet).mockReturnValueOnce({ publicKey: null } as any);
    wrap(<StakingDashboard />);
    expect(screen.getByTestId('staking-connect-prompt')).toBeTruthy();
  });

  it('shows cooldown banner when active', async () => {
    const { useStakingPosition } = await import('../hooks/useStakingData');
    vi.mocked(useStakingPosition).mockReturnValueOnce({ data: mockPositionCooldown, refetch: vi.fn(), isLoading: false } as any);
    wrap(<StakingDashboard />);
    expect(screen.getByText('Cooldown in progress')).toBeTruthy();
  });

  it('shows ready-to-unstake banner when cooldown elapsed', async () => {
    const { useStakingPosition } = await import('../hooks/useStakingData');
    vi.mocked(useStakingPosition).mockReturnValueOnce({ data: mockPositionReady, refetch: vi.fn(), isLoading: false } as any);
    wrap(<StakingDashboard />);
    expect(screen.getByText('Cooldown complete!')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// StakingModal
// ---------------------------------------------------------------------------

describe('StakingModal', () => {
  const { StakingModal } = await import('../components/staking/StakingModal');

  const baseProps = {
    position: mockPosition,
    walletBalance: 10000,
    transaction: { status: 'idle' as const, signature: null, error: null },
    onStake: vi.fn(),
    onInitiateUnstake: vi.fn(),
    onCompleteUnstake: vi.fn(),
    onClaim: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders stake modal', () => {
    render(<StakingModal mode="stake" {...baseProps} />);
    expect(screen.getByTestId('amount-input')).toBeTruthy();
    expect(screen.getByTestId('modal-submit-btn')).toBeTruthy();
  });

  it('renders claim modal with reward amount', () => {
    render(<StakingModal mode="claim" {...baseProps} />);
    expect(screen.getByText('3.2')).toBeTruthy();
  });

  it('shows error when amount empty on stake', async () => {
    render(<StakingModal mode="stake" {...baseProps} />);
    fireEvent.click(screen.getByTestId('modal-submit-btn'));
    await waitFor(() => expect(screen.getByTestId('amount-error')).toBeTruthy());
  });

  it('MAX button fills wallet balance', () => {
    render(<StakingModal mode="stake" {...baseProps} />);
    const maxBtn = screen.getByText('MAX');
    fireEvent.click(maxBtn);
    const input = screen.getByTestId('amount-input') as HTMLInputElement;
    expect(input.value).toBe('10000');
  });

  it('close button calls onClose', () => {
    render(<StakingModal mode="stake" {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Close modal'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('shows tx status when confirming', () => {
    render(
      <StakingModal
        mode="stake"
        {...baseProps}
        transaction={{ status: 'confirming', signature: 'sig123', error: null }}
      />,
    );
    expect(screen.getByTestId('tx-status')).toBeTruthy();
  });

  it('shows error state', () => {
    render(
      <StakingModal
        mode="stake"
        {...baseProps}
        transaction={{ status: 'error', signature: null, error: 'Insufficient balance' }}
      />,
    );
    expect(screen.getByTestId('tx-error')).toBeTruthy();
    expect(screen.getByText('Insufficient balance')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// StakingTiers
// ---------------------------------------------------------------------------

describe('StakingTiers', () => {
  const { StakingTiers } = await import('../components/staking/StakingTiers');

  it('renders all four tiers', () => {
    render(<StakingTiers currentTier="bronze" stakedAmount={5000} />);
    expect(screen.getByTestId('tier-bronze')).toBeTruthy();
    expect(screen.getByTestId('tier-silver')).toBeTruthy();
    expect(screen.getByTestId('tier-gold')).toBeTruthy();
    expect(screen.getByTestId('tier-diamond')).toBeTruthy();
  });

  it('marks current tier', () => {
    render(<StakingTiers currentTier="gold" stakedAmount={50000} />);
    expect(screen.getByText('Current tier')).toBeTruthy();
  });

  it('shows APY for each tier', () => {
    render(<StakingTiers currentTier="none" stakedAmount={0} />);
    expect(screen.getByText('5% APY')).toBeTruthy();
    expect(screen.getByText('18% APY')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// RewardsPanel
// ---------------------------------------------------------------------------

describe('RewardsPanel', () => {
  const { RewardsPanel } = await import('../components/staking/RewardsPanel');

  it('renders rewards available', () => {
    render(
      <RewardsPanel
        rewardsAvailable={3.2}
        rewardsEarned={10.5}
        apy={0.05}
        onClaim={vi.fn()}
        isClaiming={false}
      />,
    );
    expect(screen.getByText('3.2')).toBeTruthy();
    expect(screen.getByTestId('claim-btn')).toBeTruthy();
  });

  it('disables claim when no rewards', () => {
    render(
      <RewardsPanel
        rewardsAvailable={0}
        rewardsEarned={0}
        apy={0}
        onClaim={vi.fn()}
        isClaiming={false}
      />,
    );
    const btn = screen.getByTestId('claim-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('shows claiming state', () => {
    render(
      <RewardsPanel
        rewardsAvailable={5}
        rewardsEarned={10}
        apy={0.08}
        onClaim={vi.fn()}
        isClaiming={true}
      />,
    );
    expect(screen.getByText('Claiming...')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// StakingHistory
// ---------------------------------------------------------------------------

describe('StakingHistory', () => {
  const { StakingHistory } = await import('../components/staking/StakingHistory');

  const events = [
    { id: '1', wallet_address: 'W', event_type: 'stake' as const, amount: 1000, rewards_amount: null, signature: 'sig1', created_at: '2026-01-01T00:00:00Z' },
    { id: '2', wallet_address: 'W', event_type: 'reward_claimed' as const, amount: 5, rewards_amount: 5, signature: null, created_at: '2026-02-01T00:00:00Z' },
  ];

  it('renders history events', () => {
    render(<StakingHistory items={events} total={2} page={1} onPageChange={vi.fn()} />);
    expect(screen.getByText('Staked')).toBeTruthy();
    expect(screen.getByText('Rewards claimed')).toBeTruthy();
  });

  it('shows empty state', () => {
    render(<StakingHistory items={[]} total={0} page={1} onPageChange={vi.fn()} />);
    expect(screen.getByTestId('staking-history-empty')).toBeTruthy();
  });

  it('renders pagination when multiple pages', () => {
    render(<StakingHistory items={events} total={25} page={1} onPageChange={vi.fn()} perPage={10} />);
    expect(screen.getByText('Page 1 of 3 · 25 events')).toBeTruthy();
  });
});
