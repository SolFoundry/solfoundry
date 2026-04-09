import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Loader2, Plus, Filter } from 'lucide-react';
import { BountyCard } from './BountyCard';
import { useInfiniteBounties } from '../../hooks/useBounties';
import { staggerContainer, staggerItem } from '../../lib/animations';

const FILTER_SKILLS = ['All', 'TypeScript', 'Rust', 'Solidity', 'Python', 'Go', 'JavaScript'];

export function BountyGrid() {
  const [activeSkill, setActiveSkill] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const params = {
    status: statusFilter,
    skill: activeSkill !== 'All' ? activeSkill : undefined,
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteBounties(params);

  const allBounties = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section id="bounties" className="py-12 sm:py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Header row */}
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <h2 className="font-sans text-xl sm:text-2xl font-semibold text-text-primary">Open Bounties</h2>
            <div className="flex items-center gap-2">
              <Link
                to="/bounties/create"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-emerald text-forge-950 font-semibold text-xs sm:text-sm hover:bg-emerald/90 transition-colors duration-150 flex-shrink-0 min-h-[36px] sm:min-h-0"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Post a Bounty</span>
                <span className="xs:hidden">Post</span>
              </Link>
              {/* Status filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none bg-forge-800 border border-border rounded-lg px-3 py-2 sm:py-1.5 pr-8 text-xs sm:text-sm text-text-secondary font-medium focus:border-emerald outline-none transition-colors duration-150 cursor-pointer min-h-[36px] sm:min-h-0"
                >
                  <option value="open">Open</option>
                  <option value="funded">Funded</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Completed</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
              </div>
              {/* Mobile filter toggle */}
              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="sm:hidden inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-text-secondary text-xs font-medium hover:border-border-hover transition-colors duration-150 min-h-[36px] min-w-[36px]"
                aria-label="Toggle filters"
                aria-expanded={showMobileFilters}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filter</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter pills - horizontal scroll on mobile */}
        <div className={`${showMobileFilters ? 'block' : 'hidden'} sm:block mb-6 sm:mb-8`}>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
            {FILTER_SKILLS.map((skill) => (
              <button
                key={skill}
                onClick={() => setActiveSkill(skill)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors duration-150 whitespace-nowrap flex-shrink-0 min-h-[32px] touch-manipulation ${
                  activeSkill === skill
                    ? 'bg-forge-700 text-text-primary'
                    : 'text-text-muted hover:text-text-secondary bg-forge-800'
                }`}
              >
                {skill}
              </button>
            ))}
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-44 sm:h-52 rounded-xl border border-border bg-forge-900 overflow-hidden"
              >
                <div className="h-full bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 bg-[length:200%_100%] animate-shimmer" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <div className="text-center py-12 sm:py-16 px-4">
            <p className="text-text-muted mb-4 text-sm sm:text-base">Could not load bounties. Backend may be offline.</p>
            <p className="text-text-muted text-xs sm:text-sm font-mono">Running in demo mode — no bounties to display.</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && allBounties.length === 0 && (
          <div className="text-center py-12 sm:py-16 px-4">
            <p className="text-text-muted text-base sm:text-lg mb-2">No bounties found</p>
            <p className="text-text-muted text-xs sm:text-sm">
              {activeSkill !== 'All' ? `Try a different language filter.` : 'Check back soon for new bounties.'}
            </p>
          </div>
        )}

        {/* Bounty grid */}
        {!isLoading && allBounties.length > 0 && (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-50px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5"
          >
            {allBounties.map((bounty) => (
              <motion.div key={bounty.id} variants={staggerItem} className="h-full">
                <BountyCard bounty={bounty} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Load more */}
        {hasNextPage && (
          <div className="mt-8 sm:mt-10 text-center px-4">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-lg border border-border text-text-secondary text-xs sm:text-sm font-medium hover:border-border-hover hover:text-text-primary transition-all duration-200 disabled:opacity-50 min-h-[44px] touch-manipulation w-full sm:w-auto"
            >
              {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" />}
              Load More
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
