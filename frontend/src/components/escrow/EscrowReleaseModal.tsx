/**
 * EscrowReleaseModal — Confirmation modal for releasing escrowed $FNDRY
 * from the bounty escrow PDA to the winning contributor's wallet.
 *
 * Only shown to bounty owners. Displays the contributor wallet, locked amount,
 * and requires explicit confirmation before signing the Anchor release instruction.
 *
 * Mobile-responsive with touch-friendly targets and bottom-sheet layout on small screens.
 *
 * @module components/escrow/EscrowReleaseModal
 */

import { useRef, useEffect } from 'react';

/** Props for the EscrowReleaseModal component. */
export interface EscrowReleaseModalProps {
  /** Whether the modal is visible. */
  readonly isOpen: boolean;
  /** Callback to close the modal. */
  readonly onClose: () => void;
  /** Callback when the user confirms the release. */
  readonly onConfirm: () => void;
  /** The amount of $FNDRY to release (display units). */
  readonly amount: number;
  /** The contributor wallet address receiving the funds. */
  readonly contributorWallet: string;
}

/**
 * EscrowReleaseModal shows a confirmation dialog before releasing
 * escrowed funds to a contributor. The bounty owner must approve
 * the Anchor program release instruction in their wallet.
 *
 * The escrow program's PDA authority handles the actual token transfer —
 * the owner's wallet only authorizes the instruction.
 */
export function EscrowReleaseModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
  contributorWallet,
}: EscrowReleaseModalProps) {
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

  /** Truncate a wallet address for display, showing first 8 and last 4 characters. */
  const truncatedWallet =
    contributorWallet.length > 12
      ? `${contributorWallet.slice(0, 8)}...${contributorWallet.slice(-4)}`
      : contributorWallet;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm escrow release"
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
          <h2 className="text-lg font-semibold text-white">Release Escrow Funds</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close release modal"
            className="h-10 w-10 rounded-lg text-gray-400 hover:text-white inline-flex items-center justify-center transition-colors touch-manipulation"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Release amount display */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6 text-center">
          <p className="text-gray-400 text-sm mb-2">Releasing to contributor</p>
          <p className="text-3xl font-bold text-green-400" data-testid="release-amount">
            {amount.toLocaleString()}
          </p>
          <p className="text-gray-400 text-sm mt-1">$FNDRY</p>
        </div>

        {/* Recipient details */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Recipient</span>
            <span
              className="text-white font-mono text-xs"
              title={contributorWallet}
              data-testid="recipient-wallet"
            >
              {truncatedWallet}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Amount</span>
            <span className="text-green-400 font-medium">
              {amount.toLocaleString()} $FNDRY
            </span>
          </div>
        </div>

        {/* Warning notice */}
        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 mb-6">
          <p className="text-yellow-400 text-xs leading-relaxed">
            This action is irreversible. The SolFoundry Escrow Program will transfer
            the $FNDRY tokens from the escrow PDA to the contributor's wallet.
            Only proceed if you are satisfied with the submitted work.
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
            className="flex-1 py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-500 transition-colors min-h-[44px] touch-manipulation active:scale-[0.98]"
            data-testid="confirm-release-button"
          >
            Release Funds
          </button>
        </div>
      </div>
    </div>
  );
}
