/**
 * LeaderboardPage - Main view for the contributor leaderboard feature.
 * Renders search input, time-range toggle, sort selector, and the ranked
 * contributor table. Wired into the app router at /leaderboard via
 * pages/LeaderboardPage.tsx re-export.
 * @module components/leaderboard/LeaderboardPage
 */
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { Skeleton, SkeletonTable } from '../common/Skeleton';
import { NoDataAvailable } from '../common/EmptyState';
import type { TimeRange, SortField } from '../../types/leaderboard';

const RANGES: { label: string; value: TimeRange }[] = [
  { label: '7 days', value: '7d' }, { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' }, { label: 'All time', value: 'all' },
];
const SORTS: { label: string; value: SortField }[] = [
  { label: 'Points', value: 'points' }, { label: 'Bounties', value: 'bounties' },
  { label: 'Earnings', value: 'earnings' },
];

export function LeaderboardPage() {
  const { contributors, loading, error, timeRange, setTimeRange, sortBy, setSortBy, search, setSearch } = useLeaderboard();

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="leaderboard-page">
        <div role="status" aria-live="polite" aria-label="Loading leaderboard" className="space-y-6">
          <Skeleton height="2rem" width="16rem" rounded="lg" />
          <div className="flex flex-wrap gap-3 items-center">
            <Skeleton height="2.5rem" width="16rem" rounded="lg" />
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} height="2rem" width="4rem" rounded="lg" />
              ))}
            </div>
            <Skeleton height="2.5rem" width="7rem" rounded="lg" />
          </div>
          <SkeletonTable rows={10} columns={6} showAvatar />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600 dark:text-red-400" role="alert">
        Error: {error}
      </div>
    );
  }

  function rowClasses(rank: number) {
    const base =
      'border-b border-gray-200 transition-colors dark:border-gray-800 ' +
      'hover:bg-gray-50 dark:hover:bg-surface-100';
    if (rank === 1) {
      return `${base} bg-emerald-50/90 hover:bg-emerald-100/90 dark:bg-solana-green/15 dark:hover:bg-solana-green/[0.18]`;
    }
    if (rank === 2) {
      return `${base} bg-slate-50/90 hover:bg-slate-100/90 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]`;
    }
    if (rank === 3) {
      return `${base} bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-500/[0.08] dark:hover:bg-amber-500/[0.12]`;
    }
    return base;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="leaderboard-page">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contributor Leaderboard</h1>
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="search"
          placeholder="Search contributors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="min-h-11 w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-solana-purple/30 focus:border-solana-purple/50 dark:border-gray-700 dark:bg-surface-100 dark:text-gray-200 dark:placeholder-gray-500 sm:w-64"
          aria-label="Search contributors"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Time range">
          {RANGES.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => setTimeRange(r.value)}
              aria-pressed={timeRange === r.value}
              className={
                'inline-flex min-h-11 items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors sm:text-base ' +
                (timeRange === r.value
                  ? 'bg-solana-green text-gray-900 border-transparent shadow-sm dark:text-black'
                  : 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200 hover:border-gray-400 dark:bg-surface-100 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-surface-200 dark:hover:border-gray-600')
              }
            >
              {r.label}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortField)}
          aria-label="Sort by"
          className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-solana-purple/30 dark:border-gray-700 dark:bg-surface-100 dark:text-gray-200"
        >
          {SORTS.map(s => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {contributors.length === 0 ? (
        <NoDataAvailable dataType="contributors" />
      ) : (
        <div className="-mx-6 overflow-x-auto overscroll-x-contain px-6 pb-1 sm:mx-0 sm:px-0 touch-pan-x">
        <table className="w-full min-w-[36rem] text-base" role="table" aria-label="Leaderboard">
          <thead>
            <tr className="border-b border-gray-200 text-gray-600 text-left text-xs dark:border-gray-700 dark:text-gray-400">
              <th className="py-2 w-12">#</th>
              <th className="py-2">Contributor</th>
              <th className="py-2 text-right">Points</th>
              <th className="py-2 text-right">Bounties</th>
              <th className="py-2 text-right">Earned (FNDRY)</th>
              <th className="py-2 text-right hidden md:table-cell">Streak</th>
            </tr>
          </thead>
          <tbody>
            {contributors.map(c => (
              <tr key={c.username} className={rowClasses(c.rank)}>
                <td className="py-3 font-bold text-gray-600 dark:text-gray-400">
                  {c.rank <= 3 ? ['\u{1F947}', '\u{1F948}', '\u{1F949}'][c.rank - 1] : c.rank}
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <img
                      src={c.avatarUrl}
                      alt=""
                      className="h-8 w-8 rounded-full shrink-0 object-cover"
                      width={32}
                      height={32}
                      loading="lazy"
                      decoding="async"
                      sizes="32px"
                    />
                    <span className="font-medium text-gray-900 dark:text-white">{c.username}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-500">{c.topSkills.slice(0, 2).join(', ')}</span>
                  </div>
                </td>
                <td className="py-3 text-right text-emerald-700 dark:text-solana-green font-semibold tabular-nums">
                  {c.points.toLocaleString()}
                </td>
                <td className="py-3 text-right text-gray-700 tabular-nums dark:text-gray-300">{c.bountiesCompleted}</td>
                <td className="py-3 text-right text-gray-700 tabular-nums dark:text-gray-300">{c.earningsFndry.toLocaleString()}</td>
                <td className="py-3 text-right text-gray-600 tabular-nums hidden md:table-cell dark:text-gray-400">{c.streak}d</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
export default LeaderboardPage;