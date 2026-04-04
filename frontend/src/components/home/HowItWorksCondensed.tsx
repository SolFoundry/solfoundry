import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FilePlus, Bot, Coins } from 'lucide-react';
import { staggerContainer, staggerItem } from '../../lib/animations';

const STEPS = [
  {
    icon: FilePlus,
    label: 'Post Bounty',
    description: 'Describe your issue, set a reward, and fund escrow in USDC.',
    color: 'text-emerald',
    bg: 'bg-emerald-bg',
    border: 'border-emerald-border',
  },
  {
    icon: Bot,
    label: 'AI Reviews Code',
    description: 'Our AI automatically reviews incoming pull requests for quality and correctness.',
    color: 'text-magenta',
    bg: 'bg-magenta-bg',
    border: 'border-magenta-border',
  },
  {
    icon: Coins,
    label: 'Get Paid',
    description: 'Winning contributor receives instant USDC payout directly on Solana.',
    color: 'text-purple-light',
    bg: 'bg-purple-bg',
    border: 'border-purple-border',
  },
];

export function HowItWorksCondensed() {
  return (
    <section className="py-16 md:py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-2xl md:text-3xl font-bold text-text-primary tracking-wide">
            How It Works
          </h2>
          <p className="mt-3 text-text-secondary text-base max-w-xl mx-auto">
            Three steps from problem to payout.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8"
        >
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.label}
                variants={staggerItem}
                className={`relative rounded-xl border ${step.border} ${step.bg} p-6 flex flex-col items-center text-center`}
              >
                {/* Step number */}
                <span className="absolute top-4 right-4 font-mono text-xs text-text-muted">
                  0{index + 1}
                </span>

                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-forge-900 border border-border`}>
                  <Icon className={`w-6 h-6 ${step.color}`} />
                </div>

                <h3 className={`font-sans font-semibold text-base ${step.color} mb-2`}>
                  {step.label}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {step.description}
                </p>

                {/* Arrow connector (desktop only, not on last) */}
                {index < STEPS.length - 1 && (
                  <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                    <svg className="w-8 h-8 text-border" fill="none" viewBox="0 0 32 32">
                      <path d="M8 16h16M20 10l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-center mt-10"
        >
          <Link
            to="/how-it-works"
            className="inline-flex items-center gap-2 text-sm text-emerald hover:text-emerald-light transition-colors duration-200 font-medium"
          >
            See the full walkthrough
            <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
