/**
 * StakingModal — mobile-responsive modal for stake / unstake / claim actions.
 * Handles the full TransactionStatus lifecycle with inline feedback.
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { StakingPosition, StakeModalMode } from '../../types/staking';
import type { StakingTxState } from '../../hooks/useStaking';

interface StakingModalProps {
  mode: StakeModalMode;
  position: StakingPosition | null;
  walletBalance: number | null;
  transaction: StakingTxState;
  onStake: (amount: number) => Promise<void>;
  onInitiateUnstake: (amount: number) => Promise<void>;
  onCompleteUnstake: () => Promise<void>;
  onClaim: () => Promise<void>;
  onClose: () => void;
}

const STATUS_MESSAGES: Record<string, string> = {
  approving: 'Waiting for wallet approval…',
  pending: 'Sending transaction…',
  confirming: 'Confirming on-chain…',
  confirmed: 'Success!',
  error: '',
};

export function StakingModal({
  mode,
  position,
  walletBalance,
  transaction,
  onStake,
  onInitiateUnstake,
  onCompleteUnstake,
  onClaim,
  onClose,
}: StakingModalProps) {
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const validateAmount = useCallback(
    (raw: string): number | null => {
      const n = parseFloat(raw);
      if (!raw || isNaN(n) || n <= 0) {
        setAmountError('Enter a valid amount');
        return null;
      }
      if (mode === 'stake' && walletBalance !== null && n > walletBalance) {
        setAmountError('Exceeds wallet balance');
        return null;
      }
      if (mode === 'unstake' && position && n > position.staked_amount) {
        setAmountError('Exceeds staked amount');
        return null;
      }
      setAmountError('');
      return n;
    },
    [mode, walletBalance, position],
  );

  const handleSubmit = async () => {
    if (mode === 'claim') {
      await onClaim();
      return;
    }
    if (mode === 'unstake' && position?.cooldown_active) {
      // Complete unstake — no amount input needed
      await onCompleteUnstake();
      return;
    }
    const n = validateAmount(amount);
    if (n === null) return;
    if (mode === 'stake') await onStake(n);
    else await onInitiateUnstake(n);
  };

  const isProcessing = ['approving', 'pending', 'confirming'].includes(transaction.status);
  const isDone = transaction.status === 'confirmed';

  const titles: Record<StakeModalMode, string> = {
    stake: 'Stake $FNDRY',
    unstake: position?.cooldown_active ? 'Complete Unstake' : 'Initiate Unstake',
    claim: 'Claim Rewards',
  };

  const submitLabels: Record<StakeModalMode, string> = {
    stake: 'Stake',
    unstake: position?.cooldown_active ? 'Complete Unstake' : 'Start Cooldown',
    claim: 'Claim',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={titles[mode]}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-[#0f0f14] border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">{titles[mode]}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Transaction status overlay */}
          {transaction.status !== 'idle' && transaction.status !== 'error' && (
            <div
              className={`rounded-lg px-4 py-3 text-sm font-medium ${
                isDone
                  ? 'bg-[#14F195]/10 text-[#14F195] border border-[#14F195]/20'
                  : 'bg-[#9945FF]/10 text-[#9945FF] border border-[#9945FF]/20'
              }`}
              data-testid="tx-status"
            >
              {isDone ? (
                <span>
                  ✓ {STATUS_MESSAGES.confirmed}
                  {transaction.signature && (
                    <span className="block text-xs text-gray-400 mt-1 font-mono">
                      {transaction.signature.slice(0, 16)}…
                    </span>
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-[#9945FF] border-t-transparent rounded-full animate-spin inline-block" />
                  {STATUS_MESSAGES[transaction.status]}
                </span>
              )}
            </div>
          )}

          {/* Error */}
          {transaction.status === 'error' && transaction.error && (
            <div
              className="rounded-lg px-4 py-3 text-sm bg-red-900/20 text-red-400 border border-red-500/20"
              data-testid="tx-error"
            >
              {transaction.error}
            </div>
          )}

          {/* Amount input */}
          {!isDone && mode !== 'claim' && !(mode === 'unstake' && position?.cooldown_active) && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Amount ($FNDRY)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (amountError) validateAmount(e.target.value);
                  }}
                  disabled={isProcessing}
                  placeholder="0.00"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#9945FF] disabled:opacity-50"
                  data-testid="amount-input"
                />
                {mode === 'stake' && walletBalance !== null && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(walletBalance))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#9945FF] hover:text-[#9945FF]/80"
                  >
                    MAX
                  </button>
                )}
              </div>
              {amountError && (
                <p className="text-xs text-red-400 mt-1" data-testid="amount-error">
                  {amountError}
                </p>
              )}
              {mode === 'stake' && walletBalance !== null && (
                <p className="text-xs text-gray-500 mt-1">
                  Balance: {walletBalance.toLocaleString()} $FNDRY
                </p>
              )}
              {mode === 'unstake' && position && (
                <p className="text-xs text-gray-500 mt-1">
                  Staked: {position.staked_amount.toLocaleString()} $FNDRY
                </p>
              )}
            </div>
          )}

          {/* Claim summary */}
          {mode === 'claim' && position && !isDone && (
            <div className="rounded-lg bg-[#14F195]/5 border border-[#14F195]/10 p-4">
              <p className="text-xs text-gray-400 mb-1">Claiming</p>
              <p className="text-2xl font-bold text-[#14F195]">
                {position.rewards_available.toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}
              </p>
              <p className="text-xs text-gray-500">$FNDRY</p>
            </div>
          )}

          {/* Unstake complete info */}
          {mode === 'unstake' && position?.cooldown_active === false && position?.unstake_ready && !isDone && (
            <div className="rounded-lg bg-[#14F195]/5 border border-[#14F195]/10 p-4">
              <p className="text-xs text-gray-400 mb-1">Unstaking</p>
              <p className="text-2xl font-bold text-[#14F195]">
                {position.unstake_amount.toLocaleString()} $FNDRY
              </p>
              <p className="text-xs text-gray-500 mt-1">Cooldown complete — ready to withdraw</p>
            </div>
          )}

          {/* Action button */}
          {!isDone && (
            <button
              onClick={handleSubmit}
              disabled={isProcessing}
              className="w-full rounded-lg py-3 text-sm font-semibold transition-all bg-[#9945FF] text-white hover:bg-[#9945FF]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="modal-submit-btn"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing…
                </span>
              ) : (
                submitLabels[mode]
              )}
            </button>
          )}

          {isDone && (
            <button
              onClick={onClose}
              className="w-full rounded-lg py-3 text-sm font-semibold bg-[#14F195]/15 text-[#14F195] hover:bg-[#14F195]/25 transition-all"
              data-testid="modal-done-btn"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
