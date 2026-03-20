import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Bounty, BountyBoardFilters, BountySortBy } from '../types/bounty';
import { DEFAULT_FILTERS } from '../types/bounty';
import { mockBounties } from '../data/mockBounties';

const TIER_MAP: Record<number, 'T1' | 'T2' | 'T3'> = { 1: 'T1', 2: 'T2', 3: 'T3' };
const STATUS_MAP: Record<string, 'open' | 'in-progress' | 'completed'> = {
  open: 'open',
  in_progress: 'in-progress',
  completed: 'completed',
  paid: 'completed',
};

/** Transform a backend bounty (snake_case) into frontend Bounty (camelCase). */
function mapApiBounty(b: any): Bounty {
  return {
    id: b.id,
    title: b.title,
    description: b.description || '',
    tier: TIER_MAP[b.tier] || 'T2',
    skills: b.required_skills || [],
    rewardAmount: b.reward_amount,
    currency: '$FNDRY',
    deadline: b.deadline || new Date(Date.now() + 7 * 86400000).toISOString(),
    status: STATUS_MAP[b.status] || 'open',
    submissionCount: b.submission_count || 0,
    createdAt: b.created_at,
    projectName: b.created_by || 'SolFoundry',
    githubIssueUrl: b.github_issue_url || undefined,
  };
}

export function useBountyBoard() {
  const [allBounties, setAllBounties] = useState<Bounty[]>(mockBounties);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<BountyBoardFilters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<BountySortBy>('newest');

  // Fetch real bounties from API, fall back to mock data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/bounties?limit=50');
        if (!cancelled && res.ok) {
          const data = await res.json();
          const items = data.items || data;
          if (Array.isArray(items) && items.length > 0) {
            setAllBounties(items.map(mapApiBounty));
          }
        }
      } catch {
        // Keep mock data on failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const bounties = useMemo(() => {
    let r = [...allBounties];
    if (filters.tier !== 'all') r = r.filter(b => b.tier === filters.tier);
    if (filters.status !== 'all') r = r.filter(b => b.status === filters.status);
    if (filters.skills.length) r = r.filter(b => filters.skills.some(s => b.skills.map(sk => sk.toLowerCase()).includes(s.toLowerCase())));
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      r = r.filter(b => b.title.toLowerCase().includes(q) || b.projectName.toLowerCase().includes(q));
    }
    return r.sort((a, b) =>
      sortBy === 'reward' ? b.rewardAmount - a.rewardAmount
      : sortBy === 'deadline' ? new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [allBounties, filters, sortBy]);

  const setFilter = useCallback(<K extends keyof BountyBoardFilters>(k: K, v: BountyBoardFilters[K]) =>
    setFilters(p => ({ ...p, [k]: v })), []);

  return {
    bounties,
    allBounties,
    filters,
    sortBy,
    loading,
    setFilter,
    resetFilters: useCallback(() => setFilters(DEFAULT_FILTERS), []),
    setSortBy,
  };
}
