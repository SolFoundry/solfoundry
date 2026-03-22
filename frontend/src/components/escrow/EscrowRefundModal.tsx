/**
 * EscrowRefundModal — Confirmation modal for reclaiming escrowed $FNDRY
 * when a bounty expires without a winner or is cancelled by the owner.
 *
 * Only shown to the bounty owner. Displays the locked amount and confirms
 * the Anchor program refund will return tokens to the owner's wallet via the PDA.
 *
 * Mobile-responsive with touch-friendly targets and bottom-sheet layout on small screens.
 *
 * @module components/escrow/EscrowRefundModal
 */

import { useRef, useEffect } from 'react';

/** Props for the EscrowRefundModal component. */
export interface EscrowRefundModalProps {
  /** Whether the modal is visible. */
  readonly isOpen: boolean;
  /** Callback to close the modal. */
  readonly onClose: () => void;
  /** Callback when the user confirms the refund. */
  readonly onConfirm: () => void;
  /** The amount of $FNDRY to refund (display units). */
  readonly amount: number;
}

/**
 * EscrowRefundModal shows a confirmation dialog before initiating
 * a refund of escrowed funds back to the bounty owner's wallet.
 * Available when the bounty has expired or been cancelled.
 *
 * The Anchor escrow program validates eligibility (expired/cancelled state)
 * and its PDA authority signs the token transfer back to the owner.
 */
export function EscrowRefundModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
}: EscrowRefundModalProps) {
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    /** Close modal on Escape key press for keyboard accessibility. */
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm escrow refund"
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
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-gray-700 bg-gray-900 p-6 pb-safe max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Refund Escrow</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close refund modal"
            className="h-10 w-10 rounded-lg text-gray-400 hover:text-white inline-flex items-center justify-center transition-colors touch-manipulation"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Refund amount display */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6 text-center">
          <p className="text-gray-400 text-sm mb-2">Refunding to your wallet</p>
          <p className="text-3xl font-bold text-yellow-400" data-testid="refund-amount">
            {amount.toLocaleString()}
          </p>
          <p className="text-gray-400 text-sm mt-1">$FNDRY</p>
        </div>

        {/* Refund details */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Escrow balance</span>
            <span className="text-green-400 font-medium">
              {amount.toLocaleString()} $FNDRY
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Destination</span>
            <span className="text-white">Your connected wallet</span>
          </div>
        </div>

        {/* Information notice */}
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 mb-6">
          <p className="text-blue-400 text-xs leading-relaxed">
            The full escrow balance will be returned to your wallet via the SolFoundry
            Escrow Program. This is available because the bounty has expired or was
            cancelled without a successful submission. The program PDA validates
            eligibility before authorizing the transfer.
          </p>
        </div>

        {/* Action buttons with mobile touch targets */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors min-h-[44px] touch-manipulation active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 rounded-lg bg-yellow-600 text-white font-bold hover:bg-yellow-500 transition-colors min-h-[44px] touch-manipulation active:scale-[0.98]"
            data-testid="confirm-refund-button"
          >
            Refund to Wallet
          </button>
        </div>
      </div>
    </div>
  );
}
