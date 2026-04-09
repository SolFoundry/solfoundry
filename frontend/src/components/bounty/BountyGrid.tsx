import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Loader2, Plus, Filter, SearchX } from 'lucide-react';
import { BountyCard } from './BountyCard';
import { SearchBar } from './SearchBar';
import { useInfiniteBounties } from '../../hooks/useBounties';
import { mobileStaggerContainer, skeletonShimmer } from '../../lib/animations';
import type { Bounty } from '../../types/bounty';

const FILTER_SKILLS = ['All', 'TypeScript', 'Rust', 'Solidity', 'Python', 'Go', 'JavaScript'];

/**
 * Filter bounties by search query (title and description)
 */
export function filterBountiesBySearch(bounties: Bounty[], query: string): Bounty[] {
  if (!query.trim()) return bounties;

  const normalizedQuery = query.toLowerCase().trim();

  return bounties.filter((bounty) => {
    const titleMatch = bounty.title?.toLowerCase().includes(normalizedQuery) ?? false;
    const descriptionMatch = bounty.description?.toLowerCase().includes(normalizedQuery) ?? false;
    return titleMatch || descriptionMatch;
  });
}

export function BountyGrid() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize from URL params
  const [activeSkill, setActiveSkill] = useState<string>(
    searchParams.get('skill') || 'All'
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get('status') || 'open'
  );
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get('q') || ''
  );
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Sync state to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (activeSkill !== 'All') params.set('skill', activeSkill);
    if (statusFilter !== 'open') params.set('status', statusFilter);
    
    setSearchParams(params, { replace: true });
  }, [searchQuery, activeSkill, statusFilter, setSearchParams]);

  const params = {
    status: statusFilter,
    skill: activeSkill !== 'All' ? activeSkill : undefined,
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteBounties(params);

  const allBounties = data?.pages.flatMap((p) => p.items) ?? [];

  // Apply client-side search filtering
  const filteredBounties = useMemo(() => {
    return filterBountiesBySearch(allBounties, searchQuery);
  }, [allBounties, searchQuery]);

  const resultCount = filteredBounties.length;
  const totalCount = allBounties.length;

  // Clear all filters
  const handleClearAll = () => {
    setSearchQuery('');
    setActiveSkill('All');
    setStatusFilter('open');
  };

  return (
    <section id="bounties" className="py-12 sm:py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Header row */}
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <motion.h2 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-sans text-xl sm:text-2xl font-semibold text-text-primary"
            >
              Open Bounties
              {!isLoading && (
                <span className="ml-3 text-sm text-text-muted font-normal hidden sm:inline">
                  {searchQuery ? `${resultCount} of ${totalCount}` : totalCount} bounties
                </span>
              )}
            </motion.h2>
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
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
                  aria-label="Filter by status"
                >
                  <option value="open">Open</option>
                  <option value="funded">Funded</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Completed</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" aria-hidden="true" />
              </div>
              {/* Mobile filter toggle */}
              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="sm:hidden inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-text-secondary text-xs font-medium hover:border-border-hover transition-colors duration-150 min-h-[36px] min-w-[36px]"
                aria-label="Toggle filters"
                aria-expanded={showMobileFilters}
              >
                <Filter className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Filter</span>
              </button>
            </motion.div>
          </div>
        </div>

        {/* Search Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6"
        >
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by title or description..."
            className="w-full"
            debounceMs={150}
          />
        </motion.div>

        {/* Filter pills - horizontal scroll on mobile */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${showMobileFilters ? 'block' : 'hidden'} sm:block mb-6 sm:mb-8`}
        >
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
            {FILTER_SKILLS.map((skill, index) => (
              <motion.button
                key={skill}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => setActiveSkill(skill)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-150 whitespace-nowrap flex-shrink-0 min-h-[32px] touch-manipulation ${
                  activeSkill === skill
                    ? 'bg-forge-700 text-text-primary shadow-lg shadow-emerald/10'
                    : 'text-text-muted hover:text-text-secondary bg-forge-800 hover:bg-forge-700'
                }`}
                aria-pressed={activeSkill === skill}
              >
                {skill}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Active filters bar */}
        {(searchQuery || activeSkill !== 'All' || statusFilter !== 'open') && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-3 mb-6 p-3 bg-forge-800/50 rounded-lg border border-border/50"
          >
            <span className="text-sm text-text-muted hidden sm:inline">Active filters:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald/10 text-emerald text-xs rounded-full">
                  Search: "{searchQuery}"
                </span>
              )}
              {activeSkill !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple/10 text-purple text-xs rounded-full">
                  Skill: {activeSkill}
                </span>
              )}
              {statusFilter !== 'open' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-magenta/10 text-magenta text-xs rounded-full">
                  Status: {statusFilter.replace('_', ' ')}
                </span>
              )}
            </div>
            <button
              onClick={handleClearAll}
              className="ml-auto text-xs text-text-muted hover:text-text-primary underline"
            >
              Clear all
            </button>
          </motion.div>
        )}

        {/* Loading state with shimmer */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="h-44 sm:h-52 rounded-xl border border-border bg-forge-900 overflow-hidden"
              >
                <motion.div 
                  variants={skeletonShimmer}
                  initial="initial"
                  animate="animate"
                  className="h-full bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 bg-[length:200%_100%]" 
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12 sm:py-16 px-4"
          >
            <p className="text-text-muted mb-4 text-sm sm:text-base">Could not load bounties. Backend may be offline.</p>
            <p className="text-text-muted text-xs sm:text-sm font-mono">Running in demo mode — no bounties to display.</p>
          </motion.div>
        )}

        {/* Empty state - no bounties at all */}
        {!isLoading && !isError && allBounties.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12 sm:py-16 px-4"
          >
            <p className="text-text-muted text-base sm:text-lg mb-2">No bounties found</p>
            <p className="text-text-muted text-xs sm:text-sm">
              {activeSkill !== 'All' ? `Try a different language filter.` : 'Check back soon for new bounties.'}
            </p>
          </motion.div>
        )}

        {/* Empty state - search returned no results */}
        {!isLoading && !isError && allBounties.length > 0 && filteredBounties.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12 sm:py-16 px-4"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-forge-800 mb-4">
              <SearchX className="w-8 h-8 text-text-muted" aria-hidden="true" />
            </div>
            <p className="text-text-primary text-lg mb-2">No matching bounties</p>
            <p className="text-text-muted text-sm mb-4 max-w-md mx-auto">
              We couldn't find any bounties matching "{searchQuery}".
              Try different keywords or browse all bounties.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald text-forge-950 text-sm font-medium hover:bg-emerald/90 transition-colors duration-200"
              >
                Clear search
              </button>
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-text-secondary text-sm font-medium hover:border-border-hover hover:text-text-primary transition-all duration-200"
              >
                Clear all filters
              </button>
            </div>
          </motion.div>
        )}

        {/* Bounty grid with mobile-optimized stagger */}
        {!isLoading && filteredBounties.length > 0 && (
          <motion.div
            variants={mobileStaggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-50px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5"
            role="list"
            aria-label={`${resultCount} bounty listings`}
          >
            {filteredBounties.map((bounty, index) => (
              <div key={bounty.id} className="h-full" role="listitem">
                <BountyCard bounty={bounty} index={index} searchQuery={searchQuery} />
              </div>
            ))}
          </motion.div>
        )}

        {/* Load more - only show if not searching */}
        {hasNextPage && !searchQuery && filteredBounties.length > 0 && (
          <div className="mt-8 sm:mt-10 text-center px-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-lg border border-border text-text-secondary text-xs sm:text-sm font-medium hover:border-border-hover hover:text-text-primary hover:bg-forge-800 transition-all duration-200 disabled:opacity-50 min-h-[44px] touch-manipulation w-full sm:w-auto"
            >
              {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Load More
            </motion.button>
          </div>
        )}
      </div>
    </section>
  );
}
