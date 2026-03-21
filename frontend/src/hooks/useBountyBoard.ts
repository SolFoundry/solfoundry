/** Bounty fetching via apiClient with search + fallback. @module hooks/useBountyBoard */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Bounty, BountyBoardFilters, BountySortBy, SearchResponse } from '../types/bounty';
import { DEFAULT_FILTERS } from '../types/bounty';
import { apiClient } from '../services/apiClient';

const TIER_MAP: Record<number, 'T1' | 'T2' | 'T3'> = { 1: 'T1', 2: 'T2', 3: 'T3' };
const STATUS_MAP: Record<string, 'open' | 'in-progress' | 'completed'> = {
  open: 'open',
  in_progress: 'in-progress',
  completed: 'completed',
  paid: 'completed',
};

function mapApiBounty(b: any): Bounty {
  return {
    id: b.id,
    title: b.title,
    description: b.description || '',
    tier: TIER_MAP[b.tier] || b.tier || 'T2',
    skills: b.required_skills || b.skills || [],
    rewardAmount: b.reward_amount ?? b.rewardAmount,
    currency: '$FNDRY',
    deadline: b.deadline || new Date(Date.now() + 7 * 86400000).toISOString(),
    status: STATUS_MAP[b.status] || b.status || 'open',
    submissionCount: b.submission_count ?? b.submissionCount ?? 0,
    createdAt: b.created_at ?? b.createdAt,
    projectName: b.created_by || b.projectName || 'SolFoundry',
    githubIssueUrl: b.github_issue_url || b.githubIssueUrl || undefined,
    relevanceScore: b.relevance_score ?? 0,
    skillMatchCount: b.skill_match_count ?? 0,
  };
}

function buildSearchParams(
  filters: BountyBoardFilters, sortBy: BountySortBy, page: number, perPage: number,
): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.searchQuery.trim()) p.set('q', filters.searchQuery.trim());
  if (filters.tier !== 'all') {
    const tierNum = filters.tier === 'T1' ? '1' : filters.tier === 'T2' ? '2' : '3';
    p.set('tier', tierNum);
  }
  if (filters.status !== 'all') {
    const map: Record<string, string> = { open: 'open', 'in-progress': 'in_progress', completed: 'completed' };
    p.set('status', map[filters.status] || filters.status);
  }
  if (filters.skills.length) p.set('skills', filters.skills.join(','));
  if (filters.rewardMin) p.set('reward_min', filters.rewardMin);
  if (filters.rewardMax) p.set('reward_max', filters.rewardMax);
  if (filters.creatorType !== 'all') p.set('creator_type', filters.creatorType);
  if (filters.category !== 'all') p.set('category', filters.category);
  if (filters.deadlineBefore) p.set('deadline_before', new Date(filters.deadlineBefore + 'T23:59:59Z').toISOString());
  p.set('sort', sortBy);
  p.set('page', String(page));
  p.set('per_page', String(perPage));
  return p;
}

const SORT_COMPAT: Record<string, BountySortBy> = { reward: 'reward_high' };

