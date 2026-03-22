/**
 * StakeUnstakeModal — Mobile-responsive modal for staking/unstaking $FNDRY tokens.
 *
 * Provides a dual-tab interface for stake and unstake operations with:
 * - Amount input with balance validation
 * - Quick-select percentage buttons (25%, 50%, 75%, MAX)
 * - Transaction lifecycle display (signing -> confirming -> confirmed/error)
 * - Cooldown warning for unstake operations
 * - Keyboard accessibility (Escape to close, focus trap)
 *
 * @module components/staking/StakeUnstakeModal
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import type { TransactionStatus, StakingTransactionResult } from '../../types/staking';
import { UNSTAKE_COOLDOWN_SECONDS } from '../../types/staking';

/** Active tab in the stake/unstake modal. */
type ModalTab = 'stake' | 'unstake';

/** Props for the StakeUnstakeModal component. */
interface StakeUnstakeModalProps {
  /** Whether the modal is currently open. */
  open: boolean;
  /** Callback to close the modal. */
  onClose: () => void;
  /** Available $FNDRY balance that can be staked. */
  availableBalance: number;
  /** Currently staked $FNDRY balance that can be unstaked. */
  stakedBalance: number;
  /** Current APY percentage for display. */
  currentApyPercent: number;
  /** Current transaction lifecycle status. */
  transactionStatus: TransactionStatus;
  /** Error message from the most recent failed transaction. */
  transactionError: string | null;
  /** Signature of the most recent successful transaction. */
  lastSignature: string | null;
  /** Callback to execute a stake transaction with the given amount. */
  onStake: (amount: number) => Promise<StakingTransactionResult>;
  /** Callback to execute an unstake transaction with the given amount. */
  onUnstake: (amount: number) => Promise<StakingTransactionResult>;
  /** Callback to reset transaction state. */
  onResetTransaction: () => void;
  /** Which tab to open by default. */
  defaultTab?: ModalTab;
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
 * Format cooldown duration in human-readable form.
 *
 * @param seconds - Duration in seconds.
 * @returns Formatted string like "7 days".
 */
function formatCooldownDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  const hours = Math.floor(seconds / 3600);
  return `${hours} hour${hours > 1 ? 's' : ''}`;
}

/**
 * StakeUnstakeModal — Full-featured staking modal with transaction signing.
 *
 * Mobile-responsive dialog with tab-based navigation between stake and unstake.
 * Validates input amounts against available balances, shows estimated APY,
 * and handles the full transaction lifecycle with explicit error states.
 */
