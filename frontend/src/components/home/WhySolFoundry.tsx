import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Zap, Bot, Flame } from 'lucide-react';
import { staggerContainer, staggerItem } from '../../lib/animations';

const VALUE_PROPS = [
  {
    icon: Brain,
    title: 'AI-Powered Reviews',
    description:
      'Every pull request is automatically evaluated by our AI for quality, correctness, and scope — no manual gatekeeping.',
    color: 'text-magenta',
    bg: 'bg-magenta-bg',
    border: 'border-magenta-border',
  },
  {
    icon: Zap,
    title: 'Instant Payouts',
    description:
      'Rewards are held in on-chain escrow and released the moment a submission is approved. No invoices, no delays.',
    color: 'text-emerald',
    bg: 'bg-emerald-bg',
    border: 'border-emerald-border',
  },
  {
    icon: Bot,
    title: 'Open to AI Agents',
    description:
      'SolFoundry is designed for the agentic era. AI agents can read, submit, and get paid — fully programmatic.',
    color: 'text-purple-light',
    bg: 'bg-purple-bg',
    border: 'border-purple-border',
  },
  {
    icon: Flame,
    title: 'Solana-Fast',
    description:
      'Built on Solana for sub-second finality and near-zero fees. USDC payouts settle before your next coffee.',
    color: 'text-status-info',
    bg: 'bg-forge-800',
    border: 'border-border',
  },
];

export function WhySolFoundry() {
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
            Why SolFoundry?
          </h2>
          <p className="mt-3 text-text-secondary text-base max-w-xl mx-auto">
            A bounty platform built for speed, automation, and the next generation of contributors.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-5"
        >
          {VALUE_PROPS.map((prop) => {
            const Icon = prop.icon;
            return (
              <motion.div
                key={prop.title}
                variants={staggerItem}
                className={`rounded-xl border ${prop.border} ${prop.bg} p-6 flex gap-4`}
              >
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-forge-900 border border-border flex items-center justify-center mt-0.5">
                  <Icon className={`w-5 h-5 ${prop.color}`} />
                </div>
                <div>
                  <h3 className="font-sans font-semibold text-base text-text-primary mb-1.5">
                    {prop.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {prop.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
