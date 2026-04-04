import React from 'react';
import { motion } from 'framer-motion';
import { PageLayout } from '../components/layout/PageLayout';
import { BountyBoard } from '../components/bounties/BountyBoard';
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
        <BountyBoard />
      </motion.div>
    </PageLayout>
  );
}

export default BountiesPage;
