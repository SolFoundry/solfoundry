import { useState, useMemo } from 'react';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { SkeletonTable } from '../common/Skeleton';
import { NoDataAvailable } from '../common/EmptyState';
import type { TimeRange, SortField } from '../../types/leaderboard';

const RANGES: { label: string; value: TimeRange }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: 'All time', value: 'all' },
];

const SORTS: { label: string; value: SortField }[] = [
  { label: 'Points', value: 'points' },
  { label: 'Bounties', value: 'bounties' },
  { label: 'Earnings', value: 'earnings' },
];

export function LeaderboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [sortBy, setSortBy] = useState<SortField>('points');
  const [search, setSearch] = useState('');

  const { contributors, loading, error } = useLeaderboard(timeRange);

  const filteredAndSorted = useMemo(() => {
    let list = [...contributors];
    
    // Filter by search
    if (search) {
      list = list.filter((c) =>
        c.username.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Sort
    list.sort((a, b) => {
      const aVal = sortBy === 'bounties' ? a.bountiesCompleted : 
                  sortBy === 'earnings' ? a.earningsFndry : a.points;
      const bVal = sortBy === 'bounties' ? b.bountiesCompleted : 
                  sortBy === 'earnings' ? b.earningsFndry : b.points;
      return bVal - aVal;
    });

    // Re-rank after filter/sort for display purposes if needed
    return list.map((c, i) => ({ ...c, displayRank: i + 1 }));
  }, [contributors, search, sortBy]);

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="leaderboard-page">
        <div className="h-8 w-64 bg-surface-200 rounded-lg animate-pulse" />
        <div className="flex flex-wrap gap-3 items-center">
          <div className="h-10 w-64 bg-surface-200 rounded-lg animate-pulse" />
          <div className="flex gap-1">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-8 w-16 bg-surface-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        <SkeletonTable rows={10} columns={6} showAvatar />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center" role="alert">
        <div className="text-red-400 mb-2">Error: {error}</div>
        <button 
          onClick={() => window.location.reload()}
          className="text-sm text-[#00FF88] hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="leaderboard-page">
      <h1 className="text-2xl font-bold text-white">Contributor Leaderboard</h1>
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="search"
          placeholder="Search contributors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-700 bg-surface-100 px-3 py-2 text-sm text-gray-200 w-64"
          aria-label="Search contributors"
        />
        <div className="flex gap-1" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setTimeRange(r.value)}
              aria-pressed={timeRange === r.value}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                timeRange === r.value
                  ? 'bg-[#00FF88] text-surface'
                  : 'bg-surface-100 text-gray-300 border border-gray-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortField)}
          aria-label="Sort by"
          className="rounded-lg border border-gray-700 bg-surface-100 px-3 py-2 text-xs text-gray-300"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {filteredAndSorted.length === 0 ? (
        <NoDataAvailable dataType="contributors" />
      ) : (
        <table className="w-full text-sm" role="table" aria-label="Leaderboard">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left text-xs">
              <th className="py-2 w-12">#</th>
              <th className="py-2">Contributor</th>
              <th className="py-2 text-right">Points</th>
              <th className="py-2 text-right">Bounties</th>
              <th className="py-2 text-right">Earned (FNDRY)</th>
              <th className="py-2 text-right hidden md:table-cell">Streak</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((c) => (
              <tr key={c.username} className="border-b border-gray-800 hover:bg-surface-100 transition-colors">
                <td className="py-3 font-bold text-gray-400">
                  {c.displayRank <= 3
                    ? ['\u{1F947}', '\u{1F948}', '\u{1F949}'][c.displayRank - 1]
                    : c.displayRank}
                </td>
                <td className="py-3 flex items-center gap-2">
                  <img
                    src={c.avatarUrl}
                    alt={c.username}
                    className="h-6 w-6 rounded-full bg-surface-200"
                    width={24}
                    height={24}
                  />
                  <span className="text-white font-medium">{c.username}</span>
                  <span className="text-xs text-gray-500 hidden sm:inline">
                    {c.topSkills.slice(0, 2).join(', ')}
                  </span>
                </td>
                <td className="py-3 text-right text-[#00FF88] font-semibold">
                  {c.points.toLocaleString()}
                </td>
                <td className="py-3 text-right text-gray-300">{c.bountiesCompleted}</td>
                <td className="py-3 text-right text-gray-300">
                  {c.earningsFndry.toLocaleString()}
                </td>
                <td className="py-3 text-right text-gray-400 hidden md:table-cell">
                  {c.streak}d
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
export default LeaderboardPage;