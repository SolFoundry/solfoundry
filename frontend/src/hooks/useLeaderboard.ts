/**
 * useLeaderboard - Data-fetching hook for the contributor leaderboard.
 * Tries GET /api/leaderboard, falls back to mock data on failure.
 * Provides client-side search, sort, and time-range filtering.
 * @module hooks/useLeaderboard
 */
import { useState, useEffect, useMemo } from 'react';
import type { Contributor, TimeRange, SortField } from '../types/leaderboard';
import { MOCK_CONTRIBUTORS } from '../data/mockLeaderboard';

export function useLeaderboard() {
  const [contributors, setContributors] = useState<Contributor[]>(MOCK_CONTRIBUTORS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [sortBy, setSortBy] = useState<SortField>('points');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const r = await fetch(`/api/leaderboard?range=${timeRange}`);
        if (!c && r.ok) setContributors(await r.json());
      } catch (e) { if (!c) setError(e instanceof Error ? e.message : 'Failed'); }
      finally { if (!c) setLoading(false); }
    })();
    return () => { c = true; };
  }, [timeRange]);

  const sorted = useMemo(() => {
    let list = [...contributors];
    if (search) list = list.filter(c => c.username.toLowerCase().includes(search.toLowerCase()));
    list.sort((a, b) => {
      const aValue = sortBy === 'bounties' ? a.bountiesCompleted : sortBy === 'earnings' ? a.earningsFndry : a.points;
      const bValue = sortBy === 'bounties' ? b.bountiesCompleted : sortBy === 'earnings' ? b.earningsFndry : b.points;
      return bValue - aValue;
    });
    return list.map((c, i) => ({ ...c, rank: i + 1 }));
  }, [contributors, sortBy, search]);

  return { contributors: sorted, loading, error, timeRange, setTimeRange, sortBy, setSortBy, search, setSearch };
}
