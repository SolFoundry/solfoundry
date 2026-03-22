/**
 * Bounty fetching via apiClient + React Query with search and fallback.
 * @module hooks/useBountyBoard
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Bounty, BountyBoardFilters, BountySortBy, SearchResponse } from '../types/bounty';
import { DEFAULT_FILTERS } from '../types/bounty';
import { apiClient } from '../services/apiClient';

/** Read initial filter values from the current URL search params. */
function readFiltersFromURL(): Partial<BountyBoardFilters> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const partial: Partial<BountyBoardFilters> = {};
  const q = params.get('q');
  if (q) partial.searchQuery = q;
  const tier = params.get('tier');
  if (tier === 'T1' || tier === 'T2' || tier === 'T3') partial.tier = tier;
  const status = params.get('status');
  if (status) partial.status = status as BountyBoardFilters['status'];
  const skills = params.get('skills');
  if (skills) partial.skills = skills.split(',').filter(Boolean);
  const rewardMin = params.get('reward_min');
  if (rewardMin) partial.rewardMin = rewardMin;
  const rewardMax = params.get('reward_max');
  if (rewardMax) partial.rewardMax = rewardMax;
  const creatorType = params.get('creator_type');
  if (creatorType) partial.creatorType = creatorType as BountyBoardFilters['creatorType'];
  const category = params.get('category');
  if (category) partial.category = category as BountyBoardFilters['category'];
  const deadlineBefore = params.get('deadline_before');
  if (deadlineBefore) partial.deadlineBefore = deadlineBefore;
  return partial;
}

/** Sync current filters back to the URL without triggering a navigation. */
function syncFiltersToURL(filters: BountyBoardFilters): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();
  if (filters.searchQuery.trim()) params.set('q', filters.searchQuery.trim());
  if (filters.tier !== 'all') params.set('tier', filters.tier);
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.skills.length) params.set('skills', filters.skills.join(','));
  if (filters.rewardMin) params.set('reward_min', filters.rewardMin);
  if (filters.rewardMax) params.set('reward_max', filters.rewardMax);
  if (filters.creatorType !== 'all') params.set('creator_type', filters.creatorType);
  if (filters.category !== 'all') params.set('category', filters.category);
  if (filters.deadlineBefore) params.set('deadline_before', filters.deadlineBefore);
  const newSearch = params.toString();
  const url = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

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

/** Build URLSearchParams from current filters, sort, and pagination. */
function buildSearchParams(
  filters: BountyBoardFilters, sortBy: BountySortBy, page: number, perPage: number,
): URLSearchParams {
  const searchParams = new URLSearchParams();
  if (filters.searchQuery.trim()) searchParams.set('q', filters.searchQuery.trim());
  if (filters.tier !== 'all') {
    const tierNum = filters.tier === 'T1' ? '1' : filters.tier === 'T2' ? '2' : '3';
    searchParams.set('tier', tierNum);
  }
  if (filters.status !== 'all') {
    const statusMap: Record<string, string> = { open: 'open', 'in-progress': 'in_progress', completed: 'completed' };
    searchParams.set('status', statusMap[filters.status] || filters.status);
  }
  if (filters.skills.length) searchParams.set('skills', filters.skills.join(','));
  if (filters.rewardMin) searchParams.set('reward_min', filters.rewardMin);
  if (filters.rewardMax) searchParams.set('reward_max', filters.rewardMax);
  if (filters.creatorType !== 'all') searchParams.set('creator_type', filters.creatorType);
  if (filters.category !== 'all') searchParams.set('category', filters.category);
  if (filters.deadlineBefore) searchParams.set('deadline_before', new Date(filters.deadlineBefore + 'T23:59:59Z').toISOString());
  searchParams.set('sort', sortBy);
  searchParams.set('page', String(page));
  searchParams.set('per_page', String(perPage));
  return searchParams;
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

/** Bounty board hook with React Query caching, server-side search, and client-side fallback. */
export function useBountyBoard() {
  const [filters, setFilters] = useState<BountyBoardFilters>(() => ({
    ...DEFAULT_FILTERS,
    ...readFiltersFromURL(),
  }));
  const [sortBy, setSortByRaw] = useState<BountySortBy>('newest');
  const [page, setPage] = useState(1);
  const perPage = 20;
  const searchAvailableRef = useRef(true);

  // Sync filter state to URL whenever filters change
  useEffect(() => {
    syncFiltersToURL(filters);
  }, [filters]);

  const setSortBy = useCallback((sortField: BountySortBy | string) => {
    setSortByRaw((SORT_COMPAT[sortField] || sortField) as BountySortBy);
    setPage(1);
  }, []);

  // Server-side search via React Query
  const searchQuery = useQuery({
    queryKey: ['bounties', 'search', filters, sortBy, page],
    queryFn: async () => {
      const params = buildSearchParams(filters, sortBy, page, perPage);
      const data = await apiClient<SearchResponse>(`/api/bounties/search?${params}`);
      return { items: data.items.map(mapApiBounty), total: data.total };
    },
    enabled: searchAvailableRef.current,
    retry: false,
    staleTime: 15_000,
  });

  if (searchQuery.isError && searchAvailableRef.current) searchAvailableRef.current = false;

  // Fallback: full bounty list when search endpoint is down
  const fallbackQuery = useQuery({
    queryKey: ['bounties', 'all'],
    queryFn: async () => {
      const data = await apiClient<{ items?: unknown[] }>('/api/bounties?limit=100');
      const items = (data.items || data) as unknown[];
      return Array.isArray(items) ? items.map(mapApiBounty) : [];
    },
    enabled: !searchAvailableRef.current,
    staleTime: 60_000,
  });

  const allBounties = fallbackQuery.data ?? [];
  const localFiltered = useMemo(() => applyLocalFilters(allBounties, filters, sortBy), [allBounties, filters, sortBy]);
  const bounties = searchQuery.data ? searchQuery.data.items : localFiltered;
  const total = searchQuery.data ? searchQuery.data.total : localFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const loading = searchQuery.isLoading || fallbackQuery.isLoading;

  // Hot bounties (fetched once)
  const hotBountiesQuery = useQuery({
    queryKey: ['bounties', 'hot'],
    queryFn: async () => (await apiClient<unknown[]>('/api/bounties/hot?limit=6')).map(mapApiBounty),
    staleTime: 60_000,
    retry: false,
  });

  // Recommended bounties (skill-based)
  const skillsKey = filters.skills.length > 0 ? filters.skills : ['react', 'typescript', 'rust'];
  const recommendedQuery = useQuery({
    queryKey: ['bounties', 'recommended', skillsKey],
    queryFn: async () => (await apiClient<unknown[]>(`/api/bounties/recommended?skills=${encodeURIComponent(skillsKey.join(','))}&limit=6`)).map(mapApiBounty),
    staleTime: 60_000,
    retry: false,
  });

  const setFilter = useCallback(<K extends keyof BountyBoardFilters>(key: K, value: BountyBoardFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
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
    hotBounties: hotBountiesQuery.data ?? [],
    recommendedBounties: recommendedQuery.data ?? [],
    setFilter,
    resetFilters: useCallback(() => { setFilters(DEFAULT_FILTERS); setPage(1); }, []),
    setSortBy,
    setPage,
  };
}
