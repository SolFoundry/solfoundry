import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface SubmissionFormProps {
  bountyId: string;
  onSubmit: (prUrl: string, wallet: string, notes?: string) => Promise<unknown>;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
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

  const handleSubmit = async (e: React.FormEvent) => {
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

    const result = await onSubmit(prUrl, wallet, notes || undefined);
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

        <button
          type="submit"
          disabled={disabled || loading}
          className="w-full bg-solana-purple hover:bg-violet-600 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-surface-300 dark:disabled:text-gray-500 text-white py-3 rounded-lg font-medium transition-colors min-h-[44px] flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit PR for Review'
          )}
        </button>
      </form>
    </div>
  );
};

export default SubmissionForm;
