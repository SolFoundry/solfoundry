import { useState, useMemo, useCallback } from 'react';
import type { Bounty, BountyBoardFilters, BountySortBy } from '../types/bounty';
import { DEFAULT_FILTERS } from '../types/bounty';
import { mockBounties } from '../data/mockBounties';
export function useBountyBoard() {
  const [filters, setFilters] = useState<BountyBoardFilters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<BountySortBy>('newest');
  const bounties = useMemo(() => {
    let r = [...mockBounties];
    if (filters.tier !== 'all') r = r.filter(b => b.tier === filters.tier);
    if (filters.status !== 'all') r = r.filter(b => b.status === filters.status);
    if (filters.skills.length) r = r.filter(b => filters.skills.some(s => b.skills.includes(s)));
    if (filters.searchQuery.trim()) { const q = filters.searchQuery.toLowerCase(); r = r.filter(b => b.title.toLowerCase().includes(q) || b.projectName.toLowerCase().includes(q)); }
    return r.sort((a, b) => sortBy === 'reward' ? b.rewardAmount - a.rewardAmount : sortBy === 'deadline' ? new Date(a.deadline).getTime() - new Date(b.deadline).getTime() : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filters, sortBy]);
  const setFilter = useCallback(<K extends keyof BountyBoardFilters>(k: K, v: BountyBoardFilters[K]) => setFilters(p => ({ ...p, [k]: v })), []);
  return { bounties, allBounties: mockBounties, filters, sortBy, setFilter, resetFilters: useCallback(() => setFilters(DEFAULT_FILTERS), []), setSortBy };
}
