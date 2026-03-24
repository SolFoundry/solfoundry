/**
 * AnalyticsLeaderboardPage - Enhanced public leaderboard with analytics.
 *
 * Displays ranked contributors with quality scores, tier badges,
 * on-chain verification, search, filtering by tier/category/time range,
 * sorting, and pagination. Uses React Query for data fetching and
 * supports responsive mobile-first layout.
 * @module components/analytics/AnalyticsLeaderboardPage
 */

import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLeaderboardAnalytics } from '../../hooks/useAnalytics';
import { SkeletonTable } from '../common/Skeleton';
import { NoDataAvailable } from '../common/EmptyState';
import type {
  AnalyticsTimeRange,
  LeaderboardSortField,
  SortOrder,
} from '../../types/analytics';

/** Time range filter options for the leaderboard. */
const TIME_RANGES: { label: string; value: AnalyticsTimeRange }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: 'All time', value: 'all' },
];

/** Sort field options for the leaderboard table. */
const SORT_OPTIONS: { label: string; value: LeaderboardSortField }[] = [
  { label: 'Earnings', value: 'total_earned' },
  { label: 'Bounties', value: 'bounties_completed' },
  { label: 'Quality', value: 'quality_score' },
  { label: 'Reputation', value: 'reputation_score' },
];

/** Tier filter options. */
const TIER_OPTIONS = [
  { label: 'All Tiers', value: 0 },
  { label: 'Tier 1', value: 1 },
  { label: 'Tier 2', value: 2 },
  { label: 'Tier 3', value: 3 },
];

/** Tier badge color classes. */
const TIER_BADGE_COLORS: Record<number, string> = {
  1: 'bg-[#14F195]/20 text-[#14F195]',
  2: 'bg-[#9945FF]/20 text-[#9945FF]',
  3: 'bg-[#FF6B35]/20 text-[#FF6B35]',
};

/**
 * Enhanced leaderboard page with analytics, filtering, and pagination.
 *
 * Renders search input, time-range toggle, tier filter, sort selector,
 * and the ranked contributor table with quality scores and verification badges.
 */
