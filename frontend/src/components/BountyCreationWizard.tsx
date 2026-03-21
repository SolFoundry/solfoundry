'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useFndryBalance } from '../hooks/useFndryToken';
import { FundBountyButton } from './wallet/FundBountyFlow';
import { solscanTxUrl } from '../config/constants';
import { useNetwork } from './wallet/WalletProvider';

// Types
interface BountyFormData {
  tier: 'T1' | 'T2' | 'T3' | '';
  title: string;
  description: string;
  requirements: string[];
  category: string;
  skills: string[];
  rewardAmount: number;
  deadline: string;
}

// Validation function for draft data from localStorage
function isValidBountyFormData(data: unknown): data is BountyFormData {
  if (typeof data !== 'object' || data === null) return false;
  
  const d = data as Record<string, unknown>;
  
  // Validate tier
  if (d.tier !== undefined && !['T1', 'T2', 'T3', ''].includes(d.tier as string)) {
    return false;
  }
  
  // Validate strings
  if (d.title !== undefined && typeof d.title !== 'string') return false;
  if (d.description !== undefined && typeof d.description !== 'string') return false;
  if (d.category !== undefined && typeof d.category !== 'string') return false;
  if (d.deadline !== undefined && typeof d.deadline !== 'string') return false;
  
  // Validate arrays
  if (d.requirements !== undefined) {
    if (!Array.isArray(d.requirements)) return false;
    if (!d.requirements.every((r: unknown) => typeof r === 'string')) return false;
  }
  
  if (d.skills !== undefined) {
    if (!Array.isArray(d.skills)) return false;
    if (!d.skills.every((s: unknown) => typeof s === 'string')) return false;
  }
  
  // Validate rewardAmount
  if (d.rewardAmount !== undefined && typeof d.rewardAmount !== 'number') return false;
  
  return true;
}

// Simple markdown to HTML converter (safe subset)
function renderMarkdown(text: string): string {
  if (!text) return '';
  
  let html = text
    // Escape HTML to prevent XSS
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-white mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-white mt-4 mb-2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-white mt-4 mb-2">$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-gray-900 p-3 rounded-lg overflow-x-auto my-2"><code class="text-green-400">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-900 px-1.5 py-0.5 rounded text-purple-400 text-sm">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-purple-400 hover:text-purple-300 underline" target="_blank" rel="noopener noreferrer">$1</a>')
    // Lists
    .replace(/^\s*[-*]\s+(.*)$/gim, '<li class="ml-4 list-disc">$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p class="my-2">')
    .replace(/\n/g, '<br/>');
  
  return `<div class="prose prose-invert prose-sm max-w-none"><p class="my-2">${html}</p></div>`;
}

// Auth context types — GitHub auth is placeholder; wallet state comes from hooks.
interface AuthState {
  isGithubAuthenticated: boolean;
}

interface StepProps {
  formData: BountyFormData;
  updateFormData: (updates: Partial<BountyFormData>) => void;
  errors: Record<string, string>;
}

const initialFormData: BountyFormData = {
  tier: '',
  title: '',
  description: '',
  requirements: [''],
  category: '',
  skills: [],
  rewardAmount: 100000,
  deadline: '',
};

const DRAFT_KEY = 'bounty_creation_draft';

const CATEGORIES = [
  'Frontend',
  'Backend',
  'Smart Contracts',
  'DevOps',
  'Documentation',
  'Design',
  'Security',
  'Testing',
];

const SKILLS_OPTIONS = [
  'TypeScript',
  'React',
  'Next.js',
  'Tailwind CSS',
  'Python',
  'FastAPI',
  'Rust',
  'Solana',
  'PostgreSQL',
  'Redis',
  'WebSocket',
  'Docker',
];

