/**
 * Bounty fetching via apiClient + React Query with search, URL sync, and fallback.
 * @module hooks/useBountyBoard
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Bounty, BountyBoardFilters, BountySortBy, SearchResponse, BountyTier, BountyStatus, BountyCategory } from '../types/bounty';
import { DEFAULT_FILTERS, normalizeBountyCategory } from '../types/bounty';
import { apiClient } from '../services/apiClient';

export const PER_PAGE = 12;

const TIER_MAP: Record<number, 'T1' | 'T2' | 'T3'> = { 1: 'T1', 2: 'T2', 3: 'T3' };
const STATUS_MAP: Record<string, BountyStatus> = {
  open: 'open',
  in_progress: 'in-progress',
  under_review: 'under_review',
  completed: 'completed',
  disputed: 'disputed',
  paid: 'paid',
  cancelled: 'cancelled',
};

const SORT_COMPAT: Record<string, BountySortBy> = { reward: 'reward_high' };

const VALID_TIERS = new Set<string>(['all', 'T1', 'T2', 'T3']);
const VALID_STATUSES = new Set<string>(['all', 'open', 'in-progress', 'under_review', 'completed', 'disputed', 'paid', 'cancelled']);
const VALID_CATEGORIES = new Set<string>(['all', 'smart-contract', 'frontend', 'backend', 'design', 'content', 'security', 'devops', 'documentation']);
const VALID_SORTS = new Set<string>([
  'newest',
  'oldest',
  'reward_high',
  'reward_low',
  'tier_high',
  'deadline',
  'submissions',
  'best_match',
]);

/** Parse URLSearchParams into partial filter + sort + page state. */
function parseUrlParams(params: URLSearchParams): Partial<BountyBoardFilters> & { sortBy?: BountySortBy; page?: number } {
  const result: Partial<BountyBoardFilters> & { sortBy?: BountySortBy; page?: number } = {};
  const q = params.get('q');
  if (q) result.searchQuery = q;
  const tier = params.get('tier');
  if (tier && VALID_TIERS.has(tier)) result.tier = tier as BountyTier | 'all';
  const status = params.get('status');
  if (status && VALID_STATUSES.has(status)) result.status = status as BountyStatus | 'all';
  const category = params.get('category');
  if (category && VALID_CATEGORIES.has(category)) result.category = category as BountyCategory | 'all';
  const creatorType = params.get('creator_type');
  if (creatorType && ['all', 'platform', 'community'].includes(creatorType)) {
    result.creatorType = creatorType as 'all' | 'platform' | 'community';
  }
  const skills = params.get('skills');
  if (skills) result.skills = skills.split(',').filter(Boolean);
  const rewardMin = params.get('reward_min');
  if (rewardMin) result.rewardMin = rewardMin;
  const rewardMax = params.get('reward_max');
  if (rewardMax) result.rewardMax = rewardMax;
  const deadlineBefore = params.get('deadline_before');
  if (deadlineBefore) result.deadlineBefore = deadlineBefore;
  const sort = params.get('sort');
  if (sort && VALID_SORTS.has(sort)) result.sortBy = sort as BountySortBy;
  const page = params.get('page');
  const pageNum = Number(page);
  if (page && Number.isFinite(pageNum) && pageNum > 0) result.page = pageNum;
  return result;
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
    category: normalizeBountyCategory(
      raw.category != null ? String(raw.category) : undefined,
    ),
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

const tierRank: Record<string, number> = { T1: 1, T2: 2, T3: 3 };

/** Sort bounties by the given field, returning a new sorted array. */
function localSort(bounties: Bounty[], sortBy: BountySortBy): Bounty[] {
  const sorted = [...bounties];
  switch (sortBy) {
    case 'reward_high': return sorted.sort((left, right) => right.rewardAmount - left.rewardAmount);
    case 'reward_low': return sorted.sort((left, right) => left.rewardAmount - right.rewardAmount);
    case 'tier_high':
      return sorted.sort(
        (left, right) => (tierRank[right.tier] ?? 0) - (tierRank[left.tier] ?? 0),
      );
    case 'deadline': return sorted.sort((left, right) => new Date(left.deadline).getTime() - new Date(right.deadline).getTime());
    case 'submissions': return sorted.sort((left, right) => right.submissionCount - left.submissionCount);
    case 'oldest': return sorted.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
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
  if (activeFilters.category !== 'all') {
    results = results.filter(bounty => bounty.category === activeFilters.category);
  }
  if (activeFilters.searchQuery.trim()) {
    const query = activeFilters.searchQuery.toLowerCase();
    results = results.filter(bounty =>
      bounty.title.toLowerCase().includes(query) ||
      bounty.description.toLowerCase().includes(query) ||
      bounty.projectName.toLowerCase().includes(query) ||
      bounty.skills.some(skill => skill.toLowerCase().includes(query))
    );
  }
  if (activeFilters.rewardMin) { const minReward = Number(activeFilters.rewardMin); if (!isNaN(minReward)) results = results.filter(bounty => bounty.rewardAmount >= minReward); }
  if (activeFilters.rewardMax) { const maxReward = Number(activeFilters.rewardMax); if (!isNaN(maxReward)) results = results.filter(bounty => bounty.rewardAmount <= maxReward); }
  if (activeFilters.deadlineBefore) {
    const cutoff = new Date(activeFilters.deadlineBefore + 'T23:59:59Z').getTime();
    results = results.filter(bounty => new Date(bounty.deadline).getTime() <= cutoff);
  }
  return localSort(results, sortBy);
}

/** Bounty board hook with React Query caching, server-side search, URL sync, and client-side fallback. */
export function useBountyBoard() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<BountyBoardFilters>(() => {
    const urlState = parseUrlParams(searchParams);
    return { ...DEFAULT_FILTERS, ...urlState };
  });

  const [sortBy, setSortByRaw] = useState<BountySortBy>(() => {
    const { sortBy: urlSort } = parseUrlParams(searchParams);
    if (!urlSort) return 'newest';
    return (SORT_COMPAT[urlSort] || urlSort) as BountySortBy;
  });

  const [page, setPageRaw] = useState<number>(() => {
    const { page: urlPage } = parseUrlParams(searchParams);
    return urlPage ?? 1;
  });

  const searchAvailableRef = useRef(true);
  const isSyncingFromUrl = useRef(false);

  // Sync filters / sort / page → URL (replace history so back button works naturally)
  useEffect(() => {
    if (isSyncingFromUrl.current) return;
    const params: Record<string, string> = {};
    if (filters.searchQuery.trim()) params.q = filters.searchQuery.trim();
    if (filters.tier !== 'all') params.tier = filters.tier;
    if (filters.status !== 'all') params.status = filters.status;
    if (filters.category !== 'all') params.category = filters.category;
    if (filters.creatorType !== 'all') params.creator_type = filters.creatorType;
    if (filters.skills.length) params.skills = filters.skills.join(',');
    if (filters.rewardMin) params.reward_min = filters.rewardMin;
    if (filters.rewardMax) params.reward_max = filters.rewardMax;
    if (filters.deadlineBefore) params.deadline_before = filters.deadlineBefore;
    if (sortBy !== 'newest') params.sort = sortBy;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [filters, sortBy, page, setSearchParams]);

  // Sync URL → state for back/forward navigation and programmatic URL changes
  useEffect(() => {
    const urlState = parseUrlParams(searchParams);
    const urlSort = urlState.sortBy ? (SORT_COMPAT[urlState.sortBy] || urlState.sortBy) as BountySortBy : 'newest';
    const urlPage = urlState.page ?? 1;
    const { sortBy: _urlSortField, page: _urlPageField, ...filterFromUrl } = urlState;
    const urlFilters = { ...DEFAULT_FILTERS, ...filterFromUrl };

    let changed = false;
    if (urlPage !== page) { changed = true; setPageRaw(urlPage); }
    if (urlSort !== sortBy) { changed = true; setSortByRaw(urlSort); }
    const skillKey = (s: string[]) => [...s].sort().join('\0');
    const filtersOutOfSync =
      urlFilters.searchQuery !== filters.searchQuery ||
      urlFilters.tier !== filters.tier ||
      urlFilters.status !== filters.status ||
      urlFilters.category !== filters.category ||
      urlFilters.creatorType !== filters.creatorType ||
      urlFilters.rewardMin !== filters.rewardMin ||
      urlFilters.rewardMax !== filters.rewardMax ||
      urlFilters.deadlineBefore !== filters.deadlineBefore ||
      skillKey(urlFilters.skills) !== skillKey(filters.skills);

    if (filtersOutOfSync) {
      changed = true;
      setFilters(urlFilters);
    }
    if (changed) {
      isSyncingFromUrl.current = true;
      queueMicrotask(() => { isSyncingFromUrl.current = false; });
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPage = useCallback((p: number) => {
    setPageRaw(p);
  }, []);

  const setSortBy = useCallback((sortField: BountySortBy | string) => {
    const resolved = (SORT_COMPAT[sortField] || sortField) as BountySortBy;
    setSortByRaw(resolved);
    setPageRaw(1);
  }, []);

  const setFilter = useCallback(<K extends keyof BountyBoardFilters>(key: K, value: BountyBoardFilters[K]) => {
    setFilters((prev: BountyBoardFilters) => ({ ...prev, [key]: value }));
    setPageRaw(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSortByRaw('newest');
    setPageRaw(1);
  }, []);

  // Server-side search via React Query
  const searchQuery = useQuery({
    queryKey: ['bounties', 'search', filters, sortBy, page],
    queryFn: async () => {
      const params = buildApiParams(filters, sortBy, page);
      const data = await apiClient<SearchResponse>(`/api/bounties/search?${params}`);
      return { items: data.items.map(item => mapApiBounty(item as unknown as Record<string, unknown>)), total: data.total };
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
      const data = await apiClient<{ items?: unknown[] }>('/api/bounties?limit=10000');
      const items = (data.items || data) as unknown[];
      return Array.isArray(items) ? items.map(item => mapApiBounty(item as Record<string, unknown>)) : [];
    },
    enabled: !searchAvailableRef.current,
    staleTime: 60_000,
  });

  const allBounties = fallbackQuery.data ?? [];
  const localFiltered = useMemo(() => applyLocalFilters(allBounties, filters, sortBy), [allBounties, filters, sortBy]);

  const localPaginated = useMemo(() => {
    const safePage = Math.max(1, Math.min(page, Math.max(1, Math.ceil(localFiltered.length / PER_PAGE) || 1)));
    const start = (safePage - 1) * PER_PAGE;
    return localFiltered.slice(start, start + PER_PAGE);
  }, [localFiltered, page]);

  const bounties = (searchAvailableRef.current && searchQuery.data) ? searchQuery.data.items : localPaginated;
  const total = (searchAvailableRef.current && searchQuery.data) ? searchQuery.data.total : localFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const loading = searchQuery.isLoading || fallbackQuery.isLoading;
  const isFetching = searchQuery.isFetching;

  // Synchronously clamp page so consumers never see an out-of-range value
  const clampedPage = loading ? page : Math.max(1, Math.min(page, totalPages));

  // Reconcile state when page exceeds totalPages (e.g. after filter change reduces results)
  useEffect(() => {
    if (!loading && page > totalPages && totalPages > 0) {
      setPageRaw(totalPages);
    }
  }, [page, totalPages, loading]);

  // Hot bounties (fetched once)
  const hotBountiesQuery = useQuery({
    queryKey: ['bounties', 'hot'],
    queryFn: async () => (await apiClient<unknown[]>('/api/bounties/hot?limit=6')).map(item => mapApiBounty(item as Record<string, unknown>)),
    staleTime: 60_000,
    retry: false,
  });

  // Recommended bounties (skill-based)
  const skillsKey = filters.skills.length > 0 ? filters.skills : ['react', 'typescript', 'rust'];
  const recommendedQuery = useQuery({
    queryKey: ['bounties', 'recommended', skillsKey],
    queryFn: async () => (await apiClient<unknown[]>(`/api/bounties/recommended?skills=${encodeURIComponent(skillsKey.join(','))}&limit=6`)).map(item => mapApiBounty(item as Record<string, unknown>)),
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
    page: clampedPage,
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
