/**
 * FAQPage — "How It Works" + FAQ accordion page for SolFoundry.
 *
 * Route: /faq
 *
 * Sections:
 *  1. How It Works — 4 step cards (Post → Submit → Review → Paid)
 *  2. FAQ — 8+ collapsible Q&A accordion items
 *
 * @module FAQPage
 */
import React, { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PostBountyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      className="w-7 h-7">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SubmitPRIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      className="w-7 h-7">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
      <path d="M6 9v12" />
    </svg>
  );
}

function AIReviewIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      className="w-7 h-7">
      <path d="M12 2a10 10 0 1 0 10 10" />
      <path d="M12 8v4l3 3" />
      <path d="M20 2v6h-6" />
    </svg>
  );
}

function GetPaidIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      className="w-7 h-7">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const HOW_IT_WORKS_STEPS: Step[] = [
  {
    number: 1,
    icon: <PostBountyIcon />,
    title: 'Post a Bounty',
    description:
      'Project owners post a bounty describing the feature, bug fix, or task they need done. They set the $FNDRY reward, requirements, and deadline.',
  },
  {
    number: 2,
    icon: <SubmitPRIcon />,
    title: 'Submit a PR',
    description:
      'Contributors fork the repo, implement the solution, and submit a pull request linked to the bounty. Clear description and passing tests are essential.',
  },
  {
    number: 3,
    icon: <AIReviewIcon />,
    title: 'AI Review',
    description:
      'Our AI agent reviews submitted PRs for code quality, test coverage, security issues, and spec compliance. Results are posted to the PR within minutes.',
  },
  {
    number: 4,
    icon: <GetPaidIcon />,
    title: 'Get Paid',
    description:
      'Once a PR passes the AI review and the bounty poster approves the merge, $FNDRY tokens are released automatically to the contributor\'s Solana wallet.',
  },
];

