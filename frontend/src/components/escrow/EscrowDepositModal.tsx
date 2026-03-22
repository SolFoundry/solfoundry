/**
 * EscrowDepositModal — Modal for depositing $FNDRY tokens into a bounty escrow.
 * Shows the deposit amount, current wallet balance, post-deposit balance preview,
 * and an insufficient funds warning when applicable.
 *
 * Mobile-responsive with touch-friendly button targets (min-h 44px).
 * @module components/escrow/EscrowDepositModal
 */

import { useRef, useEffect } from 'react';
import { useFndryBalance } from '../../hooks/useFndryToken';

/** Props for the EscrowDepositModal component. */
export interface EscrowDepositModalProps {
  /** Whether the modal is visible. */
  readonly isOpen: boolean;
  /** Callback to close the modal. */
  readonly onClose: () => void;
  /** Callback when the user confirms the deposit. */
  readonly onConfirm: () => void;
  /** The amount of $FNDRY to deposit. */
  readonly amount: number;
}

/**
 * EscrowDepositModal displays a confirmation dialog before initiating
 * an escrow deposit transaction. Shows balance information and prevents
 * deposits when the wallet has insufficient funds.
 */
export function EscrowDepositModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
}: EscrowDepositModalProps) {
  const modalContentRef = useRef<HTMLDivElement>(null);
  const { balance, loading: balanceLoading } = useFndryBalance();

  useEffect(() => {
    if (!isOpen) return;

    /** Close modal on Escape key press. */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasInsufficientBalance = balance !== null && balance < amount;
  const balanceAfterDeposit = balance !== null ? Math.max(0, balance - amount) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm escrow deposit"
      onClick={(event) => {
        if (
          modalContentRef.current &&
          !modalContentRef.current.contains(event.target as Node)
        ) {
          onClose();
        }
      }}
    >
      <div
        ref={modalContentRef}
        className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Deposit to Escrow</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close deposit modal"
            className="h-8 w-8 rounded-lg text-gray-400 hover:text-white inline-flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Deposit amount display */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6 text-center">
          <p className="text-gray-400 text-sm mb-2">You are depositing</p>
          <p className="text-3xl font-bold text-green-400" data-testid="deposit-amount">
            {amount.toLocaleString()}
          </p>
          <p className="text-gray-400 text-sm mt-1">$FNDRY</p>
        </div>

        {/* Balance information */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Current balance</span>
            <span
              className={hasInsufficientBalance ? 'text-red-400' : 'text-white'}
              data-testid="current-balance"
            >
              {balanceLoading
                ? 'Loading...'
                : balance !== null
                  ? `${balance.toLocaleString()} $FNDRY`
                  : 'Error loading balance'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">After deposit</span>
            <span className="text-white" data-testid="balance-after">
              {balanceAfterDeposit !== null
                ? `${balanceAfterDeposit.toLocaleString()} $FNDRY`
                : '--'}
            </span>
          </div>
        </div>

        {/* Escrow information notice */}
        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 mb-6">
          <p className="text-yellow-400 text-xs leading-relaxed">
            Funds will be locked in a Solana escrow PDA until the bounty is completed or
            cancelled. You can reclaim funds if the bounty expires without a winner.
            This transaction requires wallet approval.
          </p>
        </div>

        {/* Insufficient balance warning */}
        {hasInsufficientBalance && (
          <div
            className="bg-red-900/20 border border-red-700/30 rounded-lg p-3 mb-4"
            role="alert"
          >
            <p className="text-red-400 text-xs">
              You need {Math.ceil(amount - (balance || 0)).toLocaleString()} more $FNDRY
              to complete this deposit.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={hasInsufficientBalance || balanceLoading}
            className="flex-1 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-green-500 text-white font-bold hover:from-purple-500 hover:to-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            data-testid="confirm-deposit-button"
          >
            {hasInsufficientBalance ? 'Insufficient Balance' : 'Approve & Deposit'}
          </button>
        </div>
      </div>
    </div>
  );
}
