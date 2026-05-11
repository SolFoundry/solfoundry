import React, { useState, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Check, Wallet, Code, User, BookOpen } from 'lucide-react';

// Types
interface OnboardingData {
  displayName: string;
  githubUsername: string;
  skills: string[];
  languages: string[];
  walletAddress: string;
  experience: 'beginner' | 'intermediate' | 'advanced';
  understoodTiers: boolean;
}

const INITIAL_DATA: OnboardingData = {
  displayName: '',
  githubUsername: '',
  skills: [],
  languages: [],
  walletAddress: '',
  experience: 'intermediate',
  understoodTiers: false,
};

const AVAILABLE_SKILLS = [
  'Frontend', 'Backend', 'Full-Stack', 'DevOps', 'Security',
  'AI/ML', 'Mobile', 'Design', 'Documentation', 'Testing',
];

const AVAILABLE_LANGUAGES = [
  'TypeScript', 'JavaScript', 'Python', 'Rust', 'Go',
  'Java', 'C++', 'Swift', 'Kotlin', 'Ruby',
];

const STEPS = [
  { id: 'profile', title: 'Profile', icon: User },
  { id: 'skills', title: 'Skills', icon: Code },
  { id: 'wallet', title: 'Wallet', icon: Wallet },
  { id: 'learn', title: 'Learn', icon: BookOpen },
];

