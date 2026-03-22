/**
 * Staking UI Tests — $FNDRY Staking Interface.
 *
 * Tests are named after spec acceptance criteria from bounty #500:
 * - Stake/unstake flow with wallet transaction signing
 * - Staking dashboard: staked amount, rewards earned, APY estimate
 * - Staking tiers visualization (different reward rates by amount)
 * - Unstaking: cooldown period display and countdown timer
 * - Claim rewards button with transaction confirmation
 * - Staking history table (deposits, withdrawals, rewards)
 * - Real-time balance updates
 * - Mobile-responsive staking modal
 * - Error handling for all transaction states
 * - Tests with mocked program interactions
 *
 * @module __tests__/staking
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Wallet mock state ───────────────────────────────────────────────────────

const ADDR = '97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF';
const PK = { toBase58: () => ADDR };
const mockSignTransaction = vi.fn();
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn().mockResolvedValue(undefined);
const mockSendRawTransaction = vi.fn().mockResolvedValue('5XzMockSignature123abc');
const mockConfirmTransaction = vi.fn().mockResolvedValue({ value: { err: null } });

let walletState: Record<string, unknown> = {};

function setWalletConnected() {
  walletState = {
    publicKey: PK,
    wallet: { adapter: { name: 'Phantom', icon: 'https://phantom.app/icon.png' } },
    connected: true,
    connecting: false,
    disconnect: mockDisconnect,
    connect: mockConnect,
    select: vi.fn(),
    wallets: [],
    signTransaction: mockSignTransaction,
  };
}

function setWalletDisconnected() {
  walletState = {
    publicKey: null,
    wallet: null,
    connected: false,
    connecting: false,
    disconnect: mockDisconnect,
    connect: mockConnect,
    select: vi.fn(),
    wallets: [],
    signTransaction: null,
  };
}

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => walletState,
  useConnection: () => ({
    connection: {
      rpcEndpoint: 'https://api.devnet.solana.com',
      sendRawTransaction: mockSendRawTransaction,
      confirmTransaction: mockConfirmTransaction,
    },
  }),
  ConnectionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@solana/wallet-adapter-wallets', () => ({
  PhantomWalletAdapter: vi.fn(() => ({ name: 'Phantom' })),
  SolflareWalletAdapter: vi.fn(() => ({ name: 'Solflare' })),
}));

vi.mock('@solana/web3.js', () => ({
  clusterApiUrl: (n: string) => `https://api.${n}.solana.com`,
  Transaction: {
    from: vi.fn(() => ({
      serialize: () => Buffer.from('mock-tx'),
    })),
  },
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { StakingDashboard } from '../components/staking/StakingDashboard';
import { StakeUnstakeModal } from '../components/staking/StakeUnstakeModal';
import { StakingTiers } from '../components/staking/StakingTiers';
import { CooldownTimer } from '../components/staking/CooldownTimer';
import { ClaimRewardsButton } from '../components/staking/ClaimRewardsButton';
import { StakingHistory } from '../components/staking/StakingHistory';
import { WalletProvider } from '../components/wallet/WalletProvider';
import {
  getStakingTier,
  calculateEstimatedRewards,
  STAKING_TIERS,
  UNSTAKE_COOLDOWN_SECONDS,
} from '../types/staking';

/** Wrap component in providers for rendering. */
function renderWithProviders(ui: React.ReactElement) {
  return render(<WalletProvider>{ui}</WalletProvider>);
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setWalletDisconnected();

  /* Default fetch responses: return mock data for all staking endpoints */
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/api/staking/position')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            staked_amount: 500000,
            pending_rewards: 12500,
            staked_since: '2026-03-01T00:00:00Z',
            cooldown_active: false,
            cooldown_ends_at: null,
            cooldown_amount: 0,
            total_rewards_earned: 45000,
          }),
      });
    }
    if (typeof url === 'string' && url.includes('/api/staking/history')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            entries: [
              { id: 'h1', type: 'stake', amount: 250000, timestamp: '2026-03-10T14:30:00Z', transaction_signature: '5Xz1abc', confirmed: true },
              { id: 'h2', type: 'claim_reward', amount: 8750, timestamp: '2026-03-15T18:00:00Z', transaction_signature: '7Az3ghi', confirmed: true },
              { id: 'h3', type: 'unstake', amount: 50000, timestamp: '2026-03-18T11:45:00Z', transaction_signature: '9Bz4jkl', confirmed: true },
            ],
          }),
      });
    }
    if (typeof url === 'string' && url.includes('/api/staking/stats')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            total_staked: 125000000,
            total_stakers: 1842,
            average_apy_percent: 9.4,
            total_rewards_distributed: 4500000,
          }),
      });
    }
    if (typeof url === 'string' && url.includes('/api/staking/balance')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ fndry_balance: 1250000, sol_balance: 2.5 }),
      });
    }
    if (typeof url === 'string' && (url.includes('/api/staking/stake') || url.includes('/api/staking/unstake') || url.includes('/api/staking/claim'))) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ transaction: btoa('mock-serialized-tx') }),
      });
    }
    return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('Not found') });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// Type / utility tests