function localSort(arr: Bounty[], sortBy: BountySortBy): Bounty[] {
  const s = [...arr];
  switch (sortBy) {
    case 'reward_high': return s.sort((a, b) => b.rewardAmount - a.rewardAmount);
    case 'reward_low': return s.sort((a, b) => a.rewardAmount - b.rewardAmount);
    case 'deadline': return s.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    case 'submissions': return s.sort((a, b) => b.submissionCount - a.submissionCount);
    case 'best_match':
    case 'newest':
    default: return s.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

function applyLocalFilters(all: Bounty[], f: BountyBoardFilters, sortBy: BountySortBy): Bounty[] {
  let r = [...all];
  if (f.tier !== 'all') r = r.filter(b => b.tier === f.tier);
  if (f.status !== 'all') r = r.filter(b => b.status === f.status);
  if (f.skills.length) r = r.filter(b => f.skills.some(s => b.skills.map(sk => sk.toLowerCase()).includes(s.toLowerCase())));
  if (f.searchQuery.trim()) {
    const q = f.searchQuery.toLowerCase();
    r = r.filter(b => b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) || b.projectName.toLowerCase().includes(q));
  }
  if (f.rewardMin) { const min = Number(f.rewardMin); if (!isNaN(min)) r = r.filter(b => b.rewardAmount >= min); }
  if (f.rewardMax) { const max = Number(f.rewardMax); if (!isNaN(max)) r = r.filter(b => b.rewardAmount <= max); }
  if (f.deadlineBefore) {
    const cutoff = new Date(f.deadlineBefore + 'T23:59:59Z').getTime();
    r = r.filter(b => new Date(b.deadline).getTime() <= cutoff);
  }
  return localSort(r, sortBy);
}

export function useBountyBoard() {
  const [allBounties, setAllBounties] = useState<Bounty[]>([]);
  const [apiResults, setApiResults] = useState<{ items: Bounty[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<BountyBoardFilters>(DEFAULT_FILTERS);
  const [sortBy, setSortByRaw] = useState<BountySortBy>('newest');
  const [page, setPage] = useState(1);
  const [hotBounties, setHotBounties] = useState<Bounty[]>([]);
  const [recommendedBounties, setRecommendedBounties] = useState<Bounty[]>([]);
  const perPage = 20;
  const abortRef = useRef<AbortController | null>(null);
  const useApiRef = useRef(true);

  const setSortBy = useCallback((s: BountySortBy | string) => {
    setSortByRaw((SORT_COMPAT[s] || s) as BountySortBy);
    setPage(1);
  }, []);

  // Server-side search
  useEffect(() => {
    if (!useApiRef.current) return;
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const params = buildSearchParams(filters, sortBy, page, perPage);
        const data = await apiClient<SearchResponse>(`/api/bounties/search?${params}`, { signal: ctrl.signal });
        setApiResults({ items: data.items.map(mapApiBounty), total: data.total });
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        useApiRef.current = false;
        setApiResults(null);
        // Fallback: fetch all bounties once from old list endpoint
        try {
          const d = await apiClient<{ items?: unknown[] }>('/api/bounties?limit=100', { retries: 0 });
          const items = (d.items || d) as unknown[];
          if (Array.isArray(items) && items.length > 0) setAllBounties(items.map(mapApiBounty));
        } catch { /* API unavailable */ }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [filters, sortBy, page]);

  // Client-side filtered results (fallback when API unavailable)
  const localFiltered = useMemo(
    () => applyLocalFilters(allBounties, filters, sortBy),
    [allBounties, filters, sortBy],
  );

  // Decide which results to use
  const bounties = apiResults ? apiResults.items : localFiltered;
  const total = apiResults ? apiResults.total : localFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // Fetch hot bounties once
  useEffect(() => {
    (async () => {
      try {
        const d = await apiClient<unknown[]>('/api/bounties/hot?limit=6', { retries: 0, cacheTtl: 60_000 });
        setHotBounties(d.map(mapApiBounty));
      } catch { /* API unavailable */ }
    })();
  }, []);

  // Fetch recommended bounties
  useEffect(() => {
    const skills = filters.skills.length > 0 ? filters.skills : ['react', 'typescript', 'rust'];
    (async () => {
      try {
        const d = await apiClient<unknown[]>(`/api/bounties/recommended?skills=${skills.join(',')}&limit=6`, { retries: 0, cacheTtl: 60_000 });
        setRecommendedBounties(d.map(mapApiBounty));
      } catch { /* API unavailable */ }
    })();
  }, [filters.skills]);

  const setFilter = useCallback(<K extends keyof BountyBoardFilters>(k: K, v: BountyBoardFilters[K]) => {
    setFilters(p => ({ ...p, [k]: v }));
    setPage(1);
  }, []);

  return {
    bounties,
    allBounties,
    total,
    filters,
    sortBy,
    loading,
    page,
    totalPages,
    hotBounties,
    recommendedBounties,
    setFilter,
    resetFilters: useCallback(() => { setFilters(DEFAULT_FILTERS); setPage(1); setApiResults(null); }, []),
    setSortBy,
    setPage,
  };
}
