import React from 'react';
import { motion } from 'framer-motion';
import { PageLayout } from '../components/layout/PageLayout';
import { BountyGrid } from '../components/bounty/BountyGrid';
import { pageTransition } from '../lib/animations';

export function BountiesPage() {
  return (
    <PageLayout>
      <motion.div
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        className="pt-16"
      >
        <BountyGrid />
      </motion.div>
    </PageLayout>
  );
}