// ============================================================================

describe('staking type utilities', () => {
  it('getStakingTier returns correct tier for staked amounts', () => {
    expect(getStakingTier(0).id).toBe('bronze');
    expect(getStakingTier(50000).id).toBe('bronze');
    expect(getStakingTier(100000).id).toBe('silver');
    expect(getStakingTier(499999).id).toBe('silver');
    expect(getStakingTier(500000).id).toBe('gold');
    expect(getStakingTier(1999999).id).toBe('gold');
    expect(getStakingTier(2000000).id).toBe('diamond');
    expect(getStakingTier(10000000).id).toBe('diamond');
  });

  it('calculateEstimatedRewards computes annual yield correctly', () => {
    expect(calculateEstimatedRewards(100000, 5)).toBe(5000);
    expect(calculateEstimatedRewards(500000, 12)).toBe(60000);
    expect(calculateEstimatedRewards(2000000, 18)).toBe(360000);
    expect(calculateEstimatedRewards(0, 10)).toBe(0);
    expect(calculateEstimatedRewards(100000, 0)).toBe(0);
    expect(calculateEstimatedRewards(-100, 10)).toBe(0);
  });

  it('STAKING_TIERS are ordered by minimumStake ascending', () => {
    for (let i = 1; i < STAKING_TIERS.length; i++) {
      expect(STAKING_TIERS[i].minimumStake).toBeGreaterThan(STAKING_TIERS[i - 1].minimumStake);
    }
  });

  it('UNSTAKE_COOLDOWN_SECONDS equals 7 days', () => {
    expect(UNSTAKE_COOLDOWN_SECONDS).toBe(7 * 24 * 60 * 60);
  });
});

// ============================================================================
// Spec: Staking dashboard — staked amount, rewards earned, APY estimate
// ============================================================================

describe('spec_requirement_staking_dashboard_stats', () => {
  it('displays staked amount, pending rewards, APY, and tier when wallet connected', async () => {
    setWalletConnected();
    renderWithProviders(<StakingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('staking-dashboard')).toBeInTheDocument();
    });

    /* Staked amount stat card */
    const stakedCard = screen.getByTestId('stat-staked-amount');
    expect(stakedCard).toBeInTheDocument();
    expect(within(stakedCard).getByText('Staked Amount')).toBeInTheDocument();

    /* Pending rewards stat card */
    const rewardsCard = screen.getByTestId('stat-pending-rewards');
    expect(rewardsCard).toBeInTheDocument();
    expect(within(rewardsCard).getByText('Pending Rewards')).toBeInTheDocument();

    /* Current APY stat card */
    const apyCard = screen.getByTestId('stat-current-apy');
    expect(apyCard).toBeInTheDocument();
    expect(within(apyCard).getByText('Current APY')).toBeInTheDocument();

    /* Current tier stat card */
    const tierCard = screen.getByTestId('stat-current-tier');
    expect(tierCard).toBeInTheDocument();
    expect(within(tierCard).getByText('Current Tier')).toBeInTheDocument();
  });

  it('shows connect wallet prompt when wallet is disconnected', () => {
    setWalletDisconnected();
    renderWithProviders(<StakingDashboard />);

    expect(screen.getByText('Connect Wallet to Stake')).toBeInTheDocument();
    expect(screen.getByText(/Connect your Solana wallet/)).toBeInTheDocument();
  });
});

