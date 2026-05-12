import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Loader2, Plus, Search, X } from 'lucide-react';
import { BountyCard } from './BountyCard';
import { useInfiniteBounties } from '../../hooks/useBounties';
import { staggerContainer, staggerItem } from '../../lib/animations';
import type { Bounty } from '../../types/bounty';

const FILTER_SKILLS = ['All', 'TypeScript', 'Rust', 'Solidity', 'Python', 'Go', 'JavaScript'];

export function BountyGrid() {
  const [activeSkill, setActiveSkill] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim().toLowerCase());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const params = {
    status: statusFilter,
    skill: activeSkill !== 'All' ? activeSkill : undefined,
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteBounties(params);

  const allBounties = data?.pages.flatMap((p) => p.items) ?? [];
  const visibleBounties = useMemo(() => {
    if (!debouncedSearch) return allBounties;

    return allBounties.filter((bounty: Bounty) => {
      const searchableText = [
        bounty.title,
        bounty.description,
        bounty.category,
        bounty.tier,
        bounty.status,
        bounty.org_name,
        bounty.repo_name,
        ...(bounty.skills ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(debouncedSearch);
    });
  }, [allBounties, debouncedSearch]);

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

        {/* Search */}
        <div className="mb-5">
          <label htmlFor="bounty-search" className="sr-only">
            Search bounties
          </label>
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              id="bounty-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search bounties"
              className="w-full h-10 rounded-lg border border-border bg-forge-900 pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors duration-150 focus:border-emerald"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setDebouncedSearch('');
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-forge-800 hover:text-text-primary"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
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
        {!isLoading && !isError && visibleBounties.length === 0 && (
          <div className="text-center py-16">
            <p className="text-text-muted text-lg mb-2">No bounties found</p>
            <p className="text-text-muted text-sm">
              {debouncedSearch
                ? 'Try a different search term.'
                : activeSkill !== 'All'
                  ? 'Try a different language filter.'
                  : 'Check back soon for new bounties.'}
            </p>
          </div>
        )}

        {/* Bounty grid */}
        {!isLoading && visibleBounties.length > 0 && (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-50px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {visibleBounties.map((bounty) => (
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
