import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Loader2, Plus, Search, X } from 'lucide-react';
import { BountyCard } from './BountyCard';
import { useInfiniteBounties } from '../../hooks/useBounties';
import { staggerContainer, staggerItem } from '../../lib/animations';
import { useDebounce } from '../../hooks/useDebounce';

import { BountyCardSkeleton } from '../ui/Skeleton';

const FILTER_SKILLS = ['All', 'TypeScript', 'Rust', 'Solidity', 'Python', 'Go', 'JavaScript'];

export function BountyGrid() {
  const [activeSkill, setActiveSkill] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const params = {
    status: statusFilter,
    skill: activeSkill !== 'All' ? activeSkill : undefined,
    search: debouncedSearch || undefined,
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteBounties(params);

  const allBounties = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section id="bounties" className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4">
        {/* Search bar and Status filter */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search bounties by title, description or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-forge-800 border border-border rounded-lg pl-10 pr-10 py-2 text-sm text-text-primary focus:border-emerald outline-none transition-colors duration-150"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Link
              to="/bounties/create"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald text-forge-950 font-semibold text-sm hover:bg-emerald/90 transition-colors duration-150 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Post a Bounty
            </Link>
            
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-forge-800 border border-border rounded-lg px-3 py-2 pr-8 text-sm text-text-secondary font-medium focus:border-emerald outline-none transition-colors duration-150 cursor-pointer"
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

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <BountyCardSkeleton key={i} />
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
        {!isLoading && !isError && allBounties.length === 0 && (
          <div className="text-center py-16">
            <p className="text-text-muted text-lg mb-2">No bounties found</p>
            <p className="text-text-muted text-sm">
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
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {allBounties.map((bounty) => (
              <motion.div key={bounty.id} variants={staggerItem}>
                <BountyCard bounty={bounty} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Load more */}
        {hasNextPage && (
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