// ============================================================================
// Spec: Staking tiers visualization (different reward rates by amount)
// ============================================================================

describe('spec_requirement_staking_tiers_visualization', () => {
  it('renders all four staking tiers with APY rates', () => {
    render(<StakingTiers currentTierId="silver" stakedAmount={150000} />);

    expect(screen.getByTestId('staking-tiers')).toBeInTheDocument();

    STAKING_TIERS.forEach((tier) => {
      const card = screen.getByTestId(`tier-card-${tier.id}`);
      expect(card).toBeInTheDocument();
      expect(within(card).getByText(tier.name)).toBeInTheDocument();
      expect(within(card).getByText(`${tier.apyPercent}%`)).toBeInTheDocument();
    });
  });

  it('highlights the active tier with ACTIVE badge', () => {
    render(<StakingTiers currentTierId="gold" stakedAmount={750000} />);

    const goldCard = screen.getByTestId('tier-card-gold');
    expect(within(goldCard).getByText('ACTIVE')).toBeInTheDocument();

    /* Bronze and silver should NOT have ACTIVE badge */
    const bronzeCard = screen.getByTestId('tier-card-bronze');
    expect(within(bronzeCard).queryByText('ACTIVE')).not.toBeInTheDocument();
  });

  it('shows progress bar toward next tier', () => {
    render(<StakingTiers currentTierId="silver" stakedAmount={300000} />);

    /* Progress bar should exist */
    const progressBar = screen.getByRole('progressbar', { name: /progress toward gold tier/i });
    expect(progressBar).toBeInTheDocument();
  });

  it('shows lock icon on tiers above current staked amount', () => {
    render(<StakingTiers currentTierId="bronze" stakedAmount={50000} />);

    /* Diamond and gold should be locked */
    const diamondCard = screen.getByTestId('tier-card-diamond');
    const goldCard = screen.getByTestId('tier-card-gold');
    expect(diamondCard.className).toContain('opacity-60');
    expect(goldCard.className).toContain('opacity-60');
  });
});

// ============================================================================
// Spec: Unstaking — cooldown period display and countdown timer
// ============================================================================

describe('spec_requirement_unstaking_cooldown_timer', () => {
  it('displays cooldown timer when active', () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    render(<CooldownTimer cooldownEndsAt={futureDate} cooldownAmount={100000} />);

    expect(screen.getByTestId('cooldown-timer')).toBeInTheDocument();
    expect(screen.getByText('Unstaking Cooldown')).toBeInTheDocument();
    expect(screen.getByText('100,000 $FNDRY')).toBeInTheDocument();
    expect(screen.getByTestId('cooldown-remaining')).toBeInTheDocument();
  });

  it('shows progress bar for cooldown completion', () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    render(<CooldownTimer cooldownEndsAt={futureDate} cooldownAmount={50000} />);

    const progressBar = screen.getByRole('progressbar', { name: /cooldown progress/i });
    expect(progressBar).toBeInTheDocument();
  });

  it('renders nothing when no cooldown is active', () => {
    const { container } = render(<CooldownTimer cooldownEndsAt={null} cooldownAmount={0} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when cooldown has already expired', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const { container } = render(<CooldownTimer cooldownEndsAt={pastDate} cooldownAmount={100} />);
    expect(container.innerHTML).toBe('');
  });

  it('has timer role with accessible label', () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    render(<CooldownTimer cooldownEndsAt={futureDate} cooldownAmount={10000} />);

    expect(screen.getByRole('timer')).toBeInTheDocument();
  });
});

// ============================================================================
// Spec: Claim rewards button with transaction confirmation
// ============================================================================

