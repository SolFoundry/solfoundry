import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, User, Code, Wallet, Rocket, Sparkles, GitBranch, Link as LinkIcon, Globe, Plus, X, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const STEPS = ['Profile', 'Skills', 'Wallet', 'Start Bountying'];

// Available skills/languages
const AVAILABLE_SKILLS = [
  'React', 'Vue.js', 'Angular', 'Svelte', 'Next.js', 'Nuxt',
  'TypeScript', 'JavaScript', 'Python', 'Rust', 'Solidity', 'Go',
  'Node.js', 'Django', 'Flask', 'Express', 'GraphQL', 'REST API',
  'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS',
  'Tailwind CSS', 'Sass/SCSS', 'Web3', 'Smart Contracts', 'UI/UX Design',
  'Testing', 'CI/CD', 'Git/GitHub', 'Open Source', 'Documentation',
];

const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner', desc: 'New to open source' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Some contributions' },
  { value: 'advanced', label: 'Advanced', desc: 'Experienced contributor' },
  { value: 'expert', label: 'Expert', desc: 'Core maintainer level' },
];

const inputClass =
  'w-full bg-forge-700 border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald focus:ring-1 focus:ring-emerald/30 outline-none transition-all duration-150';

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

// ─── Step 1: Profile Setup ──────────────────────────────────────────

interface WizardState {
  displayName: string;
  bio: string;
  experienceLevel: string;
  githubUrl: string;
  twitterUrl: string;
  websiteUrl: string;
  selectedSkills: string[];
  walletConnected: boolean;
  walletAddress: string;
  completed: boolean;
}

