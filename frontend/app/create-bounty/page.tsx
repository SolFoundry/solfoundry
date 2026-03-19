'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { BountyTier } from '@/types/bounty';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BountyFormData {
  title: string;
  description: string;
  tier: BountyTier;
  reward: string;
  fundingAmount: string;
  walletAddress: string;
  skills: string[];
}

// Mock data for pre-fill
const MOCK_DATA: BountyFormData = {
  title: 'Build a Multi-Signature Wallet Interface',
  description: 'Create a user-friendly multi-sig wallet interface for Solana that allows multiple signers to approve transactions. Should include transaction queue, approval workflow, and history tracking.',
  tier: 'T1',
  reward: '5000',
  fundingAmount: '10000',
  walletAddress: '',
  skills: ['React', 'Solana', 'TypeScript'],
};

// ─── Constants ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, name: 'Bounty Details', description: 'Title, description & tier' },
  { id: 2, name: 'Reward & Funding', description: 'Set reward amount' },
  { id: 3, name: 'Review & Confirm', description: 'Confirm details' },
];

const TIER_OPTIONS: { value: BountyTier; label: string; desc: string }[] = [
  { value: 'T1', label: 'Tier 1 — Open Race', desc: 'First valid PR wins' },
  { value: 'T2', label: 'Tier 2 — Assigned', desc: 'Assigned to selected dev' },
  { value: 'T3', label: 'Tier 3 — Complex', desc: 'Multi-stage or long-term' },
];

// ─── Components ───────────────────────────────────────────────────────────

function ProgressIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm font-bold
                  ${currentStep > step.id
                    ? 'bg-[#14F195] text-black'
                    : currentStep === step.id
                    ? 'bg-[#9945FF] text-white'
                    : 'bg-gray-800 text-gray-500 border border-gray-700'
                  }`}
              >
                {currentStep > step.id ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.id
                )}
              </div>
              <div className="mt-2 text-center hidden sm:block">
                <div className={`text-xs font-medium ${currentStep >= step.id ? 'text-white' : 'text-gray-500'}`}>
                  {step.name}
                </div>
                <div className="text-[10px] text-gray-500">{step.description}</div>
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${currentStep > step.id ? 'bg-[#14F195]' : 'bg-gray-800'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WalletModal({
  isOpen,
  onClose,
  onConnect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (address: string) => void;
}) {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      setError('Please enter a wallet address');
      return;
    }
    if (address.length < 32) {
      setError('Invalid wallet address format');
      return;
    }
    onConnect(address);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0a0a0a] border border-[#9945FF]/30 rounded-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-bold text-white font-mono mb-4">Connect Wallet</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs text-gray-400 font-mono mb-2">Wallet Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter your Solana wallet address..."
              className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white font-mono text-sm
                         placeholder-gray-500 focus:outline-none focus:border-[#9945FF] transition-colors"
            />
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-gray-400 font-mono text-sm
                         hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-[#9945FF] text-white font-mono text-sm
                         hover:bg-[#9945FF]/80 transition-colors"
            >
              Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SuccessState({ bountyId }: { bountyId: number }) {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#14F195]/10 border-2 border-[#14F195] flex items-center justify-center">
        <svg className="w-10 h-10 text-[#14F195]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-white font-mono mb-2">Bounty Created!</h2>
      <p className="text-gray-400 font-mono text-sm mb-6">
        Your bounty #{bountyId} has been successfully published.
      </p>
      <div className="flex items-center justify-center gap-4">
        <Link
          href={`/bounty/${bountyId}`}
          className="px-6 py-2 rounded-lg bg-[#9945FF] text-white font-mono text-sm
                     hover:bg-[#9945FF]/80 transition-colors"
        >
          View Bounty
        </Link>
        <Link
          href="/bounties"
          className="px-6 py-2 rounded-lg border border-gray-700 text-gray-400 font-mono text-sm
                     hover:bg-gray-800 transition-colors"
        >
          Back to Board
        </Link>
      </div>
    </div>
  );
}

// ─── Step Forms ────────────────────────────────────────────────────────────

function Step1({
  data,
  onChange,
  errors,
}: {
  data: BountyFormData;
  onChange: (field: keyof BountyFormData, value: string | string[]) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-300 font-mono mb-2">
          Bounty Title *
        </label>
        <input
          type="text"
          value={data.title}
          onChange={(e) => onChange('title', e.target.value)}
          placeholder="e.g., Fix critical bug in swap logic"
          className={`w-full px-4 py-3 rounded-lg bg-gray-900 border ${errors.title ? 'border-red-500' : 'border-gray-700'} 
                     text-white font-mono text-sm placeholder-gray-500 focus:outline-none focus:border-[#9945FF] transition-colors`}
        />
        {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 font-mono mb-2">
          Description *
        </label>
        <textarea
          value={data.description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Describe the bounty requirements, scope, and deliverables..."
          rows={5}
          className={`w-full px-4 py-3 rounded-lg bg-gray-900 border ${errors.description ? 'border-red-500' : 'border-gray-700'} 
                     text-white font-mono text-sm placeholder-gray-500 focus:outline-none focus:border-[#9945FF] transition-colors resize-none`}
        />
        {errors.description && <p className="mt-1 text-xs text-red-400">{errors.description}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 font-mono mb-3">
          Select Tier *
        </label>
        <div className="grid gap-3">
          {TIER_OPTIONS.map((tier) => (
            <button
              key={tier.value}
              type="button"
              onClick={() => onChange('tier', tier.value)}
              className={`p-4 rounded-lg border text-left transition-all ${
                data.tier === tier.value
                  ? 'bg-[#9945FF]/10 border-[#9945FF]'
                  : 'bg-gray-900 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className={`font-mono text-sm font-bold ${data.tier === tier.value ? 'text-[#9945FF]' : 'text-white'}`}>
                {tier.label}
              </div>
              <div className="text-xs text-gray-500 mt-1">{tier.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step2({
  data,
  onChange,
  onConnectWallet,
  errors,
}: {
  data: BountyFormData;
  onChange: (field: keyof BountyFormData, value: string) => void;
  onConnectWallet: () => void;
  errors: Record<string, string>;
}) {
  const isConnected = data.walletAddress.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-300 font-mono mb-2">
          Reward Amount (FNDRY) *
        </label>
        <div className="relative">
          <input
            type="number"
            value={data.reward}
            onChange={(e) => onChange('reward', e.target.value)}
            placeholder="5000"
            min="1"
            className={`w-full px-4 py-3 rounded-lg bg-gray-900 border ${errors.reward ? 'border-red-500' : 'border-gray-700'} 
                       text-white font-mono text-sm placeholder-gray-500 focus:outline-none focus:border-[#9945FF] transition-colors`}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">
            FNDRY
          </span>
        </div>
        {errors.reward && <p className="mt-1 text-xs text-red-400">{errors.reward}</p>}
        <p className="mt-2 text-xs text-gray-500">Minimum reward: 100 FNDRY</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 font-mono mb-2">
          Funding Amount (FNDRY) *
        </label>
        <div className="relative">
          <input
            type="number"
            value={data.fundingAmount}
            onChange={(e) => onChange('fundingAmount', e.target.value)}
            placeholder="10000"
            min="1"
            className={`w-full px-4 py-3 rounded-lg bg-gray-900 border ${errors.fundingAmount ? 'border-red-500' : 'border-gray-700'} 
                       text-white font-mono text-sm placeholder-gray-500 focus:outline-none focus:border-[#9945FF] transition-colors`}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">
            FNDRY
          </span>
        </div>
        {errors.fundingAmount && <p className="mt-1 text-xs text-red-400">{errors.fundingAmount}</p>}
        <p className="mt-2 text-xs text-gray-500">Must be at least 2x the reward amount</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 font-mono mb-2">
          Wallet Connection *
        </label>
        {isConnected ? (
          <div className="flex items-center justify-between p-4 rounded-lg bg-[#14F195]/10 border border-[#14F195]/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#14F195]/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#14F195]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-white font-mono">Connected</div>
                <div className="text-xs text-gray-400 font-mono">
                  {data.walletAddress.slice(0, 6)}...{data.walletAddress.slice(-4)}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onConnectWallet}
              className="text-xs text-[#9945FF] hover:text-[#9945FF]/80 font-mono"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConnectWallet}
            className="w-full p-4 rounded-lg border border-dashed border-gray-700 text-gray-400 font-mono text-sm
                       hover:border-[#9945FF] hover:text-[#9945FF] transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Connect Wallet
          </button>
        )}
        {errors.walletAddress && <p className="mt-2 text-xs text-red-400">{errors.walletAddress}</p>}
      </div>
    </div>
  );
}

function Step3Review({
  data,
}: {
  data: BountyFormData;
}) {
  const tierLabels: Record<BountyTier, string> = {
    T1: 'Tier 1 — Open Race',
    T2: 'Tier 2 — Assigned',
    T3: 'Tier 3 — Complex',
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-gray-900 border border-gray-700">
        <h4 className="text-sm font-bold text-white font-mono mb-4">Bounty Details</h4>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-xs text-gray-500 font-mono">Title</span>
            <span className="text-sm text-white font-mono">{data.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500 font-mono">Description</span>
            <span className="text-sm text-white font-mono max-w-[200px] text-right truncate">{data.description}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500 font-mono">Tier</span>
            <span className="text-sm text-[#9945FF] font-mono">{tierLabels[data.tier]}</span>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-gray-900 border border-gray-700">
        <h4 className="text-sm font-bold text-white font-mono mb-4">Reward & Funding</h4>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-xs text-gray-500 font-mono">Reward Amount</span>
            <span className="text-sm text-[#14F195] font-mono">{data.reward} FNDRY</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500 font-mono">Funding Amount</span>
            <span className="text-sm text-white font-mono">{data.fundingAmount} FNDRY</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500 font-mono">Wallet</span>
            <span className="text-sm text-white font-mono">
              {data.walletAddress.slice(0, 6)}...{data.walletAddress.slice(-4)}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-[#9945FF]/10 border border-[#9945FF]/30">
        <div className="flex items-center gap-2 text-[#9945FF] mb-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-bold font-mono">Ready to Publish</span>
        </div>
        <p className="text-xs text-gray-400 font-mono">
          Once you confirm, your bounty will be published and developers can start submitting solutions.
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function CreateBountyPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<BountyFormData>(MOCK_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bountyId, setBountyId] = useState(0);

  const updateField = (field: keyof BountyFormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.title.trim()) {
        newErrors.title = 'Title is required';
      } else if (formData.title.length < 5) {
        newErrors.title = 'Title must be at least 5 characters';
      }
      if (!formData.description.trim()) {
        newErrors.description = 'Description is required';
      } else if (formData.description.length < 20) {
        newErrors.description = 'Description must be at least 20 characters';
      }
    }

    if (step === 2) {
      const reward = parseInt(formData.reward);
      if (!formData.reward || isNaN(reward)) {
        newErrors.reward = 'Reward amount is required';
      } else if (reward < 100) {
        newErrors.reward = 'Minimum reward is 100 FNDRY';
      }
      const funding = parseInt(formData.fundingAmount);
      if (!formData.fundingAmount || isNaN(funding)) {
        newErrors.fundingAmount = 'Funding amount is required';
      } else if (funding < reward * 2) {
        newErrors.fundingAmount = 'Funding must be at least 2x the reward';
      }
      if (!formData.walletAddress) {
        newErrors.walletAddress = 'Wallet connection is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(2)) return;
    
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock success - generate random bounty ID
    setBountyId(Math.floor(Math.random() * 900) + 100);
    setSuccess(true);
    setIsSubmitting(false);
  };

  const handleWalletConnect = (address: string) => {
    updateField('walletAddress', address);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <SuccessState bountyId={bountyId} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white font-mono">Create Bounty</h1>
              <p className="text-xs text-gray-500 font-mono mt-1">Set up a new bounty for developers</p>
            </div>
            <Link
              href="/bounties"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <ProgressIndicator currentStep={currentStep} />

        <div className="bg-[#0a0a0a] rounded-xl border border-gray-800 p-6">
          {currentStep === 1 && (
            <Step1 data={formData} onChange={updateField} errors={errors} />
          )}
          {currentStep === 2 && (
            <Step2
              data={formData}
              onChange={updateField}
              onConnectWallet={() => setIsWalletModalOpen(true)}
              errors={errors}
            />
          )}
          {currentStep === 3 && (
            <Step3Review data={formData} />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-800">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              className={`px-4 py-2 rounded-lg font-mono text-sm transition-colors
                ${currentStep === 1
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
            >
              ← Back
            </button>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2 rounded-lg bg-[#9945FF] text-white font-mono text-sm
                           hover:bg-[#9945FF]/80 transition-colors"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 rounded-lg bg-[#14F195] text-black font-mono text-sm font-bold
                           hover:bg-[#14F195]/80 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Publishing...
                  </span>
                ) : (
                  'Publish Bounty'
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Wallet Modal */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnect={handleWalletConnect}
      />
    </div>
  );
}