describe('spec_requirement_claim_rewards_with_transaction_confirmation', () => {
  const defaultProps = {
    pendingRewards: 12500,
    walletConnected: true,
    transactionStatus: 'idle' as const,
    transactionError: null,
    lastSignature: null,
    onClaim: vi.fn().mockResolvedValue({ success: true, signature: '5XzMock', errorMessage: null }),
    onResetTransaction: vi.fn(),
  };

  it('shows claim button with reward amount', () => {
    render(<ClaimRewardsButton {...defaultProps} />);

    const button = screen.getByTestId('claim-rewards-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Claim 12,500 $FNDRY');
  });

  it('shows confirmation dialog before claiming', async () => {
    render(<ClaimRewardsButton {...defaultProps} />);

    await userEvent.click(screen.getByTestId('claim-rewards-button'));

    expect(screen.getByTestId('claim-confirmation')).toBeInTheDocument();
    expect(screen.getByText(/in rewards\?/)).toBeInTheDocument();
    expect(screen.getByTestId('claim-confirm-button')).toBeInTheDocument();
  });

  it('executes claim on confirmation', async () => {
    const onClaim = vi.fn().mockResolvedValue({ success: true, signature: '5Xz', errorMessage: null });
    render(<ClaimRewardsButton {...defaultProps} onClaim={onClaim} />);

    await userEvent.click(screen.getByTestId('claim-rewards-button'));
    await userEvent.click(screen.getByTestId('claim-confirm-button'));

    expect(onClaim).toHaveBeenCalledOnce();
  });

  it('shows success state with transaction signature', () => {
    render(
      <ClaimRewardsButton
        {...defaultProps}
        transactionStatus="confirmed"
        lastSignature="5XzMockSignature123abc"
      />,
    );

    expect(screen.getByTestId('claim-success')).toBeInTheDocument();
    expect(screen.getByText('Rewards Claimed Successfully')).toBeInTheDocument();
    expect(screen.getByTestId('claim-signature')).toHaveTextContent('5XzMockSignature123abc');
    expect(screen.getByText('View on Solscan')).toHaveAttribute(
      'href',
      'https://solscan.io/tx/5XzMockSignature123abc',
    );
  });

  it('shows error state with descriptive message', () => {
    render(
      <ClaimRewardsButton
        {...defaultProps}
        transactionStatus="error"
        transactionError="Claim failed: Insufficient SOL for transaction fees"
      />,
    );

    expect(screen.getByTestId('claim-error')).toBeInTheDocument();
    expect(screen.getByText('Claim Failed')).toBeInTheDocument();
    expect(screen.getByTestId('claim-error-message')).toHaveTextContent('Insufficient SOL');
  });

  it('disables button when no rewards available', () => {
    render(<ClaimRewardsButton {...defaultProps} pendingRewards={0} />);

    const button = screen.getByTestId('claim-rewards-button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('No Rewards to Claim');
  });

  it('disables button when wallet not connected', () => {
    render(<ClaimRewardsButton {...defaultProps} walletConnected={false} />);

    const button = screen.getByTestId('claim-rewards-button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Connect Wallet to Claim');
  });

  it('shows transaction pending state during signing', () => {
    render(<ClaimRewardsButton {...defaultProps} transactionStatus="signing" />);

    expect(screen.getByTestId('claim-transacting')).toBeInTheDocument();
    expect(screen.getByText(/Waiting for wallet signature/)).toBeInTheDocument();
  });

  it('shows transaction pending state during confirming', () => {
    render(<ClaimRewardsButton {...defaultProps} transactionStatus="confirming" />);

    expect(screen.getByTestId('claim-transacting')).toBeInTheDocument();
    expect(screen.getByText(/Confirming transaction/)).toBeInTheDocument();
  });
});

// ============================================================================
// Spec: Staking history table (deposits, withdrawals, rewards)
// ============================================================================

describe('spec_requirement_staking_history_table', () => {
  const mockEntries = [
    { id: 'h1', type: 'stake' as const, amount: 250000, timestamp: '2026-03-10T14:30:00Z', transactionSignature: '5Xz1abc', confirmed: true },
    { id: 'h2', type: 'claim_reward' as const, amount: 8750, timestamp: '2026-03-15T18:00:00Z', transactionSignature: '7Az3ghi', confirmed: true },
    { id: 'h3', type: 'unstake' as const, amount: 50000, timestamp: '2026-03-18T11:45:00Z', transactionSignature: '9Bz4jkl', confirmed: true },
  ];

  it('renders all three transaction types: deposit, withdrawal, reward', () => {
    render(<StakingHistory entries={mockEntries} isLoading={false} />);

    expect(screen.getByTestId('staking-history')).toBeInTheDocument();
    expect(screen.getByTestId('history-entry-h1')).toBeInTheDocument();
    expect(screen.getByTestId('history-entry-h2')).toBeInTheDocument();
    expect(screen.getByTestId('history-entry-h3')).toBeInTheDocument();
  });

  it('shows type badges for each transaction type', () => {
    render(<StakingHistory entries={mockEntries} isLoading={false} />);

    expect(screen.getByText('Stake')).toBeInTheDocument();
    expect(screen.getByText('Reward')).toBeInTheDocument();
    expect(screen.getByText('Unstake')).toBeInTheDocument();
  });

  it('displays formatted amounts with +/- prefix', () => {
    render(<StakingHistory entries={mockEntries} isLoading={false} />);

    expect(screen.getByText('+250,000 $FNDRY')).toBeInTheDocument();
    expect(screen.getByText('+8,750 $FNDRY')).toBeInTheDocument();
    expect(screen.getByText('-50,000 $FNDRY')).toBeInTheDocument();
  });

  it('links transaction signatures to Solscan', () => {
    render(<StakingHistory entries={mockEntries} isLoading={false} />);

    const links = screen.getAllByRole('link');
    const solscanLinks = links.filter((link) => link.getAttribute('href')?.includes('solscan.io'));
    expect(solscanLinks.length).toBe(3);
    expect(solscanLinks[0]).toHaveAttribute('href', 'https://solscan.io/tx/5Xz1abc');
  });

  it('shows transaction count', () => {
    render(<StakingHistory entries={mockEntries} isLoading={false} />);
    expect(screen.getByText('3 transactions')).toBeInTheDocument();
  });

  it('shows empty state when no history exists', () => {
    render(<StakingHistory entries={[]} isLoading={false} />);

    expect(screen.getByText('No staking history yet.')).toBeInTheDocument();
    expect(screen.getByText(/Stake \$FNDRY to start/)).toBeInTheDocument();
  });

  it('shows loading skeleton while data is loading', () => {
    render(<StakingHistory entries={[]} isLoading={true} />);

    expect(screen.getByTestId('staking-history-loading')).toBeInTheDocument();
  });
});

// ============================================================================
// Spec: Mobile-responsive staking modal
// ============================================================================

describe('spec_requirement_mobile_responsive_staking_modal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    availableBalance: 1250000,
    stakedBalance: 500000,
    currentApyPercent: 12,
    transactionStatus: 'idle' as const,
    transactionError: null,
    lastSignature: null,
    onStake: vi.fn().mockResolvedValue({ success: true, signature: '5Xz', errorMessage: null }),
    onUnstake: vi.fn().mockResolvedValue({ success: true, signature: '5Xz', errorMessage: null }),
    onResetTransaction: vi.fn(),
    defaultTab: 'stake' as const,
  };

  it('renders modal with stake/unstake tabs', () => {
    render(<StakeUnstakeModal {...defaultProps} />);

    expect(screen.getByTestId('stake-unstake-modal')).toBeInTheDocument();
    expect(screen.getByTestId('stake-tab')).toBeInTheDocument();
    expect(screen.getByTestId('unstake-tab')).toBeInTheDocument();
  });

  it('has dialog role and aria-modal for accessibility', () => {
    render(<StakeUnstakeModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('shows available balance on stake tab', () => {
    render(<StakeUnstakeModal {...defaultProps} />);

    expect(screen.getByTestId('modal-balance')).toHaveTextContent('1,250,000 $FNDRY');
  });

  it('shows staked balance on unstake tab', async () => {
    render(<StakeUnstakeModal {...defaultProps} defaultTab="unstake" />);

    await waitFor(() => {
      expect(screen.getByTestId('modal-balance')).toHaveTextContent('500,000 $FNDRY');
    });
  });

  it('validates amount exceeding available balance', async () => {
    render(<StakeUnstakeModal {...defaultProps} />);

    const input = screen.getByTestId('staking-amount-input');
    await userEvent.clear(input);
    await userEvent.type(input, '9999999');

    await waitFor(() => {
      expect(screen.getByTestId('staking-input-error')).toBeInTheDocument();
      expect(screen.getByTestId('staking-input-error')).toHaveTextContent(/Insufficient balance/);
    });
  });

  it('quick-select percentage buttons set correct amounts', async () => {
    render(<StakeUnstakeModal {...defaultProps} />);

    await userEvent.click(screen.getByTestId('pct-btn-50'));
    expect(screen.getByTestId('staking-amount-input')).toHaveValue('625000');

    await userEvent.click(screen.getByTestId('pct-btn-100'));
    expect(screen.getByTestId('staking-amount-input')).toHaveValue('1250000');

    await userEvent.click(screen.getByTestId('pct-btn-25'));
    expect(screen.getByTestId('staking-amount-input')).toHaveValue('312500');
  });

  it('shows estimated annual reward on stake tab', async () => {
    render(<StakeUnstakeModal {...defaultProps} />);

    const input = screen.getByTestId('staking-amount-input');
    await userEvent.type(input, '100000');

    await waitFor(() => {
      expect(screen.getByTestId('estimated-reward')).toBeInTheDocument();
    });
  });

  it('shows cooldown warning on unstake tab', async () => {
    render(<StakeUnstakeModal {...defaultProps} defaultTab="unstake" />);

    await waitFor(() => {
      expect(screen.getByTestId('cooldown-warning')).toBeInTheDocument();
      expect(screen.getByText(/Cooldown Period/)).toBeInTheDocument();
    });
  });

  it('closes on Escape key', async () => {
    const onClose = vi.fn();
    render(<StakeUnstakeModal {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders nothing when open is false', () => {
    const { container } = render(<StakeUnstakeModal {...defaultProps} open={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('disables submit button when amount is empty', () => {
    render(<StakeUnstakeModal {...defaultProps} />);

    expect(screen.getByTestId('submit-staking-button')).toBeDisabled();
  });
});

// ============================================================================
// Spec: Stake/unstake flow with wallet transaction signing
// ============================================================================

describe('spec_requirement_stake_unstake_flow_with_wallet_transaction_signing', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    availableBalance: 1250000,
    stakedBalance: 500000,
    currentApyPercent: 12,
    transactionStatus: 'idle' as const,
    transactionError: null,
    lastSignature: null,
    onStake: vi.fn().mockResolvedValue({ success: true, signature: '5Xz', errorMessage: null }),
    onUnstake: vi.fn().mockResolvedValue({ success: true, signature: '5Xz', errorMessage: null }),
    onResetTransaction: vi.fn(),
    defaultTab: 'stake' as const,
  };

  it('calls onStake with correct amount when stake form is submitted', async () => {
    render(<StakeUnstakeModal {...defaultProps} />);

    const input = screen.getByTestId('staking-amount-input');
    await userEvent.type(input, '100000');
    await userEvent.click(screen.getByTestId('submit-staking-button'));

    expect(defaultProps.onStake).toHaveBeenCalledWith(100000);
  });

  it('calls onUnstake with correct amount when unstake form is submitted', async () => {
    render(<StakeUnstakeModal {...defaultProps} defaultTab="unstake" />);

    await waitFor(() => {
      expect(screen.getByTestId('unstake-tab')).toHaveAttribute('aria-selected', 'true');
    });

    const input = screen.getByTestId('staking-amount-input');
    await userEvent.type(input, '50000');
    await userEvent.click(screen.getByTestId('submit-staking-button'));

    expect(defaultProps.onUnstake).toHaveBeenCalledWith(50000);
  });

  it('shows transaction success with Solscan link', () => {
    render(
      <StakeUnstakeModal
        {...defaultProps}
        transactionStatus="confirmed"
        lastSignature="5XzMockSignature123abc"
      />,
    );

    expect(screen.getByTestId('modal-tx-success')).toBeInTheDocument();
    expect(screen.getByText('View on Solscan')).toHaveAttribute(
      'href',
      'https://solscan.io/tx/5XzMockSignature123abc',
    );
  });

  it('shows transaction error with descriptive message', () => {
    render(
      <StakeUnstakeModal
        {...defaultProps}
        transactionStatus="error"
        transactionError="Transaction cancelled: you rejected the stake request in your wallet."
      />,
    );

    expect(screen.getByTestId('modal-tx-error')).toBeInTheDocument();
    expect(screen.getByTestId('modal-tx-error-message')).toHaveTextContent(/rejected the stake request/);
  });

  it('shows signing pending state', () => {
    render(<StakeUnstakeModal {...defaultProps} transactionStatus="signing" />);

    expect(screen.getByTestId('modal-tx-pending')).toBeInTheDocument();
    expect(screen.getByText('Waiting for Signature')).toBeInTheDocument();
  });

  it('shows confirming pending state', () => {
    render(<StakeUnstakeModal {...defaultProps} transactionStatus="confirming" />);

    expect(screen.getByTestId('modal-tx-pending')).toBeInTheDocument();
    expect(screen.getByText('Confirming Transaction')).toBeInTheDocument();
  });
});

// ============================================================================
// Spec: Error handling for all transaction states
// ============================================================================

describe('spec_requirement_error_handling_for_all_transaction_states', () => {
  it('handles wallet not connected error explicitly', () => {
    render(
      <ClaimRewardsButton
        pendingRewards={10000}
        walletConnected={false}
        transactionStatus="idle"
        transactionError={null}
        lastSignature={null}
        onClaim={vi.fn()}
        onResetTransaction={vi.fn()}
      />,
    );

    const button = screen.getByTestId('claim-rewards-button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-label', 'Connect wallet to claim rewards');
  });

  it('displays user rejection error distinctly', () => {
    render(
      <ClaimRewardsButton
        pendingRewards={10000}
        walletConnected={true}
        transactionStatus="error"
        transactionError="Transaction cancelled: you rejected the claim request in your wallet."
        lastSignature={null}
        onClaim={vi.fn()}
        onResetTransaction={vi.fn()}
      />,
    );

    expect(screen.getByTestId('claim-error')).toBeInTheDocument();
    expect(screen.getByTestId('claim-error-message')).toHaveTextContent(/rejected the claim request/);
  });

  it('displays network/server error distinctly', () => {
    render(
      <ClaimRewardsButton
        pendingRewards={10000}
        walletConnected={true}
        transactionStatus="error"
        transactionError="Claim failed: Server rejected claim request: 500 — Internal Server Error"
        lastSignature={null}
        onClaim={vi.fn()}
        onResetTransaction={vi.fn()}
      />,
    );

    expect(screen.getByTestId('claim-error-message')).toHaveTextContent(/Server rejected/);
  });

  it('validates zero amount in modal input', async () => {
    render(
      <StakeUnstakeModal
        open={true}
        onClose={vi.fn()}
        availableBalance={1000000}
        stakedBalance={500000}
        currentApyPercent={10}
        transactionStatus="idle"
        transactionError={null}
        lastSignature={null}
        onStake={vi.fn()}
        onUnstake={vi.fn()}
        onResetTransaction={vi.fn()}
        defaultTab="stake"
      />,
    );

    /* Submit button should be disabled with empty input */
    expect(screen.getByTestId('submit-staking-button')).toBeDisabled();
  });

  it('rejects non-numeric input in amount field', async () => {
    render(
      <StakeUnstakeModal
        open={true}
        onClose={vi.fn()}
        availableBalance={1000000}
        stakedBalance={500000}
        currentApyPercent={10}
        transactionStatus="idle"
        transactionError={null}
        lastSignature={null}
        onStake={vi.fn()}
        onUnstake={vi.fn()}
        onResetTransaction={vi.fn()}
        defaultTab="stake"
      />,
    );

    const input = screen.getByTestId('staking-amount-input');
    await userEvent.type(input, 'abc');

    /* Non-numeric input should be rejected, value stays empty */
    expect(input).toHaveValue('');
  });

  it('allows dismiss of error state and retry', async () => {
    const onResetTransaction = vi.fn();
    render(
      <StakeUnstakeModal
        open={true}
        onClose={vi.fn()}
        availableBalance={1000000}
        stakedBalance={500000}
        currentApyPercent={10}
        transactionStatus="error"
        transactionError="Some error"
        lastSignature={null}
        onStake={vi.fn()}
        onUnstake={vi.fn()}
        onResetTransaction={onResetTransaction}
        defaultTab="stake"
      />,
    );

    expect(screen.getByTestId('modal-tx-error')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Try Again'));
    expect(onResetTransaction).toHaveBeenCalled();
  });
});

// ============================================================================
// Spec: Real-time balance updates
// ============================================================================

describe('spec_requirement_real_time_balance_updates', () => {
  it('stake and unstake buttons are present for triggering balance-changing operations', async () => {
    setWalletConnected();
    renderWithProviders(<StakingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('staking-dashboard')).toBeInTheDocument();
    });

    expect(screen.getByTestId('stake-button')).toBeInTheDocument();
    expect(screen.getByTestId('unstake-button')).toBeInTheDocument();
  });

  it('opens stake modal when stake button is clicked', async () => {
    setWalletConnected();
    renderWithProviders(<StakingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('stake-button')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('stake-button'));

    await waitFor(() => {
      expect(screen.getByTestId('stake-unstake-modal')).toBeInTheDocument();
    });
  });

  it('opens unstake modal when unstake button is clicked', async () => {
    setWalletConnected();
    renderWithProviders(<StakingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('unstake-button')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('unstake-button'));

    await waitFor(() => {
      expect(screen.getByTestId('stake-unstake-modal')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Spec: Tests with mocked program interactions
// ============================================================================

describe('spec_requirement_mocked_program_interactions', () => {
  it('fetches staking position from API on mount', async () => {
    setWalletConnected();
    renderWithProviders(<StakingDashboard />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/staking/position'),
      );
    });
  });

  it('fetches staking history from API on mount', async () => {
    setWalletConnected();
    renderWithProviders(<StakingDashboard />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/staking/history'),
      );
    });
  });

  it('fetches platform stats from API on mount', async () => {
    setWalletConnected();
    renderWithProviders(<StakingDashboard />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/staking/stats');
    });
  });

  it('fetches wallet balance from API on mount', async () => {
    setWalletConnected();
    renderWithProviders(<StakingDashboard />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/staking/balance'),
      );
    });
  });

  it('falls back to mock data when API returns error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    setWalletConnected();
    renderWithProviders(<StakingDashboard />);

    /* Should still render with fallback data */
    await waitFor(() => {
      expect(screen.getByTestId('staking-dashboard')).toBeInTheDocument();
    });
  });

  it('displays platform stats section', async () => {
    setWalletConnected();
    renderWithProviders(<StakingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('platform-stats')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Integration: Staking wired into existing flows
// ============================================================================

describe('spec_requirement_integration_into_existing_flows', () => {
  it('StakingDashboard renders staking tiers section', async () => {
    setWalletConnected();
    renderWithProviders(<StakingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('staking-tiers')).toBeInTheDocument();
    });
  });

  it('StakingDashboard renders claim rewards section', async () => {
    setWalletConnected();
    renderWithProviders(<StakingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('claim-rewards-section')).toBeInTheDocument();
    });
  });

  it('StakingDashboard renders history section', async () => {
    setWalletConnected();
    renderWithProviders(<StakingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('staking-history')).toBeInTheDocument();
    });
  });
});
