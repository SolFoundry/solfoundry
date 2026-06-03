import React, { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Loader2, Plus, Filter, X, SlidersHorizontal } from 'lucide-react';
import { BountyCard } from './BountyCard';
import { useInfiniteBounties } from '../../hooks/useBounties';
import { staggerContainer, staggerItem } from '../../lib/animations';

const FILTER_SKILLS = ['All', 'TypeScript', 'Rust', 'Solidity', 'Python', 'Go', 'JavaScript'];
const FILTER_TIERS = ['All', 'T1', 'T2', 'T3'];
const FILTER_DOMAINS = ['All', 'Frontend', 'Backend', 'Agent', 'Documentation', 'Design'];
const FILTER_REWARD_TOKENS = ['All', 'FNDRY', 'USDC'];

interface FilterState {
  skill: string;
  status: string;
  tier: string;
  domain: string;
  rewardToken: string;
  minAmount: string;
  maxAmount: string;
  deadline: string; // 'all' | '7d' | '30d' | 'expired'
}

const INITIAL_FILTERS: FilterState = {
  skill: 'All',
  status: 'open',
  tier: 'All',
  domain: 'All',
  rewardToken: 'All',
  minAmount: '',
  maxAmount: '',
  deadline: 'all',
};

function parseAmount(value: string): number | undefined {
  const n = parseFloat(value);
  return isNaN(n) || n < 0 ? undefined : n;
}

interface BountyGridProps {
  showFilters?: boolean;
}

export function BountyGrid({ showFilters = true }: BountyGridProps) {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const params = useMemo(() => ({
    status: filters.status,
    skill: filters.skill !== 'All' ? filters.skill : undefined,
    tier: filters.tier !== 'All' ? filters.tier : undefined,
    reward_token: filters.rewardToken !== 'All' ? filters.rewardToken : undefined,
    domain: filters.domain !== 'All' ? filters.domain : undefined,
    min_amount: parseAmount(filters.minAmount),
    max_amount: parseAmount(filters.maxAmount),
    deadline: filters.deadline !== 'all' ? filters.deadline : undefined,
  }), [filters]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteBounties(params);

  const allBounties = data?.pages.flatMap((p) => p.items) ?? [];

  // Client-side fallback filtering (when backend doesn't support all params)
  const filteredBounties = useMemo(() => {
    return allBounties.filter((b) => {
      if (filters.minAmount && b.reward_amount < parseAmount(filters.minAmount)!) return false;
      if (filters.maxAmount && b.reward_amount > parseAmount(filters.maxAmount)!) return false;
      if (filters.domain !== 'All' && b.category && b.category !== filters.domain) return false;
      if (filters.deadline !== 'all' && b.deadline) {
        const deadlineDate = new Date(b.deadline);
        const now = new Date();
        const daysLeft = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (filters.deadline === '7d' && daysLeft > 7) return false;
        if (filters.deadline === '30d' && daysLeft > 30) return false;
        if (filters.deadline === 'expired' && daysLeft > 0) return false;
      }
      return true;
    });
  }, [allBounties, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.skill !== 'All') count++;
    if (filters.tier !== 'All') count++;
    if (filters.domain !== 'All') count++;
    if (filters.rewardToken !== 'All') count++;
    if (filters.minAmount) count++;
    if (filters.maxAmount) count++;
    if (filters.deadline !== 'all') count++;
    return count;
  }, [filters]);

  const clearFilters = useCallback(() => setFilters(INITIAL_FILTERS), []);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
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
                value={filters.status}
                onChange={(e) => updateFilter('status', e.target.value)}
                className="appearance-none bg-forge-800 border border-border rounded-lg px-3 py-1.5 pr-8 text-sm text-text-secondary font-medium focus:border-emerald outline-none transition-colors duration-150 cursor-pointer"
              >
                <option value="open">Open</option>
                <option value="funded">Funded</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            </div>
            {/* Advanced filter toggle */}
            {showFilters && (
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  showAdvanced || activeFilterCount > 0
                    ? 'bg-emerald/10 text-emerald border border-emerald/20'
                    : 'bg-forge-800 border border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-emerald text-forge-950 text-xs flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Skill filter pills */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {FILTER_SKILLS.map((skill) => (
            <button
              key={skill}
              onClick={() => updateFilter('skill', skill)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                filters.skill === skill
                  ? 'bg-forge-700 text-text-primary'
                  : 'text-text-muted hover:text-text-secondary bg-forge-800'
              }`}
            >
              {skill}
            </button>
          ))}
        </div>

        {/* Advanced filters panel */}
        {showAdvanced && showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 rounded-xl border border-border bg-forge-900 p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Advanced Filters
              </h3>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-text-muted hover:text-text-secondary flex items-center gap-1 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tier filter */}
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Tier</label>
                <div className="relative">
                  <select
                    value={filters.tier}
                    onChange={(e) => updateFilter('tier', e.target.value)}
                    className="w-full appearance-none bg-forge-700 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-emerald outline-none transition-colors duration-150 cursor-pointer"
                  >
                    {FILTER_TIERS.map(t => <option key={t} value={t}>{t === 'All' ? 'All Tiers' : t}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                </div>
              </div>

              {/* Domain filter */}
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Domain</label>
                <div className="relative">
                  <select
                    value={filters.domain}
                    onChange={(e) => updateFilter('domain', e.target.value)}
                    className="w-full appearance-none bg-forge-700 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-emerald outline-none transition-colors duration-150 cursor-pointer"
                  >
                    {FILTER_DOMAINS.map(d => <option key={d} value={d}>{d === 'All' ? 'All Domains' : d}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                </div>
              </div>

              {/* Reward token filter */}
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Reward Token</label>
                <div className="relative">
                  <select
                    value={filters.rewardToken}
                    onChange={(e) => updateFilter('rewardToken', e.target.value)}
                    className="w-full appearance-none bg-forge-700 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-emerald outline-none transition-colors duration-150 cursor-pointer"
                  >
                    {FILTER_REWARD_TOKENS.map(t => <option key={t} value={t}>{t === 'All' ? 'All Tokens' : t}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                </div>
              </div>

              {/* Deadline filter */}
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Deadline</label>
                <div className="relative">
                  <select
                    value={filters.deadline}
                    onChange={(e) => updateFilter('deadline', e.target.value)}
                    className="w-full appearance-none bg-forge-700 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-emerald outline-none transition-colors duration-150 cursor-pointer"
                  >
                    <option value="all">Any time</option>
                    <option value="7d">Less than 7 days</option>
                    <option value="30d">Less than 30 days</option>
                    <option value="expired">Expired</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Amount range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Min Amount</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 100"
                  value={filters.minAmount}
                  onChange={(e) => updateFilter('minAmount', e.target.value)}
                  className="w-full bg-forge-700 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald outline-none transition-colors duration-150"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Max Amount</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 10000"
                  value={filters.maxAmount}
                  onChange={(e) => updateFilter('maxAmount', e.target.value)}
                  className="w-full bg-forge-700 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald outline-none transition-colors duration-150"
                />
              </div>
            </div>
          </motion.div>
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
        {!isLoading && !isError && filteredBounties.length === 0 && (
          <div className="text-center py-16">
            <p className="text-text-muted text-lg mb-2">No bounties found</p>
            <p className="text-text-muted text-sm">
              {activeFilterCount > 0
                ? 'Try adjusting your filters.'
                : 'Check back soon for new bounties.'}
            </p>
          </div>
        )}

        {/* Bounty grid */}
        {!isLoading && filteredBounties.length > 0 && (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-50px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filteredBounties.map((bounty) => (
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
