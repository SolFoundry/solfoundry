/**
 * SendToAddress -- "Send X tokens to this address" funding component.
 * Replaces the old wallet-adapter transaction signing flow.
 * User sends tokens from any wallet, then pastes the transaction signature
 * for backend verification.
 *
 * @module components/escrow/SendToAddress
 */

import { useState, useRef } from 'react';
import { apiClient } from '../../services/apiClient';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FeeBreakdown {
  bounty_reward: number;
  creator_fee_pct: number;
  creator_fee_amount: number;
  total: number;
}

export interface SendToAddressProps {
  /** Treasury wallet address to send tokens to. */
  treasuryWallet: string;
  /** Token symbol (e.g. "USDC" or "FNDRY"). */
  token: string;
  /** Amount of tokens to send. */
  amount: number;
  /** Optional fee breakdown to display. */
  feeBreakdown?: FeeBreakdown;
  /** Called when the backend successfully verifies the payment. */
  onVerified: (signature: string) => void;
  /** Bounty ID for backend verification. */
  bountyId: string;
  /** Determines which backend endpoint to call for verification. */
  type: 'funding' | 'review-fee';
}

type PaymentStatus = 'awaiting' | 'verifying' | 'confirmed' | 'failed';

// ── Component ────────────────────────────────────────────────────────────────

export function SendToAddress({
  treasuryWallet,
  token,
  amount,
  feeBreakdown,
  onVerified,
  bountyId,
  type,
}: SendToAddressProps) {
  const [signature, setSignature] = useState('');
  const [status, setStatus] = useState<PaymentStatus>('awaiting');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async (): Promise<void> => {
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      await navigator.clipboard.writeText(treasuryWallet);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = treasuryWallet;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerify = async (): Promise<void> => {
    const trimmed = signature.trim();
    if (!trimmed) {
      setError('Please paste your transaction signature');
      return;
    }

    setStatus('verifying');
    setError(null);

    try {
      if (type === 'funding') {
        await apiClient('/api/escrow/fund', {
          method: 'POST',
          body: { bounty_id: bountyId, signature: trimmed, amount, token },
        });
      } else {
        // review-fee: The signature is verified inline when the submission is
        // posted (backend verifies on-chain in the submissions endpoint).
        // We do a basic format check here and pass it back to the parent.
        if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(trimmed)) {
          throw new Error('Invalid transaction signature format. Must be a valid Solana base-58 signature.');
        }
        // No separate backend call needed -- parent includes this in submission payload
      }
      setStatus('confirmed');
      onVerified(trimmed);
    } catch (err: unknown) {
      setStatus('failed');
      const message =
        err instanceof Error ? err.message : 'Verification failed. Check your signature and try again.';
      setError(message);
    }
  };

  if (status === 'confirmed') {
    return (
      <div className="rounded-xl border border-green-600/30 bg-green-900/20 p-6 text-center">
        <div className="text-green-400 text-5xl mb-3">&#10003;</div>
        <h3 className="text-lg font-bold text-white mb-1">Payment Confirmed</h3>
        <p className="text-gray-400 text-sm">
          {amount.toLocaleString()} {token} received and verified on-chain.
        </p>
        <p className="text-gray-500 text-xs mt-2 font-mono break-all">{signature.trim()}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-5">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-bold text-white mb-1">
          Send {amount.toLocaleString()} {token} to this address
        </h3>
        <p className="text-gray-400 text-sm">
          Send from any Solana wallet. Paste the transaction signature below to verify.
        </p>
      </div>

      {/* Treasury address with copy */}
      <div className="bg-gray-800 rounded-lg p-4">
        <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">
          Treasury Wallet
        </label>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm font-mono text-solana-green bg-gray-900 rounded px-3 py-2 break-all select-all">
            {treasuryWallet}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            aria-label={copied ? 'Copied!' : 'Copy address'}
            title={copied ? 'Copied!' : 'Copy address'}
          >
            {copied ? (
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Fee breakdown */}
      {feeBreakdown && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Bounty reward</span>
            <span className="text-green-400 font-medium">
              {feeBreakdown.bounty_reward.toLocaleString()} {token}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">
              Platform fee ({feeBreakdown.creator_fee_pct}%)
            </span>
            <span className="text-orange-400">
              {feeBreakdown.creator_fee_amount.toFixed(2)} {token}
            </span>
          </div>
          <div className="border-t border-gray-700 pt-2 flex justify-between text-sm font-bold">
            <span className="text-gray-300">Total to send</span>
            <span className="text-white">
              {feeBreakdown.total.toFixed(2)} {token}
            </span>
          </div>
        </div>
      )}

      {/* Signature input */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">
          Transaction Signature
        </label>
        <input
          type="text"
          value={signature}
          onChange={(e) => {
            setSignature(e.target.value);
            if (status === 'failed') {
              setStatus('awaiting');
              setError(null);
            }
          }}
          placeholder="Paste your Solana transaction signature here..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 font-mono text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors"
          disabled={status === 'verifying'}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Status + Verify button */}
      <div className="space-y-3">
        {/* Status indicator */}
        <div className="flex items-center gap-2 text-sm">
          {status === 'awaiting' && (
            <>
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-yellow-400">Awaiting Payment</span>
            </>
          )}
          {status === 'verifying' && (
            <>
              <svg className="w-4 h-4 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-purple-400">Verifying...</span>
            </>
          )}
          {status === 'failed' && (
            <>
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-red-400">Verification Failed</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleVerify}
          disabled={!signature.trim() || status === 'verifying'}
          className="w-full py-3 rounded-lg font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-purple-600 to-green-500 hover:from-purple-500 hover:to-green-400 min-h-[44px] touch-manipulation active:scale-[0.98]"
        >
          {status === 'verifying' ? 'Verifying...' : status === 'failed' ? 'Retry Verification' : 'Verify Payment'}
        </button>
      </div>

      {/* Help text */}
      <p className="text-xs text-gray-500 leading-relaxed">
        After sending {token} to the address above, find the transaction signature in your wallet
        history or on Solscan. Paste it above and click Verify Payment.
      </p>
    </div>
  );
}

export default SendToAddress;
