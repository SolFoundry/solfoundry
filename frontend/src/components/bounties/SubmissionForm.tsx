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
      <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 sm:p-6">
        <div className="flex items-center gap-3 text-green-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-semibold">Submission Received</h3>
            <p className="text-sm text-gray-400">
              Your PR is now under review. AI review scores will appear shortly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Submit Your Solution</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Pull Request URL *</label>
          <input
            type="url"
            value={prUrl}
            onChange={(e) => setPrUrl(e.target.value)}
            placeholder="https://github.com/SolFoundry/solfoundry/pull/42"
            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:border-[#9945FF] focus:ring-1 focus:ring-[#9945FF] transition-colors"
            required
            disabled={disabled || loading}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Solana Wallet Address *</label>
          <input
            type="text"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="Your Solana wallet address for payout"
            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:border-[#9945FF] focus:ring-1 focus:ring-[#9945FF] transition-colors font-mono text-sm"
            required
            disabled={disabled || loading}
          />
          {publicKey && (
            <button
              type="button"
              onClick={() => setWallet(publicKey.toBase58())}
              className="mt-1 text-xs text-[#9945FF] hover:text-[#14F195] transition-colors"
            >
              Use connected wallet
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Brief description of your implementation..."
            rows={3}
            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:border-[#9945FF] focus:ring-1 focus:ring-[#9945FF] transition-colors resize-none"
            disabled={disabled || loading}
          />
        </div>

        {(validationError || error) && (
          <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {validationError || error}
          </div>
        )}

        <button
          type="submit"
          disabled={disabled || loading}
          className="w-full bg-[#9945FF] hover:bg-[#7C3AED] disabled:bg-gray-700 disabled:text-gray-500 text-white py-3 rounded-lg font-medium transition-colors min-h-[44px] flex items-center justify-center gap-2"
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
