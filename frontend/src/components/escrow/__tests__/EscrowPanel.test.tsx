/**
 * Tests for the EscrowPanel component and its child modals.
 * Validates rendering of escrow status, action buttons, modal interactions,
 * proper state handling for deposit/release/refund flows, real-time indicator,
 * wallet adapter auth, and the 'sending' step in transaction progress.
 *
 * Uses mocked wallet adapter and React Query provider to isolate component logic.
 * @module components/escrow/__tests__/EscrowPanel.test
 */

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { EscrowPanel } from '../EscrowPanel';
import { EscrowDepositModal } from '../EscrowDepositModal';
import { EscrowReleaseModal } from '../EscrowReleaseModal';
import { EscrowRefundModal } from '../EscrowRefundModal';
import { EscrowStatusDisplay } from '../EscrowStatusDisplay';
import { TransactionConfirmation } from '../TransactionConfirmation';
import type { EscrowAccount } from '../../../types/escrow';

// ── Mocks ──────────────────────────────────────────────────────────────────────

/** Mock the Solana wallet adapter hook using the wallet adapter as single source of truth. */
const mockPublicKey = { toBase58: () => 'OwnerWallet111111111111111111111111111111' };

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(() => ({
    publicKey: mockPublicKey,
    connected: true,
    sendTransaction: vi.fn(),
  })),
  useConnection: vi.fn(() => ({
    connection: {
      getAccountInfo: vi.fn().mockResolvedValue(null),
      confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
      onAccountChange: vi.fn().mockReturnValue(1),
      removeAccountChangeListener: vi.fn(),
    },
  })),
}));

/** Mock the WalletProvider's useNetwork hook. */
vi.mock('../../wallet/WalletProvider', () => ({
  useNetwork: () => ({ network: 'devnet', endpoint: 'https://api.devnet.solana.com' }),
}));

/** Mock the useEscrow hook to control escrow state in tests. */
const mockDeposit = vi.fn().mockResolvedValue('mock-deposit-sig');
const mockRelease = vi.fn().mockResolvedValue('mock-release-sig');
const mockRefund = vi.fn().mockResolvedValue('mock-refund-sig');
const mockResetTransaction = vi.fn();

let mockEscrowData: Partial<ReturnType<typeof import('../../../hooks/useEscrow').useEscrow>> = {
  escrowAccount: null,
  isLoading: false,
  queryError: null,
  transactionProgress: { step: 'idle', signature: null, errorMessage: null, operationType: null },
  transactions: [],
  transactionsLoading: false,
  isRealtimeConnected: false,
  deposit: mockDeposit,
  release: mockRelease,
  refund: mockRefund,
  resetTransaction: mockResetTransaction,
};

vi.mock('../../../hooks/useEscrow', () => ({
  useEscrow: () => mockEscrowData,
  escrowKeys: {
    all: ['escrow'],
    account: (id: string) => ['escrow', 'account', id],
    transactions: (id: string) => ['escrow', 'transactions', id],
  },
}));

/** Mock the useFndryBalance hook for the deposit modal. */
vi.mock('../../../hooks/useFndryToken', () => ({
  useFndryBalance: () => ({ balance: 500_000, rawBalance: BigInt(500000000000000), loading: false, error: null, refetch: vi.fn() }),
  useBountyEscrow: () => ({ fundBounty: vi.fn(), transaction: { status: 'idle', signature: null, error: null }, reset: vi.fn() }),
}));

