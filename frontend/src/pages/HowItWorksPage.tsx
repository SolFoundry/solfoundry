/**
 * HowItWorksPage - FAQ and How It Works page for SolFoundry
 * @module pages/HowItWorksPage
 */
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface Step {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface FAQItem {
  question: string;
  answer: string;
}

// ============================================================================
// Icons
// ============================================================================

function BrowseIcon() {
  return (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function ForkIcon() {
  return (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}

function SubmitIcon() {
  return (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  );
}

function AIReviewIcon() {
  return (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function GetPaidIcon() {
  return (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
}

function ChevronDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

// ============================================================================
// Data
// ============================================================================

const STEPS: Step[] = [
  {
    number: 1,
    title: 'Browse Bounties',
    description: 'Explore open bounties on SolFoundry. Each bounty has clear requirements, a reward amount in $FNDRY, and a deadline.',
    icon: <BrowseIcon />,
  },
  {
    number: 2,
    title: 'Fork & Build',
    description: 'Fork the repository, create a feature branch, and implement the solution according to the bounty requirements.',
    icon: <ForkIcon />,
  },
  {
    number: 3,
    title: 'Submit PR',
    description: 'Open a pull request referencing the bounty issue. Our AI review system will automatically evaluate your code.',
    icon: <SubmitIcon />,
  },
  {
    number: 4,
    title: 'AI Review',
    description: 'Our multi-LLM review pipeline (GPT-5, Grok 4, Gemini 2.5 Pro) evaluates your code for quality, security, and completeness.',
    icon: <AIReviewIcon />,
  },
  {
    number: 5,
    title: 'Get Paid',
    description: 'Once your PR is merged, the bounty reward is automatically sent to your connected wallet in $FNDRY tokens.',
    icon: <GetPaidIcon />,
  },
];

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'What is $FNDRY?',
    answer: '$FNDRY is the native utility token of SolFoundry. It\'s used to reward contributors who complete bounties. You can earn $FNDRY by submitting successful pull requests, and it can be held, transferred, or used within the SolFoundry ecosystem.',
  },
  {
    question: 'How do I get started?',
    answer: 'Getting started is easy! 1) Connect your Solana wallet (Phantom, Solflare, etc.), 2) Browse open bounties and find one that matches your skills, 3) Fork the repository and create your solution, 4) Submit a pull request. That\'s it!',
  },
  {
    question: 'How does the AI review work?',
    answer: 'Our AI review pipeline uses multiple LLMs (GPT-5, Grok 4, Gemini 2.5 Pro) to evaluate your code. Each model scores your submission on quality, correctness, security, completeness, tests, and integration. The median score determines approval (threshold: 6.5/10 for tier-1 bounties).',
  },
  {
    question: 'How long do reviews take?',
    answer: 'AI reviews typically complete within 2-5 minutes of opening a PR. You\'ll see the results directly in the PR comments with detailed feedback on each category.',
  },
  {
    question: 'What if my PR gets rejected?',
    answer: 'Don\'t worry! Rejections are part of the learning process. The AI review provides detailed feedback on what needs improvement. You can address the issues and push new commits, or close the PR and start fresh on another bounty.',
  },
  {
    question: 'How do payouts work?',
    answer: 'Once your PR is merged, the bounty reward is automatically sent to your connected wallet. Make sure your wallet address is included in your PR description using the format "Wallet: YOUR_ADDRESS". Payouts are processed in $FNDRY tokens on Solana.',
  },
  {
    question: 'What are the bounty tiers?',
    answer: 'Bounties are categorized by complexity: Tier 1 (50K-150K $FNDRY) for beginner-friendly tasks, Tier 2 (200K-600K $FNDRY) for intermediate work requiring more integration, and Tier 3 (700K-1M $FNDRY) for complex, multi-component systems.',
  },
  {
    question: 'Can I work on multiple bounties?',
    answer: 'Yes! You can work on multiple bounties simultaneously. However, each bounty requires its own separate pull request. Make sure to manage your time effectively and only take on what you can deliver.',
  },
];

// ============================================================================
// Components
// ============================================================================

function StepCard({ step }: { step: Step }) {
  return (
    <div className="relative flex flex-col items-center text-center">
      {/* Connector line */}
      {step.number < STEPS.length && (
        <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-[#9945FF] to-[#14F195] opacity-30" />
      )}
      
      {/* Icon circle */}
      <div className="relative z-10 w-24 h-24 rounded-2xl bg-gradient-to-br from-[#9945FF] to-[#14F195] p-[2px] mb-4">
        <div className="w-full h-full rounded-2xl bg-gray-900 dark:bg-gray-900 flex items-center justify-center text-[#14F195]">
          {step.icon}
        </div>
      </div>
      
      {/* Step number */}
      <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#9945FF] text-white text-sm font-bold flex items-center justify-center">
        {step.number}
      </div>
      
      {/* Content */}
      <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
      <p className="text-sm text-gray-400 max-w-xs">{step.description}</p>
    </div>
  );
}

function FAQAccordion({ item, isOpen, onToggle }: { 
  item: FAQItem; 
  isOpen: boolean; 
  onToggle: () => void;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-gray-900 dark:text-white pr-4">{item.question}</span>
        <ChevronDownIcon 
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>
      <div 
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-96' : 'max-h-0'
        }`}
      >
        <div className="p-4 pt-0 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {item.answer}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function HowItWorksPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white">
      {/* Hero Section */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            How <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9945FF] to-[#14F195]">SolFoundry</span> Works
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Earn $FNDRY tokens by contributing code to the SolFoundry ecosystem. 
            Here's how to go from browsing to getting paid.
          </p>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-12 px-4 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            5 Simple Steps to Earn
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-4">
            {STEPS.map((step) => (
              <StepCard key={step.number} step={step} />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-10">
            Everything you need to know about SolFoundry bounties
          </p>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, index) => (
              <FAQAccordion
                key={index}
                item={item}
                isOpen={openFAQ === index}
                onToggle={() => setOpenFAQ(openFAQ === index ? null : index)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="p-8 rounded-2xl bg-gradient-to-br from-[#9945FF]/10 to-[#14F195]/10 border border-[#9945FF]/20">
            <h3 className="text-2xl font-bold mb-4">Ready to Start Earning?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Browse open bounties and find your first contribution opportunity.
            </p>
            <a
              href="/bounties"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white font-medium hover:opacity-90 transition-opacity"
            >
              Browse Open Bounties
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}