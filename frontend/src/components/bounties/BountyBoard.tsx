import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Grid3X3, List, Search } from 'lucide-react';
import { useBountyBoard } from '../../hooks/useBountyBoard';
import type { SortOption } from '../../hooks/useBountyBoard';
import { BountyCard } from './BountyCard';
import { BountyFilters } from './BountyFilters';
import { EmptyState } from './EmptyState';
import { Pagination } from './Pagination';
import type { BountyBoardFilters } from '../../types/bounty';

const TIERS = ['all', 'T1', 'T2', 'T3'] as const;

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'reward_high', label: 'Highest reward' },
  { value: 'reward_low', label: 'Lowest reward' },
  { value: 'tier_high', label: 'Highest tier' },
];

export function BountyBoard() {
  const navigate = useNavigate();
  const {
    bounties,
    loading,
    filters,
    sortBy,
    page,
    totalPages,
    total,
    setFilter,
    setSortBy,
    setPage,
    resetFilters,
  } = useBountyBoard();

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  // Keyboard arrow navigation
  const pageRef = useRef(page);
  const totalPagesRef = useRef(totalPages);
  pageRef.current = page;
  totalPagesRef.current = totalPages;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.key === 'ArrowRight' && pageRef.current < totalPagesRef.current) {
        setPage(pageRef.current + 1);
      }
      if (e.key === 'ArrowLeft' && pageRef.current > 1) {
        setPage(pageRef.current - 1);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setPage]);

  const handleFilterChange = (key: keyof BountyBoardFilters, value: unknown) => {
    setFilter(key, value);
  };

  const displayedBounties = searchQuery
    ? bounties.filter(
        (b) =>
          b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : bounties;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold text-text-primary">Bounty Marketplace</h1>
        <Link
          to="/bounties/create"
          data-testid="create-bounty-btn"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald text-forge-950 font-semibold text-sm hover:bg-emerald/90 transition-colors w-fit"
        >
          <Plus className="w-4 h-4" />
          Post a Bounty
        </Link>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search bounties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-forge-800 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:border-emerald outline-none"
          />
        </div>
        <select
          data-testid="bounty-sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="appearance-none bg-forge-800 border border-border rounded-lg px-3 py-2 text-sm text-text-secondary focus:border-emerald outline-none cursor-pointer"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div data-testid="view-toggle" className="flex rounded-lg border border-border overflow-hidden">
          <button
            data-testid="view-grid"
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
            className={`px-3 py-2 transition-colors ${
              view === 'grid' ? 'bg-forge-700 text-text-primary' : 'bg-forge-800 text-text-muted'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            data-testid="view-list"
            aria-label="List view"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={`px-3 py-2 transition-colors ${
              view === 'list' ? 'bg-forge-700 text-text-primary' : 'bg-forge-800 text-text-muted'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tier chips */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {TIERS.map((tier) => (
          <button
            key={tier}
            data-testid={`tier-chip-${tier}`}
            aria-pressed={filters.tier === tier}
            onClick={() => setFilter('tier', tier)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filters.tier === tier
                ? 'bg-emerald text-forge-950'
                : 'bg-forge-800 text-text-muted hover:text-text-primary'
            }`}
          >
            {tier === 'all' ? 'All Tiers' : tier}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6">
        <BountyFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={resetFilters}
          resultCount={displayedBounties.length}
          totalCount={total}
        />
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div
          data-testid="bounty-loading"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-52 rounded-xl border border-border bg-forge-900 overflow-hidden"
            >
              <div className="h-full bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && displayedBounties.length === 0 && (
        <EmptyState onReset={resetFilters} />
      )}

      {/* Bounties */}
      {!loading && displayedBounties.length > 0 && (
        <>
          {view === 'grid' ? (
            <div
              data-testid="bounty-grid"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {displayedBounties.map((bounty) => (
                <BountyCard
                  key={bounty.id}
                  bounty={bounty}
                  onClick={(id) => navigate(`/bounties/${id}`)}
                />
              ))}
            </div>
          ) : (
            <div data-testid="bounty-list" className="flex flex-col gap-3">
              {displayedBounties.map((bounty) => (
                <BountyCard
                  key={bounty.id}
                  bounty={bounty}
                  onClick={(id) => navigate(`/bounties/${id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Pagination — show whenever there's data */}
      {!loading && total > 0 && (
        <div className="mt-8 flex justify-center">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
