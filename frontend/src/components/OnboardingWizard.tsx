/** Contributor onboarding wizard — 4-step flow: Welcome → Wallet → Skills → First Bounty */
import React from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

type Skill = 'react' | 'python' | 'fastapi' | 'solidity' | 'typescript' | 'rust' | 'go' | 'docker';

interface RecommendedBounty {
  id: number;
  title: string;
  tier: 'T1' | 'T2' | 'T3';
  reward: number;
  skills: Skill[];
  issueUrl: string;
}

// ── Recommended bounties mapped by skill ──────────────────────────────────────

const ALL_BOUNTIES: RecommendedBounty[] = [
  {
    id: 203,
    title: 'Agent Registration API (Backend, Python/FastAPI)',
    tier: 'T1',
    reward: 250000,
    skills: ['python', 'fastapi'],
    issueUrl: 'https://github.com/SolFoundry/solfoundry/issues/203',
  },
  {
    id: 204,
    title: 'Agent Profile Page (Frontend, React/TypeScript)',
    tier: 'T1',
    reward: 200000,
    skills: ['react', 'typescript'],
    issueUrl: 'https://github.com/SolFoundry/solfoundry/issues/204',
  },
  {
    id: 205,
    title: 'Activity Feed Component (Frontend)',
    tier: 'T1',
    reward: 150000,
    skills: ['react', 'typescript'],
    issueUrl: 'https://github.com/SolFoundry/solfoundry/issues/205',
  },
  {
    id: 206,
    title: 'Bounty Timeline Component (Frontend)',
    tier: 'T1',
    reward: 175000,
    skills: ['react', 'typescript'],
    issueUrl: 'https://github.com/SolFoundry/solfoundry/issues/206',
  },
  {
    id: 207,
    title: 'Contributor Onboarding Flow (Frontend)',
    tier: 'T1',
    reward: 175000,
    skills: ['react', 'typescript'],
    issueUrl: 'https://github.com/SolFoundry/solfoundry/issues/207',
  },
  {
    id: 190,
    title: 'Smart contract gas optimisation (Solidity)',
    tier: 'T2',
    reward: 300000,
    skills: ['solidity'],
    issueUrl: 'https://github.com/SolFoundry/solfoundry/issues/190',
  },
  {
    id: 191,
    title: 'Rust BPF program: token vesting schedule',
    tier: 'T2',
    reward: 350000,
    skills: ['rust'],
    issueUrl: 'https://github.com/SolFoundry/solfoundry/issues/191',
  },
  {
    id: 192,
    title: 'Go microservice: on-chain event indexer',
    tier: 'T2',
    reward: 280000,
    skills: ['go'],
    issueUrl: 'https://github.com/SolFoundry/solfoundry/issues/192',
  },
  {
    id: 193,
    title: 'Dockerise backend for reproducible builds',
    tier: 'T1',
    reward: 120000,
    skills: ['docker'],
    issueUrl: 'https://github.com/SolFoundry/solfoundry/issues/193',
  },
];

