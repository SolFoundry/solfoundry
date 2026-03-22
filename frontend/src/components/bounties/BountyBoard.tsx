import { useState } from 'react';
import { useBountyBoard } from '../../hooks/useBountyBoard';
import { BountyFilters } from './BountyFilters';
import { BountySortBar } from './BountySortBar';
import { BountyGrid } from './BountyGrid';
import { BountyListView } from './BountyListView';
import { ViewToggle } from './ViewToggle';
import type { ViewMode } from './ViewToggle';
import { NoBountiesFound } from '../common/EmptyState';
import { SkeletonList } from '../common/Skeleton';
import { HotBounties } from './HotBounties';
import { RecommendedBounties } from './RecommendedBounties';
import { Pagination } from './Pagination';

export function BountyBoard() {
  const {
    bounties, total, filters, sortBy, loading, page, totalPages,
    hotBounties, recommendedBounties,
    setFilter, resetFilters, setSortBy, setPage,
  } = useBountyBoard();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const hasActiveFilters = filters.searchQuery.trim() !== '' ||
    filters.tier !== 'all' || filters.status !== 'all' ||
    filters.skills.length > 0 || filters.rewardMin !== '' ||
    filters.rewardMax !== '' || filters.creatorType !== 'all' ||
    filters.category !== 'all' || filters.deadlineBefore !== '';

  const handleBountyClick = (id: string) => { window.location.href = '/bounties/' + id; };

  return (
    <div className="min-h-screen bg-surface p-4 sm:p-6 lg:p-8" data-testid="bounty-board">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Bounty Marketplace</h1>
          <p className="text-sm text-gray-500">Browse open bounties and find your next contribution.</p>
        </div>
        <a
          href="/bounties/create"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-solana-purple to-solana-green px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 transition-opacity"
          data-testid="create-bounty-btn"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Bounty
        </a>
      </div>

      <BountyFilters
        filters={filters}
        onFilterChange={setFilter}
        onReset={resetFilters}
        resultCount={bounties.length}
        totalCount={total}
      />

      {!hasActiveFilters && hotBounties.length > 0 && (
        <HotBounties bounties={hotBounties} />
      )}

      {!filters.searchQuery.trim() && recommendedBounties.length > 0 && (
        <RecommendedBounties bounties={recommendedBounties} />
      )}

      <div className="flex items-center justify-between mt-4 mb-3">
        <BountySortBar sortBy={sortBy} onSortChange={setSortBy} />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {loading ? (
        <SkeletonList count={6} showTier showSkills />
      ) : bounties.length > 0 ? (
        <>
          {viewMode === 'grid' ? (
            <BountyGrid bounties={bounties} onBountyClick={handleBountyClick} />
          ) : (
            <BountyListView bounties={bounties} onBountyClick={handleBountyClick} />
          )}
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} loading={loading} />
          )}
        </>
      ) : (
        <NoBountiesFound onReset={resetFilters} hasFilters={hasActiveFilters} />
      )}
    </div>
  );
}