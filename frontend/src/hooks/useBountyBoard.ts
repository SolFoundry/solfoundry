/**
 * Bounty fetching via apiClient + React Query with search and fallback.
 * URL search params drive page, sort, and search state for shareable links.
 * @module hooks/useBountyBoard
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Bounty, BountyBoardFilters, BountySortBy, SearchResponse } from '../types/bounty';
import { DEFAULT_FILTERS, SORT_OPTIONS } from '../types/bounty';
import { apiClient } from '../services/apiClient';

export const PER_PAGE = 12;

const TIER_MAP: Record<number, 'T1' | 'T2' | 'T3'> = { 1: 'T1', 2: 'T2', 3: 'T3' };
import type { BountyStatus } from '../types/bounty';
const STATUS_MAP: Record<string, BountyStatus> = {
  open: 'open',
  in_progress: 'in-progress',
  under_review: 'under_review',
  completed: 'completed',
  disputed: 'disputed',
  paid: 'paid',
  cancelled: 'cancelled',
};

const VALID_SORTS = new Set(SORT_OPTIONS.map(o => o.value));

function isValidSort(v: string | null): v is BountySortBy {
  return v !== null && VALID_SORTS.has(v as BountySortBy);
}

function parsePageParam(v: string | null): number {
  if (!v) return 1;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Map raw API bounty response to strongly-typed Bounty object. */
function mapApiBounty(raw: Record<string, unknown>): Bounty {
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    tier: TIER_MAP[Number(raw.tier)] || (typeof raw.tier === 'string' ? raw.tier as Bounty['tier'] : 'T2'),
    skills: (Array.isArray(raw.required_skills) ? raw.required_skills : Array.isArray(raw.skills) ? raw.skills : []) as string[],
    rewardAmount: Number(raw.reward_amount ?? raw.rewardAmount ?? 0),
    currency: '$FNDRY',
    deadline: String(raw.deadline || new Date(Date.now() + 7 * 86400000).toISOString()),
    status: STATUS_MAP[String(raw.status)] || (typeof raw.status === 'string' ? raw.status as Bounty['status'] : 'open'),
    submissionCount: Number(raw.submission_count ?? raw.submissionCount ?? 0),
    createdAt: String(raw.created_at ?? raw.createdAt ?? ''),
    projectName: String(raw.created_by || raw.projectName || 'SolFoundry'),
    creatorType: (String(raw.creator_type || raw.creatorType || 'platform')) as Bounty['creatorType'],
    githubIssueUrl: raw.github_issue_url || raw.githubIssueUrl ? String(raw.github_issue_url || raw.githubIssueUrl) : undefined,
    relevanceScore: Number(raw.relevance_score ?? 0),
    skillMatchCount: Number(raw.skill_match_count ?? 0),
  };
}

/** Build URLSearchParams for the API request (not for the browser URL). */
function buildApiParams(
  filters: BountyBoardFilters, sortBy: BountySortBy, page: number,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.searchQuery.trim()) params.set('q', filters.searchQuery.trim());
  if (filters.tier !== 'all') {
    const tierNum = filters.tier === 'T1' ? '1' : filters.tier === 'T2' ? '2' : '3';
    params.set('tier', tierNum);
  }
  if (filters.status !== 'all') {
    const statusMap: Record<string, string> = { open: 'open', 'in-progress': 'in_progress', completed: 'completed' };
    params.set('status', statusMap[filters.status] || filters.status);
  }
  if (filters.skills.length) params.set('skills', filters.skills.join(','));
  if (filters.rewardMin) params.set('reward_min', filters.rewardMin);
  if (filters.rewardMax) params.set('reward_max', filters.rewardMax);
  if (filters.creatorType !== 'all') params.set('creator_type', filters.creatorType);
  if (filters.category !== 'all') params.set('category', filters.category);
  if (filters.deadlineBefore) params.set('deadline_before', new Date(filters.deadlineBefore + 'T23:59:59Z').toISOString());
  params.set('sort', sortBy);
  params.set('page', String(page));
  params.set('per_page', String(PER_PAGE));
  return params;
}

const SORT_COMPAT: Record<string, BountySortBy> = { reward: 'reward_high' };

/** Sort bounties by the given field, returning a new sorted array. */
function localSort(bounties: Bounty[], sortBy: BountySortBy): Bounty[] {
  const sorted = [...bounties];
  switch (sortBy) {
    case 'reward_high': return sorted.sort((left, right) => right.rewardAmount - left.rewardAmount);
    case 'reward_low': return sorted.sort((left, right) => left.rewardAmount - right.rewardAmount);
    case 'deadline': return sorted.sort((left, right) => new Date(left.deadline).getTime() - new Date(right.deadline).getTime());
    case 'submissions': return sorted.sort((left, right) => right.submissionCount - left.submissionCount);
    case 'best_match':
    case 'newest':
    default: return sorted.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }
}

