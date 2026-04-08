import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { BountyCreateWizard } from '../components/bounty/BountyCreateWizard';
import { motion } from 'framer-motion';
import { fadeIn } from '../lib/animations';

export function BountyCreatePage() {
  return (
    <PageLayout>
      <motion.div variants={fadeIn} initial="initial" animate="animate" className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="font-display text-4xl font-bold text-text-primary mb-3">Post a Bounty</h1>
          <p className="text-text-secondary text-lg">Fund a challenge, attract contributors, ship better code.</p>
        </div>
        <BountyCreateWizard />
      </motion.div>
    </PageLayout>
  );
}