// Step Components
function ProfileStep({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Display Name <span className="text-forge-red">*</span>
        </label>
        <input
          type="text"
          value={data.displayName}
          onChange={(e) => onChange({ displayName: e.target.value })}
          placeholder="Your name or alias"
          className="w-full px-4 py-3 bg-surface-card border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald/50"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          GitHub Username <span className="text-forge-red">*</span>
        </label>
        <input
          type="text"
          value={data.githubUsername}
          onChange={(e) => onChange({ githubUsername: e.target.value })}
          placeholder="your-github-username"
          className="w-full px-4 py-3 bg-surface-card border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald/50"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Experience Level
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
            <button
              key={level}
              onClick={() => onChange({ experience: level })}
              className={`py-3 px-4 rounded-lg border text-sm font-medium capitalize transition-colors ${
                data.experience === level
                  ? 'border-emerald bg-emerald/10 text-emerald'
                  : 'border-border-primary bg-surface-card text-text-secondary hover:border-border-secondary'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillsStep({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  const toggleItem = (list: string[], item: string): string[] =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-3">
          What are your skills? <span className="text-text-muted">(select all that apply)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_SKILLS.map((skill) => (
            <button
              key={skill}
              onClick={() => onChange({ skills: toggleItem(data.skills, skill) })}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                data.skills.includes(skill)
                  ? 'border-emerald bg-emerald/10 text-emerald'
                  : 'border-border-primary bg-surface-card text-text-secondary hover:border-border-secondary'
              }`}
            >
              {skill}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary mb-3">
          Preferred Languages <span className="text-text-muted">(select all that apply)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_LANGUAGES.map((lang) => (
            <button
              key={lang}
              onClick={() => onChange({ languages: toggleItem(data.languages, lang) })}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                data.languages.includes(lang)
                  ? 'border-anvil-orange bg-anvil-orange/10 text-anvil-orange'
                  : 'border-border-primary bg-surface-card text-text-secondary hover:border-border-secondary'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function WalletStep({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Solana Wallet Address <span className="text-forge-red">*</span>
        </label>
        <input
          type="text"
          value={data.walletAddress}
          onChange={(e) => onChange({ walletAddress: e.target.value })}
          placeholder="Your Solana wallet address (e.g., 7xKXtg...)"
          className="w-full px-4 py-3 bg-surface-card border border-border-primary rounded-lg text-text-primary font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald/50"
        />
        <p className="mt-2 text-xs text-text-muted">
          This is where you'll receive $FNDRY token payouts when your PRs are merged.
        </p>
      </div>
      <div className="p-4 rounded-lg border border-border-primary bg-surface-card">
        <p className="text-sm text-text-secondary">
          💡 <strong className="text-text-primary">Don't have a wallet?</strong> Install{' '}
          <a href="https://phantom.app" target="_blank" rel="noopener" className="text-emerald hover:underline">
            Phantom Wallet
          </a>{' '}
          or{' '}
          <a href="https://solflare.com" target="_blank" rel="noopener" className="text-emerald hover:underline">
            Solflare
          </a>{' '}
          to create one for free.
        </p>
      </div>
    </div>
  );
}

function LearnStep({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg border border-emerald/20 bg-emerald/5">
        <h3 className="text-emerald font-semibold mb-2">How Bounties Work</h3>
        <ol className="space-y-2 text-sm text-text-secondary">
          <li><span className="text-emerald font-medium">1.</span> Find an open bounty on the Issues tab</li>
          <li><span className="text-emerald font-medium">2.</span> Fork the repo, build your solution</li>
          <li><span className="text-emerald font-medium">3.</span> Submit a PR with <code className="bg-surface-card px-1 rounded">Closes #N</code></li>
          <li><span className="text-emerald font-medium">4.</span> 5 AI models review your code</li>
          <li><span className="text-emerald font-medium">5.</span> If you pass, $FNDRY is sent to your wallet!</li>
        </ol>
      </div>
      <div className="p-4 rounded-lg border border-border-primary bg-surface-card">
        <h3 className="text-anvil-orange font-semibold mb-2">Tier System</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald/10 text-emerald border border-emerald/20">T1</span>
            <span className="text-text-secondary">Open race — anyone can participate (~100K $FNDRY)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-tier-t2/10 text-tier-t2 border border-tier-t2/20">T2</span>
            <span className="text-text-secondary">Requires 4+ merged T1 bounties (~500K $FNDRY)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-tier-t3/10 text-tier-t3 border border-tier-t3/20">T3</span>
            <span className="text-text-secondary">Requires 4+ merged T2 bounties (~1M $FNDRY)</span>
          </div>
        </div>
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={data.understoodTiers}
          onChange={(e) => onChange({ understoodTiers: e.target.checked })}
          className="w-5 h-5 rounded border-border-primary bg-surface-card text-emerald focus:ring-emerald/30"
        />
        <span className="text-sm text-text-primary">I understand the bounty and tier system</span>
      </label>
    </div>
  );
}

// Main Wizard
export function OnboardingWizard({ onComplete }: { onComplete: (data: OnboardingData) => void }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);

  const updateData = useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return data.displayName.trim() !== '' && data.githubUsername.trim() !== '';
      case 1: return data.skills.length > 0;
      case 2: return data.walletAddress.trim() !== '';
      case 3: return data.understoodTiers;
      default: return true;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(data);
    }
  };

  const stepComponents = [
    <ProfileStep key="profile" data={data} onChange={updateData} />,
    <SkillsStep key="skills" data={data} onChange={updateData} />,
    <WalletStep key="wallet" data={data} onChange={updateData} />,
    <LearnStep key="learn" data={data} onChange={updateData} />,
  ];

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isComplete = i < step;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                isComplete ? 'bg-emerald text-dark-forge' :
                isActive ? 'bg-emerald/20 text-emerald border border-emerald/50' :
                'bg-surface-card text-text-muted border border-border-primary'
              }`}>
                {isComplete ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={`hidden sm:block text-xs font-medium ${
                isActive ? 'text-emerald' : isComplete ? 'text-text-primary' : 'text-text-muted'
              }`}>
                {s.title}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${i < step ? 'bg-emerald' : 'bg-border-primary'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="min-h-[300px]">
        {stepComponents[step]}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border-primary">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!canProceed()}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-anvil-orange text-dark-forge font-medium text-sm hover:bg-anvil-orange/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {step === STEPS.length - 1 ? 'Start Earning!' : 'Continue'}
          {step < STEPS.length - 1 && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default OnboardingWizard;