function StepProfile({
  state,
  onChange,
  onNext,
}: {
  state: WizardState;
  onChange: (k: keyof WizardState, v: unknown) => void;
  onNext: () => void;
}) {
  const { user } = useAuth();
  const canProceed = state.displayName.trim().length >= 2;

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald to-purple flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-text-inverse" />
        </div>
        <h2 className="font-display text-xl font-bold text-text-primary mb-2">
          Welcome to SolFoundry!
        </h2>
        <p className="text-text-muted text-sm max-w-md mx-auto">
          Let's set up your contributor profile. This helps project maintainers find you and match you with the right bounties.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Display Name <span className="text-status-error">*</span>
            </label>
            <input
              type="text"
              value={state.displayName}
              onChange={(e) => onChange('displayName', e.target.value)}
              placeholder={user?.username ?? 'Your display name'}
              className={inputClass}
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Bio
            </label>
            <textarea
              value={state.bio}
              onChange={(e) => onChange('bio', e.target.value)}
              placeholder="Tell us about yourself — your experience, interests, and what you're looking for..."
              className={`${inputClass} resize-none min-h-[120px]`}
              maxLength={500}
            />
            <p className="mt-1 text-xs text-text-muted text-right">{state.bio.length}/500</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Experience Level
            </label>
            <div className="grid grid-cols-2 gap-2">
              {EXPERIENCE_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => onChange('experienceLevel', level.value)}
                  className={`px-3 py-3 rounded-lg border text-left transition-all duration-150 ${
                    state.experienceLevel === level.value
                      ? 'bg-emerald-bg border-emerald-border text-emerald'
                      : 'border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
                  }`}
                >
                  <p className="text-sm font-semibold">{level.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{level.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Social Links (optional)
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-text-muted flex-shrink-0" />
                <input
                  type="url"
                  value={state.githubUrl}
                  onChange={(e) => onChange('githubUrl', e.target.value)}
                  placeholder="github.com/your-profile"
                  className={inputClass}
                />
              </div>
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
                <input
                  type="url"
                  value={state.twitterUrl}
                  onChange={(e) => onChange('twitterUrl', e.target.value)}
                  placeholder="x.com/your-handle"
                  className={inputClass}
                />
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-text-muted flex-shrink-0" />
                <input
                  type="url"
                  value={state.websiteUrl}
                  onChange={(e) => onChange('websiteUrl', e.target.value)}
                  placeholder="your-website.com"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next: Pick Skills <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Skill & Language Selection ─────────────────────────────

function StepSkills({
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
  const toggleSkill = (skill: string) => {
    const current = state.selectedSkills;
    if (current.includes(skill)) {
      onChange('selectedSkills', current.filter((s) => s !== skill));
    } else {
      onChange('selectedSkills', [...current, skill]);
    }
  };

  const canProceed = state.selectedSkills.length >= 1;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple to-magenta flex items-center justify-center mx-auto mb-4">
          <Code className="w-8 h-8 text-text-inverse" />
        </div>
        <h2 className="font-display text-xl font-bold text-text-primary mb-2">
          What are your skills?
        </h2>
        <p className="text-text-muted text-sm max-w-md mx-auto">
          Select the technologies and areas you're comfortable working with. This helps us recommend relevant bounties.
        </p>
      </div>

      {/* Selected skills summary */}
      {state.selectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-2 p-4 rounded-lg bg-emerald-bg border border-emerald-border">
          <span className="text-xs text-emerald font-medium flex items-center gap-1">
            <Check className="w-3 h-3" /> {state.selectedSkills.length} selected
          </span>
          {state.selectedSkills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald/10 text-emerald text-xs font-medium border border-emerald-border/50"
            >
              {skill}
              <button
                onClick={() => toggleSkill(skill)}
                className="hover:text-emerald-light transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Skill grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {AVAILABLE_SKILLS.map((skill) => {
          const isSelected = state.selectedSkills.includes(skill);
          return (
            <button
              key={skill}
              onClick={() => toggleSkill(skill)}
              className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 ${
                isSelected
                  ? 'bg-emerald text-text-inverse border-emerald shadow-[0_0_12px_rgba(0,230,118,0.2)]'
                  : 'border-border text-text-secondary hover:border-emerald hover:text-emerald bg-forge-800'
              }`}
            >
              {skill}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg border border-border text-text-secondary text-sm font-medium hover:border-border-hover hover:text-text-primary transition-all duration-200"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next: Connect Wallet <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Wallet Connection ──────────────────────────────────────

function StepWallet({
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
  const [connecting, setConnecting] = useState(false);
  const [walletInput, setWalletInput] = useState('');

  const handleManualConnect = () => {
    if (!walletInput.trim()) return;
    const addr = walletInput.trim();
    // Basic Solana address validation (base58, 32-44 chars)
    if (addr.length >= 32 && addr.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(addr)) {
      onChange('walletAddress', addr);
      onChange('walletConnected', true);
    }
  };

  const handleDisconnect = () => {
    onChange('walletConnected', false);
    onChange('walletAddress', '');
    setWalletInput('');
  };

  const canProceed = true; // Wallet is optional at this stage

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-8 h-8 text-text-inverse" />
        </div>
        <h2 className="font-display text-xl font-bold text-text-primary mb-2">
          Connect Your Wallet
        </h2>
        <p className="text-text-muted text-sm max-w-md mx-auto">
          Link your Solana wallet to receive FNDRY token rewards when you complete bounties. You can also do this later.
        </p>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        {state.walletConnected ? (
          <div className="rounded-xl border border-emerald-border bg-emerald-bg p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald">Wallet Connected</p>
                <p className="font-mono text-xs text-text-muted mt-0.5 break-all">{state.walletAddress}</p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-xs text-status-error hover:text-status-error/80 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <>
            {/* Manual wallet address input */}
            <div className="rounded-xl border border-border bg-forge-900 p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                Enter Your Solana Wallet Address
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                  placeholder="Your Solana wallet address..."
                  className={inputClass}
                />
                <button
                  onClick={handleManualConnect}
                  disabled={!walletInput.trim()}
                  className="px-4 py-3 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Connect
                </button>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                Paste your Solana wallet address (e.g., Phantom, Solflare) to receive FNDRY rewards.
              </p>
            </div>

            {/* Skip option */}
            <div className="text-center">
              <button
                onClick={() => {
                  onChange('walletConnected', false);
                  onChange('walletAddress', '');
                  onNext();
                }}
                className="text-sm text-text-muted hover:text-text-secondary transition-colors"
              >
                Skip for now — I'll connect later
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg border border-border text-text-secondary text-sm font-medium hover:border-border-hover hover:text-text-primary transition-all duration-200"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200"
        >
          Next: Get Started <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Bounty System Overview & Completion ────────────────────

function StepComplete({
  state,
  onComplete,
}: {
  state: WizardState;
  onComplete: () => void;
}) {
  const navigate = useNavigate();

  const highlights = [
    {
      icon: <Rocket className="w-5 h-5" />,
      title: 'Browse Bounties',
      desc: 'Find open bounties that match your skills and interests. Filter by reward, tier, and technology.',
      action: 'View Bounties',
      onClick: () => navigate('/bounties'),
    },
    {
      icon: <Code className="w-5 h-5" />,
      title: 'Submit Solutions',
      desc: 'Work on bounties, submit your solutions, and get reviewed by our AI and community reviewers.',
      action: 'How It Works',
      onClick: () => navigate('/how-it-works'),
    },
    {
      icon: <Sparkles className="w-5 h-5" />,
      title: 'Earn Rewards',
      desc: 'Get paid in FNDRY tokens for accepted submissions. Build your reputation and unlock higher-tier bounties.',
      action: 'View Leaderboard',
      onClick: () => navigate('/leaderboard'),
    },
    {
      icon: <Wallet className="w-5 h-5" />,
      title: 'Manage Profile',
      desc: 'Update your skills, wallet, and settings anytime from your profile dashboard.',
      action: 'Go to Profile',
      onClick: () => navigate('/profile'),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald via-purple to-magenta flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
          <Rocket className="w-10 h-10 text-text-inverse" />
        </div>
        <h2 className="font-display text-2xl font-bold text-text-primary mb-2">
          You're All Set!
        </h2>
        <p className="text-text-muted text-sm max-w-lg mx-auto">
          Your contributor profile is ready. Here's what you can do next:
        </p>

        {state.selectedSkills.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {state.selectedSkills.slice(0, 5).map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-bg text-emerald text-xs font-medium border border-emerald-border"
              >
                {skill}
              </span>
            ))}
            {state.selectedSkills.length > 5 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-forge-800 text-text-muted text-xs font-medium border border-border">
                +{state.selectedSkills.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {highlights.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-border bg-forge-900 p-5 hover:border-emerald-border/50 hover:bg-forge-850 transition-all duration-200 cursor-pointer group"
            onClick={item.onClick}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-forge-800 flex items-center justify-center text-emerald group-hover:bg-emerald-bg transition-colors duration-200">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-text-primary mb-1">{item.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{item.desc}</p>
                <span className="inline-flex items-center gap-1 text-xs text-emerald mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {item.action} <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center pt-4">
        <button
          onClick={onComplete}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors duration-200"
        >
          <Check className="w-4 h-4" />
          Complete Setup
        </button>
      </div>
    </div>
  );
}

// ─── Main Wizard ─────────────────────────────────────────────────────

export function ContributorOnboardingWizard() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({
    displayName: '',
    bio: '',
    experienceLevel: 'beginner',
    githubUrl: '',
    twitterUrl: '',
    websiteUrl: '',
    selectedSkills: [],
    walletConnected: false,
    walletAddress: '',
    completed: false,
  });

  const onChange = useCallback((k: keyof WizardState, v: unknown) => {
    setState((prev) => ({ ...prev, [k]: v }));
  }, []);

  const handleComplete = () => {
    onChange('completed', true);
  };

  if (state.completed) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-emerald/10 border border-emerald/30 flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-emerald" />
        </div>
        <h2 className="font-display text-2xl font-bold text-text-primary mb-3">
          Setup Complete!
        </h2>
        <p className="text-text-muted mb-6">
          Your contributor profile has been saved. Start exploring bounties!
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => window.location.href = '/bounties'}
            className="px-6 py-3 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors"
          >
            Browse Bounties
          </button>
          <button
            onClick={() => window.location.href = '/profile'}
            className="px-6 py-3 rounded-lg border border-border text-text-secondary text-sm font-medium hover:border-border-hover hover:text-text-primary transition-all"
          >
            Go to Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <StepIndicator currentStep={step} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 0 && (
            <StepProfile state={state} onChange={onChange} onNext={() => setStep(1)} />
          )}
          {step === 1 && (
            <StepSkills
              state={state}
              onChange={onChange}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <StepWallet
              state={state}
              onChange={onChange}
              onNext={() => setStep(3)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 3 && (
            <StepComplete state={state} onComplete={handleComplete} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}