const TIER_INFO = {
  T1: {
    name: 'Tier 1 - Open Race',
    description: 'Anyone can submit. First clean PR wins.',
    rules: ['No claiming needed', '72 hours deadline', 'Min score: 6.0/10', 'Speed matters'],
    color: 'text-green-400',
    borderColor: 'border-green-500',
  },
  T2: {
    name: 'Tier 2 - Open Race (Gated)',
    description: 'Requires 4+ merged T1 bounties.',
    rules: ['Open race after unlock', '7 days deadline', 'Min score: 7/10', 'Gated access'],
    color: 'text-yellow-400',
    borderColor: 'border-yellow-500',
  },
  T3: {
    name: 'Tier 3 - Claim-Based (Gated)',
    description: 'Requires 3+ merged T2 bounties.',
    rules: ['Must claim first', '14 days deadline', 'Min score: 6.0/10', 'Max 2 concurrent claims'],
    color: 'text-red-400',
    borderColor: 'border-red-500',
  },
};

// Step 1: Tier Selection
const TierSelection: React.FC<StepProps> = ({ formData, updateFormData, errors }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Select Bounty Tier</h2>
      <p className="text-gray-400">Choose the tier that matches your bounty complexity.</p>
      
      <div className="grid gap-4">
        {(['T1', 'T2', 'T3'] as const).map((tier) => {
          const info = TIER_INFO[tier];
          const isSelected = formData.tier === tier;
          
          return (
            <button
              key={tier}
              onClick={() => updateFormData({ tier })}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                isSelected
                  ? `${info.borderColor} bg-gray-800`
                  : 'border-gray-700 bg-gray-900 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`font-bold ${info.color}`}>{info.name}</span>
                {isSelected && (
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-gray-400 text-sm mb-3">{info.description}</p>
              <ul className="space-y-1">
                {info.rules.map((rule, idx) => (
                  <li key={idx} className="text-gray-500 text-xs flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full" />
                    {rule}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      
      {errors.tier && <p className="text-red-400 text-sm">{errors.tier}</p>}
    </div>
  );
};

// Step 2: Title & Description
const TitleDescription: React.FC<StepProps> = ({ formData, updateFormData, errors }) => {
  const [showPreview, setShowPreview] = useState(false);
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Title & Description</h2>
      <p className="text-gray-400">Provide a clear title and detailed description.</p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Bounty Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => updateFormData({ title: e.target.value })}
            placeholder="e.g., Implement User Authentication System"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
          {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title}</p>}
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">
              Description (Markdown) *
            </label>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              {showPreview ? 'Edit' : 'Preview'}
            </button>
          </div>
          
          {showPreview ? (
            <div 
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 min-h-[200px] text-gray-300 prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: formData.description 
                  ? renderMarkdown(formData.description) 
                  : '<p class="text-gray-500 italic">No description yet...</p>' 
              }}
            />
          ) : (
            <textarea
              value={formData.description}
              onChange={(e) => updateFormData({ description: e.target.value })}
              placeholder="Describe the bounty in detail. Include requirements, expected deliverables, and any relevant technical specifications..."
              rows={8}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none font-mono text-sm"
            />
          )}
          {errors.description && <p className="text-red-400 text-sm mt-1">{errors.description}</p>}
        </div>
      </div>
    </div>
  );
};

// Step 3: Requirements Checklist
const RequirementsBuilder: React.FC<StepProps> = ({ formData, updateFormData, errors }) => {
  const addRequirement = () => {
    updateFormData({ requirements: [...formData.requirements, ''] });
  };
  
  const removeRequirement = (index: number) => {
    const newReqs = formData.requirements.filter((_, i) => i !== index);
    updateFormData({ requirements: newReqs.length > 0 ? newReqs : [''] });
  };
  
  const updateRequirement = (index: number, value: string) => {
    const newReqs = [...formData.requirements];
    newReqs[index] = value;
    updateFormData({ requirements: newReqs });
  };
  
  const moveRequirement = (from: number, to: number) => {
    if (to < 0 || to >= formData.requirements.length) return;
    const newReqs = [...formData.requirements];
    [newReqs[from], newReqs[to]] = [newReqs[to], newReqs[from]];
    updateFormData({ requirements: newReqs });
  };
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Requirements Checklist</h2>
      <p className="text-gray-400">Add the deliverables contributors must complete.</p>
      
      <div className="space-y-3">
        {formData.requirements.map((req, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-gray-500 text-sm w-6">{index + 1}.</span>
            <input
              type="text"
              value={req}
              onChange={(e) => updateRequirement(index, e.target.value)}
              placeholder="Enter requirement..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => moveRequirement(index, index - 1)}
                disabled={index === 0}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveRequirement(index, index + 1)}
                disabled={index === formData.requirements.length - 1}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeRequirement(index)}
                disabled={formData.requirements.length === 1}
                className="p-2 text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Remove"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <button
        type="button"
        onClick={addRequirement}
        className="flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm"
      >
        <span className="text-lg">+</span> Add Requirement
      </button>
      
      {errors.requirements && <p className="text-red-400 text-sm">{errors.requirements}</p>}
    </div>
  );
};

// Step 4: Category & Skills
const CategorySkills: React.FC<StepProps> = ({ formData, updateFormData, errors }) => {
  const toggleSkill = (skill: string) => {
    const newSkills = formData.skills.includes(skill)
      ? formData.skills.filter((s) => s !== skill)
      : [...formData.skills, skill];
    updateFormData({ skills: newSkills });
  };
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Category & Skills</h2>
      <p className="text-gray-400">Categorize your bounty and tag required skills.</p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Category *</label>
          <select
            value={formData.category}
            onChange={(e) => updateFormData({ category: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
          >
            <option value="">Select a category...</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {errors.category && <p className="text-red-400 text-sm mt-1">{errors.category}</p>}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Required Skills</label>
          <div className="flex flex-wrap gap-2">
            {SKILLS_OPTIONS.map((skill) => {
              const isSelected = formData.skills.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {skill}
                </button>
              );
            })}
          </div>
          {errors.skills && <p className="text-red-400 text-sm mt-1">{errors.skills}</p>}
        </div>
      </div>
    </div>
  );
};

// Step 5: Reward & Deadline
const RewardDeadline: React.FC<StepProps> = ({ formData, updateFormData, errors }) => {
  const presetAmounts = [50000, 100000, 250000, 500000, 1000000];
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Reward & Deadline</h2>
      <p className="text-gray-400">Set the $FNDRY reward amount and deadline.</p>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Reward Amount ($FNDRY) *
          </label>
          <div className="flex gap-2 mb-3">
            {presetAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => updateFormData({ rewardAmount: amount })}
                className={`px-3 py-2 rounded-lg text-sm transition-all ${
                  formData.rewardAmount === amount
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {(amount / 1000).toFixed(0)}K
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              type="number"
              value={formData.rewardAmount}
              onChange={(e) => updateFormData({ rewardAmount: parseInt(e.target.value) || 0 })}
              min={1000}
              step={1000}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none pr-20"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">$FNDRY</span>
          </div>
          {errors.rewardAmount && <p className="text-red-400 text-sm mt-1">{errors.rewardAmount}</p>}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Deadline *
          </label>
          <input
            type="date"
            value={formData.deadline}
            onChange={(e) => updateFormData({ deadline: e.target.value })}
            min={new Date().toISOString().split('T')[0]}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
          />
          {errors.deadline && <p className="text-red-400 text-sm mt-1">{errors.deadline}</p>}
        </div>
      </div>
    </div>
  );
};

// Step 6: Preview
const PreviewBounty: React.FC<StepProps> = ({ formData }) => {
  const tierInfo = TIER_INFO[formData.tier as keyof typeof TIER_INFO];
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Preview Bounty</h2>
      <p className="text-gray-400">Review your bounty before publishing.</p>
      
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-700 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2 py-1 rounded text-xs font-bold ${tierInfo?.color} bg-gray-800`}>
              {formData.tier}
            </span>
            <span className="px-2 py-1 rounded text-xs bg-purple-600 text-white">
              {formData.category}
            </span>
          </div>
          <h3 className="text-2xl font-bold text-white">{formData.title || 'Untitled Bounty'}</h3>
          <div className="flex items-center gap-4 mt-3 text-sm">
            <span className="text-green-400 font-bold">
              {formData.rewardAmount.toLocaleString()} $FNDRY
            </span>
            <span className="text-gray-400">
              Deadline: {formData.deadline || 'Not set'}
            </span>
          </div>
        </div>
        
        {/* Description */}
        <div>
          <h4 className="text-sm font-bold text-gray-400 uppercase mb-2">Description</h4>
          <div 
            className="text-gray-300 prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: formData.description 
                ? renderMarkdown(formData.description) 
                : '<p class="text-gray-500 italic">No description provided.</p>' 
            }}
          />
        </div>
        
        {/* Requirements */}
        <div>
          <h4 className="text-sm font-bold text-gray-400 uppercase mb-2">Requirements</h4>
          <ul className="space-y-2">
            {formData.requirements.filter(Boolean).map((req, idx) => (
              <li key={idx} className="flex items-start gap-2 text-gray-300">
                <input type="checkbox" disabled className="mt-1 accent-purple-500" />
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Skills */}
        {formData.skills.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-gray-400 uppercase mb-2">Required Skills</h4>
            <div className="flex flex-wrap gap-2">
              {formData.skills.map((skill) => (
                <span key={skill} className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-sm">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Step 7: Fund & Publish — real wallet integration
interface ConfirmPublishProps extends StepProps {
  onPublish: () => Promise<void>;
}

const ConfirmPublish: React.FC<ConfirmPublishProps> = ({ formData, onPublish }) => {
  const { connected, publicKey } = useWallet();
  const { balance, loading: balanceLoading } = useFndryBalance();
  const { network } = useNetwork();
  const [agreed, setAgreed] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fundingSignature, setFundingSignature] = useState<string | null>(null);

  const isWalletConnected = connected && !!publicKey;
  const walletBalance = balance ?? 0;
  const hasSufficientBalance = walletBalance >= formData.rewardAmount;
  const isFunded = !!fundingSignature;
  const canPublish = agreed && isWalletConnected && isFunded;

  const handleFunded = (signature: string) => {
    setFundingSignature(signature);
  };

  const handlePublish = async () => {
    if (!canPublish) return;
    setIsPublishing(true);
    setError(null);
    try {
      await onPublish();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish bounty');
    } finally {
      setIsPublishing(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="text-green-400 text-6xl mb-4">✓</div>
        <h2 className="text-2xl font-bold text-white">Bounty Published & Funded!</h2>
        <p className="text-gray-400">
          Your bounty has been created and {formData.rewardAmount.toLocaleString()} $FNDRY is held in escrow.
        </p>
        {fundingSignature && (
          <a
            href={solscanTxUrl(fundingSignature, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-sm"
          >
            View funding transaction on Solscan ↗
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Fund & Publish</h2>
      <p className="text-gray-400">Stake $FNDRY to fund the bounty escrow, then publish.</p>

      {/* Wallet & Funding Status */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Wallet</span>
          <span className={isWalletConnected ? 'text-green-400' : 'text-red-400'}>
            {isWalletConnected ? '✓ Connected' : '✗ Not connected'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">$FNDRY Balance</span>
          <span className={!balanceLoading && !hasSufficientBalance && isWalletConnected ? 'text-red-400' : 'text-green-400'}>
            {balanceLoading
              ? 'Loading…'
              : isWalletConnected
                ? `${walletBalance.toLocaleString()} $FNDRY`
                : '—'}
            {!balanceLoading && !hasSufficientBalance && isWalletConnected &&
              ` (Need ${formData.rewardAmount.toLocaleString()})`}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Escrow Funding</span>
          <span className={isFunded ? 'text-green-400' : 'text-yellow-400'}>
            {isFunded ? '✓ Funded' : '○ Pending'}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Bounty Tier</span>
          <span className="text-white font-medium">{formData.tier}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Title</span>
          <span className="text-white font-medium truncate ml-4">{formData.title}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Staking Amount</span>
          <span className="text-green-400 font-bold">{formData.rewardAmount.toLocaleString()} $FNDRY</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Deadline</span>
          <span className="text-white font-medium">{formData.deadline}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Requirements</span>
          <span className="text-white font-medium">{formData.requirements.filter(Boolean).length} items</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 accent-purple-500"
        />
        <span className="text-gray-300 text-sm">
          I confirm this bounty is accurate and authorize the staking of{' '}
          {formData.rewardAmount.toLocaleString()} $FNDRY into escrow.
        </span>
      </label>

      {/* Two-phase flow: fund first, then publish */}
      {!isFunded ? (
        <FundBountyButton
          amount={formData.rewardAmount}
          onFunded={handleFunded}
          disabled={!agreed || !isWalletConnected}
        />
      ) : (
        <button
          onClick={handlePublish}
          disabled={!canPublish || isPublishing}
          className="w-full py-3 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-linear-to-r from-purple-600 to-green-500 text-white hover:from-purple-500 hover:to-green-400"
        >
          {isPublishing ? 'Publishing…' : 'Publish Bounty'}
        </button>
      )}

      {!isWalletConnected && (
        <p className="text-yellow-400 text-sm text-center">
          Please connect your Solana wallet to fund and publish.
        </p>
      )}
    </div>
  );
};

// Main Wizard Component
interface BountyCreationWizardProps {
  onPublishBounty?: (formData: BountyFormData) => Promise<void>;
}

export const BountyCreationWizard: React.FC<BountyCreationWizardProps> = ({
  onPublishBounty,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<BountyFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalSteps = 7;
  const progressPercent = (currentStep / totalSteps) * 100;
  const stepTitles = [
    'Select Tier',
    'Title & Description',
    'Requirements',
    'Category & Skills',
    'Reward & Deadline',
    'Preview',
    'Fund & Publish',
  ];
  
  // Load draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate the parsed data before using it
        if (isValidBountyFormData(parsed)) {
          // Merge with defaults to ensure all fields exist
          setFormData({
            ...initialFormData,
            ...parsed,
            // Ensure requirements always has at least one item
            requirements: Array.isArray(parsed.requirements) && parsed.requirements.length > 0 
              ? parsed.requirements 
              : [''],
          });
        } else {
          console.warn('Invalid draft data found, ignoring');
          localStorage.removeItem(DRAFT_KEY);
        }
      }
    } catch (e) {
      console.error('Failed to load draft:', e);
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);
  
  // Save draft on form change
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    } catch (e) {
      console.error('Failed to save draft:', e);
    }
  }, [formData]);
  
  const updateFormData = useCallback((updates: Partial<BountyFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setErrors({});
  }, []);
  
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    switch (step) {
      case 1:
        if (!formData.tier) newErrors.tier = 'Please select a tier';
        break;
      case 2:
        if (!formData.title.trim()) newErrors.title = 'Title is required';
        if (!formData.description.trim()) newErrors.description = 'Description is required';
        break;
      case 3:
        if (!formData.requirements.some((r) => r.trim())) {
          newErrors.requirements = 'At least one requirement is required';
        }
        break;
      case 4:
        if (!formData.category) newErrors.category = 'Please select a category';
        if (formData.skills.length === 0) newErrors.skills = 'Select at least one skill';
        break;
      case 5:
        // Base validation
        if (formData.rewardAmount < 1000) newErrors.rewardAmount = 'Minimum reward is 1,000 $FNDRY';
        if (!formData.deadline) newErrors.deadline = 'Please set a deadline';
        
        // Tier 2 specific validation
        if (formData.tier === 'T2') {
          if (formData.rewardAmount < 500000) {
            newErrors.rewardAmount = 'Tier 2 requires minimum reward of 500,000 $FNDRY';
          }
          const deadlineDate = new Date(formData.deadline);
          const minDeadline = new Date();
          minDeadline.setDate(minDeadline.getDate() + 7);
          if (deadlineDate < minDeadline) {
            newErrors.deadline = 'Tier 2 requires at least 7 days deadline';
          }
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((s) => Math.min(s + 1, totalSteps));
    }
  };
  
  const prevStep = () => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  };
  
  const handlePublish = async () => {
    if (onPublishBounty) {
      await onPublishBounty(formData);
    } else {
      const categoryMap: Record<string, string> = {
        'Frontend': 'frontend',
        'Backend': 'backend',
        'Smart Contracts': 'smart-contract',
        'DevOps': 'devops',
        'Documentation': 'documentation',
        'Design': 'design',
        'Security': 'security',
        'Testing': 'backend',
      };
      const tierMap: Record<string, number> = { T1: 1, T2: 2, T3: 3 };
      const requirementsBlock = formData.requirements
        .filter(Boolean)
        .map((r) => `- ${r}`)
        .join('\n');
      const fullDescription = formData.description +
        (requirementsBlock ? `\n\n## Requirements\n${requirementsBlock}` : '');

      const resp = await fetch('/api/bounties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: fullDescription,
          tier: tierMap[formData.tier] ?? 2,
          category: categoryMap[formData.category] ?? formData.category.toLowerCase(),
          reward_amount: formData.rewardAmount,
          required_skills: formData.skills.map((s) => s.toLowerCase()),
          deadline: formData.deadline
            ? new Date(formData.deadline + 'T23:59:59Z').toISOString()
            : undefined,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: 'Failed to create bounty' }));
        throw new Error(err.detail || 'Failed to create bounty');
      }
      localStorage.removeItem(DRAFT_KEY);
    }
  };
  
  const renderStep = () => {
    const props: StepProps = { formData, updateFormData, errors };
    
    switch (currentStep) {
      case 1: return <TierSelection {...props} />;
      case 2: return <TitleDescription {...props} />;
      case 3: return <RequirementsBuilder {...props} />;
      case 4: return <CategorySkills {...props} />;
      case 5: return <RewardDeadline {...props} />;
      case 6: return <PreviewBounty {...props} />;
      case 7: return (
        <ConfirmPublish
          {...props}
          onPublish={handlePublish}
        />
      );
      default: return null;
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-950 min-h-screen">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-white">Create Bounty</h1>
          <span className="text-gray-400 text-sm">Step {currentStep} of {totalSteps}</span>
        </div>
        <div 
          className="h-2 bg-gray-800 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Step ${currentStep} of ${totalSteps}`}
        >
          <div
            className="h-full bg-gradient-to-r from-purple-600 to-green-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          {stepTitles.map((title, idx) => (
            <div
              key={idx}
              className={`text-xs ${
                idx + 1 === currentStep
                  ? 'text-purple-400'
                  : idx + 1 < currentStep
                  ? 'text-green-400'
                  : 'text-gray-600'
              }`}
            >
              {title.split(' ')[0]}
            </div>
          ))}
        </div>
      </div>
      
      {/* Step Content */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        {renderStep()}
      </div>
      
      {/* Navigation */}
      {currentStep < 7 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="px-6 py-2 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            ← Back
          </button>
          <button
            onClick={nextStep}
            className="px-6 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-all"
          >
            {currentStep === 6 ? 'Continue to Publish' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  );
};

export default BountyCreationWizard;