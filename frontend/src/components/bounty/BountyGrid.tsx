import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Loader2 } from 'lucide-react';
import { BountyCard } from './BountyCard';
import { useBounties } from '../../hooks/useBounties';
import { BountyFilters, Pagination } from '../bounties';
import { staggerContainer, staggerItem } from '../../lib/animations';
import type { BountyBoardFilters } from '../../types/bounty';
import { DEFAULT_FILTERS } from '../../types/bounty';

const ITEMS_PER_PAGE = 12;

export function BountyGrid() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<BountyBoardFilters>(() => {
    // Restore filters from URL search params for persistence
    const fromUrl = (key: string, fallback: string) => searchParams.get(key) ?? fallback;
    const skillsRaw = searchParams.get('skills');
    return {
      category: fromUrl('category', DEFAULT_FILTERS.category),
      skills: skillsRaw ? skillsRaw.split(',').filter(Boolean) : DEFAULT_FILTERS.skills,
      tier: fromUrl('tier', DEFAULT_FILTERS.tier),
      rewardMin: Number(fromUrl('rewardMin', String(DEFAULT_FILTERS.rewardMin))),
      rewardMax: Number(fromUrl('rewardMax', String(DEFAULT_FILTERS.rewardMax))),
      deadlineBefore: fromUrl('deadlineBefore', DEFAULT_FILTERS.deadlineBefore),
      searchQuery: fromUrl('q', DEFAULT_FILTERS.searchQuery),
    };
  });
  const [page, setPage] = useState(() => {
    const p = searchParams.get('page');
    return p ? Math.max(1, parseInt(p, 10)) : 1;
  });
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get('status') ?? 'open');

  // Sync filters to URL search params for search persistence
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.category !== DEFAULT_FILTERS.category) params.set('category', filters.category);
    if (filters.skills.length > 0) params.set('skills', filters.skills.join(','));
    if (filters.tier) params.set('tier', filters.tier);
    if (filters.rewardMin !== DEFAULT_FILTERS.rewardMin) params.set('rewardMin', String(filters.rewardMin));
    if (filters.rewardMax !== DEFAULT_FILTERS.rewardMax) params.set('rewardMax', String(filters.rewardMax));
    if (filters.deadlineBefore) params.set('deadlineBefore', filters.deadlineBefore);
    if (filters.searchQuery) params.set('q', filters.searchQuery);
    if (page > 1) params.set('page', String(page));
    if (statusFilter !== 'open') params.set('status', statusFilter);
    setSearchParams(params, { replace: true });
  }, [filters, page, statusFilter, setSearchParams]);

  const apiParams = useMemo(() => {
    const params: Record<string, string | number | boolean | undefined> = {
      status: statusFilter,
      limit: ITEMS_PER_PAGE,
      offset: (page - 1) * ITEMS_PER_PAGE,
    };

    if (filters.searchQuery) params.search = filters.searchQuery;
    if (filters.category && filters.category !== 'all') params.category = filters.category;
    if (filters.skills.length > 0) params.skills = filters.skills.join(',');
    if (filters.tier) params.tier = filters.tier;
    if (filters.rewardMin > 0) params.reward_min = filters.rewardMin;
    if (filters.rewardMax < 500000) params.reward_max = filters.rewardMax;
    if (filters.deadlineBefore) params.deadline_before = filters.deadlineBefore;

    return params;
  }, [filters, page, statusFilter]);

  const { data, isLoading, isError } = useBounties(apiParams);

  const bounties = data?.items ?? [];
  const totalCount = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

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
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="appearance-none bg-forge-800 border border-border rounded-lg px-3 py-1.5 pr-8 text-sm text-text-secondary font-medium focus:border-emerald outline-none transition-colors duration-150 cursor-pointer"
              >
                <option value="open">Open</option>
                <option value="funded">Funded</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Advanced filters */}
        <div className="mb-8">
          <BountyFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleReset}
            resultCount={bounties.length}
            totalCount={totalCount}
          />
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
        {!isLoading && !isError && bounties.length === 0 && (
          <div className="text-center py-16">
            <p className="text-text-muted text-lg mb-2">No bounties found</p>
            <p className="text-text-muted text-sm">
              Try adjusting your filters or search query.
            </p>
          </div>
        )}

        {/* Bounty grid */}
        {!isLoading && bounties.length > 0 && (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-50px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {bounties.map((bounty) => (
              <motion.div key={bounty.id} variants={staggerItem}>
                <BountyCard bounty={bounty} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="mt-10">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </section>
  );
}