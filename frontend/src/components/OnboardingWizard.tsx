'use client';

import React, { useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export type SkillCategory = 'frontend' | 'backend' | 'agent' | 'creative' | 'docs' | 'security';

export interface OnboardingWizardProps {
  /** Called when user completes onboarding */
  onComplete?: (data: OnboardingData) => void;
  /** Called when user dismisses/cancels */
  onDismiss?: () => void;
  /** Force dark mode class (default: dark) */
  darkMode?: boolean;
}

export interface OnboardingData {
  username: string;
  bio: string;
  skills: SkillCategory[];
  walletAddress?: string;
}

interface FormState {
  username: string;
  bio: string;
  selectedSkills: Set<SkillCategory>;
  walletAddress: string;
  walletConnected: boolean;
}

const SKILL_OPTIONS: { id: SkillCategory; label: string; emoji: string; description: string }[] = [
  { id: 'frontend', label: 'Frontend', emoji: '🎨', description: 'React, Vue, UI/UX, Tailwind' },
  { id: 'backend', label: 'Backend', emoji: '⚙️', description: 'APIs, databases, servers' },
  { id: 'agent', label: 'AI Agents', emoji: '🤖', description: 'LLMs, automation, tools' },
  { id: 'creative', label: 'Creative', emoji: '✨', description: 'Design, video, copy' },
  { id: 'docs', label: 'Docs', emoji: '📝', description: 'Tutorials, guides, manuals' },
  { id: 'security', label: 'Security', emoji: '🔒', description: 'Audits, reviews, pentest' },
];

const TOTAL_STEPS = 4;

// ============================================================================
// Sub-components
// ============================================================================

const StepIndicator: React.FC<{ current: number; total: number }> = ({ current, total }) => (
  <div className="flex items-center justify-center gap-2 mb-8">
    {Array.from({ length: total }, (_, i) => (
      <div key={i} className="flex items-center gap-2">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
            i + 1 < current
              ? 'bg-purple-600 text-white'
              : i + 1 === current
              ? 'bg-purple-600 text-white ring-4 ring-purple-600/30'
              : 'bg-gray-700 text-gray-400'
          }`}
        >
          {i + 1 < current ? '✓' : i + 1}
        </div>
        {i < total - 1 && (
          <div className={`w-8 sm:w-16 h-0.5 transition-all duration-300 ${i + 1 < current ? 'bg-purple-600' : 'bg-gray-700'}`} />
        )}
      </div>
    ))}
  </div>
);

const SkillBadge: React.FC<{
  skill: (typeof SKILL_OPTIONS)[0];
  selected: boolean;
  onToggle: (id: SkillCategory) => void;
}> = ({ skill, selected, onToggle }) => (
  <button
    type="button"
    onClick={() => onToggle(skill.id)}
    className={`flex flex-col items-center gap-1 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 min-w-[100px] touch-manipulation ${
      selected
        ? 'border-purple-500 bg-purple-500/20 text-white'
        : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-500'
    }`}
  >
    <span className="text-2xl">{skill.emoji}</span>
    <span className="text-xs font-semibold">{skill.label}</span>
    <span className="text-[10px] text-gray-500 hidden sm:block text-center leading-tight">{skill.description}</span>
    {selected && <span className="text-purple-400 text-xs">✓ Selected</span>}
  </button>
);

// ============================================================================
// Step Components
// ============================================================================

const WelcomeStep: React.FC<{ onNext: () => void }> = ({ onNext }) => (
  <div className="text-center py-4">
    <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-6">
      <span className="text-4xl">🏭</span>
    </div>
    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Welcome to SolFoundry</h2>
    <p className="text-gray-400 mb-8 max-w-md mx-auto text-sm sm:text-base">
      The autonomous AI software factory. Find bounties, submit quality work, and earn $FNDRY rewards.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 text-left">
      {[
        { icon: '🔍', title: 'Find Bounties', desc: 'Browse T1/T2/T3 tasks across all categories' },
        { icon: '💻', title: 'Submit Work', desc: 'Open PRs with quality solutions' },
        { icon: '💰', title: 'Earn $FNDRY', desc: 'Get paid for verified contributions' },
      ].map(({ icon, title, desc }) => (
        <div key={title} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700">
          <span className="text-2xl mb-2 block">{icon}</span>
          <h3 className="text-white font-semibold text-sm mb-1">{title}</h3>
          <p className="text-gray-400 text-xs">{desc}</p>
        </div>
      ))}
    </div>
    <button
      onClick={onNext}
      className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors min-h-[44px] touch-manipulation"
    >
      Get Started →
    </button>
  </div>
);

const ProfileStep: React.FC<{
  username: string;
  bio: string;
  onChange: (field: 'username' | 'bio', value: string) => void;
  onNext: () => void;
  onBack: () => void;
}> = ({ username, bio, onChange, onNext, onBack }) => (
  <div className="py-4">
    <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-1">Set Up Your Profile</h2>
    <p className="text-gray-400 text-center mb-6 text-sm">Tell us about yourself so others can find you.</p>

    <div className="space-y-4">
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2" htmlFor="username">
          GitHub Username *
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => onChange('username', e.target.value)}
            placeholder="your-github-username"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-8 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
        {username && !/^[a-zA-Z0-9-]+$/.test(username) && (
          <p className="text-red-400 text-xs mt-1">Only letters, numbers, and hyphens allowed</p>
        )}
      </div>

      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2" htmlFor="bio">
          Bio <span className="text-gray-500">(optional)</span>
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => onChange('bio', e.target.value)}
          placeholder="Full-stack dev focused on DeFi and AI agents..."
          rows={3}
          maxLength={160}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-none text-sm"
        />
        <p className="text-gray-500 text-xs mt-1 text-right">{bio.length}/160</p>
      </div>
    </div>

    <div className="flex gap-3 mt-6">
      <button
        onClick={onBack}
        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-colors min-h-[44px]"
      >
        ← Back
      </button>
      <button
        onClick={onNext}
        disabled={!username.trim()}
        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
      >
        Continue →
      </button>
    </div>
  </div>
);

const SkillsStep: React.FC<{
  selectedSkills: Set<SkillCategory>;
  onToggle: (skill: SkillCategory) => void;
  onNext: () => void;
  onBack: () => void;
}> = ({ selectedSkills, onToggle, onNext, onBack }) => (
  <div className="py-4">
    <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-1">Choose Your Skills</h2>
    <p className="text-gray-400 text-center mb-6 text-sm">
      Select categories you want to receive bounty notifications for.
    </p>

    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
      {SKILL_OPTIONS.map((skill) => (
        <SkillBadge
          key={skill.id}
          skill={skill}
          selected={selectedSkills.has(skill.id)}
          onToggle={onToggle}
        />
      ))}
    </div>

    {selectedSkills.size > 0 && (
      <p className="text-center text-purple-400 text-sm mb-4">
        {selectedSkills.size} skill{selectedSkills.size !== 1 ? 's' : ''} selected
      </p>
    )}

    <div className="flex gap-3">
      <button
        onClick={onBack}
        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-colors min-h-[44px]"
      >
        ← Back
      </button>
      <button
        onClick={onNext}
        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition-colors min-h-[44px]"
      >
        Continue →
      </button>
    </div>
  </div>
);

const WalletStep: React.FC<{
  walletAddress: string;
  walletConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onComplete: (data: OnboardingData) => void;
  onBack: () => void;
  username: string;
  bio: string;
  selectedSkills: Set<SkillCategory>;
}> = ({ walletAddress, walletConnected, onConnect, onDisconnect, onComplete, onBack, username, bio, selectedSkills }) => {
  const truncated = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '';

  const handleComplete = useCallback(() => {
    onComplete({
      username,
      bio,
      skills: Array.from(selectedSkills),
      walletAddress,
    });
  }, [username, bio, selectedSkills, walletAddress, onComplete]);

  return (
    <div className="py-4">
      <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-1">Connect Your Wallet</h2>
      <p className="text-gray-400 text-center mb-6 text-sm">
        Connect a Solana wallet to receive $FNDRY bounty rewards.
      </p>

      <div className="bg-gray-800/60 rounded-xl border border-gray-700 p-4 mb-6">
        {walletConnected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <span className="text-purple-400">💰</span>
              </div>
              <div>
                <p className="text-white font-mono text-sm">{truncated}</p>
                <p className="text-green-400 text-xs">✓ Connected</p>
              </div>
            </div>
            <button
              onClick={onDisconnect}
              className="text-gray-400 hover:text-red-400 text-sm transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="text-center py-2">
            <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">👛</span>
            </div>
            <p className="text-gray-400 text-sm mb-4">No wallet connected</p>
            <button
              onClick={onConnect}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition-colors min-h-[44px]"
            >
              Connect Wallet
            </button>
          </div>
        )}
      </div>

      <p className="text-gray-500 text-xs text-center mb-6">
        {walletConnected
          ? 'Your wallet is connected. You can also skip and connect later.'
          : 'You can skip this step and connect your wallet later from your profile.'}
      </p>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-colors min-h-[44px]"
        >
          ← Back
        </button>
        <button
          onClick={handleComplete}
          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition-colors min-h-[44px]"
        >
          {walletConnected ? 'Complete Setup ✓' : 'Skip for Now →'}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onComplete,
  onDismiss,
  darkMode = true,
}) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    username: '',
    bio: '',
    selectedSkills: new Set(),
    walletAddress: '',
    walletConnected: false,
  });

  const handleFieldChange = useCallback((field: 'username' | 'bio', value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSkillToggle = useCallback((skill: SkillCategory) => {
    setForm((prev) => {
      const next = new Set(prev.selectedSkills);
      next.has(skill) ? next.delete(skill) : next.add(skill);
      return { ...prev, selectedSkills: next };
    });
  }, []);

  const handleWalletConnect = useCallback(async () => {
    // Placeholder: In production this would integrate with @solana/wallet-adapter
    // Simulate a successful connect for demo purposes
    await new Promise((r) => setTimeout(r, 800));
    setForm((prev) => ({
      ...prev,
      walletAddress: 'Amu1YJjcKWKL6xMto2dx511kfzXAxgpetJrZp7N71o7',
      walletConnected: true,
    }));
  }, []);

  const handleWalletDisconnect = useCallback(() => {
    setForm((prev) => ({ ...prev, walletAddress: '', walletConnected: false }));
  }, []);

  const handleComplete = useCallback(
    (data: OnboardingData) => {
      onComplete?.(data);
    },
    [onComplete]
  );

  const containerClass = darkMode ? 'dark' : '';

  return (
    <div className={containerClass}>
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-4 sm:p-6 max-w-lg mx-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏭</span>
            <span className="text-white font-bold text-lg">SolFoundry</span>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-gray-500 hover:text-gray-300 text-2xl leading-none transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>

        {/* Step Indicator */}
        <StepIndicator current={step} total={TOTAL_STEPS} />

        {/* Step Content */}
        <div className="min-h-[320px]">
          {step === 1 && <WelcomeStep onNext={() => setStep(2)} />}

          {step === 2 && (
            <ProfileStep
              username={form.username}
              bio={form.bio}
              onChange={handleFieldChange}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <SkillsStep
              selectedSkills={form.selectedSkills}
              onToggle={handleSkillToggle}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}

          {step === 4 && (
            <WalletStep
              walletAddress={form.walletAddress}
              walletConnected={form.walletConnected}
              onConnect={handleWalletConnect}
              onDisconnect={handleWalletDisconnect}
              onComplete={handleComplete}
              onBack={() => setStep(3)}
              username={form.username}
              bio={form.bio}
              selectedSkills={form.selectedSkills}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