/** Mock constants to avoid PublicKey construction issues in test. */
vi.mock('../../../config/constants', () => ({
  solscanTxUrl: (sig: string, net: string) => `https://solscan.io/tx/${sig}?cluster=${net}`,
  solscanAddressUrl: (addr: string, net: string) => `https://solscan.io/account/${addr}?cluster=${net}`,
  ESCROW_PROGRAM_ID: { toBase58: () => 'FNDRYEscrow11111111111111111111111111111111' },
  FNDRY_TOKEN_MINT: { toBuffer: () => Buffer.alloc(32) },
  FNDRY_DECIMALS: 9,
  TOKEN_PROGRAM_ID: { toBuffer: () => Buffer.alloc(32) },
  ASSOCIATED_TOKEN_PROGRAM_ID: { toBuffer: () => Buffer.alloc(32) },
  deriveEscrowPda: vi.fn().mockResolvedValue([{ toBase58: () => 'PDA111' }, 255]),
  findAssociatedTokenAddress: vi.fn().mockResolvedValue({ toBase58: () => 'ATA1111' }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Create a fresh QueryClient for each test to avoid cache leaks. */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
}

/** Render a component wrapped in QueryClientProvider. */
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

/** Factory for creating mock escrow accounts with sensible defaults. */
function createMockEscrowAccount(overrides?: Partial<EscrowAccount>): EscrowAccount {
  return {
    escrowAddress: 'Escrow111111111111111111111111111111111111',
    bountyId: 'bounty-123',
    state: 'funded',
    lockedAmount: 350_000,
    lockedAmountRaw: '350000000000000',
    ownerWallet: 'OwnerWallet111111111111111111111111111111',
    contributorWallet: undefined,
    transactions: [],
    createdAt: '2026-03-20T00:00:00Z',
    updatedAt: '2026-03-20T12:00:00Z',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('EscrowPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEscrowData = {
      escrowAccount: null,
      isLoading: false,
      queryError: null,
      transactionProgress: { step: 'idle', signature: null, errorMessage: null, operationType: null },
      transactions: [],
      transactionsLoading: false,
      isRealtimeConnected: false,
      deposit: mockDeposit,
      release: mockRelease,
      refund: mockRefund,
      resetTransaction: mockResetTransaction,
    };
  });

  it('renders the escrow panel with unfunded state', () => {
    renderWithProviders(
      <EscrowPanel
        bountyId="bounty-123"
        rewardAmount={350_000}
        bountyStatus="open"
        ownerWallet="OwnerWallet111111111111111111111111111111"
      />,
    );

    expect(screen.getByTestId('escrow-panel')).toBeInTheDocument();
    expect(screen.getByText('Escrow Status')).toBeInTheDocument();
  });

  it('shows deposit button when user is owner and escrow is unfunded', () => {
    renderWithProviders(
      <EscrowPanel
        bountyId="bounty-123"
        rewardAmount={350_000}
        bountyStatus="open"
        ownerWallet="OwnerWallet111111111111111111111111111111"
      />,
    );

    expect(screen.getByTestId('deposit-button')).toBeInTheDocument();
    expect(screen.getByTestId('deposit-button')).toHaveTextContent('Fund Bounty');
  });

  it('shows release button when escrow is funded and contributor assigned', () => {
    mockEscrowData.escrowAccount = createMockEscrowAccount({ state: 'funded' });

    renderWithProviders(
      <EscrowPanel
        bountyId="bounty-123"
        rewardAmount={350_000}
        bountyStatus="completed"
        ownerWallet="OwnerWallet111111111111111111111111111111"
        contributorWallet="ContribWallet111111111111111111111111111"
      />,
    );

    expect(screen.getByTestId('release-button')).toBeInTheDocument();
    expect(screen.getByTestId('release-button')).toHaveTextContent('Release to Contributor');
  });

  it('shows refund button when bounty is expired and escrow is funded', () => {
    mockEscrowData.escrowAccount = createMockEscrowAccount({ state: 'funded' });

    renderWithProviders(
      <EscrowPanel
        bountyId="bounty-123"
        rewardAmount={350_000}
        bountyStatus="expired"
        ownerWallet="OwnerWallet111111111111111111111111111111"
      />,
    );

    expect(screen.getByTestId('refund-button')).toBeInTheDocument();
    expect(screen.getByTestId('refund-button')).toHaveTextContent('Refund to Wallet');
  });

  it('hides action buttons when user is not the owner (wallet adapter check)', () => {
    renderWithProviders(
      <EscrowPanel
        bountyId="bounty-123"
        rewardAmount={350_000}
        bountyStatus="open"
        ownerWallet="DifferentOwner111111111111111111111111111"
      />,
    );

    expect(screen.queryByTestId('deposit-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('release-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('refund-button')).not.toBeInTheDocument();
  });

  it('opens deposit modal on deposit button click', async () => {
    renderWithProviders(
      <EscrowPanel
        bountyId="bounty-123"
        rewardAmount={350_000}
        bountyStatus="open"
        ownerWallet="OwnerWallet111111111111111111111111111111"
      />,
    );

    await userEvent.click(screen.getByTestId('deposit-button'));

    expect(screen.getByText('Deposit to Escrow')).toBeInTheDocument();
    expect(screen.getByTestId('deposit-amount')).toHaveTextContent('350,000');
  });

  it('calls deposit function when deposit is confirmed', async () => {
    renderWithProviders(
      <EscrowPanel
        bountyId="bounty-123"
        rewardAmount={350_000}
        bountyStatus="open"
        ownerWallet="OwnerWallet111111111111111111111111111111"
      />,
    );

    await userEvent.click(screen.getByTestId('deposit-button'));
    await userEvent.click(screen.getByTestId('confirm-deposit-button'));

    expect(mockDeposit).toHaveBeenCalledWith(350_000);
  });

  it('opens release modal on release button click', async () => {
    mockEscrowData.escrowAccount = createMockEscrowAccount({ state: 'locked' });

    renderWithProviders(
      <EscrowPanel
        bountyId="bounty-123"
        rewardAmount={350_000}
        bountyStatus="completed"
        ownerWallet="OwnerWallet111111111111111111111111111111"
        contributorWallet="ContribWallet111111111111111111111111111"
      />,
    );

    await userEvent.click(screen.getByTestId('release-button'));

    expect(screen.getByText('Release Escrow Funds')).toBeInTheDocument();
    expect(screen.getByTestId('release-amount')).toHaveTextContent('350,000');
  });

  it('opens refund modal on refund button click', async () => {
    mockEscrowData.escrowAccount = createMockEscrowAccount({ state: 'expired' });

    renderWithProviders(
      <EscrowPanel
        bountyId="bounty-123"
        rewardAmount={350_000}
        bountyStatus="cancelled"
        ownerWallet="OwnerWallet111111111111111111111111111111"
      />,
    );

    await userEvent.click(screen.getByTestId('refund-button'));

    expect(screen.getByText('Refund Escrow')).toBeInTheDocument();
    expect(screen.getByTestId('refund-amount')).toHaveTextContent('350,000');
  });

  it('shows message when escrow is released and no actions available', () => {
    mockEscrowData.escrowAccount = createMockEscrowAccount({ state: 'released' });

    renderWithProviders(
      <EscrowPanel
        bountyId="bounty-123"
        rewardAmount={350_000}
        bountyStatus="completed"
        ownerWallet="OwnerWallet111111111111111111111111111111"
      />,
    );

    expect(screen.getByText('Funds have been released to the contributor.')).toBeInTheDocument();
  });

  it('does not show deposit button when wallet is not the owner', () => {
    renderWithProviders(
      <EscrowPanel
        bountyId="bounty-123"
        rewardAmount={350_000}
        bountyStatus="open"
        ownerWallet="SomeOtherOwnerWallet11111111111111111111"
      />,
    );

    expect(screen.queryByTestId('deposit-button')).not.toBeInTheDocument();
  });

  it('shows loading state in escrow status', () => {
    mockEscrowData.isLoading = true;

    renderWithProviders(
      <EscrowPanel
        bountyId="bounty-123"
        rewardAmount={350_000}
        bountyStatus="open"
        ownerWallet="OwnerWallet111111111111111111111111111111"
      />,
    );

    expect(screen.getByRole('status', { name: /loading escrow/i })).toBeInTheDocument();
  });
});

describe('EscrowStatusDisplay', () => {
  it('renders funded state correctly', () => {
    const account = createMockEscrowAccount({ state: 'funded', lockedAmount: 100_000 });

    render(
      <EscrowStatusDisplay
        escrowAccount={account}
        isLoading={false}
        errorMessage={null}
        network="devnet"
      />,
    );

    expect(screen.getByTestId('escrow-state')).toHaveTextContent('Funded');
    expect(screen.getByTestId('escrow-locked-amount')).toHaveTextContent('100,000 $FNDRY');
  });

  it('renders unfunded state when no escrow account', () => {
    render(
      <EscrowStatusDisplay
        escrowAccount={null}
        isLoading={false}
        errorMessage={null}
        network="devnet"
      />,
    );

    expect(screen.getByTestId('escrow-state')).toHaveTextContent('Awaiting Funding');
  });

  it('renders error state', () => {
    render(
      <EscrowStatusDisplay
        escrowAccount={null}
        isLoading={false}
        errorMessage="Failed to fetch escrow data"
        network="devnet"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch escrow data');
  });

  it('renders loading skeleton', () => {
    render(
      <EscrowStatusDisplay
        escrowAccount={null}
        isLoading={true}
        errorMessage={null}
        network="devnet"
      />,
    );

    expect(screen.getByRole('status', { name: /loading escrow/i })).toBeInTheDocument();
  });

  it('renders transaction history with explorer links', () => {
    const account = createMockEscrowAccount({
      transactions: [
        {
          id: 'tx-1',
          signature: 'abc123def456',
          type: 'deposit',
          amountRaw: '100000000000000',
          amountDisplay: 100_000,
          confirmedAt: '2026-03-20T10:00:00Z',
          signer: 'OwnerWallet111111111111111111111111111111',
        },
      ],
    });

    render(
      <EscrowStatusDisplay
        escrowAccount={account}
        isLoading={false}
        errorMessage={null}
        network="devnet"
      />,
    );

    expect(screen.getByText('Transaction History')).toBeInTheDocument();
    expect(screen.getByText('Deposit')).toBeInTheDocument();
  });

  it('renders all escrow states correctly', () => {
    const states = ['unfunded', 'funded', 'locked', 'released', 'refunded', 'expired'] as const;
    const expectedLabels = [
      'Awaiting Funding',
      'Funded',
      'Locked in Escrow',
      'Released to Contributor',
      'Refunded to Owner',
      'Expired — Refund Available',
    ];

    states.forEach((state, index) => {
      const account = createMockEscrowAccount({ state, lockedAmount: 1000 });
      const { unmount } = render(
        <EscrowStatusDisplay
          escrowAccount={account}
          isLoading={false}
          errorMessage={null}
          network="devnet"
        />,
      );

      expect(screen.getByTestId('escrow-state')).toHaveTextContent(expectedLabels[index]);
      unmount();
    });
  });

  it('shows real-time connection indicator when connected', () => {
    render(
      <EscrowStatusDisplay
        escrowAccount={null}
        isLoading={false}
        errorMessage={null}
        network="devnet"
        isRealtimeConnected={true}
      />,
    );

    const indicator = screen.getByTestId('realtime-indicator');
    expect(indicator).toHaveTextContent('Live');
  });

  it('shows polling indicator when not connected to real-time', () => {
    render(
      <EscrowStatusDisplay
        escrowAccount={null}
        isLoading={false}
        errorMessage={null}
        network="devnet"
        isRealtimeConnected={false}
      />,
    );

    const indicator = screen.getByTestId('realtime-indicator');
    expect(indicator).toHaveTextContent('Polling');
  });

  it('renders escrow PDA address link', () => {
    const account = createMockEscrowAccount();

    render(
      <EscrowStatusDisplay
        escrowAccount={account}
        isLoading={false}
        errorMessage={null}
        network="devnet"
      />,
    );

    const link = screen.getByTestId('escrow-address-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent('Escrow PDA:');
  });
});

describe('EscrowDepositModal', () => {
  it('renders deposit amount and balance', () => {
    render(
      <EscrowDepositModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        amount={350_000}
      />,
    );

    expect(screen.getByText('Deposit to Escrow')).toBeInTheDocument();
    expect(screen.getByTestId('deposit-amount')).toHaveTextContent('350,000');
    expect(screen.getByTestId('current-balance')).toHaveTextContent('500,000 $FNDRY');
  });

  it('calculates post-deposit balance', () => {
    render(
      <EscrowDepositModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        amount={350_000}
      />,
    );

    expect(screen.getByTestId('balance-after')).toHaveTextContent('150,000 $FNDRY');
  });

  it('does not render when closed', () => {
    render(
      <EscrowDepositModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        amount={350_000}
      />,
    );

    expect(screen.queryByText('Deposit to Escrow')).not.toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();

    render(
      <EscrowDepositModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        amount={100_000}
      />,
    );

    await userEvent.click(screen.getByTestId('confirm-deposit-button'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const onClose = vi.fn();

    render(
      <EscrowDepositModal
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        amount={100_000}
      />,
    );

    await userEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();

    render(
      <EscrowDepositModal
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        amount={100_000}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows insufficient balance warning with specific amount', () => {
    render(
      <EscrowDepositModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        amount={600_000}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('100,000 more $FNDRY');
    expect(screen.getByTestId('confirm-deposit-button')).toBeDisabled();
  });

  it('enables confirm button when balance is sufficient', () => {
    render(
      <EscrowDepositModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        amount={100_000}
      />,
    );

    /** Balance is mocked at 500K, amount is 100K — button should NOT be disabled. */
    expect(screen.getByTestId('confirm-deposit-button')).not.toBeDisabled();
  });
});

describe('EscrowReleaseModal', () => {
  it('renders release amount and recipient wallet', () => {
    render(
      <EscrowReleaseModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        amount={350_000}
        contributorWallet="ContribWalletAddr111111111111111111111"
      />,
    );

    expect(screen.getByText('Release Escrow Funds')).toBeInTheDocument();
    expect(screen.getByTestId('release-amount')).toHaveTextContent('350,000');
    expect(screen.getByTestId('recipient-wallet')).toHaveTextContent('ContribW...1111');
  });

  it('calls onConfirm when release is confirmed', async () => {
    const onConfirm = vi.fn();

    render(
      <EscrowReleaseModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        amount={350_000}
        contributorWallet="ContribWallet111"
      />,
    );

    await userEvent.click(screen.getByTestId('confirm-release-button'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('does not render when closed', () => {
    render(
      <EscrowReleaseModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        amount={350_000}
        contributorWallet="ContribWallet111"
      />,
    );

    expect(screen.queryByText('Release Escrow Funds')).not.toBeInTheDocument();
  });

  it('describes Anchor program release in the warning notice', () => {
    render(
      <EscrowReleaseModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        amount={350_000}
        contributorWallet="ContribWallet111"
      />,
    );

    expect(screen.getByText(/Escrow Program/i)).toBeInTheDocument();
  });
});

describe('EscrowRefundModal', () => {
  it('renders refund amount', () => {
    render(
      <EscrowRefundModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        amount={250_000}
      />,
    );

    expect(screen.getByText('Refund Escrow')).toBeInTheDocument();
    expect(screen.getByTestId('refund-amount')).toHaveTextContent('250,000');
  });

  it('calls onConfirm when refund is confirmed', async () => {
    const onConfirm = vi.fn();

    render(
      <EscrowRefundModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        amount={250_000}
      />,
    );

    await userEvent.click(screen.getByTestId('confirm-refund-button'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('describes Anchor program refund in the notice', () => {
    render(
      <EscrowRefundModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        amount={250_000}
      />,
    );

    expect(screen.getByText(/Escrow Program/i)).toBeInTheDocument();
  });
});

describe('TransactionConfirmation', () => {
  it('does not render when step is idle', () => {
    render(
      <TransactionConfirmation
        progress={{ step: 'idle', signature: null, errorMessage: null, operationType: null }}
        network="devnet"
        onRetry={vi.fn()}
        onClose={vi.fn()}
        operationTitle="Depositing $FNDRY"
      />,
    );

    expect(screen.queryByText('Depositing $FNDRY')).not.toBeInTheDocument();
  });

  it('renders progress steps when transaction is confirming', () => {
    render(
      <TransactionConfirmation
        progress={{ step: 'confirming', signature: 'tx-sig-123', errorMessage: null, operationType: 'deposit' }}
        network="devnet"
        onRetry={vi.fn()}
        onClose={vi.fn()}
        operationTitle="Depositing $FNDRY"
      />,
    );

    expect(screen.getByText('Depositing $FNDRY')).toBeInTheDocument();
    expect(screen.getByText('Confirming')).toBeInTheDocument();
    expect(screen.getByText('Preparing')).toBeInTheDocument();
  });

  it('renders the sending step in progress tracker', () => {
    render(
      <TransactionConfirmation
        progress={{ step: 'sending', signature: 'tx-sig-abc', errorMessage: null, operationType: 'deposit' }}
        network="devnet"
        onRetry={vi.fn()}
        onClose={vi.fn()}
        operationTitle="Depositing $FNDRY"
      />,
    );

    expect(screen.getByText('Sending')).toBeInTheDocument();
    expect(screen.getByText('Submitting to Solana network')).toBeInTheDocument();
  });

  it('shows explorer link during sending step (not just confirmed)', () => {
    render(
      <TransactionConfirmation
        progress={{ step: 'sending', signature: 'tx-sig-abc', errorMessage: null, operationType: 'deposit' }}
        network="devnet"
        onRetry={vi.fn()}
        onClose={vi.fn()}
        operationTitle="Depositing $FNDRY"
      />,
    );

    expect(screen.getByTestId('explorer-link')).toBeInTheDocument();
    expect(screen.getByText('View on Solscan')).toBeInTheDocument();
  });

  it('shows explorer link during confirming step', () => {
    render(
      <TransactionConfirmation
        progress={{ step: 'confirming', signature: 'tx-sig-456', errorMessage: null, operationType: 'release' }}
        network="devnet"
        onRetry={vi.fn()}
        onClose={vi.fn()}
        operationTitle="Releasing $FNDRY"
      />,
    );

    expect(screen.getByTestId('explorer-link')).toBeInTheDocument();
  });

  it('renders confirmed state with Solscan link', () => {
    render(
      <TransactionConfirmation
        progress={{ step: 'confirmed', signature: 'tx-sig-456', errorMessage: null, operationType: 'deposit' }}
        network="devnet"
        onRetry={vi.fn()}
        onClose={vi.fn()}
        operationTitle="Depositing $FNDRY"
      />,
    );

    expect(screen.getByText('Transaction Confirmed!')).toBeInTheDocument();
    expect(screen.getByText('View on Solscan')).toBeInTheDocument();
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });

  it('renders error state with retry button', () => {
    render(
      <TransactionConfirmation
        progress={{ step: 'error', signature: null, errorMessage: 'Transaction was rejected in your wallet. No funds were moved.', operationType: 'deposit' }}
        network="devnet"
        onRetry={vi.fn()}
        onClose={vi.fn()}
        operationTitle="Depositing $FNDRY"
      />,
    );

    expect(screen.getByText('Transaction Failed')).toBeInTheDocument();
    expect(screen.getByText('Transaction was rejected in your wallet. No funds were moved.')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('shows explorer link on error when signature exists', () => {
    render(
      <TransactionConfirmation
        progress={{ step: 'error', signature: 'failed-sig', errorMessage: 'Error on chain', operationType: 'deposit' }}
        network="devnet"
        onRetry={vi.fn()}
        onClose={vi.fn()}
        operationTitle="Depositing $FNDRY"
      />,
    );

    expect(screen.getByTestId('explorer-link')).toBeInTheDocument();
  });

  it('calls onRetry when Try Again is clicked', async () => {
    const onRetry = vi.fn();

    render(
      <TransactionConfirmation
        progress={{ step: 'error', signature: null, errorMessage: 'Error', operationType: 'deposit' }}
        network="devnet"
        onRetry={onRetry}
        onClose={vi.fn()}
        operationTitle="Depositing $FNDRY"
      />,
    );

    await userEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('calls onClose when Continue is clicked after confirmation', async () => {
    const onClose = vi.fn();

    render(
      <TransactionConfirmation
        progress={{ step: 'confirmed', signature: 'sig-123', errorMessage: null, operationType: 'deposit' }}
        network="devnet"
        onRetry={vi.fn()}
        onClose={onClose}
        operationTitle="Depositing $FNDRY"
      />,
    );

    await userEvent.click(screen.getByText('Continue'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('has mobile-responsive buttons with min-h-[44px] and touch-manipulation', () => {
    render(
      <TransactionConfirmation
        progress={{ step: 'error', signature: null, errorMessage: 'Error', operationType: 'deposit' }}
        network="devnet"
        onRetry={vi.fn()}
        onClose={vi.fn()}
        operationTitle="Depositing $FNDRY"
      />,
    );

    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button.className).toContain('min-h-[44px]');
      expect(button.className).toContain('touch-manipulation');
    });
  });
});
