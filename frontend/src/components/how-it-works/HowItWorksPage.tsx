import { useState } from 'react';

// ── Step data ────────────────────────────────────────────────────────────────

interface Step {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}

const STEPS: Step[] = [
  {
    number: 1,
    title: 'Browse Bounties',
    description:
      'Explore open bounties across different tiers and skill requirements. Filter by reward size, technology, or difficulty to find the perfect task for you.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
    accent: '#9945FF',
  },
  {
    number: 2,
    title: 'Fork & Build',
    description:
      'Fork the SolFoundry repository, create a feature branch, and start building. Follow the requirements outlined in the bounty issue to guide your implementation.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    accent: '#4DA8FF',
  },
  {
    number: 3,
    title: 'Submit PR',
    description:
      'Open a pull request referencing the bounty issue with "Closes #issue". Include a clear description of your changes and any relevant screenshots or demos.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
    accent: '#14F195',
  },
  {
    number: 4,
    title: 'AI Review',
    description:
      'Our AI review system automatically evaluates your code for quality, correctness, and adherence to the bounty requirements. You\'ll receive detailed feedback within minutes.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
    accent: '#FFD700',
  },
  {
    number: 5,
    title: 'Get Paid',
    description:
      'Once your PR is approved and merged, the $FNDRY reward is sent directly to your connected Solana wallet. No invoices, no delays — just code and earn.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    accent: '#14F195',
  },
];

// ── FAQ data ─────────────────────────────────────────────────────────────────

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'What is $FNDRY?',
    answer:
      '$FNDRY is the native token of SolFoundry, built on the Solana blockchain. It\'s used to reward contributors who complete bounties. You can earn $FNDRY by building features, fixing bugs, and improving the platform. The token is fully on-chain and can be held, traded, or used within the SolFoundry ecosystem.',
  },
  {
    question: 'How do I get started?',
    answer:
      'Getting started is simple: connect your Solana wallet, browse the open bounties, and pick one that matches your skills. Fork the repository, create a feature branch, build your solution, and submit a pull request referencing the bounty issue. Our AI review system handles the rest.',
  },
  {
    question: 'How does the AI review work?',
    answer:
      'When you submit a pull request, our AI review system automatically analyzes your code for quality, correctness, style consistency, and adherence to the bounty requirements. It checks for common issues, verifies the implementation meets the specification, and provides detailed inline feedback. Think of it as an instant, thorough code review available 24/7.',
  },
  {
    question: 'How long do reviews take?',
    answer:
      'AI reviews typically complete within a few minutes of submitting your PR. You\'ll receive inline comments and an overall assessment almost immediately. If a human review is also required for higher-tier bounties, that may take an additional 24–48 hours.',
  },
  {
    question: 'What if my PR gets rejected?',
    answer:
      'Don\'t worry — rejection is part of the process. The AI reviewer will provide specific feedback on what needs to change. You can update your PR based on the feedback and push new commits. The review will re-run automatically. There\'s no penalty for iterations, and most bounties are completed within 2–3 review cycles.',
  },
  {
    question: 'How do payouts work?',
    answer:
      'Payouts are sent in $FNDRY tokens directly to the Solana wallet you connected when submitting your PR. Once your pull request is approved and merged, the reward is transferred automatically via an on-chain transaction. You can verify the transaction on Solscan. No invoices or manual steps required.',
  },
  {
    question: 'What are the bounty tiers?',
    answer:
      'Bounties are organized into tiers based on complexity and reward size. Tier 1 (Beginner-Friendly) offers 50,000–150,000 $FNDRY for straightforward tasks like UI components and documentation. Tier 2 (Intermediate) offers 150,000–500,000 $FNDRY for features requiring deeper integration. Tier 3 (Advanced) offers 500,000+ $FNDRY for complex system-level work like smart contracts and infrastructure.',
  },
  {
    question: 'Can I work on multiple bounties?',
    answer:
      'Yes! You can work on as many bounties as you want simultaneously. However, we recommend focusing on one at a time to produce your best work and maximize your chances of approval. If a bounty has already been claimed by another contributor, you\'ll see that in the issue status.',
  },
];

// ── Chevron icon ─────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 shrink-0 text-gray-500 dark:text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

// ── FAQ Accordion Item ───────────────────────────────────────────────────────

