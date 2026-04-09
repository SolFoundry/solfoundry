import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { staggerContainer, staggerItem } from '../../lib/animations';
import { useBounties } from '../../hooks/useBounties';
import { BountyCard } from '../bounty/BountyCard';
import { BountyCardSkeleton } from '../skeletons';

export function FeaturedBounties() {
  const { data, isLoading, isError } = useBounties({ limit: 4, status: 'open' });

  return (
    <section className="py-16 md:py-24 px-4 bg-forge-900/30">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="flex items-end justify-between mb-10"
        >
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-text-primary tracking-wide">
              Open Bounties
            </h2>
            <p className="mt-2 text-text-secondary text-base">
              Start contributing and earn USDC rewards.
            </p>
          </div>
          <Link
            to="/bounties"
            className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-emerald hover:text-emerald-light transition-colors duration-200"
          >
            Browse all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="status" aria-label="Loading featured bounties">
            {Array.from({ length: 4 }).map((_, i) => (
              <BountyCardSkeleton key={i} />
            ))}
          </div>
        )}

        {isError && (
          <div className="py-12 text-center text-text-muted text-sm">
            Could not load bounties.
          </div>
        )}

        {data && data.items.length > 0 && (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {data.items.map((bounty) => (
              <motion.div key={bounty.id} variants={staggerItem}>
                <BountyCard bounty={bounty} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {data && data.items.length === 0 && (
          <div className="py-12 text-center text-text-muted text-sm">
            No open bounties right now. Check back soon.
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="sm:hidden mt-8 text-center"
        >
          <Link
            to="/bounties"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-emerald text-emerald font-semibold text-sm hover:bg-emerald-bg transition-colors duration-200"
          >
            Browse All Bounties
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
