/**
 * TransactionConfirmation — Reusable multi-step transaction status modal.
 * Shows progress through building, approving, sending, confirming, and confirmed steps.
 * Displays Solana explorer links on confirmation and error retry on failure.
 *
 * @module components/escrow/TransactionConfirmation
 */

import { useRef, useEffect } from 'react';
import { solscanTxUrl } from '../../config/constants';
import type { EscrowTransactionProgress } from '../../types/escrow';
import type { SolanaNetwork } from '../../types/wallet';

/** Step definition for the transaction progress tracker. */
interface TransactionStep {
  /** Machine-readable key matching an EscrowTransactionStep. */
  readonly key: string;
  /** Human-readable label displayed in the UI. */
  readonly label: string;
  /** Short description of what happens at this step. */
  readonly description: string;
}

/** Ordered list of transaction steps displayed in the progress tracker. */
const TRANSACTION_STEPS: TransactionStep[] = [
  { key: 'building', label: 'Preparing', description: 'Building the transaction' },
  { key: 'approving', label: 'Wallet Approval', description: 'Approve in your wallet' },
  { key: 'sending', label: 'Sending', description: 'Submitting to Solana' },
  { key: 'confirming', label: 'Confirming', description: 'Waiting for network confirmation' },
  { key: 'confirmed', label: 'Confirmed', description: 'Transaction confirmed on-chain' },
];

/** Maps transaction step keys to their display order index. */
const STEP_ORDER: Record<string, number> = Object.fromEntries(
  TRANSACTION_STEPS.map((step, index) => [step.key, index]),
);

/** Props for the TransactionConfirmation component. */
export interface TransactionConfirmationProps {
  /** Current transaction progress state from useEscrow. */
  readonly progress: EscrowTransactionProgress;
  /** The Solana network for generating explorer URLs. */
  readonly network: SolanaNetwork;
  /** Callback when the user clicks "Try Again" after an error. */
  readonly onRetry: () => void;
  /** Callback when the user clicks "Close" or "Continue". */
  readonly onClose: () => void;
  /** Human-readable title for the operation, e.g. "Depositing $FNDRY". */
  readonly operationTitle: string;
}

/**
 * TransactionConfirmation renders a full-screen modal showing the progress
 * of an escrow transaction through its lifecycle steps.
 *
 * Features:
 * - Step-by-step progress indicator with animated active step
 * - Error state with descriptive message and retry button
 * - Confirmed state with Solana explorer link
 * - Mobile-responsive layout with accessible ARIA attributes
 * - Keyboard dismiss via Escape key
 */
export function TransactionConfirmation({
  progress,
  network,
  onRetry,
  onClose,
  operationTitle,
}: TransactionConfirmationProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /** Close modal on Escape key press. */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (progress.step === 'idle') return null;

  const currentStepIndex = STEP_ORDER[progress.step] ?? -1;
  const isError = progress.step === 'error';
  const isConfirmed = progress.step === 'confirmed';

  /** Determine the modal heading based on current transaction state. */
  const headingText = isError
    ? 'Transaction Failed'
    : isConfirmed
      ? 'Transaction Confirmed!'
      : operationTitle;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={headingText}
      onClick={(event) => {
        if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
          if (isConfirmed || isError) onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-6">{headingText}</h2>

        {isError ? (
          <div className="space-y-4">
            <div
              className="bg-red-900/20 border border-red-700/30 rounded-lg p-4"
              role="alert"
            >
              <p className="text-red-400 text-sm">
                {progress.errorMessage || 'An unknown error occurred.'}
              </p>
            </div>

            {progress.signature && (
              <a
                href={solscanTxUrl(progress.signature, network)}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center py-2 rounded-lg border border-purple-700/30 text-purple-400 hover:bg-purple-900/20 text-sm transition-colors"
              >
                View failed transaction on Solscan
              </a>
            )}

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
                onClick={onRetry}
                className="flex-1 py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors font-medium min-h-[44px]"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step progress indicator */}
            <div className="space-y-3" role="list" aria-label="Transaction progress">
              {TRANSACTION_STEPS.map((step, index) => {
                const isComplete = index < currentStepIndex;
                const isActive = index === currentStepIndex;

                return (
                  <div
                    key={step.key}
                    className="flex items-center gap-3"
                    role="listitem"
                    aria-current={isActive ? 'step' : undefined}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isComplete
                          ? 'bg-green-500'
                          : isActive
                            ? 'bg-purple-500 animate-pulse'
                            : 'bg-gray-700'
                      }`}
                    >
                      {isComplete ? (
                        <svg
                          className="w-4 h-4 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : isActive ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="text-gray-400 text-xs">{index + 1}</span>
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          isComplete
                            ? 'text-green-400'
                            : isActive
                              ? 'text-white'
                              : 'text-gray-500'
                        }`}
                      >
                        {step.label}
                      </p>
                      <p
                        className={`text-xs ${isActive ? 'text-gray-400' : 'text-gray-600'}`}
                      >
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Confirmed state with explorer link */}
            {isConfirmed && progress.signature && (
              <div className="mt-4 space-y-3">
                <a
                  href={solscanTxUrl(progress.signature, network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-purple-700/30 text-purple-400 hover:bg-purple-900/20 text-sm transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  View on Solscan
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-500 transition-colors min-h-[44px]"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