function AccordionItem({
  item,
  index,
  isOpen,
  onToggle,
}: {
  item: FAQItem;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const panelId = `faq-panel-${index}`;
  const triggerId = `faq-trigger-${index}`;
  return (
    <div
      className={
        'rounded-xl overflow-hidden border transition-colors ' +
        (isOpen
          ? 'border-solana-green/35 bg-white shadow-sm dark:border-solana-green/25 dark:bg-surface-50/80 dark:shadow-none'
          : 'border-gray-200 bg-white hover:border-gray-300 dark:border-white/10 dark:bg-surface-50 dark:hover:border-white/20')
      }
    >
      <button
        type="button"
        onClick={onToggle}
        className={
          'w-full flex items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5 text-left cursor-pointer transition-colors ' +
          (isOpen
            ? 'bg-gray-50 dark:bg-surface-100'
            : 'bg-white hover:bg-gray-50 dark:bg-surface-50 dark:hover:bg-surface-100')
        }
        aria-expanded={isOpen}
        aria-controls={panelId}
        id={triggerId}
      >
        <span className="text-sm sm:text-base font-medium text-gray-900 dark:text-white pr-2">
          {item.question}
        </span>
        <ChevronIcon open={isOpen} />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        className="grid transition-all duration-300 ease-in-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-4 sm:px-6 sm:pb-5 pt-0 border-t border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-surface-100/50">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed pt-4">
              {item.answer}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step Card ────────────────────────────────────────────────────────────────

function StepCard({ step, isLast }: { step: Step; isLast: boolean }) {
  return (
    <div className="relative flex flex-col items-center text-center group">
      {/* Connector line (hidden on last item and mobile) */}
      {!isLast && (
        <div className="hidden lg:block absolute top-10 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-gradient-to-r from-gray-300 to-gray-200/50 dark:from-white/20 dark:to-white/5 z-0" />
      )}

      {/* Icon circle */}
      <div
        className="relative z-10 w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
        style={{
          background: `${step.accent}15`,
          border: `1px solid ${step.accent}30`,
        }}
      >
        <div style={{ color: step.accent }}>{step.icon}</div>
      </div>

      {/* Step number badge */}
      <div
        className="absolute -top-2 -right-2 sm:top-0 sm:right-[calc(50%-52px)] w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black z-20"
        style={{ background: step.accent }}
      >
        {step.number}
      </div>

      {/* Text */}
      <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-[240px]">{step.description}</p>
    </div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────────

export function HowItWorksPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <div className="min-h-screen">
      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-solana-purple/10 rounded-full blur-[120px]" />
          <div className="absolute top-20 left-1/3 w-[400px] h-[300px] bg-solana-green/8 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-12 sm:pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-solana-purple/10 border border-solana-purple/20 text-solana-purple text-xs font-medium mb-6">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            New to SolFoundry?
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black dark:text-white mb-4 tracking-tight">
            Code.{' '}
            <span className="bg-gradient-to-r from-solana-purple to-solana-green bg-clip-text text-transparent">
              Contribute.
            </span>{' '}
            Earn.
          </h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            SolFoundry connects open-source contributors with paid bounties.
            Pick a task, write great code, and get rewarded in $FNDRY — all reviewed by AI in minutes.
          </p>
        </div>
      </section>

      {/* ── Steps Section ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
        <div className="text-center mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">How It Works</h2>
          <p className="text-sm text-gray-600 dark:text-gray-500">Five steps from discovery to payout</p>
        </div>

        {/* Desktop: horizontal flow */}
        <div className="hidden lg:grid lg:grid-cols-5 gap-6">
          {STEPS.map((step, i) => (
            <StepCard key={step.number} step={step} isLast={i === STEPS.length - 1} />
          ))}
        </div>

        {/* Mobile/Tablet: vertical timeline */}
        <div className="lg:hidden space-y-8">
          {STEPS.map((step) => (
            <div key={step.number} className="flex gap-4">
              {/* Timeline rail */}
              <div className="flex flex-col items-center">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: `${step.accent}15`,
                    border: `1px solid ${step.accent}30`,
                  }}
                >
                  <div style={{ color: step.accent }}>{step.icon}</div>
                </div>
                {step.number < STEPS.length && (
                  <div className="w-px flex-1 mt-2 bg-gradient-to-b from-gray-300 to-transparent dark:from-white/15 min-h-[24px]" />
                )}
              </div>

              {/* Content */}
              <div className="pt-1 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded text-black"
                    style={{ background: step.accent }}
                  >
                    {step.number}
                  </span>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">{step.title}</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ Section ───────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
        <div className="text-center mb-10">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-500">
            Everything you need to know about contributing
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem
              key={index}
              index={index}
              item={item}
              isOpen={openFAQ === index}
              onToggle={() => toggleFAQ(index)}
            />
          ))}
        </div>
      </section>

      {/* ── CTA Section ───────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28">
        <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-surface-50 dark:shadow-none p-8 sm:p-12 text-center">
          {/* Subtle glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-solana-green/10 dark:bg-solana-green/5 rounded-full blur-[80px]" />
          </div>

          <div className="relative">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3">Ready to start earning?</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
              Browse open bounties and find your first task. No applications, no interviews — just great code.
            </p>
            <a
              href="/bounties"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-solana-purple to-solana-green
                       text-white text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-solana-purple/20"
            >
              Browse Open Bounties
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HowItWorksPage;