export function AnalyticsLeaderboardPage() {
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>('all');
  const [sortBy, setSortBy] = useState<LeaderboardSortField>('total_earned');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const { data, isLoading, isError, error } = useLeaderboardAnalytics({
    page,
    perPage,
    sortBy,
    sortOrder,
    tier: tierFilter || undefined,
    search: search || undefined,
    timeRange,
  });

  const handleSortChange = useCallback((field: LeaderboardSortField) => {
    if (field === sortBy) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  }, [sortBy]);

  const totalPages = data ? Math.ceil(data.total / perPage) : 0;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6" data-testid="analytics-leaderboard-page">
        <div className="h-8 w-64 bg-surface-200 rounded-lg animate-pulse" />
        <SkeletonTable rows={10} columns={7} showAvatar />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto" data-testid="analytics-leaderboard-page">
        <div className="text-center text-red-400 py-8" role="alert">
          Error: {error instanceof Error ? error.message : 'Failed to load leaderboard'}
        </div>
      </div>
    );
  }

  const entries = data?.entries ?? [];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6" data-testid="analytics-leaderboard-page">
      {/* Page header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Contributor Leaderboard</h1>
        <p className="text-sm text-gray-400 mt-1">
          Ranked by earnings, quality, and contribution history
        </p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <input
          type="search"
          placeholder="Search contributors..."
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          className="rounded-lg border border-gray-700 bg-[#111111] px-3 py-2 text-sm text-gray-200 w-full sm:w-64"
          aria-label="Search contributors"
        />

        {/* Time range */}
        <div className="flex gap-1" role="group" aria-label="Time range filter">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => { setTimeRange(range.value); setPage(1); }}
              aria-pressed={timeRange === range.value}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                timeRange === range.value
                  ? 'bg-[#14F195] text-black'
                  : 'bg-[#111111] text-gray-300 border border-gray-700 hover:border-gray-500'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* Tier filter */}
        <select
          value={tierFilter}
          onChange={(event) => { setTierFilter(Number(event.target.value)); setPage(1); }}
          className="rounded-lg border border-gray-700 bg-[#111111] px-3 py-2 text-xs text-gray-300"
          aria-label="Filter by tier"
        >
          {TIER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        {/* Sort selector */}
        <select
          value={sortBy}
          onChange={(event) => handleSortChange(event.target.value as LeaderboardSortField)}
          className="rounded-lg border border-gray-700 bg-[#111111] px-3 py-2 text-xs text-gray-300"
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {/* Results count */}
      {data && (
        <p className="text-xs text-gray-500">
          Showing {entries.length} of {data.total} contributors
        </p>
      )}

      {/* Table */}
      {entries.length === 0 ? (
        <NoDataAvailable dataType="contributors" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table" aria-label="Analytics leaderboard">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left text-xs">
                <th className="py-2 w-12">#</th>
                <th className="py-2">Contributor</th>
                <th className="py-2 text-center hidden sm:table-cell">Tier</th>
                <th className="py-2 text-right">
                  <button
                    onClick={() => handleSortChange('quality_score')}
                    className="hover:text-white transition-colors"
                    aria-label="Sort by quality score"
                  >
                    Quality {sortBy === 'quality_score' ? (sortOrder === 'desc' ? '\u2193' : '\u2191') : ''}
                  </button>
                </th>
                <th className="py-2 text-right hidden md:table-cell">Bounties</th>
                <th className="py-2 text-right">Earned (FNDRY)</th>
                <th className="py-2 text-right hidden lg:table-cell">Streak</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.username}
                  className="border-b border-gray-800 hover:bg-[#111111]/50 transition-colors"
                >
                  {/* Rank */}
                  <td className="py-3 font-bold text-gray-400">
                    {entry.rank <= 3
                      ? ['\u{1F947}', '\u{1F948}', '\u{1F949}'][entry.rank - 1]
                      : entry.rank}
                  </td>

                  {/* Contributor info */}
                  <td className="py-3">
                    <Link
                      to={`/analytics/contributors/${entry.username}`}
                      className="flex items-center gap-2 hover:text-[#9945FF] transition-colors"
                    >
                      <img
                        src={entry.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${entry.username}`}
                        alt={entry.username}
                        className="h-7 w-7 rounded-full"
                        width={28}
                        height={28}
                        loading="lazy"
                      />
                      <div className="min-w-0">
                        <span className="text-white font-medium block truncate">
                          {entry.username}
                        </span>
                        <span className="text-[10px] text-gray-500 block truncate">
                          {entry.topSkills.slice(0, 2).join(', ')}
                        </span>
                      </div>
                      {entry.onChainVerified && (
                        <span
                          className="text-[#14F195] text-xs"
                          title="On-chain verified"
                          aria-label="On-chain verified contributor"
                        >
                          \u2713
                        </span>
                      )}
                    </Link>
                  </td>

                  {/* Tier badge */}
                  <td className="py-3 text-center hidden sm:table-cell">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${TIER_BADGE_COLORS[entry.tier] || TIER_BADGE_COLORS[1]}`}>
                      T{entry.tier}
                    </span>
                  </td>

                  {/* Quality score */}
                  <td className="py-3 text-right">
                    <span className={`font-semibold ${
                      entry.qualityScore >= 8 ? 'text-[#14F195]'
                        : entry.qualityScore >= 6 ? 'text-yellow-400'
                        : 'text-gray-400'
                    }`}>
                      {entry.qualityScore.toFixed(1)}
                    </span>
                  </td>

                  {/* Bounties */}
                  <td className="py-3 text-right text-gray-300 hidden md:table-cell">
                    {entry.bountiesCompleted}
                  </td>

                  {/* Earnings */}
                  <td className="py-3 text-right text-[#14F195] font-semibold">
                    {entry.totalEarned.toLocaleString()}
                  </td>

                  {/* Streak */}
                  <td className="py-3 text-right text-gray-400 hidden lg:table-cell">
                    {entry.streakDays}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4" role="navigation" aria-label="Leaderboard pagination">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-xs border border-gray-700 bg-[#111111] text-gray-300 disabled:opacity-40 hover:border-gray-500 transition-colors"
            aria-label="Previous page"
          >
            Previous
          </button>
          <span className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg text-xs border border-gray-700 bg-[#111111] text-gray-300 disabled:opacity-40 hover:border-gray-500 transition-colors"
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default AnalyticsLeaderboardPage;