function getRecommended(selected: Skill[]): RecommendedBounty[] {
  if (selected.length === 0) return ALL_BOUNTIES.filter((b) => b.tier === 'T1').slice(0, 3);
  const scored = ALL_BOUNTIES.map((b) => ({
    bounty: b,
    score: b.skills.filter((s) => selected.includes(s)).length,
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.bounty.reward - b.bounty.reward);
  const top = scored.slice(0, 3).map((x) => x.bounty);
  // Pad with T1 bounties if fewer than 3 matches
  if (top.length < 3) {
    const fallback = ALL_BOUNTIES.filter(
      (b) => b.tier === 'T1' && !top.includes(b)
    ).slice(0, 3 - top.length);
    top.push(...fallback);
  }
  return top;
}

// ── Skill config ──────────────────────────────────────────────────────────────

const SKILLS: { id: Skill; label: string; color: string }[] = [
  { id: 'react', label: 'React', color: 'text-cyan-400 border-cyan-700 bg-cyan-900/30' },
  { id: 'python', label: 'Python', color: 'text-yellow-400 border-yellow-700 bg-yellow-900/30' },
  { id: 'fastapi', label: 'FastAPI', color: 'text-green-400 border-green-700 bg-green-900/30' },
  { id: 'solidity', label: 'Solidity', color: 'text-purple-400 border-purple-700 bg-purple-900/30' },
  { id: 'typescript', label: 'TypeScript', color: 'text-blue-400 border-blue-700 bg-blue-900/30' },
  { id: 'rust', label: 'Rust', color: 'text-orange-400 border-orange-700 bg-orange-900/30' },
  { id: 'go', label: 'Go', color: 'text-teal-400 border-teal-700 bg-teal-900/30' },
  { id: 'docker', label: 'Docker', color: 'text-sky-400 border-sky-700 bg-sky-900/30' },
];

const TOTAL_STEPS = 4;
const MOCK_WALLET = '7xKXtg2...Abc1';

// ── Step components ───────────────────────────────────────────────────────────

function StepWelcome({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="text-5xl mb-3">🚀</div>
        <h2 className="text-xl font-bold text-white">Welcome to SolFoundry</h2>
        <p className="text-gray-400 text-sm mt-2">
          The autonomous AI software factory on Solana
        </p>
      </div>
      <div className="bg-gray-700/50 rounded-lg p-4 text-sm text-gray-300 space-y-2">
        <p className="font-medium text-white">What is SolFoundry?</p>
        <p>SolFoundry is an open bounty platform where contributors — human and AI — claim, build, and ship features for the Solana ecosystem.</p>
        <p>Earn <span className="text-green-400 font-medium">$FNDRY tokens</span> for every merged PR. The better the review score, the higher the payout.</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-2.5 rounded-lg bg-gray-700 text-gray-400 text-sm hover:bg-gray-600 transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
        >
          Get Started →
        </button>
      </div>
    </div>
  );
}

function StepWallet({
  onNext,
  onSkip,
}: {
  onNext: (wallet: string | null) => void;
  onSkip: () => void;
}) {
  const [connected, setConnected] = React.useState(false);
  const wallet = connected ? MOCK_WALLET : null;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="text-5xl mb-3">🔑</div>
        <h2 className="text-xl font-bold text-white">Connect Your Wallet</h2>
        <p className="text-gray-400 text-sm mt-2">
          Your Solana wallet is how you receive $FNDRY payouts
        </p>
      </div>
      <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
        {connected ? (
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-green-400 font-mono">{MOCK_WALLET}</span>
          </div>
        ) : (
          <button
            onClick={() => setConnected(true)}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Connect Phantom
          </button>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-2.5 rounded-lg bg-gray-700 text-gray-400 text-sm hover:bg-gray-600 transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={() => onNext(wallet)}
          className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
        >
          {connected ? 'Continue →' : 'Skip →'}
        </button>
      </div>
    </div>
  );
}

function StepSkills({
  selected,
  onChange,
  onNext,
  onSkip,
}: {
  selected: Skill[];
  onChange: (skills: Skill[]) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const toggle = (skill: Skill) =>
    onChange(
      selected.includes(skill)
        ? selected.filter((s) => s !== skill)
        : [...selected, skill]
    );

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="text-5xl mb-3">🛠️</div>
        <h2 className="text-xl font-bold text-white">Pick Your Skills</h2>
        <p className="text-gray-400 text-sm mt-2">
          We'll recommend bounties that match your stack
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {SKILLS.map((skill) => {
          const isSelected = selected.includes(skill.id);
          return (
            <button
              key={skill.id}
              onClick={() => toggle(skill.id)}
              aria-pressed={isSelected}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                isSelected
                  ? skill.color
                  : 'text-gray-500 border-gray-600 bg-gray-700/30 hover:border-gray-500'
              }`}
            >
              {isSelected && <span className="mr-1">✓</span>}
              {skill.label}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-center text-xs text-gray-500">
          {selected.length} skill{selected.length !== 1 ? 's' : ''} selected
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-2.5 rounded-lg bg-gray-700 text-gray-400 text-sm hover:bg-gray-600 transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
        >
          See Bounties →
        </button>
      </div>
    </div>
  );
}

const TIER_COLORS: Record<string, string> = {
  T1: 'bg-green-900/40 text-green-400 border-green-700/50',
  T2: 'bg-blue-900/40 text-blue-400 border-blue-700/50',
  T3: 'bg-purple-900/40 text-purple-400 border-purple-700/50',
};

function StepBounties({
  skills,
  onDone,
  onSkip,
}: {
  skills: Skill[];
  onDone: () => void;
  onSkip: () => void;
}) {
  const bounties = getRecommended(skills);

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="text-5xl mb-3">💰</div>
        <h2 className="text-xl font-bold text-white">Your First Bounty</h2>
        <p className="text-gray-400 text-sm mt-2">
          Here are 3 bounties matched to your skills
        </p>
      </div>
      <div className="space-y-3">
        {bounties.map((bounty) => (
          <div
            key={bounty.id}
            className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/40"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm text-white font-medium leading-snug flex-1">
                {bounty.title}
              </p>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${TIER_COLORS[bounty.tier]}`}
              >
                {bounty.tier}
              </span>
            </div>
            <p className="text-xs text-green-400 mb-3">
              {bounty.reward.toLocaleString()} $FNDRY
            </p>
            <a
              href={bounty.issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-lg transition-colors"
            >
              Claim on GitHub →
            </a>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-2.5 rounded-lg bg-gray-700 text-gray-400 text-sm hover:bg-gray-600 transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={onDone}
          className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
        >
          Let's Build 🚀
        </button>
      </div>
    </div>
  );
}

// ── Progress dots ─────────────────────────────────────────────────────────────

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i < step
              ? 'w-2 h-2 bg-green-500'
              : i === step
              ? 'w-3 h-3 bg-green-400 ring-2 ring-green-400/30'
              : 'w-2 h-2 bg-gray-600'
          }`}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onClose,
}) => {
  const [step, setStep] = React.useState(0);
  const [_wallet, setWallet] = React.useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = React.useState<Skill[]>([]);
  const [transitioning, setTransitioning] = React.useState(false);

  const advance = React.useCallback(
    (toStep: number | null) => {
      setTransitioning(true);
      setTimeout(() => {
        if (toStep === null || toStep >= TOTAL_STEPS) {
          localStorage.setItem('sf_onboarded', 'true');
          onClose();
        } else {
          setStep(toStep);
        }
        setTransitioning(false);
      }, 200);
    },
    [onClose]
  );

  const next = () => advance(step + 1);
  const skip = () => advance(step + 1);
  const done = () => advance(null);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Contributor onboarding"
    >
      <div
        className="bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl border border-gray-700 overflow-hidden"
        style={{
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? 'translateY(8px)' : 'translateY(0)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <span className="text-xs text-gray-500">
            Step {step + 1} of {TOTAL_STEPS}
          </span>
          <button
            onClick={done}
            className="text-gray-500 hover:text-gray-300 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Progress dots */}
        <div className="px-5 pt-3">
          <ProgressDots step={step} />
        </div>

        {/* Step content */}
        <div className="px-5 pb-6">
          {step === 0 && <StepWelcome onNext={next} onSkip={skip} />}
          {step === 1 && (
            <StepWallet
              onNext={(wallet) => {
                setWallet(wallet);
                next();
              }}
              onSkip={skip}
            />
          )}
          {step === 2 && (
            <StepSkills
              selected={selectedSkills}
              onChange={setSelectedSkills}
              onNext={next}
              onSkip={skip}
            />
          )}
          {step === 3 && (
            <StepBounties skills={selectedSkills} onDone={done} onSkip={done} />
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
