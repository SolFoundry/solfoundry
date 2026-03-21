import { useBountyBoard } from '../../hooks/useBountyBoard';
import { BountyFilters } from './BountyFilters';
import { BountySortBar } from './BountySortBar';
import { BountyGrid } from './BountyGrid';
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

      <div className="mt-4 mb-3">
        <BountySortBar sortBy={sortBy} onSortChange={setSortBy} />
      </div>

      {loading ? (
        <SkeletonList count={6} showTier showSkills />
      ) : bounties.length > 0 ? (
        <>
          <BountyGrid bounties={bounties} onBountyClick={id => { window.location.href = '/bounties/' + id; }} />
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      ) : (
        <NoBountiesFound onReset={resetFilters} hasFilters={hasActiveFilters} />
      )}
    </div>
  );
}