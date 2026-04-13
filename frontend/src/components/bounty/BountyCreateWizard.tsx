import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Loader2, Copy } from 'lucide-react';
import type { BountyCreatePayload } from '../../types/bounty';
import { createBounty, getTreasuryDepositInfo, verifyEscrowDeposit } from '../../api/bounties';
import { pageTransition } from '../../lib/animations';

const PRESET_AMOUNTS = [10, 20, 50, 100, 200];
const PLATFORM_FEE_PCT = 0.05;

const inputClass =
  'w-full bg-forge-700 border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald focus:ring-1 focus:ring-emerald/30 outline-none transition-all duration-150';

const STEPS = ['Describe', 'Timeline & Reward', 'Fund & Publish'];

/**
 * WizardState — holds all form state across the 3-step bounty creation flow.
 */
interface WizardState {
  title: string;
  description: string;
  github_repo_url: string;
  github_issue_url: string;
  reward_amount: number;
  custom_amount: string;
  deadline: string;
  tier: string;
  tags: string[];
  bounty_id?: string;
  treasury_address?: string;
  total_to_fund?: number;
  tx_signature: string;
  verified: boolean;
}

/**
 * StepIndicator — renders the 3-step progress indicator at the top of the wizard.
 * Highlights completed steps with a checkmark and the current step with an emerald border.
 */
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-4 mb-10">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 ${
              i < currentStep
                ? 'bg-emerald text-text-inverse'
                : i === currentStep
                ? 'border-2 border-emerald text-emerald bg-emerald-bg'
                : 'border-2 border-border text-text-muted bg-forge-800'
            }`}
          >
            {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          <span
            className={`text-sm font-medium hidden md:block ${
              i <= currentStep ? 'text-text-primary' : 'text-text-muted'
            }`}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && <div className="w-12 h-px bg-border hidden md:block" />}
        </div>
      ))}
    </div>
  );
}

/**
 * Step1 — collects bounty title, description, and optional GitHub repo/issue.
 * Validates minimum lengths before enabling the Next button.
 */
function Step1({
  state,
  onChange,
  onNext,
}: {
  state: WizardState;
  onChange: (k: keyof WizardState, v: unknown) => void;
  onNext: () => void;
}) {
  const canProceed = state.title.trim().length >= 5 && state.description.trim().length >= 20;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Title *</label>
          <input
            type="text"
            value={state.title}
            onChange={(e) => onChange('title', e.target.value)}
            placeholder="Fix authentication bypass in auth module"
            className={inputClass}
            maxLength={120}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Description *</label>
          <textarea
            value={state.description}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Describe the problem, requirements, and acceptance criteria..."
            className={`${inputClass} resize-none min-h-[160px]`}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">GitHub Repo (optional)</label>
            <input
              type="url"
              value={state.github_repo_url}
              onChange={(e) => onChange('github_repo_url', e.target.value)}
              placeholder="github.com/org/repo"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">GitHub Issue # (optional)</label>
            <input
              type="text"
              value={state.github_issue_url}
              onChange={(e) => onChange('github_issue_url', e.target.value)}
              placeholder="#142 or full URL"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="bg-forge-800 border border-border rounded-lg p-4 h-fit">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">AI Tag Preview</p>
        {state.description.length > 20 ? (
          <div className="space-y-2">
            <span className="inline-block bg-magenta-bg text-magenta text-xs px-2 py-0.5 rounded-full border border-magenta-border">
              Tier 2 (AI)
            </span>
            {state.description.toLowerCase().includes('security') && (
              <span className="inline-block bg-purple-bg text-purple-light text-xs px-2 py-0.5 rounded-full border border-purple-border ml-2">
                Security
              </span>
            )}
            {(state.description.toLowerCase().includes('typescript') || state.description.toLowerCase().includes('ts')) && (
              <span className="inline-block bg-forge-700 text-text-secondary text-xs px-2 py-0.5 rounded-full border border-border ml-2">
                TypeScript
              </span>
            )}
            <p className="text-xs text-text-muted mt-3">Tags are auto-generated based on your description.</p>
          </div>
        ) : (
          <p className="text-xs text-text-muted">Start typing your description to see AI-generated tags.</p>
        )}
      </div>

      <div className="md:col-span-3 flex justify-end">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="px-6 py-2.5 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

/**
 * Step2 — collects reward amount (with presets), deadline date, and displays a fee summary.
 * Disables the Next button until a deadline is selected.
 */
function Step2({
  state,
  onChange,
  onNext,
  onBack,
}: {
  state: WizardState;
  onChange: (k: keyof WizardState, v: unknown) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const amount = state.reward_amount;
  const fee = Math.round(amount * PLATFORM_FEE_PCT * 100) / 100;
  const total = amount + fee;

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-3">Reward Amount (USDC)</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_AMOUNTS.map((amt) => (
            <button
              key={amt}
              onClick={() => { onChange('reward_amount', amt); onChange('custom_amount', ''); }}
              className={`px-4 py-2 rounded-lg border text-sm font-mono font-medium transition-all duration-150 ${
                state.reward_amount === amt && !state.custom_amount
                  ? 'bg-emerald text-text-inverse border-emerald'
                  : 'border-border text-text-secondary hover:border-emerald hover:text-emerald'
              }`}
            >
              ${amt}
            </button>
          ))}
          <input
            type="number"
            value={state.custom_amount}
            onChange={(e) => {
              const v = e.target.value;
              onChange('custom_amount', v);
              if (v && !isNaN(Number(v))) onChange('reward_amount', Number(v));
            }}
            placeholder="Custom"
            min={1}
            className={`${inputClass} w-28`}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Deadline</label>
        <input
          type="date"
          value={state.deadline}
          min={minDateStr}
          onChange={(e) => onChange('deadline', e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-text-secondary">AI Suggested Tier:</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-magenta-bg text-magenta border border-magenta-border">
          T2 (Medium)
        </span>
      </div>

      <div className="bg-forge-800 border border-border rounded-lg p-4 font-mono text-sm space-y-2">
        <div className="flex justify-between text-text-secondary">
          <span>Bounty reward:</span>
          <span>${amount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-text-secondary">
          <span>Platform fee (5%):</span>
          <span>${fee.toFixed(2)}</span>
        </div>
        <div className="border-t border-border/50 pt-2 flex justify-between font-semibold text-emerald">
          <span>Total to fund:</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-6 py-2.5 rounded-lg border border-border text-text-secondary text-sm font-medium hover:border-border-hover hover:text-text-primary transition-all duration-200">
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!state.deadline}
          className="px-6 py-2.5 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

/**
 * Step3 — collects the escrow deposit transaction signature, verifies it,
 * and enables publishing once verification succeeds.
 */
function Step3({
  state,
  onChange,
  onBack,
  onSubmit,
  creating,
}: {
  state: WizardState;
  onChange: (k: keyof WizardState, v: unknown) => void;
  onBack: () => void;
  onSubmit: () => void;
  creating: boolean;
}) {
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);

  const treasuryAddress = state.treasury_address ?? 'Loading treasury address...';

  const copyAddr = () => {
    if (!state.treasury_address) return;
    navigator.clipboard.writeText(state.treasury_address).then(() => {
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 2000);
    });
  };

  const handleVerify = async () => {
    if (!state.tx_signature.trim() || !state.bounty_id) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await verifyEscrowDeposit({ bounty_id: state.bounty_id, tx_signature: state.tx_signature });
      if (result.verified) {
        onChange('verified', true);
      } else {
        setVerifyError(result.error ?? 'Verification failed. Check your transaction signature.');
      }
    } catch {
      setVerifyError('Verification failed. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-text-secondary mb-3">Send USDC to the following address:</p>
        <div className="font-mono text-sm bg-forge-700 border border-border rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <span className="truncate text-text-primary">{treasuryAddress}</span>
          <button
            onClick={copyAddr}
            disabled={!state.treasury_address}
            className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
          >
            {copiedAddr ? <Check className="w-4 h-4 text-emerald" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        {state.total_to_fund && (
          <p className="mt-2 text-sm text-text-muted">
            Amount: <span className="font-mono text-emerald font-semibold">${state.total_to_fund.toFixed(2)} USDC</span>
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Paste Transaction Signature</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={state.tx_signature}
            onChange={(e) => onChange('tx_signature', e.target.value)}
            disabled={state.verified}
            placeholder="5KfR8xMn..."
            className={`flex-1 bg-forge-700 border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald focus:ring-1 focus:ring-emerald/30 outline-none transition-all duration-150`}
          />
          <button
            onClick={handleVerify}
            disabled={!state.tx_signature.trim() || verifying || state.verified || !state.bounty_id}
            className="px-4 py-3 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
          >
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : state.verified ? <Check className="w-4 h-4" /> : null}
            {state.verified ? 'Verified' : verifying ? 'Verifying...' : 'Verify Payment'}
          </button>
        </div>
      </div>

      {verifyError && (
        <p className="text-sm text-status-error bg-status-error/10 border border-status-error/20 rounded-lg px-4 py-3">
          {verifyError}
        </p>
      )}

      <div className="text-sm font-mono">
        {state.verified ? (
          <span className="text-emerald inline-flex items-center gap-1.5">
            <Check className="w-4 h-4" /> Payment verified! Bounty is ready to publish.
          </span>
        ) : (
          <span className="text-text-muted">⏳ Awaiting verification...</span>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-6 py-2.5 rounded-lg border border-border text-text-secondary text-sm font-medium hover:border-border-hover hover:text-text-primary transition-all duration-200">
          ← Back
        </button>
        <button
          onClick={onSubmit}
          disabled={!state.verified || creating}
          className="px-6 py-2.5 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {creating && <Loader2 className="w-4 h-4 animate-spin" />}
          Publish Bounty
        </button>
      </div>
    </div>
  );
}

/**
 * BountyCreateWizard — multi-step bounty creation flow (Describe → Timeline & Reward → Fund & Publish).
 * Collects title, description, reward amount, deadline, and escrow verification before publishing.
 */
export function BountyCreateWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [state, setState] = useState<WizardState>({
    title: '',
    description: '',
    github_repo_url: '',
    github_issue_url: '',
    reward_amount: 20,
    custom_amount: '',
    deadline: '',
    tier: 'T2',
    tags: [],
    tx_signature: '',
    verified: false,
  });

  const onChange = useCallback((k: keyof WizardState, v: unknown) => {
    setState((prev) => ({ ...prev, [k]: v }));
  }, []);

  const handleStep1Next = () => setStep(1);
  const handleStep2Next = async () => {
    setCreating(true);
    setError(null);
    try {
      const payload: BountyCreatePayload = {
        title: state.title,
        description: state.description,
        reward_amount: state.reward_amount,
        reward_token: 'USDC',
        deadline: state.deadline ? new Date(state.deadline).toISOString() : undefined,
        github_repo_url: state.github_repo_url || undefined,
        github_issue_url: state.github_issue_url || undefined,
      };
      const bounty = await createBounty(payload);
      const depositInfo = await getTreasuryDepositInfo(bounty.id);
      onChange('bounty_id', bounty.id);
      onChange('treasury_address', depositInfo.treasury_address);
      onChange('total_to_fund', depositInfo.total_to_fund);
      setStep(2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create bounty. Try again.');
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async () => {
    if (!state.bounty_id) return;
    setCreating(true);
    setError(null);
    try {
      await verifyEscrowDeposit({ bounty_id: state.bounty_id, tx_signature: state.tx_signature });
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to publish bounty. Try again.');
    } finally {
      setCreating(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-emerald/10 border border-emerald/30 flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-emerald" />
        </div>
        <h2 className="font-display text-2xl font-bold text-text-primary mb-3">Bounty Published!</h2>
        <p className="text-text-muted mb-6">Your bounty is live. Contributors will be notified.</p>
        <button onClick={() => state.bounty_id && navigate(`/bounties/${state.bounty_id}`)} className="px-6 py-3 rounded-lg bg-emerald text-text-inverse font-semibold text-sm">
          View Bounty
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <StepIndicator currentStep={step} />

      {error && (
        <p className="mb-6 text-sm text-status-error bg-status-error/10 border border-status-error/20 rounded-lg px-4 py-3">{error}</p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          variants={pageTransition}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {step === 0 && <Step1 state={state} onChange={onChange} onNext={handleStep1Next} />}
          {step === 1 && <Step2 state={state} onChange={onChange} onNext={handleStep2Next} onBack={() => setStep(0)} />}
          {step === 2 && <Step3 state={state} onChange={onChange} onBack={() => setStep(1)} onSubmit={handlePublish} creating={creating} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
