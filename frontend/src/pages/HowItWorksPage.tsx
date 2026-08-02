import React from 'react';
import { motion } from 'framer-motion';
import { PageLayout } from '../components/layout/PageLayout';
import { FlowTabs } from '../components/how-it-works/FlowTabs';
import BountyFlowDiagram from '../components/bounty/BountyFlowDiagram';
import { fadeIn } from '../lib/animations';

export function HowItWorksPage() {
  return (
    <PageLayout>
      <motion.div variants={fadeIn} initial="initial" animate="animate" className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl font-bold text-text-primary mb-3">How It Works</h1>
          <p className="text-text-secondary text-lg">Two paths to earning on SolFoundry</p>
        </div>

        {/* Bounty Lifecycle Flow Diagram */}
        <div className="mb-16">
          <h2 className="font-display text-2xl font-bold text-text-primary text-center mb-2">
            Bounty Lifecycle
          </h2>
          <p className="text-text-secondary text-sm text-center mb-8">
            From posting to payout — understand every stage of the bounty journey
          </p>
          <BountyFlowDiagram />
        </div>

        <FlowTabs />
      </motion.div>
    </PageLayout>
  );
}
