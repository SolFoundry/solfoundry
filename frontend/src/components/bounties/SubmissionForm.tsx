import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { LoadingButton } from '../common/LoadingButton';
import { SendToAddress } from '../escrow/SendToAddress';
import { apiClient } from '../../services/apiClient';

interface SubmissionFormProps {
  bountyId: string;
  onSubmit: (prUrl: string, wallet: string, notes?: string, reviewFeeSignature?: string) => Promise<unknown>;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
}

/** Response shape from GET /api/bounties/{bountyId}/review-fee-deposit */
interface ReviewFeeDepositInfo {
  treasury_wallet: string;
  token: string;
  token_mint: string;
  fndry_amount: number;
  exchange_rate: number;
  usdc_equivalent: number;
}

export const SubmissionForm: React.FC<SubmissionFormProps> = ({
  bountyId,
  onSubmit,
  loading = false,
  error,
  disabled = false,
}) => {
  const { publicKey } = useWallet();
  const [prUrl, setPrUrl] = useState('');
  const [wallet, setWallet] = useState(publicKey?.toBase58() || '');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Review fee state
  const [feeDepositInfo, setFeeDepositInfo] = useState<ReviewFeeDepositInfo | null>(null);
  const [feeLoading, setFeeLoading] = useState(true);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [feePaid, setFeePaid] = useState(false);
  const [feeSignature, setFeeSignature] = useState<string | null>(null);

  // Fetch review fee deposit info on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await apiClient<ReviewFeeDepositInfo>(
          `/api/bounties/${bountyId}/review-fee-deposit`,
        );
        if (!cancelled) {
          setFeeDepositInfo(info);
          // If fee is not required (FNDRY bounties -- fndry_amount is 0), mark as already paid
          if (info.fndry_amount <= 0) {
            setFeePaid(true);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setFeeError(err instanceof Error ? err.message : 'Failed to load review fee info');
        }
      } finally {
        if (!cancelled) setFeeLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bountyId]);

  const feeRequired = (feeDepositInfo?.fndry_amount ?? 0) > 0;

  const handleFeeVerified = (signature: string): void => {
    setFeeSignature(signature);
    setFeePaid(true);
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setValidationError(null);

    if (!prUrl.match(/^https:\/\/github\.com\/.+\/pull\/\d+/)) {
      setValidationError('Please enter a valid GitHub PR URL (e.g. https://github.com/org/repo/pull/123)');
      return;
    }

    if (!wallet || wallet.length < 32) {
      setValidationError('Please enter a valid Solana wallet address');
      return;
    }

    if (feeRequired && !feePaid) {
      setValidationError('Please pay the review fee before submitting');
      return;
    }

    const result = await onSubmit(prUrl, wallet, notes || undefined, feeSignature || undefined);
    if (result) {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 p-4 sm:p-6 dark:border-solana-green/25 dark:bg-surface-100">
        <div className="flex items-center gap-3 text-emerald-800 dark:text-solana-green">
          <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Submission Received</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your PR is now under review. AI review scores will appear shortly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-surface-light p-4 sm:p-6 dark:border-white/10 dark:bg-surface-100">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-200 mb-4">Submit Your Solution</h2>

      {/* Review Fee Section */}
      {feeLoading && (
        <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">Checking review fee...</div>
      )}

      {feeError && (
        <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/25 rounded-lg text-red-700 dark:text-red-400 text-xs">
          {feeError}
        </div>
      )}

      {/* Show SendToAddress for USDC bounties that require a review fee */}
      {feeRequired && !feePaid && feeDepositInfo && (
        <div className="mb-4">
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/90 p-3 dark:border-yellow-700/30 dark:bg-yellow-900/20">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-600 dark:text-yellow-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-amber-900 dark:text-yellow-300">Review Fee Required</h3>
                <p className="text-xs text-amber-800 dark:text-yellow-400/80 mt-1">
                  This USDC-funded bounty requires a <strong>{feeDepositInfo.fndry_amount.toLocaleString()} $FNDRY</strong> review
                  fee (~${feeDepositInfo.usdc_equivalent.toFixed(2)} USDC equivalent, at {feeDepositInfo.exchange_rate.toLocaleString()} FNDRY/USDC).
                </p>
              </div>
            </div>
          </div>
          <SendToAddress
            treasuryWallet={feeDepositInfo.treasury_wallet}
            token="FNDRY"
            amount={feeDepositInfo.fndry_amount}
            onVerified={handleFeeVerified}
            bountyId={bountyId}
            type="review-fee"
          />
        </div>
      )}

      {/* Fee Paid Confirmation */}
      {feePaid && feeRequired && feeDepositInfo && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/90 p-3 dark:border-solana-green/25 dark:bg-surface-100">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-solana-green text-sm">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Review fee paid: {feeDepositInfo.fndry_amount.toLocaleString()} $FNDRY</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Pull Request URL *</label>
          <input
            type="url"
            value={prUrl}
            onChange={(e) => setPrUrl(e.target.value)}
            placeholder="https://github.com/SolFoundry/solfoundry/pull/42"
            className="w-full rounded-lg border border-gray-300 bg-surface-light px-4 py-3 text-base text-gray-900 placeholder-gray-500 focus:border-solana-purple focus:ring-1 focus:ring-solana-purple transition-colors dark:border-surface-300 dark:bg-surface-50 dark:text-white dark:placeholder-gray-500"
            required
            disabled={disabled || loading}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Solana Wallet Address *</label>
          <input
            type="text"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="Your Solana wallet address for payout"
            className="w-full rounded-lg border border-gray-300 bg-surface-light px-4 py-3 font-mono text-base text-gray-900 placeholder-gray-500 focus:border-solana-purple focus:ring-1 focus:ring-solana-purple transition-colors dark:border-surface-300 dark:bg-surface-50 dark:text-white dark:placeholder-gray-500"
            required
            disabled={disabled || loading}
          />
          {publicKey && (
            <button
              type="button"
              onClick={() => setWallet(publicKey.toBase58())}
              className="mt-1 inline-flex min-h-11 items-center text-sm text-solana-purple hover:text-solana-green transition-colors sm:text-base"
            >
              Use connected wallet
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Brief description of your implementation..."
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-300 bg-surface-light px-4 py-3 text-base text-gray-900 placeholder-gray-500 focus:border-solana-purple focus:ring-1 focus:ring-solana-purple transition-colors dark:border-surface-300 dark:bg-surface-50 dark:text-white dark:placeholder-gray-500"
            disabled={disabled || loading}
          />
        </div>

        {(validationError || error) && (
          <div className="px-3 py-2 bg-red-500/10 border border-red-500/25 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {validationError || error}
          </div>
        )}

        <LoadingButton
          type="submit"
          isLoading={loading}
          loadingText="Submitting..."
          disabled={disabled || (feeRequired && !feePaid)}
          className="w-full py-3 min-h-[44px]"
        >
          {feeRequired && !feePaid ? 'Pay Review Fee First' : 'Submit PR for Review'}
        </LoadingButton>
      </form>
    </div>
  );
};

export default SubmissionForm;
