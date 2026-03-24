import { useState, useRef, useEffect, useCallback } from 'react';
import { useBountyBoard } from '../../hooks/useBountyBoard';
import { BountyFilters } from './BountyFilters';
import { BountySortBar } from './BountySortBar';
import { BountyGrid } from './BountyGrid';
import { BountyListView } from './BountyListView';
import { ViewToggle } from './ViewToggle';
import type { ViewMode } from './ViewToggle';
import { NoBountiesFound } from '../common/EmptyState';
import { SkeletonBountyCard, SkeletonBountyListRows } from '../common/Skeleton';
import { HotBounties } from './HotBounties';
import { RecommendedBounties } from './RecommendedBounties';
import { Pagination } from './Pagination';

export function BountyBoard() {
  const {
    bounties, total, filters, sortBy, loading, isFetching, page, totalPages,
    hotBounties, recommendedBounties,
    setFilter, resetFilters, setSortBy, setPage,
  } = useBountyBoard();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const listTopRef = useRef<HTMLDivElement>(null);
  const prevPageRef = useRef(page);

  const hasActiveFilters = filters.searchQuery.trim() !== '' ||
    filters.tier !== 'all' || filters.status !== 'all' ||
    filters.skills.length > 0 || filters.rewardMin !== '' ||
    filters.rewardMax !== '' || filters.creatorType !== 'all' ||
    filters.category !== 'all' || filters.deadlineBefore !== '';

  const handleBountyClick = (id: string) => { window.location.href = '/bounties/' + id; };

  // Smooth scroll to top of list on page change
  useEffect(() => {
    if (prevPageRef.current !== page && listTopRef.current) {
      listTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    prevPageRef.current = page;
  }, [page]);

  // Keyboard navigation: Left/Right arrows for prev/next page
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
    if (isInput) return;

    if (e.key === 'ArrowLeft' && page > 1) {
      e.preventDefault();
      setPage(page - 1);
    } else if (e.key === 'ArrowRight' && page < totalPages) {
      e.preventDefault();
      setPage(page + 1);
    }
  }, [page, totalPages, setPage]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface p-4 sm:p-6 lg:p-8" data-testid="bounty-board">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Bounty Marketplace</h1>
          <p className="text-sm text-gray-600 dark:text-gray-500">Browse open bounties and find your next contribution.</p>
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

      <div className="flex items-center justify-between mt-4 mb-3" ref={listTopRef}>
        <BountySortBar sortBy={sortBy} onSortChange={setSortBy} />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          aria-label="Loading bounties"
          data-testid="bounty-board-skeleton"
        >
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonBountyCard key={i} />
              ))}
            </div>
          ) : (
            <SkeletonBountyListRows count={6} />
          )}
        </div>
      ) : bounties.length > 0 ? (
        <div className="relative">
          {isFetching && !loading && (
            <div
              className="absolute inset-0 z-10 bg-white/70 dark:bg-surface/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center"
              data-testid="page-loading-overlay"
            >
              <div className="absolute inset-x-0 top-0 h-1 skeleton-shimmer rounded-full" />
              <div className="w-6 h-6 border-2 border-solana-green border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {viewMode === 'grid' ? (
            <BountyGrid bounties={bounties} onBountyClick={handleBountyClick} />
          ) : (
            <BountyListView bounties={bounties} onBountyClick={handleBountyClick} />
          )}
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          )}
        </div>
      ) : (
        <NoBountiesFound onReset={resetFilters} hasFilters={hasActiveFilters} />
      )}
    </div>
  );
}
