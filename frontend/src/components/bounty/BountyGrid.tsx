import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Loader2, Plus } from 'lucide-react';
import { BountyCard } from './BountyCard';
import { AdvancedBountySearch, BountyFilters } from './AdvancedBountySearch';
import { useInfiniteBounties } from '../../hooks/useBounties';
import { staggerContainer, staggerItem } from '../../lib/animations';
import type { Bounty } from '../../types/bounty';

const FILTER_SKILLS = ['All', 'TypeScript', 'Rust', 'Solidity', 'Python', 'Go', 'JavaScript'];

export function BountyGrid() {
  const [activeSkill, setActiveSkill] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [advancedFilters, setAdvancedFilters] = useState<BountyFilters | null>(null);

  const params = {
    status: statusFilter,
    skill: activeSkill !== 'All' ? activeSkill : undefined,
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteBounties(params);

  const allBounties = data?.pages.flatMap((p) => p.items) ?? [];

  // Apply advanced filters client-side
  const filteredBounties = useMemo(() => {
    if (!advancedFilters) return allBounties;

    return allBounties.filter((bounty: Bounty) => {
      // Skill filter
      if (advancedFilters.skills.length > 0) {
        const hasSkill = advancedFilters.skills.some((s) =>
          bounty.skills?.map((sk: string) => sk.toLowerCase()).includes(s.toLowerCase())
        );
        if (!hasSkill) return false;
      }

      // Tier filter
      if (advancedFilters.tiers.length > 0) {
        if (!advancedFilters.tiers.includes(bounty.tier)) return false;
      }

      // Category filter
      if (advancedFilters.categories.length > 0) {
        if (!bounty.category || !advancedFilters.categories.includes(bounty.category)) return false;
      }

      // Reward range filter
      const reward = bounty.reward_amount ?? 0;
      if (reward < advancedFilters.rewardMin || reward > advancedFilters.rewardMax) return false;

      return true;
    });
  }, [allBounties, advancedFilters]);

  // Apply sorting
  const sortedBounties = useMemo(() => {
    if (!advancedFilters) return filteredBounties;

    const sorted = [...filteredBounties].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      if (advancedFilters.sortBy === 'reward') {
        aVal = a.reward_amount ?? 0;
        bVal = b.reward_amount ?? 0;
      } else if (advancedFilters.sortBy === 'deadline') {
        aVal = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        bVal = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      } else {
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
      }

      if (advancedFilters.sortOrder === 'asc') return aVal < bVal ? -1 : 1;
      return aVal > bVal ? -1 : 1;
    });

    return sorted;
  }, [filteredBounties, advancedFilters]);

  const maxReward = useMemo(() => {
    return Math.max(...allBounties.map((b: Bounty) => b.reward_amount ?? 0), 10000);
  }, [allBounties]);

  return (
    <section id="bounties" className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h2 className="font-sans text-2xl font-semibold text-text-primary">Open Bounties</h2>
          <div className="flex items-center gap-2">
            <Link
              to="/bounties/create"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald text-forge-950 font-semibold text-sm hover:bg-emerald/90 transition-colors duration-150"
            >
              <Plus className="w-4 h-4" />
              Post a Bounty
            </Link>
            {/* Status filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-forge-800 border border-border rounded-lg px-3 py-1.5 pr-8 text-sm text-text-secondary font-medium focus:border-emerald outline-none transition-colors duration-150 cursor-pointer"
              >
                <option value="open">Open</option>
                <option value="funded">Funded</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Advanced Search */}
        <AdvancedBountySearch
          onFiltersChange={setAdvancedFilters}
          maxReward={maxReward}
        />

        {/* Filter pills */}
        <div className="flex items-center gap-2 flex-wrap mb-8">
          {FILTER_SKILLS.map((skill) => (
            <button
              key={skill}
              onClick={() => setActiveSkill(skill)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                activeSkill === skill
                  ? 'bg-forge-700 text-text-primary'
                  : 'text-text-muted hover:text-text-secondary bg-forge-800'
              }`}
            >
              {skill}
            </button>
          ))}
        </div>

        {/* Results count with advanced filters */}
        {advancedFilters && (
          <div className="mb-4 text-sm text-text-muted">
            Showing {sortedBounties.length} of {allBounties.length} bounties
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-52 rounded-xl border border-border bg-forge-900 overflow-hidden"
              >
                <div className="h-full bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 bg-[length:200%_100%] animate-shimmer" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <div className="text-center py-16">
            <p className="text-text-muted mb-4">Could not load bounties. Backend may be offline.</p>
            <p className="text-text-muted text-sm font-mono">Running in demo mode — no bounties to display.</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && sortedBounties.length === 0 && (
          <div className="text-center py-16">
            <p className="text-text-muted text-lg mb-2">No bounties match your filters</p>
            <p className="text-text-muted text-sm">
              Try adjusting your search criteria or{' '}
              <button
                onClick={() => setAdvancedFilters(null)}
                className="text-emerald hover:underline"
              >
                clear all filters
              </button>
            </p>
          </div>
        )}

        {/* Bounty grid */}
        {!isLoading && sortedBounties.length > 0 && (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-50px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {sortedBounties.map((bounty: Bounty) => (
              <motion.div key={bounty.id} variants={staggerItem}>
                <BountyCard bounty={bounty} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Load more */}
        {hasNextPage && !advancedFilters && (
          <div className="mt-10 text-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-border text-text-secondary text-sm font-medium hover:border-border-hover hover:text-text-primary transition-all duration-200 disabled:opacity-50"
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
