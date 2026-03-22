/**
 * EscrowPanel — Main escrow integration component for the bounty detail page.
 * Orchestrates the escrow status display, deposit/release/refund flows,
 * and transaction confirmation modals. Determines which actions are available
 * based on the escrow state, bounty status, and connected wallet.
 *
 * @module components/escrow/EscrowPanel
 */

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNetwork } from '../wallet/WalletProvider';
import { useEscrow } from '../../hooks/useEscrow';
import { EscrowStatusDisplay } from './EscrowStatusDisplay';
import { EscrowDepositModal } from './EscrowDepositModal';
import { EscrowReleaseModal } from './EscrowReleaseModal';
import { EscrowRefundModal } from './EscrowRefundModal';
import { TransactionConfirmation } from './TransactionConfirmation';
import type { EscrowState } from '../../types/escrow';

/** Props for the EscrowPanel component. */
export interface EscrowPanelProps {
  /** The bounty ID to manage escrow for. */
  readonly bountyId: string;
  /** The reward amount for the bounty (display units). */
  readonly rewardAmount: number;
  /** The current status of the bounty. */
  readonly bountyStatus: string;
  /** The wallet address of the bounty creator/owner. */
  readonly ownerWallet?: string;
  /** The wallet address of the winning contributor (if any). */
  readonly contributorWallet?: string;
  /** Callback when a deposit is completed successfully. */
  readonly onDepositComplete?: (signature: string) => void;
  /** Callback when a release is completed successfully. */
  readonly onReleaseComplete?: (signature: string) => void;
  /** Callback when a refund is completed successfully. */
  readonly onRefundComplete?: (signature: string) => void;
}

/** Determine which modal is currently open. */
type ActiveModal = 'none' | 'deposit' | 'release' | 'refund';

/**
 * EscrowPanel is the main integration component that combines the escrow
 * status display with all three transaction flows (deposit, release, refund).
 *
 * It determines which actions are available based on:
 * - The escrow state (unfunded -> deposit, funded/locked -> release or refund)
 * - The bounty status (expired/cancelled -> refund available)
 * - The connected wallet (only the owner can deposit, release, or refund)
 *
 * Placed in the sidebar of the bounty detail page alongside the quick stats panel.
 */
