import { useState } from 'react';
import { useBountyBoard } from '../../hooks/useBountyBoard';
import { BountyFilters } from './BountyFilters';
import { BountySortBar } from './BountySortBar';
import { BountyGrid } from './BountyGrid';
import { EmptyState } from './EmptyState';
import { HotBounties } from './HotBounties';
import { RecommendedBounties } from './RecommendedBounties';
import { Pagination } from './Pagination';

/** Grid icon for the layout toggle button. */
function GridIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

/** List icon for the layout toggle button. */
function ListIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function BountyBoard() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const {
    bounties, total, filters, sortBy, loading, page, totalPages,
    hotBounties, recommendedBounties,
    setFilter, resetFilters, setSortBy, setPage,
  } = useBountyBoard();

  const hasActiveFilters = filters.searchQuery.trim() !== '' ||
    filters.tier !== 'all' || filters.status !== 'all' ||
    filters.skills.length > 0 || filters.rewardMin !== '' ||
    filters.rewardMax !== '' || filters.creatorType !== 'all' ||
    filters.category !== 'all' || filters.deadlineBefore !== '';

  return (
    <div className="min-h-screen bg-surface p-4 sm:p-6 lg:p-8" data-testid="bounty-board">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Bounty Board</h1>
        <p className="text-sm text-gray-500">Browse open bounties and find your next contribution.</p>
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

      <div className="mt-4 mb-3 flex items-center justify-between">
        <BountySortBar sortBy={sortBy} onSortChange={setSortBy} />
        <div className="flex items-center gap-1 ml-3" data-testid="view-toggle">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={'rounded p-1.5 transition-colors ' + (viewMode === 'grid' ? 'bg-solana-green/15 text-solana-green' : 'text-gray-500 hover:text-white')}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
            data-testid="view-grid"
          >
            <GridIcon />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={'rounded p-1.5 transition-colors ' + (viewMode === 'list' ? 'bg-solana-green/15 text-solana-green' : 'text-gray-500 hover:text-white')}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
            data-testid="view-list"
          >
            <ListIcon />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-solana-green border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-500 font-mono">Searching...</span>
          </div>
        </div>
      ) : bounties.length > 0 ? (
        <>
          {viewMode === 'grid' ? (
            <BountyGrid bounties={bounties} onBountyClick={id => { window.location.href = '/bounties/' + id; }} />
          ) : (
            <div className="space-y-2" data-testid="bounty-list">
              {bounties.map(b => (
                <button key={b.id} type="button" onClick={() => { window.location.href = '/bounties/' + b.id; }}
                  className="w-full text-left flex items-center gap-4 rounded-lg border border-surface-300 bg-surface-50 hover:border-solana-green/40 p-4 transition-all"
                  data-testid={'bounty-list-item-' + b.id}>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{b.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">{b.tier} | {b.rewardAmount.toLocaleString()} {b.currency} | {b.submissionCount} subs</p>
                  </div>
                  <span className="text-xs text-gray-500">{b.creatorType === 'platform' ? 'Platform' : 'Community'}</span>
                </button>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      ) : (
        <EmptyState onReset={resetFilters} />
      )}
    </div>
  );
}
