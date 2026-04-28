import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Loader2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { BountyCard } from '../components/bounty/BountyCard';
import { AdvancedSearch } from '../components/bounties/AdvancedSearch';
import { useInfiniteBounties } from '../hooks/useBounties';
import { pageTransition, staggerContainer, staggerItem } from '../lib/animations';
import type { AdvancedFilters } from '../types/bounty';
import { DEFAULT_ADVANCED_FILTERS } from '../types/bounty';

export function BountiesPage() {
  const [filters, setFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED_FILTERS);
  const [statusFilter, setStatusFilter] = useState<string>('open');

  // Map advanced filters to API params
  const apiParams = useMemo(
    () => ({
      status: statusFilter,
      q: filters.query || undefined,
      skill:
        filters.languages.length > 0 ? filters.languages.join(',') : undefined,
      tier:
        filters.tiers.length > 0 ? filters.tiers.join(',') : undefined,
      languages:
        filters.languages.length > 0 ? filters.languages.join(',') : undefined,
      domains:
        filters.domains.length > 0 ? filters.domains.join(',') : undefined,
      reward_min: filters.rewardMin > 0 ? filters.rewardMin : undefined,
      reward_max:
        filters.rewardMax < Infinity ? filters.rewardMax : undefined,
    }),
    [filters, statusFilter],
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteBounties(apiParams);

  const allBounties = data?.pages.flatMap((p) => p.items) ?? [];

  // Client-side filtering for domains and reward range (in case backend doesn't fully support)
  const filteredBounties = useMemo(() => {
    let result = allBounties;

    // Domain filter
    if (filters.domains.length > 0) {
      const domainMap: Record<string, string> = {
        DeFi: 'defi',
        Infrastructure: 'infra',
        Security: 'security',
        'NFT / Gaming': 'nft',
        'DAO / Governance': 'dao',
        'AI / ML': 'ai-ml',
        'Data Analytics': 'data',
        Mobile: 'mobile',
        DevTools: 'devtools',
        'Cross-chain': 'cross-chain',
      };
      const lowerDomains = filters.domains.map((d) => domainMap[d]?.toLowerCase() ?? d.toLowerCase());
      result = result.filter(
        (b) =>
          b.category &&
          lowerDomains.some(
            (d) => b.category!.toLowerCase().includes(d) || d.includes(b.category!.toLowerCase()),
          ),
      );
    }

    // Language filter via skills
    if (filters.languages.length > 0) {
      result = result.filter(
        (b) =>
          b.skills &&
          b.skills.length > 0 &&
          filters.languages.some((lang) =>
            b.skills.some((s) => s.toLowerCase() === lang.toLowerCase()),
          ),
      );
    }

    // Tier filter (backup if backend doesn't support)
    if (filters.tiers.length > 0) {
      result = result.filter((b) => filters.tiers.includes(b.tier));
    }

    // Reward range
    if (filters.rewardMin > 0) {
      result = result.filter((b) => b.reward_amount >= filters.rewardMin);
    }
    if (filters.rewardMax < Infinity) {
      result = result.filter((b) => b.reward_amount <= filters.rewardMax);
    }

    // Query text search
    if (filters.query) {
      const q = filters.query.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          (b.repo_name && b.repo_name.toLowerCase().includes(q)) ||
          (b.org_name && b.org_name.toLowerCase().includes(q)) ||
          b.skills.some((s) => s.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [allBounties, filters]);

  const handleFiltersChange = useCallback((newFilters: AdvancedFilters) => {
    setFilters(newFilters);
  }, []);

  return (
    <PageLayout>
      <motion.div
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        className="pt-8 pb-16"
      >
        <div className="max-w-7xl mx-auto px-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">Explore Bounties</h1>
              <p className="text-sm text-text-muted mt-1">
                Find the perfect bounty for your skills
              </p>
            </div>
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
          <div className="mb-8">
            <AdvancedSearch
              filters={filters}
              onFiltersChange={handleFiltersChange}
              resultCount={filteredBounties.length}
              totalCount={allBounties.length}
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
              <p className="text-text-muted mb-4">
                Could not load bounties. Backend may be offline.
              </p>
              <p className="text-text-muted text-sm font-mono">
                Running in demo mode — no bounties to display.
              </p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !isError && filteredBounties.length === 0 && (
            <div className="text-center py-16">
              <p className="text-text-muted text-lg mb-2">No bounties found</p>
              <p className="text-text-muted text-sm">
                {filters.query ||
                filters.languages.length > 0 ||
                filters.tiers.length > 0 ||
                filters.domains.length > 0
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
      </motion.div>
    </PageLayout>
  );
}
