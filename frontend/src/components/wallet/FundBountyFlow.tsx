/** $FNDRY bounty staking UI — approval modal, transaction status tracker, and fund button. */
import { useState, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useFndryBalance, useBountyEscrow } from '../../hooks/useFndryToken';
import { solscanTxUrl } from '../../config/constants';
import { useNetwork } from './WalletProvider';
import type { TransactionStatus } from '../../types/wallet';

/* ── Approval Modal ─────────────────────────────────────────────────────────── */

function ApprovalModal({
  open,
  onClose,
  onConfirm,
  amount,
  balance,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amount: number;
  balance: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const insufficient = balance !== null && balance < amount;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Approve staking transaction"
      onClick={(e) => {
        if (ref.current && !ref.current.contains(e.target as Node)) onClose();
      }}
    >
      <div ref={ref} className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Confirm Staking</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-lg text-gray-400 hover:text-white inline-flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 mb-6 text-center">
          <p className="text-gray-400 text-sm mb-2">You are staking</p>
          <p className="text-3xl font-bold text-green-400">{amount.toLocaleString()}</p>
          <p className="text-gray-400 text-sm mt-1">$FNDRY</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Your balance</span>
            <span className={insufficient ? 'text-red-400' : 'text-white'}>
              {balance !== null ? `${balance.toLocaleString()} $FNDRY` : 'Loading…'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">After staking</span>
            <span className="text-white">
              {balance !== null ? `${Math.max(0, balance - amount).toLocaleString()} $FNDRY` : '—'}
            </span>
          </div>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 mb-6">
          <p className="text-yellow-400 text-xs">
            Funds will be held in escrow until the bounty is completed or cancelled. This transaction
            requires approval from your wallet.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={insufficient}
            className="flex-1 py-3 rounded-lg bg-linear-to-r from-purple-600 to-green-500 text-white font-bold hover:from-purple-500 hover:to-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {insufficient ? 'Insufficient Balance' : 'Approve & Stake'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Transaction Status Tracker ─────────────────────────────────────────────── */

const TX_STEPS = [
  { key: 'approving' as const, label: 'Wallet Approval', desc: 'Approve in your wallet' },
  { key: 'pending' as const, label: 'Sending', desc: 'Submitting to Solana' },
  { key: 'confirming' as const, label: 'Confirming', desc: 'Waiting for confirmation' },
  { key: 'confirmed' as const, label: 'Confirmed', desc: 'Transaction confirmed' },
];
const STATUS_ORDER: TransactionStatus[] = ['approving', 'pending', 'confirming', 'confirmed'];

function TransactionStatusTracker({
  status,
  signature,
  error,
  network,
  onRetry,
  onClose,
}: {
  status: TransactionStatus;
  signature: string | null;
  error: string | null;
  network: 'mainnet-beta' | 'devnet';
  onRetry: () => void;
  onClose: () => void;
}) {
  if (status === 'idle') return null;

  const currentIdx = STATUS_ORDER.indexOf(status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 mx-4">
        <h2 className="text-lg font-semibold text-white mb-6">
          {status === 'error'
            ? 'Transaction Failed'
            : status === 'confirmed'
              ? 'Transaction Confirmed!'
              : 'Processing Transaction…'}
        </h2>

        {status === 'error' ? (
          <div className="space-y-4">
            <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error || 'An unknown error occurred'}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onRetry}
                className="flex-1 py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              {TX_STEPS.map((step, idx) => {
                const stepIdx = STATUS_ORDER.indexOf(step.key);
                const isComplete = stepIdx < currentIdx;
                const isActive = stepIdx === currentIdx;

                return (
                  <div key={step.key} className="flex items-center gap-3">
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
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : isActive ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="text-gray-400 text-xs">{idx + 1}</span>
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          isComplete ? 'text-green-400' : isActive ? 'text-white' : 'text-gray-500'
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className={`text-xs ${isActive ? 'text-gray-400' : 'text-gray-600'}`}>
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {status === 'confirmed' && signature && (
              <div className="mt-4 space-y-3">
                <a
                  href={solscanTxUrl(signature, network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center py-2 rounded-lg border border-purple-700/30 text-purple-400 hover:bg-purple-900/20 text-sm transition-colors"
                >
                  View on Solscan ↗
                </a>
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-500 transition-colors"
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

/* ── Fund Bounty Button ─────────────────────────────────────────────────────── */

interface FundBountyButtonProps {
  amount: number;
  onFunded: (signature: string) => void;
  disabled?: boolean;
}

export function FundBountyButton({ amount, onFunded, disabled }: FundBountyButtonProps) {
  const { connected } = useWallet();
  const { balance, loading: balanceLoading } = useFndryBalance();
  const { fundBounty, transaction, reset } = useBountyEscrow();
  const { network } = useNetwork();
  const [showApproval, setShowApproval] = useState(false);
  const [funded, setFunded] = useState(false);

  const handleConfirm = async () => {
    setShowApproval(false);
    try {
      const sig = await fundBounty(amount);
      setFunded(true);
      onFunded(sig);
    } catch {
      // Error state is tracked inside useBountyEscrow
    }
  };

  const handleRetry = () => {
    reset();
    setShowApproval(true);
  };

  const handleStatusClose = () => {
    reset();
  };

  const insufficient = balance !== null && balance < amount;
  const canFund = connected && !insufficient && !balanceLoading && !disabled;

  return (
    <>
      {connected && (
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-gray-400">$FNDRY Balance</span>
          <span className={insufficient ? 'text-red-400 font-medium' : 'text-green-400 font-medium'}>
            {balanceLoading ? 'Loading…' : balance !== null ? `${balance.toLocaleString()} $FNDRY` : 'Error'}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowApproval(true)}
        disabled={!canFund || funded}
        className="w-full py-3 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-linear-to-r from-purple-600 to-green-500 text-white hover:from-purple-500 hover:to-green-400"
      >
        {!connected
          ? 'Connect Wallet to Fund'
          : funded
            ? '✓ Bounty Funded'
            : insufficient
              ? 'Insufficient $FNDRY Balance'
              : `Fund Bounty — ${amount.toLocaleString()} $FNDRY`}
      </button>

      {insufficient && connected && !funded && (
        <p className="text-red-400 text-xs mt-2 text-center">
          Need {Math.ceil(amount - (balance || 0)).toLocaleString()} more $FNDRY
        </p>
      )}

      <ApprovalModal
        open={showApproval}
        onClose={() => setShowApproval(false)}
        onConfirm={handleConfirm}
        amount={amount}
        balance={balance}
      />

      {transaction.status !== 'idle' && (
        <TransactionStatusTracker
          status={transaction.status}
          signature={transaction.signature}
          error={transaction.error}
          network={network}
          onRetry={handleRetry}
          onClose={handleStatusClose}
        />
      )}
    </>
  );
}