export function StakeUnstakeModal({
  open,
  onClose,
  availableBalance,
  stakedBalance,
  currentApyPercent,
  transactionStatus,
  transactionError,
  lastSignature,
  onStake,
  onUnstake,
  onResetTransaction,
  defaultTab = 'stake',
}: StakeUnstakeModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>(defaultTab);
  const [amount, setAmount] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Reset state when modal opens/closes */
  useEffect(() => {
    if (open) {
      setAmount('');
      setInputError(null);
      onResetTransaction();
      setActiveTab(defaultTab);
      /* Focus input after render */
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, defaultTab, onResetTransaction]);

  /* Escape key to close */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /* Click outside to close */
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  const maxAmount = activeTab === 'stake' ? availableBalance : stakedBalance;

  /**
   * Validate the current input amount against the active tab's maximum.
   *
   * @param value - The string value from the input field.
   * @returns Error message, or null if valid.
   */
  const validateAmount = useCallback(
    (value: string): string | null => {
      if (!value.trim()) return null;
      const num = Number(value);
      if (isNaN(num) || num <= 0) return 'Amount must be a positive number.';
      if (num > maxAmount) {
        return activeTab === 'stake'
          ? `Insufficient balance. Maximum: ${formatAmount(maxAmount)} $FNDRY`
          : `Cannot unstake more than staked amount. Maximum: ${formatAmount(maxAmount)} $FNDRY`;
      }
      return null;
    },
    [maxAmount, activeTab],
  );

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      /* Allow only numeric input with optional decimal */
      if (value && !/^\d*\.?\d*$/.test(value)) return;
      setAmount(value);
      setInputError(validateAmount(value));
    },
    [validateAmount],
  );

  /**
   * Set the amount to a percentage of the maximum available.
   *
   * @param percent - Percentage (0-100) of max amount to set.
   */
  const setPercentage = useCallback(
    (percent: number) => {
      const value = Math.floor(maxAmount * (percent / 100));
      setAmount(String(value));
      setInputError(null);
    },
    [maxAmount],
  );

  const handleSubmit = useCallback(async () => {
    const error = validateAmount(amount);
    if (error) {
      setInputError(error);
      return;
    }
    const num = Number(amount);
    if (num <= 0) {
      setInputError('Amount must be greater than zero.');
      return;
    }
    if (activeTab === 'stake') {
      await onStake(num);
    } else {
      await onUnstake(num);
    }
  }, [amount, activeTab, validateAmount, onStake, onUnstake]);

  const handleTabSwitch = useCallback(
    (tab: ModalTab) => {
      setActiveTab(tab);
      setAmount('');
      setInputError(null);
      onResetTransaction();
    },
    [onResetTransaction],
  );

  if (!open) return null;

  const numAmount = Number(amount) || 0;
  const estimatedAnnualReward = Math.floor(numAmount * (currentApyPercent / 100));
  const isTransacting = transactionStatus === 'signing' || transactionStatus === 'confirming';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${activeTab === 'stake' ? 'Stake' : 'Unstake'} FNDRY tokens`}
      onClick={handleBackdropClick}
      data-testid="stake-unstake-modal"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-gray-700 bg-surface-50 p-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            <span className="text-[#14F195]">$FNDRY</span> Staking
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close staking modal"
            className="h-8 w-8 rounded-lg text-gray-400 hover:text-white inline-flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg bg-surface-200 p-1 mb-5">
          <button
            type="button"
            onClick={() => handleTabSwitch('stake')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'stake'
                ? 'bg-[#14F195] text-black'
                : 'text-gray-400 hover:text-white'
            }`}
            aria-selected={activeTab === 'stake'}
            role="tab"
            data-testid="stake-tab"
          >
            Stake
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('unstake')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'unstake'
                ? 'bg-red-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            aria-selected={activeTab === 'unstake'}
            role="tab"
            data-testid="unstake-tab"
          >
            Unstake
          </button>
        </div>

        {/* Transaction result overlays */}
        {transactionStatus === 'confirmed' && lastSignature ? (
          <div className="space-y-3" data-testid="modal-tx-success">
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center">
              <svg className="w-12 h-12 text-green-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-green-400">
                {activeTab === 'stake' ? 'Staked' : 'Unstaked'} Successfully
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {formatAmount(numAmount)} $FNDRY {activeTab === 'stake' ? 'staked' : 'unstaked'}
              </p>
              <a
                href={`https://solscan.io/tx/${lastSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#9945FF] hover:underline mt-2 inline-block"
              >
                View on Solscan
              </a>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-surface-200 px-4 py-2 text-sm text-gray-300 hover:bg-surface-300"
            >
              Close
            </button>
          </div>
        ) : transactionStatus === 'error' && transactionError ? (
          <div className="space-y-3" data-testid="modal-tx-error">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span className="text-sm font-semibold text-red-400">Transaction Failed</span>
              </div>
              <p className="text-xs text-gray-400" data-testid="modal-tx-error-message">{transactionError}</p>
            </div>
            <button
              type="button"
              onClick={() => onResetTransaction()}
              className="w-full rounded-lg bg-surface-200 px-4 py-2 text-sm text-gray-300 hover:bg-surface-300"
            >
              Try Again
            </button>
          </div>
        ) : isTransacting ? (
          <div className="py-8 text-center" data-testid="modal-tx-pending">
            <div className="w-12 h-12 border-3 border-[#9945FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white">
              {transactionStatus === 'signing' ? 'Waiting for Signature' : 'Confirming Transaction'}
            </h3>
            <p className="text-sm text-gray-400 mt-2">
              {transactionStatus === 'signing'
                ? 'Please approve the transaction in your wallet.'
                : 'Transaction submitted. Awaiting network confirmation...'}
            </p>
          </div>
        ) : (
          /* Input form */
          <div className="space-y-4">
            {/* Balance info */}
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                {activeTab === 'stake' ? 'Available' : 'Staked'} Balance
              </span>
              <span className="text-white font-mono" data-testid="modal-balance">
                {formatAmount(maxAmount)} $FNDRY
              </span>
            </div>

            {/* Amount input */}
            <div>
              <div className={`flex items-center rounded-xl border ${inputError ? 'border-red-500' : 'border-gray-700'} bg-surface-100 px-4 py-3`}>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0"
                  className="flex-1 bg-transparent text-xl font-mono text-white placeholder-gray-600 outline-none"
                  aria-label={`${activeTab === 'stake' ? 'Stake' : 'Unstake'} amount`}
                  data-testid="staking-amount-input"
                />
                <span className="text-sm text-gray-400 font-semibold ml-2">$FNDRY</span>
              </div>
              {inputError && (
                <p className="text-xs text-red-400 mt-1" data-testid="staking-input-error" role="alert">
                  {inputError}
                </p>
              )}
            </div>

            {/* Percentage quick-select buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setPercentage(pct)}
                  className="rounded-lg bg-surface-200 px-2 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-surface-300 transition-colors"
                  data-testid={`pct-btn-${pct}`}
                >
                  {pct === 100 ? 'MAX' : `${pct}%`}
                </button>
              ))}
            </div>

            {/* Estimated reward (stake tab only) */}
            {activeTab === 'stake' && numAmount > 0 && (
              <div className="rounded-lg bg-surface-100 border border-gray-800 p-3" data-testid="estimated-reward">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Current APY</span>
                  <span className="text-[#14F195] font-semibold">{currentApyPercent}%</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-400">Estimated Annual Reward</span>
                  <span className="text-[#14F195] font-mono">{formatAmount(estimatedAnnualReward)} $FNDRY</span>
                </div>
              </div>
            )}

            {/* Cooldown warning (unstake tab only) */}
            {activeTab === 'unstake' && (
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3" data-testid="cooldown-warning">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p className="text-xs text-amber-400 font-semibold">Cooldown Period</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Unstaked tokens are locked for {formatCooldownDuration(UNSTAKE_COOLDOWN_SECONDS)} before withdrawal.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!amount || !!inputError || numAmount <= 0}
              className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                !amount || !!inputError || numAmount <= 0
                  ? 'bg-surface-300 text-gray-600 cursor-not-allowed'
                  : activeTab === 'stake'
                    ? 'bg-[#14F195] text-black hover:bg-[#14F195]/90 shadow-lg shadow-[#14F195]/20'
                    : 'bg-red-500 text-white hover:bg-red-500/90 shadow-lg shadow-red-500/20'
              }`}
              data-testid="submit-staking-button"
            >
              {activeTab === 'stake'
                ? numAmount > 0
                  ? `Stake ${formatAmount(numAmount)} $FNDRY`
                  : 'Enter Amount to Stake'
                : numAmount > 0
                  ? `Unstake ${formatAmount(numAmount)} $FNDRY`
                  : 'Enter Amount to Unstake'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
