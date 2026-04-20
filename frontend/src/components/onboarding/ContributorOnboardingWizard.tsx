import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  User,
  Code,
  Wallet,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Zap,
} from 'lucide-react';
import { pageTransition } from '../../lib/animations';

const STEPS = ['Profile', 'Skills', 'Wallet', 'Get Started'];

const SKILL_CATEGORIES = [
  {
    label: 'Languages',
    icon: Code,
    options: [
      { id: 'typescript', label: 'TypeScript', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      { id: 'rust', label: 'Rust', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
      { id: 'python', label: 'Python', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      { id: 'go', label: 'Go', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
      { id: 'solidity', label: 'Solidity', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
      { id: 'swift', label: 'Swift', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    ],
  },
  {
    label: 'Domains',
    icon: Zap,
    options: [
      { id: 'frontend', label: 'Frontend', color: 'bg-emerald/20 text-emerald border-emerald/30' },
      { id: 'backend', label: 'Backend', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      { id: 'smart-contracts', label: 'Smart Contracts', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
      { id: 'devops', label: 'DevOps', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
      { id: 'security', label: 'Security', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
      { id: 'ai-ml', label: 'AI/ML', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
    ],
  },
  {
    label: 'Experience',
    icon: BookOpen,
    options: [
      { id: 'beginner', label: 'Beginner', color: 'bg-forge-700 text-text-muted border-border' },
      { id: 'intermediate', label: 'Intermediate', color: 'bg-forge-700 text-text-secondary border-border' },
      { id: 'advanced', label: 'Advanced', color: 'bg-emerald/20 text-emerald border-emerald/30' },
    ],
  },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {STEPS.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1.5">
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
            <span className={`text-xs hidden md:block ${i <= currentStep ? 'text-text-primary' : 'text-text-muted'}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 md:w-16 h-px mb-5 ${i < currentStep ? 'bg-emerald' : 'bg-border'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function Step1Profile({
  state,
  onChange,
  onNext,
}: {
  state: WizardState;
  onChange: (k: keyof WizardState, v: unknown) => void;
  onNext: () => void;
}) {
  const canProceed = state.username.trim().length >= 3;

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-emerald/10 border border-emerald/30 flex items-center justify-center mx-auto mb-4">
          <User className="w-7 h-7 text-emerald" />
        </div>
        <h2 className="font-display text-2xl font-bold text-text-primary mb-2">Set up your profile</h2>
        <p className="text-sm text-text-muted">Choose a username and tell the community about yourself.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Username *</label>
        <input
          type="text"
          value={state.username}
          onChange={(e) => onChange('username', e.target.value)}
          placeholder="your_github_handle"
          className="w-full bg-forge-700 border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald focus:ring-1 focus:ring-emerald/30 outline-none transition-all duration-150"
          maxLength={30}
        />
        <p className="mt-1.5 text-xs text-text-muted">Minimum 3 characters. This is how others will see you.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Bio (optional)</label>
        <textarea
          value={state.bio}
          onChange={(e) => onChange('bio', e.target.value)}
          placeholder="I love building on Solana and solving complex problems..."
          className="w-full bg-forge-700 border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald focus:ring-1 focus:ring-emerald/30 outline-none transition-all duration-150 resize-none min-h-[100px]"
          maxLength={200}
        />
        <p className="mt-1.5 text-xs text-text-muted text-right">{state.bio.length}/200</p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="px-6 py-2.5 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Step2Skills({
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
  const toggleSkill = (skillId: string) => {
    const current = state.skills as string[];
    const updated = current.includes(skillId)
      ? current.filter((s) => s !== skillId)
      : [...current, skillId];
    onChange('skills', updated);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-emerald/10 border border-emerald/30 flex items-center justify-center mx-auto mb-4">
          <Code className="w-7 h-7 text-emerald" />
        </div>
        <h2 className="font-display text-2xl font-bold text-text-primary mb-2">Select your skills</h2>
        <p className="text-sm text-text-muted">Choose languages and domains you specialize in. This helps match you with relevant bounties.</p>
      </div>

      <div className="space-y-6">
        {SKILL_CATEGORIES.map((category) => (
          <div key={category.label}>
            <div className="flex items-center gap-2 mb-3">
              <category.icon className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-medium text-text-secondary">{category.label}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {category.options.map((skill) => {
                const isSelected = (state.skills as string[]).includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    onClick={() => toggleSkill(skill.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                      isSelected
                        ? `${skill.color} border-current`
                        : 'bg-forge-800 text-text-muted border-border hover:border-border-hover'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                    {skill.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg border border-border text-text-secondary text-sm font-medium hover:border-border-hover hover:text-text-primary transition-all duration-200 inline-flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200 inline-flex items-center gap-2"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Step3Wallet({
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
  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-emerald/10 border border-emerald/30 flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-7 h-7 text-emerald" />
        </div>
        <h2 className="font-display text-2xl font-bold text-text-primary mb-2">Connect your wallet</h2>
        <p className="text-sm text-text-muted">Link a Solana wallet to receive FNDRY token rewards when you complete bounties.</p>
      </div>

      <div className="bg-forge-800 border border-border rounded-xl p-4">
        <p className="text-sm text-text-secondary mb-3">Supported wallets</p>
        <div className="space-y-2">
          {['Phantom', 'Solflare', 'Backpack'].map((wallet) => (
            <button
              key={wallet}
              onClick={() => onChange('walletConnected', true)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-150 ${
                state.walletConnected && state.walletType === wallet.toLowerCase()
                  ? 'bg-emerald/10 border-emerald text-emerald'
                  : 'bg-forge-700 border-border text-text-primary hover:border-border-hover'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-forge-600 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-text-muted" />
              </div>
              <span className="text-sm font-medium">{wallet}</span>
              {(state.walletConnected && state.walletType === wallet.toLowerCase()) && (
                <Check className="w-4 h-4 ml-auto" />
              )}
            </button>
          ))}
        </div>
      </div>

      {state.walletConnected && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-emerald/30 bg-emerald/5 p-4"
        >
          <p className="text-sm text-emerald inline-flex items-center gap-1.5">
            <Check className="w-4 h-4" /> Wallet connected successfully!
          </p>
          <p className="text-xs text-text-muted mt-1">You will receive FNDRY payouts at this address.</p>
        </motion.div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg border border-border text-text-secondary text-sm font-medium hover:border-border-hover hover:text-text-primary transition-all duration-200 inline-flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          disabled={!state.walletConnected}
          className="px-6 py-2.5 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Step4Complete({
  state,
  onComplete,
}: {
  state: WizardState;
  onComplete: () => void;
}) {
  return (
    <div className="space-y-6 max-w-lg mx-auto text-center">
      <div className="w-14 h-14 rounded-2xl bg-emerald/10 border border-emerald/30 flex items-center justify-center mx-auto mb-4">
        <Sparkles className="w-7 h-7 text-emerald" />
      </div>
      <h2 className="font-display text-2xl font-bold text-text-primary">You are all set!</h2>
      <p className="text-sm text-text-muted">
        Welcome to SolFoundry, <span className="text-text-primary font-semibold">@{state.username}</span>. You are ready to start claiming bounties.
      </p>

      <div className="bg-forge-800 border border-border rounded-xl p-4 text-left space-y-3">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Your profile</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-forge-700 flex items-center justify-center">
            <span className="font-display text-lg text-text-primary">{state.username[0]?.toUpperCase()}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">@{state.username}</p>
            <p className="text-xs text-text-muted">{state.bio || 'No bio yet'}</p>
          </div>
        </div>

        {(state.skills as string[]).length > 0 && (
          <div>
            <p className="text-xs text-text-muted mb-2">Skills:</p>
            <div className="flex flex-wrap gap-1.5">
              {(state.skills as string[]).map((skillId) => (
                <span key={skillId} className="px-2 py-0.5 rounded-full text-xs bg-forge-700 text-text-secondary border border-border">
                  {skillId}
                </span>
              ))}
            </div>
          </div>
        )}

        {state.walletConnected && (
          <div className="flex items-center gap-1.5 text-emerald text-xs">
            <Check className="w-3.5 h-3.5" /> Wallet connected
          </div>
        )}
      </div>

      <div className="space-y-2">
        <button
          onClick={onComplete}
          className="w-full px-6 py-3 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200"
        >
          Browse Open Bounties
        </button>
        <a
          href="/"
          className="block w-full px-6 py-2.5 rounded-lg border border-border text-text-secondary text-sm font-medium hover:border-border-hover hover:text-text-primary transition-all duration-200"
        >
          Explore the platform
        </a>
      </div>
    </div>
  );
}

interface WizardState {
  username: string;
  bio: string;
  skills: string[];
  walletConnected: boolean;
  walletType: string;
}

export function ContributorOnboardingWizard() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({
    username: '',
    bio: '',
    skills: [],
    walletConnected: false,
    walletType: '',
  });

  const onChange = (k: keyof WizardState, v: unknown) => {
    setState((prev) => ({ ...prev, [k]: v }));
  };

  const handleComplete = () => {
    window.location.href = '/bounties';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <StepIndicator currentStep={step} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          variants={pageTransition}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {step === 0 && <Step1Profile state={state} onChange={onChange} onNext={() => setStep(1)} />}
          {step === 1 && <Step2Skills state={state} onChange={onChange} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
          {step === 2 && <Step3Wallet state={state} onChange={onChange} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && <Step4Complete state={state} onComplete={handleComplete} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
