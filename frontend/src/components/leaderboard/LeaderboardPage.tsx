/**
 * LeaderboardPage - Main view for the contributor leaderboard feature.
 * Renders search input, time-range toggle, sort selector, and the ranked
 * contributor table. Wired into the app router at /leaderboard via
 * pages/LeaderboardPage.tsx re-export.
 * @module components/leaderboard/LeaderboardPage
 */
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { SkeletonTable } from '../common/Skeleton';
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
        <div className="h-8 w-64 bg-gray-100 dark:bg-surface-200 rounded-lg animate-pulse" />
        <div className="flex flex-wrap gap-3 items-center">
          <div className="h-10 w-64 bg-gray-100 dark:bg-surface-200 rounded-lg animate-pulse" />
          <div className="flex gap-1">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-8 w-16 bg-gray-100 dark:bg-surface-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        <SkeletonTable rows={10} columns={6} showAvatar />
      </div>
    );
  }
  
  if (error) return <div className="p-8 text-center text-red-400" role="alert">Error: {error}</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="leaderboard-page">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contributor Leaderboard</h1>
      <div className="flex flex-wrap gap-3 items-center">
        <input type="search" placeholder="Search contributors..." value={search} onChange={e => setSearch(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-100 px-3 py-2 text-sm text-gray-900 dark:text-gray-200 w-64" aria-label="Search contributors" />
        <div className="flex gap-1" role="group" aria-label="Time range">
          {RANGES.map(r => (
            <button key={r.value} onClick={() => setTimeRange(r.value)} aria-pressed={timeRange === r.value}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${timeRange === r.value ? 'bg-[#00FF88] text-surface' : 'bg-gray-50 dark:bg-surface-100 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}>
              {r.label}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortField)} aria-label="Sort by"
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-100 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
          {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      {contributors.length === 0 ? (
        <NoDataAvailable dataType="contributors" />
      ) : (
        <table className="w-full text-sm" role="table" aria-label="Leaderboard">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-400 text-left text-xs">
              <th className="py-2 w-12">#</th><th className="py-2">Contributor</th>
              <th className="py-2 text-right">Points</th><th className="py-2 text-right">Bounties</th>
              <th className="py-2 text-right">Earned (FNDRY)</th><th className="py-2 text-right hidden md:table-cell">Streak</th>
            </tr>
          </thead>
          <tbody>
            {contributors.map(c => (
              <tr key={c.username} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-surface-100">
                <td className="py-3 font-bold text-gray-400">{c.rank <= 3 ? ['\u{1F947}','\u{1F948}','\u{1F949}'][c.rank-1] : c.rank}</td>
                <td className="py-3 flex items-center gap-2">
                  <img src={c.avatarUrl} alt={c.username} className="h-6 w-6 rounded-full" width={24} height={24} />
                  <span className="text-gray-900 dark:text-white font-medium">{c.username}</span>
                  <span className="text-xs text-gray-500">{c.topSkills.slice(0,2).join(', ')}</span>
                </td>
                <td className="py-3 text-right text-[#00FF88] font-semibold">{c.points.toLocaleString()}</td>
                <td className="py-3 text-right text-gray-600 dark:text-gray-300">{c.bountiesCompleted}</td>
                <td className="py-3 text-right text-gray-600 dark:text-gray-300">{c.earningsFndry.toLocaleString()}</td>
                <td className="py-3 text-right text-gray-400 hidden md:table-cell">{c.streak}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
export default LeaderboardPage;