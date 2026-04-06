import React, { useState } from 'react';
import { Loader2, Check, Copy } from 'lucide-react';
import type { Bounty } from '../../types/bounty';
import { createSubmission, getReviewFee, verifyReviewFee } from '../../api/bounties';
import { useToast } from '../../contexts/ToastContext';

interface SubmissionFormProps {
  bounty: Bounty;
  onSuccess?: () => void;
}

export function SubmissionForm({ bounty, onSuccess }: SubmissionFormProps) {
  const hasRepo = bounty.has_repo ?? !!bounty.github_repo_url;
  const { pushToast } = useToast();
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [txSig, setTxSig] = useState('');
  const [feeVerified, setFeeVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feeInfo, setFeeInfo] = useState<{ fndry_amount: number; fndry_price_usd: number } | null>(null);

  const TREASURY = '9xKfBountyTreasuryAddressHere...';

  React.useEffect(() => {
    getReviewFee(bounty.id)
      .then((info) => setFeeInfo({ fndry_amount: info.fndry_amount, fndry_price_usd: info.fndry_price_usd }))
      .catch(() => setFeeInfo({ fndry_amount: 50000, fndry_price_usd: 0.00025 }));
  }, [bounty.id]);

  const handleVerifyFee = async () => {
    if (!txSig.trim()) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyReviewFee({ bounty_id: bounty.id, tx_signature: txSig });
      if (result.verified) {
        setFeeVerified(true);
        pushToast({
          title: 'Review fee verified',
          description: 'Your FNDRY payment was confirmed. You can submit now.',
          variant: 'success',
        });
      } else {
        const message = result.error ?? 'Fee verification failed. Check your transaction signature.';
        setError(message);
        pushToast({ title: 'Verification failed', description: message, variant: 'error' });
      }
    } catch {
      const message = 'Fee verification failed. Try again.';
      setError(message);
      pushToast({ title: 'Verification failed', description: message, variant: 'error' });
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async () => {
    if (!url.trim()) {
      const message = 'URL is required.';
      setError(message);
      pushToast({ title: 'Submission blocked', description: message, variant: 'warning' });
      return;
    }
    if (!feeVerified) {
      const message = 'Verify your FNDRY review fee first.';
      setError(message);
      pushToast({ title: 'Submission blocked', description: message, variant: 'warning' });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createSubmission(bounty.id, {
        repo_url: hasRepo ? undefined : url,
        pr_url: hasRepo ? url : undefined,
        description,
        tx_signature: txSig,
      });
      setSuccess(true);
      pushToast({
        title: 'Submission received',
        description: 'AI review will begin shortly.',
        variant: 'success',
      });
      onSuccess?.();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Submission failed. Try again.';
      setError(message);
      pushToast({ title: 'Submission failed', description: message, variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const copyTreasury = () => {
    navigator.clipboard.writeText(TREASURY).then(() => {
      setCopied(true);
      pushToast({
        title: 'Treasury address copied',
        description: 'Paste it into your wallet to pay the review fee.',
        variant: 'info',
      });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-full bg-emerald/10 border border-emerald/30 flex items-center justify-center mx-auto mb-4">
          <Check className="w-6 h-6 text-emerald" />
        </div>
        <p className="font-sans text-lg font-semibold text-text-primary mb-2">Submission received!</p>
        <p className="text-sm text-text-muted">AI review will begin shortly. Check back for results.</p>
      </div>
    );
  }

  const inputClass = 'w-full bg-forge-700 border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald focus:ring-1 focus:ring-emerald/30 outline-none transition-all duration-150';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          {hasRepo ? 'PR URL' : 'Repository URL'} *
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={hasRepo ? 'https://github.com/org/repo/pull/42' : 'https://github.com/username/repo'}
          className={inputClass}
        />
      </div>

      {!hasRepo && (
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Brief Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe your implementation..."
            className={`${inputClass} resize-none`}
          />
        </div>
      )}

      <div className="border-t border-b border-border py-4 my-2">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">FNDRY Review Fee</p>
        {feeInfo && (
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-text-secondary">Fee:</span>
            <span className="font-mono font-semibold text-magenta">
              {feeInfo.fndry_amount.toLocaleString()} FNDRY
              <span className="text-text-muted text-xs ml-1">(~${(feeInfo.fndry_amount * feeInfo.fndry_price_usd).toFixed(2)})</span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-text-secondary">Send to:</span>
          <code className="font-mono text-xs text-text-muted bg-forge-800 rounded px-2 py-1 flex-1 truncate">{TREASURY}</code>
          <button onClick={copyTreasury} className="text-text-muted hover:text-text-primary transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={txSig}
            onChange={(e) => setTxSig(e.target.value)}
            placeholder="Paste transaction signature..."
            disabled={feeVerified}
            className={`${inputClass} flex-1`}
          />
          <button
            onClick={handleVerifyFee}
            disabled={!txSig.trim() || verifying || feeVerified}
            className="px-3 py-2 rounded-lg bg-forge-800 border border-border text-sm text-text-secondary hover:border-border-hover hover:text-text-primary transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
          >
            {verifying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {feeVerified ? <><Check className="w-3.5 h-3.5 text-emerald" /> Verified</> : 'Verify'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-status-error bg-status-error/10 border border-status-error/20 rounded-lg px-4 py-3">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!url.trim() || !feeVerified || submitting}
        className="w-full py-3 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {hasRepo ? 'Submit PR' : 'Submit Solution'}
      </button>
    </div>
  );
}
