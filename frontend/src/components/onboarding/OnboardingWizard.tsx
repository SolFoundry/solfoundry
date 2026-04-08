import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { fadeIn, staggerItem, staggerContainer } from '../../lib/animations';

// ─── Icons ───────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v18" />
    </svg>
  );
}

// ─── Step definitions ────────────────────────────────────────────────────────

const STEPS = [
  { id: 'welcome',    title: 'Welcome',     icon: '👋' },
  { id: 'profile',   title: 'Profile',     icon: '👤' },
  { id: 'skills',     title: 'Skills',      icon: '⚡' },
  { id: 'wallet',     title: 'Wallet',      icon: '🔗' },
  { id: 'bounties',   title: 'Bounties',    icon: '🏭' },
  { id: 'complete',   title: 'Ready!',       icon: '🎉' },
];

const LANGUAGES = [
  { id: 'typescript', label: 'TypeScript', icon: '🔷' },
  { id: 'rust',       label: 'Rust',        icon: '🦀' },
  { id: 'python',     label: 'Python',      icon: '🐍' },
  { id: 'go',         label: 'Go',          icon: '🔵' },
  { id: 'solidity',   label: 'Solidity',    icon: '💎' },
  { id: 'swift',      label: 'Swift',       icon: '🍎' },
  { id: 'kotlin',     label: 'Kotlin',      icon: '🟣' },
];