export function EscrowPanel({
  bountyId,
  rewardAmount,
  bountyStatus,
  ownerWallet,
  contributorWallet,
  onDepositComplete,
  onReleaseComplete,
  onRefundComplete,
}: EscrowPanelProps) {
  const { publicKey, connected } = useWallet();
  const { network } = useNetwork();
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');

  const {
    escrowAccount,
    isLoading,
    queryError,
    transactionProgress,
    deposit,
    release,
    refund,
    resetTransaction,
  } = useEscrow(bountyId);

  const walletAddress = publicKey?.toBase58() ?? '';
  const isOwner = Boolean(ownerWallet && walletAddress === ownerWallet);
  const escrowState: EscrowState = escrowAccount?.state ?? 'unfunded';
  const lockedAmount = escrowAccount?.lockedAmount ?? rewardAmount;

  /** Determine whether the deposit action should be available. */
  const canDeposit =
    connected &&
    isOwner &&
    (escrowState === 'unfunded') &&
    ['open', 'in_progress', 'in-progress'].includes(bountyStatus);

  /** Determine whether the release action should be available. */
  const canRelease =
    connected &&
    isOwner &&
    ['funded', 'locked'].includes(escrowState) &&
    Boolean(contributorWallet);

  /** Determine whether the refund action should be available. */
  const canRefund =
    connected &&
    isOwner &&
    ['funded', 'locked', 'expired'].includes(escrowState) &&
    ['expired', 'cancelled'].includes(bountyStatus);

  /**
   * Handle deposit confirmation. Closes the modal and initiates the on-chain deposit.
   */
  const handleDeposit = useCallback(async () => {
    setActiveModal('none');
    try {
      const signature = await deposit(rewardAmount);
      onDepositComplete?.(signature);
    } catch {
      // Error is tracked in transactionProgress
    }
  }, [deposit, rewardAmount, onDepositComplete]);

  /**
   * Handle release confirmation. Closes the modal and initiates the on-chain release.
   */
  const handleRelease = useCallback(async () => {
    setActiveModal('none');
    if (!contributorWallet) return;
    try {
      const signature = await release(contributorWallet);
      onReleaseComplete?.(signature);
    } catch {
      // Error is tracked in transactionProgress
    }
  }, [release, contributorWallet, onReleaseComplete]);

  /**
   * Handle refund confirmation. Closes the modal and initiates the on-chain refund.
   */
  const handleRefund = useCallback(async () => {
    setActiveModal('none');
    try {
      const signature = await refund();
      onRefundComplete?.(signature);
    } catch {
      // Error is tracked in transactionProgress
    }
  }, [refund, onRefundComplete]);

  /** Map the operation type to a user-friendly title for the confirmation modal. */
  const operationTitleMap: Record<string, string> = {
    deposit: 'Depositing $FNDRY to Escrow',
    release: 'Releasing $FNDRY to Contributor',
    refund: 'Refunding $FNDRY to Your Wallet',
  };

  const operationTitle =
    transactionProgress.operationType
      ? operationTitleMap[transactionProgress.operationType] ?? 'Processing Transaction'
      : 'Processing Transaction';

  return (
    <div className="space-y-4" data-testid="escrow-panel">
      {/* Escrow status display */}
      <EscrowStatusDisplay
        escrowAccount={escrowAccount}
        isLoading={isLoading}
        errorMessage={queryError}
        network={network}
      />

      {/* Action buttons — only shown to the bounty owner */}
      {connected && isOwner && (
        <div className="bg-gray-900 rounded-lg p-4 sm:p-6 space-y-3">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
            Escrow Actions
          </h3>

          {canDeposit && (
            <button
              type="button"
              onClick={() => setActiveModal('deposit')}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-green-500 text-white font-bold hover:from-purple-500 hover:to-green-400 transition-all min-h-[44px]"
              data-testid="deposit-button"
            >
              Fund Bounty — {rewardAmount.toLocaleString()} $FNDRY
            </button>
          )}

          {canRelease && (
            <button
              type="button"
              onClick={() => setActiveModal('release')}
              className="w-full py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-500 transition-colors min-h-[44px]"
              data-testid="release-button"
            >
              Release to Contributor
            </button>
          )}

          {canRefund && (
            <button
              type="button"
              onClick={() => setActiveModal('refund')}
              className="w-full py-3 rounded-lg bg-yellow-600 text-white font-bold hover:bg-yellow-500 transition-colors min-h-[44px]"
              data-testid="refund-button"
            >
              Refund to Wallet
            </button>
          )}

          {!canDeposit && !canRelease && !canRefund && (
            <p className="text-xs text-gray-500 text-center py-2">
              {escrowState === 'released'
                ? 'Funds have been released to the contributor.'
                : escrowState === 'refunded'
                  ? 'Funds have been refunded to your wallet.'
                  : 'No escrow actions available for the current state.'}
            </p>
          )}
        </div>
      )}

      {/* Wallet connection prompt for non-owners viewing unfunded escrow */}
      {!connected && escrowState === 'unfunded' && (
        <div className="bg-gray-900 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-400">
            Connect your wallet to fund this bounty.
          </p>
        </div>
      )}

      {/* Deposit modal */}
      <EscrowDepositModal
        isOpen={activeModal === 'deposit'}
        onClose={() => setActiveModal('none')}
        onConfirm={handleDeposit}
        amount={rewardAmount}
      />

      {/* Release modal */}
      <EscrowReleaseModal
        isOpen={activeModal === 'release'}
        onClose={() => setActiveModal('none')}
        onConfirm={handleRelease}
        amount={lockedAmount}
        contributorWallet={contributorWallet ?? ''}
      />

      {/* Refund modal */}
      <EscrowRefundModal
        isOpen={activeModal === 'refund'}
        onClose={() => setActiveModal('none')}
        onConfirm={handleRefund}
        amount={lockedAmount}
      />

      {/* Transaction confirmation overlay */}
      {transactionProgress.step !== 'idle' && (
        <TransactionConfirmation
          progress={transactionProgress}
          network={network}
          operationTitle={operationTitle}
          onRetry={() => {
            resetTransaction();
            /** Re-open the modal for the failed operation type. */
            const opType = transactionProgress.operationType;
            if (opType === 'deposit') setActiveModal('deposit');
            else if (opType === 'release') setActiveModal('release');
            else if (opType === 'refund') setActiveModal('refund');
          }}
          onClose={resetTransaction}
        />
      )}
    </div>
  );
}