const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'what-is-solfoundry',
    question: 'What is SolFoundry?',
    answer:
      'SolFoundry is an open-source bounty platform built on Solana. It connects project owners who need development work done with skilled contributors who earn $FNDRY tokens for shipping quality code.',
  },
  {
    id: 'what-is-fndry',
    question: 'What is $FNDRY?',
    answer:
      '$FNDRY is the native utility token of the SolFoundry ecosystem on Solana. It is used to fund bounties, reward contributors, and participate in protocol governance. Token contract: C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS.',
  },
  {
    id: 'how-post-bounty',
    question: 'How do I post a bounty?',
    answer:
      'Connect your Solana wallet, click "Post Bounty", describe the task, set a $FNDRY reward amount, and publish. Your tokens are held in escrow until the bounty is claimed or you cancel it. You need a minimum of 1,000 $FNDRY to post.',
  },
  {
    id: 'how-claim-bounty',
    question: 'How do I claim a bounty?',
    answer:
      'Browse open bounties, find one you can solve, and click "Claim". Fork the GitHub repository, implement the fix on a new branch, open a pull request with the bounty number in the title, and submit the PR link through the SolFoundry interface.',
  },
  {
    id: 'how-ai-review-works',
    question: 'How does the AI review work?',
    answer:
      'Our AI agent runs static analysis, checks test coverage, scans for common security vulnerabilities, and evaluates whether the implementation matches the bounty specification. Results appear as a PR comment usually within 2–5 minutes of submission.',
  },
  {
    id: 'how-long-to-get-paid',
    question: 'How long does it take to receive payment?',
    answer:
      'Once the bounty poster approves the merged PR, the $FNDRY payment is released to your Solana wallet via a smart contract. This typically happens within 1–2 business days after approval. On-chain settlement completes in seconds.',
  },
  {
    id: 'can-multiple-contributors',
    question: 'Can multiple contributors work on the same bounty?',
    answer:
      'Yes. Multiple contributors can submit PRs for the same bounty. The bounty poster chooses the best solution. Only one PR is accepted and paid out. We encourage contributors to work on unclaimed bounties to avoid wasted effort.',
  },
  {
    id: 'what-if-pr-rejected',
    question: 'What happens if my PR is rejected?',
    answer:
      'If the AI review fails, the feedback will detail what needs to be fixed. You can update your PR and resubmit. If the bounty poster rejects the work, you can address their feedback. Bounties remain open until a solution is accepted or the poster cancels.',
  },
  {
    id: 'what-languages-supported',
    question: 'What programming languages and frameworks are supported?',
    answer:
      'SolFoundry supports bounties across any language or framework. The AI reviewer has strong coverage for Rust, TypeScript, JavaScript, Go, and Python. Solana program bounties (Anchor, native) are first-class citizens.',
  },
  {
    id: 'are-there-fees',
    question: 'Are there any platform fees?',
    answer:
      'SolFoundry charges a 2.5% protocol fee on paid-out bounties to fund ongoing development and AI infrastructure. There is no fee to browse bounties or submit PRs. Posting a bounty requires locking the full reward amount in escrow.',
  },
];

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({ step }: { step: Step }) {
  return (
    <div className="relative flex flex-col items-center text-center gap-4 p-6
                    bg-gray-800/60 border border-white/10 rounded-2xl
                    hover:border-[#9945FF]/40 transition-colors duration-200">
      {/* Number badge */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2
                      w-8 h-8 rounded-full flex items-center justify-center
                      bg-gradient-to-br from-[#9945FF] to-[#14F195]
                      text-white text-sm font-bold shadow-lg">
        {step.number}
      </div>

      {/* Icon */}
      <div className="mt-4 w-14 h-14 rounded-xl flex items-center justify-center
                      bg-[#9945FF]/10 text-[#9945FF]">
        {step.icon}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-white">{step.title}</h3>

      {/* Description */}
      <p className="text-sm text-gray-400 leading-relaxed">{step.description}</p>
    </div>
  );
}

// ─── Accordion Item ────────────────────────────────────────────────────────────

interface AccordionItemProps {
  item: FAQItem;
  isOpen: boolean;
  onToggle: (id: string) => void;
}

function AccordionItem({ item, isOpen, onToggle }: AccordionItemProps) {
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden
                    bg-gray-800/40 hover:bg-gray-800/60 transition-colors duration-200">
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${item.id}`}
        id={`faq-question-${item.id}`}
        className="w-full flex items-center justify-between gap-4
                   px-5 py-4 text-left
                   focus:outline-none focus:ring-2 focus:ring-[#9945FF]/50 focus:ring-inset"
      >
        <span className="text-sm font-medium text-white">{item.question}</span>
        <ChevronIcon open={isOpen} />
      </button>

      {/* Answer — CSS transition for smooth expand/collapse */}
      <div
        id={`faq-answer-${item.id}`}
        role="region"
        aria-labelledby={`faq-question-${item.id}`}
        style={{
          display: 'grid',
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 280ms ease',
        }}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm text-gray-400 leading-relaxed">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * FAQPage — SolFoundry "How It Works" + FAQ page.
 * Route: /faq
 */
export default function FAQPage() {
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0].id);

  const handleToggle = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="text-center space-y-4">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium
                           bg-[#9945FF]/10 text-[#9945FF] border border-[#9945FF]/20">
            How It Works
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Build. Ship.{' '}
            <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">
              Earn.
            </span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-base leading-relaxed">
            SolFoundry is the fastest way for developers to earn $FNDRY by shipping
            open-source Solana code — and for project owners to get quality work done.
          </p>
        </div>

        {/* ── How It Works Steps ──────────────────────────────────────────── */}
        <section aria-labelledby="how-it-works-heading">
          <h2
            id="how-it-works-heading"
            className="text-2xl font-bold text-center mb-10"
          >
            Four simple steps
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pt-4">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <StepCard key={step.number} step={step} />
            ))}
          </div>
        </section>

        {/* ── Divider ────────────────────────────────────────────────────── */}
        <div className="border-t border-white/10" />

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <section aria-labelledby="faq-heading">
          <div className="text-center mb-10 space-y-2">
            <h2 id="faq-heading" className="text-2xl font-bold">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-400 text-sm">
              Everything you need to know about SolFoundry and $FNDRY.
            </p>
          </div>

          <div className="space-y-3 max-w-3xl mx-auto">
            {FAQ_ITEMS.map((item) => (
              <AccordionItem
                key={item.id}
                item={item}
                isOpen={openId === item.id}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────────────── */}
        <div className="text-center space-y-4 pb-8">
          <h3 className="text-xl font-semibold">Ready to start?</h3>
          <p className="text-gray-400 text-sm">
            Browse open bounties and start earning $FNDRY today.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/bounties"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl
                         bg-gradient-to-r from-[#9945FF] to-[#14F195]
                         text-white text-sm font-semibold
                         hover:opacity-90 transition-opacity shadow-lg shadow-[#9945FF]/20"
            >
              Browse Bounties
            </a>
            <a
              href="/bounties/create"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl
                         border border-white/20 bg-white/5
                         text-white text-sm font-semibold
                         hover:bg-white/10 transition-colors"
            >
              Post a Bounty
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
