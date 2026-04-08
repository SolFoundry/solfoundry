import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  DollarSign,
  Lock,
  Bot,
  CircleCheck,
  GitPullRequest,
  Coins,
  ChevronDown,
} from 'lucide-react';

// GitHub icon not in this lucide version — inline SVG as a component
function GitHubSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}
const GitHubIcon = GitHubSvg;
import { fadeIn } from '../../lib/animations';

interface Step {
  icon: React.ElementType;
  title: string;
  description: string;
  snippet: string;
  isMagenta?: boolean;
}

const USDC_STEPS: Step[] = [
  {
    icon: FileText,
    title: 'Describe Your Bounty',
    description: 'Write a clear title and description. Optionally link a GitHub issue or repo.',
    snippet: '$ forge bounty create --title "Fix auth bypass"',
  },
  {
    icon: DollarSign,
    title: 'Set Reward & Timeline',
    description: 'Choose your USDC reward and deadline. AI suggests a difficulty tier.',
    snippet: '$ forge bounty fund --amount 500 --deadline 7d',
  },
  {
    icon: Lock,
    title: 'Fund Escrow',
    description: 'Send USDC to the escrow address. Paste your tx signature to verify.',
    snippet: '> tx verified: 5KfR...8xMn ✓',
  },
  {
    icon: Bot,
    title: 'AI Code Review',
    description: 'Three LLMs score every submission. Pass threshold: 7.0/10.',
    snippet: '> review score: 8.5/10 ✓ PASS',
    isMagenta: true,
  },
  {
    icon: CircleCheck,
    title: 'Approve & Pay',
    description: 'Review the AI report. Approve to release USDC to the contributor.',
    snippet: '> payout: 500 USDC → devbuilder ✓',
  },
];

const FNDRY_STEPS: Step[] = [
  {
    icon: GitHubIcon,
    title: 'Browse Issues',
    description: 'SolFoundry scrapes labeled GitHub issues as bounties. Browse and find one to solve.',
    snippet: '$ forge issues --label bounty --list',
  },
  {
    icon: GitPullRequest,
    title: 'Submit PR',
    description: 'Fork the repo, write your fix, open a pull request referencing the issue.',
    snippet: '$ git push origin fix/auth-bypass',
  },
  {
    icon: Bot,
    title: 'Auto-Judge',
    description: 'AI reviews the PR automatically. Results sent to Telegram for final approval.',
    snippet: '> AI review: 9.1/10 — PASS',
    isMagenta: true,
  },
  {
    icon: Coins,
    title: 'FNDRY Payout',
    description: 'On approval, FNDRY tokens are sent to your linked wallet address.',
    snippet: '> payout: 500,000 FNDRY → wallet ✓',
  },
];

const FAQS = [
  {
    id: 'q1',
    question: 'How does the AI review work?',
    answer:
      'Three different LLMs independently score each submission on a 0–10 scale. The average must exceed 7.0 to pass. Feedback from all three models is shown to both the creator and contributor.',
  },
  {
    id: 'q2',
    question: 'What USDC amounts are supported?',
    answer:
      'Any amount from $10 to $10,000 USDC. We recommend $50–$200 for typical bug fixes, $200+ for larger features.',
  },
  {
    id: 'q3',
    question: 'How are FNDRY bounties funded?',
    answer:
      'FNDRY bounties come from the SolFoundry treasury and are posted as labeled GitHub issues. Contributors earn FNDRY tokens when their PR is approved.',
  },
  {
    id: 'q4',
    question: 'What is the platform fee?',
    answer:
      'A 5% platform fee is added to all USDC bounty rewards. This covers operational costs and AI review infrastructure.',
  },
  {
    id: 'q5',
    question: 'Can I dispute an AI review decision?',
    answer:
      'Yes. Creators can manually override the AI decision. If a contributor believes the review was incorrect, they can request a manual review by contacting support.',
  },
];

function FAQItem({ faq }: { faq: typeof FAQS[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg bg-forge-900 border border-border overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-text-primary hover:bg-forge-850 transition-colors duration-150"
      >
        {faq.question}
        <ChevronDown
          className={`w-4 h-4 text-text-muted transition-transform duration-200 flex-shrink-0 ml-3 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-sm text-text-secondary leading-relaxed">{faq.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepFlow({ steps, color = 'emerald' }: { steps: Step[]; color?: 'emerald' | 'magenta' }) {
  return (
    <div className="flex flex-col md:flex-row items-start gap-6 md:gap-4">
      {steps.map((step, i) => (
        <div key={i} className="flex-1 relative">
          {/* Step number + connector */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-display text-sm font-bold flex-shrink-0 ${
                color === 'magenta'
                  ? 'border-magenta text-magenta bg-magenta-bg'
                  : 'border-emerald text-emerald bg-emerald-bg'
              }`}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className="hidden md:block flex-1 h-px bg-border" />
            )}
          </div>

          {/* Icon */}
          <step.icon
            className={`w-6 h-6 mb-2 ${step.isMagenta ? 'text-magenta' : `text-${color}`}`}
          />

          {/* Title */}
          <h3 className="font-sans text-base font-semibold text-text-primary">{step.title}</h3>

          {/* Description */}
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">{step.description}</p>

          {/* Terminal snippet */}
          <div className="mt-3 rounded-lg bg-forge-800 border border-border px-3 py-2">
            <code className={`font-mono text-xs ${step.isMagenta ? 'text-magenta' : 'text-emerald'}`}>
              {step.snippet}
            </code>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FlowTabs() {
  const [activeTab, setActiveTab] = useState<'usdc' | 'fndry'>('usdc');

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-forge-800 mx-auto w-fit mb-12">
        <button
          onClick={() => setActiveTab('usdc')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activeTab === 'usdc'
              ? 'bg-emerald text-text-inverse'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Creator Bounties (USDC)
        </button>
        <button
          onClick={() => setActiveTab('fndry')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activeTab === 'fndry'
              ? 'bg-magenta text-text-inverse'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Foundry Bounties (FNDRY)
        </button>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={fadeIn}
          initial="initial"
          animate="animate"
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          {activeTab === 'usdc' ? (
            <StepFlow steps={USDC_STEPS} color="emerald" />
          ) : (
            <StepFlow steps={FNDRY_STEPS} color="magenta" />
          )}
        </motion.div>
      </AnimatePresence>

      {/* FAQ */}
      <div className="mt-16 max-w-2xl mx-auto space-y-3">
        <h2 className="font-sans text-xl font-semibold text-text-primary mb-6 text-center">Frequently Asked Questions</h2>
        {FAQS.map((faq) => (
          <FAQItem key={faq.id} faq={faq} />
        ))}
      </div>
    </div>
  );
}