const SKILL_AREAS = [
  { id: 'frontend',    label: 'Frontend',    emoji: '🎨' },
  { id: 'backend',     label: 'Backend',     emoji: '⚙️' },
  { id: 'smart-contract', label: 'Smart Contracts', emoji: '📜' },
  { id: 'security',    label: 'Security',    emoji: '🔒' },
  { id: 'devops',      label: 'DevOps',      emoji: '🚀' },
  { id: 'design',      label: 'UI/UX Design', emoji: '✏️' },
  { id: 'testing',     label: 'Testing',     emoji: '🧪' },
  { id: 'docs',        label: 'Docs',        emoji: '📝' },
];

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="w-full h-1 bg-forge-800 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-emerald to-purple"
        initial={{ width: 0 }}
        animate={{ width: `${((step) / total) * 100}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  );
}

// ─── Step dots ───────────────────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((s, i) => (
        <button
          key={s.id}
          onClick={() => {}}
          className={`w-2.5 h-2.5 rounded-full transition-all duration-300 cursor-default
            ${i === current
              ? 'bg-emerald scale-125'
              : i < current
              ? 'bg-emerald/50'
              : 'bg-forge-700'
            }`}
          title={s.title}
        />
      ))}
    </div>
  );
}

// ─── Step: Welcome ───────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={staggerItem} className="text-center space-y-3">
        <div className="text-5xl">👋</div>
        <h2 className="font-display text-2xl font-bold text-text-primary">
          Welcome to SolFoundry
        </h2>
        <p className="text-text-secondary max-w-sm mx-auto">
          The AI-powered bounty forge where builders earn rewards shipping real code.
          Let's get you set up in under 2 minutes.
        </p>
      </motion.div>

      <motion.div variants={staggerItem} className="space-y-3">
        {[
          { icon: '⚡', text: 'Browse bounties that match your skills', sub: 'Filter by domain, tier, and reward type' },
          { icon: '🏭', text: 'Submit PRs and get AI code reviews', sub: 'Every submission is automatically reviewed' },
          { icon: '💰', text: 'Get paid in USDC or $FNDRY', sub: 'Fast payouts once your work is merged' },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-lg bg-forge-900 border border-border">
            <span className="text-xl mt-0.5">{item.icon}</span>
            <div>
              <p className="text-sm font-medium text-text-primary">{item.text}</p>
              <p className="text-xs text-text-muted mt-0.5">{item.sub}</p>
            </div>
          </div>
        ))}
      </motion.div>

      <motion.div variants={staggerItem} className="flex justify-center pt-2">
        <button
          onClick={onNext}
          className="px-8 py-3 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors shadow-lg shadow-emerald/20"
        >
          Get Started →
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Step: Profile ────────────────────────────────────────────────────────────

function ProfileStep({ onNext }: { onNext: () => void }) {
  const { user } = useAuth();
  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState('');

  const canProceed = username.trim().length >= 3;

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={staggerItem} className="text-center space-y-2">
        <div className="text-4xl">👤</div>
        <h2 className="font-display text-xl font-bold text-text-primary">Set Up Your Profile</h2>
        <p className="text-text-secondary text-sm">Your public identity on SolFoundry.</p>
      </motion.div>

      <motion.div variants={staggerItem} className="space-y-4">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="relative">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={username}
                className="w-20 h-20 rounded-full border-2 border-emerald"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-forge-800 border-2 border-border flex items-center justify-center text-3xl">
                {username ? username[0].toUpperCase() : '?'}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-text-inverse" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-2">Linked to GitHub</p>
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_username"
            maxLength={30}
            className="w-full px-4 py-2.5 rounded-lg bg-forge-900 border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-emerald transition-colors"
          />
          {username.length > 0 && username.length < 3 && (
            <p className="text-xs text-status-error">Username must be at least 3 characters</p>
          )}
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Bio <span className="text-text-muted/50">(optional)</span></label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What do you specialize in? What kind of bounties interest you?"
            maxLength={160}
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg bg-forge-900 border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-emerald transition-colors resize-none"
          />
          <p className="text-xs text-text-muted text-right">{bio.length}/160</p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all
            ${canProceed
              ? 'bg-emerald text-text-inverse hover:bg-emerald-light shadow-lg shadow-emerald/20'
              : 'bg-forge-800 text-text-muted cursor-not-allowed'
            }`}
        >
          Continue →
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Step: Skills ────────────────────────────────────────────────────────────

function SkillsStep({ onNext }: { onNext: () => void }) {
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const toggleLang = (id: string) =>
    setSelectedLangs(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]);
  const toggleSkill = (id: string) =>
    setSelectedSkills(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const canProceed = selectedLangs.length > 0 && selectedSkills.length > 0;

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={staggerItem} className="text-center space-y-2">
        <div className="text-4xl">⚡</div>
        <h2 className="font-display text-xl font-bold text-text-primary">Your Skills</h2>
        <p className="text-text-secondary text-sm">Help us match you with the right bounties.</p>
      </motion.div>

      {/* Languages */}
      <motion.div variants={staggerItem} className="space-y-2.5">
        <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Languages</label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              onClick={() => toggleLang(lang.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all
                ${selectedLangs.includes(lang.id)
                  ? 'bg-emerald-bg border-emerald-border text-emerald'
                  : 'bg-forge-900 border-border text-text-secondary hover:border-border-hover'
                }`}
            >
              <span>{lang.icon}</span> {lang.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Skill areas */}
      <motion.div variants={staggerItem} className="space-y-2.5">
        <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Domains</label>
        <div className="flex flex-wrap gap-2">
          {SKILL_AREAS.map((skill) => (
            <button
              key={skill.id}
              onClick={() => toggleSkill(skill.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all
                ${selectedSkills.includes(skill.id)
                  ? 'bg-purple-bg border-purple-border text-purple-light'
                  : 'bg-forge-900 border-border text-text-secondary hover:border-border-hover'
                }`}
            >
              <span>{skill.emoji}</span> {skill.label}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="flex justify-between items-center pt-2">
        <p className="text-xs text-text-muted">
          {selectedLangs.length} languages · {selectedSkills.length} domains selected
        </p>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all
            ${canProceed
              ? 'bg-emerald text-text-inverse hover:bg-emerald-light shadow-lg shadow-emerald/20'
              : 'bg-forge-800 text-text-muted cursor-not-allowed'
            }`}
        >
          Continue →
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Step: Wallet ─────────────────────────────────────────────────────────────

function WalletStep({ onNext }: { onNext: () => void }) {
  const { user } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [connected] = useState(!!user?.wallet_address);

  const handleConnect = async () => {
    setConnecting(true);
    // Simulate wallet connection delay
    await new Promise(r => setTimeout(r, 1500));
    setConnecting(false);
  };

  const canProceed = connected;

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={staggerItem} className="text-center space-y-2">
        <div className="text-4xl flex justify-center">
          {connected ? <span>🔗</span> : <WalletIcon />}
        </div>
        <h2 className="font-display text-xl font-bold text-text-primary">Connect Your Wallet</h2>
        <p className="text-text-secondary text-sm max-w-xs mx-auto">
          {connected
            ? 'Wallet connected! You can receive bounty rewards.'
            : 'Link a Solana wallet to receive USDC and $FNDRY rewards.'
          }
        </p>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col items-center gap-4">
        {connected ? (
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-emerald-bg border border-emerald-border">
            <div className="w-10 h-10 rounded-full bg-emerald/20 flex items-center justify-center">
              <span className="text-emerald font-mono text-sm font-semibold">
                {user?.wallet_address?.slice(0, 4)}
              </span>
            </div>
            <div className="text-left">
              <p className="text-sm font-mono font-semibold text-emerald">
                {user?.wallet_address?.slice(0, 8)}...{user?.wallet_address?.slice(-6)}
              </p>
              <p className="text-xs text-emerald/70">Connected</p>
            </div>
            <CheckIcon />
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-forge-800 border border-border hover:border-emerald transition-all"
          >
            {connecting ? (
              <>
                <svg className="w-5 h-5 animate-spin text-emerald" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span className="text-sm text-text-secondary">Connecting...</span>
              </>
            ) : (
              <>
                <WalletIcon />
                <span className="text-sm font-medium text-text-primary">Connect Phantom / Solflare</span>
              </>
            )}
          </button>
        )}

        <div className="space-y-2 w-full max-w-sm">
          {[
            { icon: '💰', text: 'Receive USDC rewards directly' },
            { icon: '🪙', text: 'Earn $FNDRY governance tokens' },
            { icon: '⚡', text: 'Instant settlements after merge' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 text-sm text-text-secondary">
              <span>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all
            ${canProceed
              ? 'bg-emerald text-text-inverse hover:bg-emerald-light shadow-lg shadow-emerald/20'
              : 'bg-forge-800 text-text-muted cursor-not-allowed'
            }`}
        >
          Continue →
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Step: Bounty Education ─────────────────────────────────────────────────

function BountiesStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={staggerItem} className="text-center space-y-2">
        <div className="text-4xl">🏭</div>
        <h2 className="font-display text-xl font-bold text-text-primary">How Bounties Work</h2>
        <p className="text-text-secondary text-sm">The whole system in 60 seconds.</p>
      </motion.div>

      <motion.div variants={staggerItem} className="space-y-3">
        {[
          { step: '1', icon: '🔍', title: 'Find a bounty', sub: 'Browse open bounties that match your skills. Filter by tier, language, and reward.' },
          { step: '2', icon: '🏭', title: 'Forge your solution', sub: 'Submit a PR with your implementation. Be clear, be complete.' },
          { step: '3', icon: '🤖', title: 'AI reviews it', sub: 'Every submission gets an automated code review. Fix issues if needed.' },
          { step: '4', icon: '💰', title: 'Get paid', sub: 'Once merged, your reward is released to your connected wallet.' },
        ].map((item, i) => (
          <motion.div
            key={i}
            variants={staggerItem}
            className="flex items-start gap-3 px-4 py-3 rounded-lg bg-forge-900 border border-border"
          >
            <div className="w-7 h-7 rounded-full bg-forge-800 border border-border flex items-center justify-center text-xs font-bold text-emerald flex-shrink-0">
              {item.step}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">{item.icon} {item.title}</p>
              <p className="text-xs text-text-muted mt-0.5">{item.sub}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center justify-between rounded-lg px-4 py-3 bg-forge-850 border border-border">
        <div className="text-xs text-text-muted">
          <span className="font-semibold text-text-primary">Tiers:</span> T1 (Easy) → T2 (Medium) → T3 (Complex)
        </div>
        <div className="flex gap-1">
          {['#00E676','#40C4FF','#7C3AED'].map((c, i) => (
            <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="flex justify-end">
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors shadow-lg shadow-emerald/20"
        >
          Start Hunting →
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Step: Complete ─────────────────────────────────────────────────────────

function CompleteStep() {
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6 text-center">
      <motion.div variants={staggerItem} className="space-y-3">
        <div className="text-5xl">🎉</div>
        <h2 className="font-display text-2xl font-bold text-text-primary">You're All Set!</h2>
        <p className="text-text-secondary text-sm max-w-xs mx-auto">
          Your profile is ready. Start browsing bounties and claiming your first reward.
        </p>
      </motion.div>

      <motion.div variants={staggerItem} className="flex justify-center gap-4">
        <a
          href="/bounties"
          className="px-6 py-3 rounded-lg bg-emerald text-text-inverse font-semibold text-sm hover:bg-emerald-light transition-colors shadow-lg shadow-emerald/20"
        >
          Browse Bounties
        </a>
        <a
          href="/"
          className="px-6 py-3 rounded-lg border border-border text-text-secondary font-semibold text-sm hover:border-border-hover hover:text-text-primary transition-colors"
        >
          Back to Home
        </a>
      </motion.div>

      <motion.div variants={staggerItem} className="pt-2">
        <p className="text-xs text-text-muted">
          You can update your profile and skills anytime from your dashboard.
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const stepId = STEPS[currentStep].id;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  return (
    <div className="min-h-screen bg-forge-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl border border-border bg-forge-900/80 backdrop-blur-sm shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-0 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏭</span>
                <span className="font-display text-sm font-semibold text-text-primary tracking-wide">SolFoundry</span>
              </div>
              <span className="text-xs text-text-muted font-mono">Onboarding</span>
            </div>
            <ProgressBar step={currentStep} total={STEPS.length - 1} />
            <StepDots current={currentStep} />
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={stepId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {stepId === 'welcome'   && <WelcomeStep   onNext={handleNext} />}
                {stepId === 'profile'   && <ProfileStep   onNext={handleNext} />}
                {stepId === 'skills'    && <SkillsStep    onNext={handleNext} />}
                {stepId === 'wallet'    && <WalletStep    onNext={handleNext} />}
                {stepId === 'bounties'  && <BountiesStep  onNext={handleNext} />}
                {stepId === 'complete'  && <CompleteStep />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