/** Apply local filters and sorting when the search API is unavailable. */
function applyLocalFilters(allBounties: Bounty[], activeFilters: BountyBoardFilters, sortBy: BountySortBy): Bounty[] {
  let results = [...allBounties];
  if (activeFilters.tier !== 'all') results = results.filter(bounty => bounty.tier === activeFilters.tier);
  if (activeFilters.status !== 'all') results = results.filter(bounty => bounty.status === activeFilters.status);
  if (activeFilters.skills.length) results = results.filter(bounty => activeFilters.skills.some(skill => bounty.skills.map(bountySkill => bountySkill.toLowerCase()).includes(skill.toLowerCase())));
  if (activeFilters.searchQuery.trim()) {
    const query = activeFilters.searchQuery.toLowerCase();
    results = results.filter(bounty => bounty.title.toLowerCase().includes(query) || bounty.description.toLowerCase().includes(query) || bounty.projectName.toLowerCase().includes(query));
  }
  if (activeFilters.rewardMin) { const minReward = Number(activeFilters.rewardMin); if (!isNaN(minReward)) results = results.filter(bounty => bounty.rewardAmount >= minReward); }
  if (activeFilters.rewardMax) { const maxReward = Number(activeFilters.rewardMax); if (!isNaN(maxReward)) results = results.filter(bounty => bounty.rewardAmount <= maxReward); }
  if (activeFilters.deadlineBefore) {
    const cutoff = new Date(activeFilters.deadlineBefore + 'T23:59:59Z').getTime();
    results = results.filter(bounty => new Date(bounty.deadline).getTime() <= cutoff);
  }
  return localSort(results, sortBy);
}

/** Bounty board hook with URL-synced pagination, React Query caching, and client-side fallback. */
export function useBountyBoard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<BountyBoardFilters>(() => ({
    ...DEFAULT_FILTERS,
    searchQuery: searchParams.get('search') ?? '',
  }));
  const searchAvailableRef = useRef(true);

  const page = parsePageParam(searchParams.get('page'));
  const sortBy: BountySortBy = isValidSort(searchParams.get('sort'))
    ? searchParams.get('sort') as BountySortBy
    : 'newest';

  const updateUrlParams = useCallback((updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '' || (key === 'page' && value === '1') || (key === 'sort' && value === 'newest')) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setPage = useCallback((p: number) => {
    updateUrlParams({ page: String(p) });
  }, [updateUrlParams]);

  const setSortBy = useCallback((sortField: BountySortBy | string) => {
    const resolved = (SORT_COMPAT[sortField] || sortField) as BountySortBy;
    updateUrlParams({ sort: resolved, page: '1' });
  }, [updateUrlParams]);

  const setFilter = useCallback(<K extends keyof BountyBoardFilters>(key: K, value: BountyBoardFilters[K]) => {
    setFilters((prev: BountyBoardFilters) => ({ ...prev, [key]: value }));
    updateUrlParams({ page: '1', ...(key === 'searchQuery' ? { search: String(value) || null } : {}) });
  }, [updateUrlParams]);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    updateUrlParams({ page: '1', search: null, sort: null });
  }, [updateUrlParams]);

  // Keep search URL param in sync when filters.searchQuery changes from autocomplete
  useEffect(() => {
    const urlSearch = searchParams.get('search') ?? '';
    if (filters.searchQuery !== urlSearch) {
      updateUrlParams({ search: filters.searchQuery || null });
    }
  }, [filters.searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Server-side search via React Query
  const searchQuery = useQuery({
    queryKey: ['bounties', 'search', filters, sortBy, page],
    queryFn: async () => {
      const params = buildApiParams(filters, sortBy, page);
      const data = await apiClient<SearchResponse>(`/api/bounties/search?${params}`);
      return { items: (data.items as unknown as Record<string, unknown>[]).map(mapApiBounty), total: data.total };
    },
    enabled: searchAvailableRef.current,
    retry: false,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  if (searchQuery.isError && searchAvailableRef.current) searchAvailableRef.current = false;

  // Fallback: full bounty list when search endpoint is down
  const fallbackQuery = useQuery({
    queryKey: ['bounties', 'all'],
    queryFn: async () => {
      const data = await apiClient<{ items?: unknown[] }>('/api/bounties?limit=200');
      const items = (data.items || data) as unknown[];
      return Array.isArray(items) ? items.map(r => mapApiBounty(r as Record<string, unknown>)) : [];
    },
    enabled: !searchAvailableRef.current,
    staleTime: 60_000,
  });

  const allBounties = fallbackQuery.data ?? [];
  const localFiltered = useMemo(() => applyLocalFilters(allBounties, filters, sortBy), [allBounties, filters, sortBy]);

  const localPaginated = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return localFiltered.slice(start, start + PER_PAGE);
  }, [localFiltered, page]);

  const bounties = searchQuery.data ? searchQuery.data.items : localPaginated;
  const total = searchQuery.data ? searchQuery.data.total : localFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const loading = searchQuery.isLoading || fallbackQuery.isLoading;
  const isFetching = searchQuery.isFetching;

  // Clamp page to valid range when totalPages changes (skip while loading)
  useEffect(() => {
    if (!loading && page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages, setPage, loading]);

  // Hot bounties (fetched once)
  const hotBountiesQuery = useQuery({
    queryKey: ['bounties', 'hot'],
    queryFn: async () => (await apiClient<unknown[]>('/api/bounties/hot?limit=6')).map(r => mapApiBounty(r as Record<string, unknown>)),
    staleTime: 60_000,
    retry: false,
  });

  // Recommended bounties (skill-based)
  const skillsKey = filters.skills.length > 0 ? filters.skills : ['react', 'typescript', 'rust'];
  const recommendedQuery = useQuery({
    queryKey: ['bounties', 'recommended', skillsKey],
    queryFn: async () => (await apiClient<unknown[]>(`/api/bounties/recommended?skills=${encodeURIComponent(skillsKey.join(','))}&limit=6`)).map(r => mapApiBounty(r as Record<string, unknown>)),
    staleTime: 60_000,
    retry: false,
  });

  return {
    bounties,
    allBounties,
    total,
    filters,
    sortBy,
    loading,
    isFetching,
    page,
    totalPages,
    perPage: PER_PAGE,
    hotBounties: hotBountiesQuery.data ?? [],
    recommendedBounties: recommendedQuery.data ?? [],
    setFilter,
    resetFilters,
    setSortBy,
    setPage,
  };
}
