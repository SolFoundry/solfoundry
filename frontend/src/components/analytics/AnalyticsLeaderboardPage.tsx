import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeaderboardEntry {
  rank: number;
  username: string;
  display_name: string;
  avatar_url: string;
  tier: number;
  total_earned: number;
  bounties_completed: number;
  quality_score: number;
  reputation_score: number;
  on_chain_verified: boolean;
  wallet_address: string | null;
  top_skills: string[];
  streak_days: number;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  per_page: number;
  sort_by: string;
  sort_order: string;
  filters_applied: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIME_RANGES = [
  { label: '7 days',  value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: 'All time', value: 'all' },
];

function exportCSV(entries: LeaderboardEntry[]) {
  const header = 'Rank,Username,Display Name,Tier,Total Earned,Bounties Completed,Quality Score,Reputation Score';
  const rows = entries.map((e) =>
    `${e.rank},${e.username},${e.display_name},${e.tier},${e.total_earned},${e.bounties_completed},${e.quality_score},${e.reputation_score}`,
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leaderboard.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchLeaderboard(timeRange: string): Promise<LeaderboardResponse> {
  const res = await fetch(`/api/analytics/leaderboard?time_range=${timeRange}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to load leaderboard');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnalyticsLeaderboardPage() {
  const [timeRange, setTimeRange] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'total_earned' | 'quality_score' | 'bounties_completed'>('total_earned');

  const { data, isLoading, error } = useQuery<LeaderboardResponse, Error>({
    queryKey: ['analytics-leaderboard', timeRange],
    queryFn: () => fetchLeaderboard(timeRange),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const entries = data?.entries ?? [];
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) => e.username.toLowerCase().includes(q) || e.display_name.toLowerCase().includes(q),
    );
  }, [data, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [filtered, sortBy]);

  return (
    <div data-testid="analytics-leaderboard-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Contributor Leaderboard</h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportCSV(sorted)}
            className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 text-white/60 rounded-lg hover:bg-white/10"
          >
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 text-white/60 rounded-lg hover:bg-white/10"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <input
          type="search"
          aria-label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contributors…"
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none w-52"
        />

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
        >
          <option value="total_earned">Total Earned</option>
          <option value="quality_score">Quality Score</option>
          <option value="bounties_completed">Bounties Completed</option>
        </select>

        {/* Time range */}
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setTimeRange(r.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                timeRange === r.value
                  ? 'bg-[#14F195] text-black'
                  : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error.message}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white/5 rounded-xl h-14" />
          ))}
        </div>
      )}

      {/* Results count */}
      {!isLoading && !error && data && (
        <p className="text-xs text-white/40">
          Showing {sorted.length} of {data.total} contributors
        </p>
      )}

      {/* Table */}
      {!isLoading && !error && sorted.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/40 text-xs">
                <th className="text-left pb-3 pr-4">#</th>
                <th className="text-left pb-3 pr-4">Contributor</th>
                <th className="text-left pb-3 pr-4">Tier</th>
                <th className="text-right pb-3 pr-4">Earned</th>
                <th className="text-right pb-3 pr-4">Quality</th>
                <th className="text-right pb-3">Bounties</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => (
                <tr key={entry.username} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 pr-4 text-white/40">{entry.rank}</td>
                  <td className="py-3 pr-4">
                    <Link
                      to={`/analytics/contributors/${entry.username}`}
                      className="flex items-center gap-2 hover:text-[#14F195]"
                    >
                      <img
                        src={entry.avatar_url}
                        alt={entry.display_name}
                        className="w-7 h-7 rounded-full"
                      />
                      <div>
                        <p className="text-white font-medium">{entry.username}</p>
                        <p className="text-white/40 text-xs">{entry.display_name}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-medium">
                      T{entry.tier}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right text-[#14F195] font-medium">
                    {entry.total_earned.toLocaleString()}
                  </td>
                  <td className="py-3 pr-4 text-right text-white">{entry.quality_score}</td>
                  <td className="py-3 text-right text-white/70">{entry.bounties_completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
