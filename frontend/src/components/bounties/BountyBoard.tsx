import { useBountyBoard } from '../../hooks/useBountyBoard';
import { BountyFilters } from './BountyFilters';
import { BountySortBar } from './BountySortBar';
import { BountyGrid } from './BountyGrid';
import { EmptyState } from './EmptyState';
export function BountyBoard() {
  const { bounties, allBounties, filters, sortBy, loading, setFilter, resetFilters, setSortBy } = useBountyBoard();
  return (
    <div className="min-h-screen bg-surface p-4 sm:p-6 lg:p-8" data-testid="bounty-board">
      <div className="mb-6"><h1 className="text-2xl font-bold text-white mb-1">Bounty Board</h1><p className="text-sm text-gray-500">Browse open bounties and find your next contribution.</p></div>
      <BountyFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} resultCount={bounties.length} totalCount={allBounties.length} />
      <div className="mt-4 mb-3"><BountySortBar sortBy={sortBy} onSortChange={setSortBy} /></div>
      {loading ? (
        <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-solana-green border-t-transparent" /><span className="ml-3 text-gray-500">Loading bounties from GitHub...</span></div>
      ) : bounties.length > 0 ? <BountyGrid bounties={bounties} onBountyClick={id => { window.location.hash = '/bounties/' + id; }} /> : <EmptyState onReset={resetFilters} />}
    </div>);
}
