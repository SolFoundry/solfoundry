/**
 * ClaimRewardsButton — Transaction-confirmed reward claiming for $FNDRY staking.
 *
 * Renders a button that triggers the claim rewards flow with full transaction
 * lifecycle display: signing -> confirming -> confirmed/error. Shows pending
 * reward amount and transaction signature on success.
 *
 * @module components/staking/ClaimRewardsButton
 */
import { useState, useCallback } from 'react';
import type { TransactionStatus, StakingTransactionResult } from '../../types/staking';

/** Props for the ClaimRewardsButton component. */
interface ClaimRewardsButtonProps {
  /** Amount of $FNDRY rewards available to claim. */
  pendingRewards: number;
  /** Whether the user's wallet is currently connected. */
  walletConnected: boolean;
  /** Current transaction status from the staking mutations hook. */
  transactionStatus: TransactionStatus;
  /** Error message from the most recent failed transaction. */
  transactionError: string | null;
  /** Signature of the most recent successful transaction. */
  lastSignature: string | null;
  /** Callback to execute the claim rewards transaction. */
  onClaim: () => Promise<StakingTransactionResult>;
  /** Callback to reset transaction state after viewing result. */
  onResetTransaction: () => void;
}

/**
 * Format a token amount for human-readable display.
 *
 * @param amount - Raw token amount.
 * @returns Formatted string with comma separators.
 */
function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US');
}

/**
 * ClaimRewardsButton — Claim accumulated staking rewards with transaction confirmation.
 *
 * States:
 * - Disabled: no pending rewards or wallet disconnected
 * - Ready: shows claim button with reward amount
 * - Signing: wallet signing prompt active
 * - Confirming: transaction submitted, awaiting on-chain confirmation
 * - Confirmed: success state with transaction signature link
 * - Error: failure state with descriptive error message
 */
export function ClaimRewardsButton({
  pendingRewards,
  walletConnected,
  transactionStatus,
  transactionError,
  lastSignature,
  onClaim,
  onResetTransaction,
}: ClaimRewardsButtonProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleClaimClick = useCallback(() => {
    setShowConfirmation(true);
  }, []);

  const handleConfirmClaim = useCallback(async () => {
    setShowConfirmation(false);
    await onClaim();
  }, [onClaim]);

  const handleCancelConfirmation = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  const handleDismissResult = useCallback(() => {
    onResetTransaction();
  }, [onResetTransaction]);

  const isDisabled = pendingRewards <= 0 || !walletConnected;
  const isTransacting = transactionStatus === 'signing' || transactionStatus === 'confirming';

  /* Transaction success state */
  if (transactionStatus === 'confirmed' && lastSignature) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4" data-testid="claim-success">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-semibold text-green-400">Rewards Claimed Successfully</span>
        </div>
        <p className="text-xs text-gray-400 font-mono break-all" data-testid="claim-signature">
          Tx: {lastSignature}
        </p>
        <a
          href={`https://solscan.io/tx/${lastSignature}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#9945FF] hover:underline mt-1 inline-block"
        >
          View on Solscan
        </a>
        <button
          type="button"
          onClick={handleDismissResult}
          className="mt-3 w-full rounded-lg bg-surface-200 px-3 py-2 text-xs text-gray-300 hover:bg-surface-300"
        >
          Dismiss
        </button>
      </div>
    );
  }

  /* Transaction error state */
  if (transactionStatus === 'error' && transactionError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4" data-testid="claim-error">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-sm font-semibold text-red-400">Claim Failed</span>
        </div>
        <p className="text-xs text-gray-400 mt-1" data-testid="claim-error-message">{transactionError}</p>
        <button
          type="button"
          onClick={handleDismissResult}
          className="mt-3 w-full rounded-lg bg-surface-200 px-3 py-2 text-xs text-gray-300 hover:bg-surface-300"
        >
          Dismiss
        </button>
      </div>
    );
  }

  /* Confirmation dialog */
  if (showConfirmation) {
    return (
      <div className="rounded-xl border border-[#9945FF]/30 bg-[#9945FF]/5 p-4" data-testid="claim-confirmation">
        <p className="text-sm text-white mb-2">
          Claim <span className="font-bold text-[#14F195]">{formatAmount(pendingRewards)} $FNDRY</span> in rewards?
        </p>
        <p className="text-xs text-gray-400 mb-3">
          This will send a transaction to your wallet for signing.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConfirmClaim}
            className="flex-1 rounded-lg bg-[#14F195] px-3 py-2 text-sm font-semibold text-black hover:bg-[#14F195]/90"
            data-testid="claim-confirm-button"
          >
            Confirm Claim
          </button>
          <button
            type="button"
            onClick={handleCancelConfirmation}
            className="flex-1 rounded-lg bg-surface-300 px-3 py-2 text-sm text-gray-300 hover:bg-surface-400"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  /* Transaction in-progress state */
  if (isTransacting) {
    return (
      <div className="rounded-xl border border-[#9945FF]/30 bg-[#9945FF]/5 p-4" data-testid="claim-transacting">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#9945FF] border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-sm font-semibold text-white">
              {transactionStatus === 'signing' ? 'Waiting for wallet signature...' : 'Confirming transaction...'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {transactionStatus === 'signing'
                ? 'Please approve the transaction in your wallet.'
                : 'Transaction sent. Waiting for network confirmation.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* Default: claim button */
  return (
    <div data-testid="claim-rewards-section">
      <button
        type="button"
        onClick={handleClaimClick}
        disabled={isDisabled}
        className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
          isDisabled
            ? 'bg-surface-300 text-gray-600 cursor-not-allowed'
            : 'bg-[#14F195] text-black hover:bg-[#14F195]/90 shadow-lg shadow-[#14F195]/20'
        }`}
        aria-label={
          !walletConnected
            ? 'Connect wallet to claim rewards'
            : pendingRewards <= 0
              ? 'No rewards to claim'
              : `Claim ${formatAmount(pendingRewards)} FNDRY rewards`
        }
        data-testid="claim-rewards-button"
      >
        {!walletConnected
          ? 'Connect Wallet to Claim'
          : pendingRewards <= 0
            ? 'No Rewards to Claim'
            : `Claim ${formatAmount(pendingRewards)} $FNDRY`}
      </button>
      {!walletConnected && (
        <p className="text-xs text-gray-500 text-center mt-2">
          Connect your Solana wallet to claim staking rewards.
        </p>
      )}
    </div>
  );
}
