import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { staggerContainer, staggerItem } from '../../lib/animations';
import { useBounties } from '../../hooks/useBounties';
import { BountyCard } from '../bounty/BountyCard';

export function FeaturedBounties() {
  const { data, isLoading, isError } = useBounties({ limit: 4, status: 'open' });

  return (
    <section className="py-12 sm:py-16 md:py-24 px-3 sm:px-4 lg:px-6 bg-forge-900/30">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-10"
        >
          <div>
            <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-text-primary tracking-wide">
              Open Bounties
            </h2>
            <p className="mt-1 sm:mt-2 text-text-secondary text-sm sm:text-base">
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
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-forge-900 h-40 sm:h-48 animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <div className="py-10 sm:py-12 text-center text-text-muted text-xs sm:text-sm px-4">
            Could not load bounties.
          </div>
        )}

        {data && data.items.length > 0 && (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
          >
            {data.items.map((bounty) => (
              <motion.div key={bounty.id} variants={staggerItem} className="h-full">
                <BountyCard bounty={bounty} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {data && data.items.length === 0 && (
          <div className="py-10 sm:py-12 text-center text-text-muted text-xs sm:text-sm px-4">
            No open bounties right now. Check back soon.
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="sm:hidden mt-6 sm:mt-8 text-center"
        >
          <Link
            to="/bounties"
            className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg border border-emerald text-emerald font-semibold text-xs sm:text-sm hover:bg-emerald-bg transition-colors duration-200 min-h-[44px] touch-manipulation w-full max-w-xs"
          >
            Browse All Bounties
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
