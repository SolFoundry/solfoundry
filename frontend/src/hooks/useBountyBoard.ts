import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Bounty, BountyBoardFilters } from '../types/bounty';
import { DEFAULT_FILTERS } from '../types/bounty';

export const PER_PAGE = 12;

export type SortOption = 'newest' | 'oldest' | 'reward_high' | 'reward_low' | 'tier_high';
const VALID_SORTS: SortOption[] = ['newest', 'oldest', 'reward_high', 'reward_low', 'tier_high'];

function mapApiBounty(raw: Record<string, unknown>): Bounty {
  return {
    id: raw.id as string,
    title: raw.title as string,
    description: (raw.description as string) ?? '',
    status: (raw.status as Bounty['status']) ?? 'open',
    tier: (raw.tier as Bounty['tier']) ?? 'T1',
    skills: (raw.required_skills as string[]) ?? (raw.skills as string[]) ?? [],
    rewardAmount: (raw.reward_amount as number) ?? (raw.rewardAmount as number) ?? 0,
    currency: ((raw.currency ?? (raw.reward_token === 'FNDRY' ? 'FNDRY' : 'USDC')) as 'USDC' | 'FNDRY'),
    deadline: (raw.deadline as string | null) ?? null,
    submissionCount: (raw.submission_count as number) ?? (raw.submissionCount as number) ?? 0,
    createdAt: (raw.created_at as string) ?? (raw.createdAt as string) ?? '',
    projectName:
      (raw.project_name as string) ??
      (raw.projectName as string) ??
      (raw.created_by as string) ??
      '',
    creatorType:
      ((raw.creator_type ?? raw.creatorType) as 'community' | 'platform') ?? 'platform',
    category: (raw.category as string) ?? null,
    reward_amount: (raw.reward_amount as number) ?? 0,
    reward_token: ((raw.reward_token as string) ?? 'USDC') as Bounty['reward_token'],
    submission_count: (raw.submission_count as number) ?? 0,
    created_at: (raw.created_at as string) ?? '',
    github_issue_url: null,
    github_repo_url: null,
    org_name: null,
    repo_name: null,
    org_avatar_url: null,
    issue_number: null,
    creator_id: null,
    creator_username: null,
    has_repo: false,
  };
}

export interface UseBountyBoardReturn {
  bounties: Bounty[];
  loading: boolean;
  error: unknown;
  filters: BountyBoardFilters;
  sortBy: SortOption;
  page: number;
  totalPages: number;
  total: number;
  setFilter: (key: keyof BountyBoardFilters, value: unknown) => void;
  setSortBy: (sort: SortOption) => void;
  setPage: (page: number) => void;
  resetFilters: () => void;
}

export function useBountyBoard(): UseBountyBoardReturn {
  const [searchParams] = useSearchParams();

  const [page, setPageState] = useState<number>(() => {
    const p = Number(searchParams.get('page'));
    return Number.isInteger(p) && p > 0 ? p : 1;
  });

  const [sortBy, setSortByState] = useState<SortOption>(() => {
    const s = searchParams.get('sort') as SortOption;
    return VALID_SORTS.includes(s) ? s : 'newest';
  });

  const [filters, setFiltersState] = useState<BountyBoardFilters>({ ...DEFAULT_FILTERS });

  const setFilter = (key: keyof BountyBoardFilters, value: unknown) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }));
    setPageState(1);
  };

  const setSortBy = (sort: SortOption) => setSortByState(sort);

  const resetFilters = () => {
    setFiltersState({ ...DEFAULT_FILTERS });
    setPageState(1);
  };

  const buildSearchUrl = () => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(PER_PAGE),
      sort: sortBy,
    });
    if (filters.category !== 'all') params.set('category', filters.category);
    if (filters.tier && filters.tier !== 'all') {
      const tierNum: Record<string, string> = { T1: '1', T2: '2', T3: '3' };
      const n = tierNum[filters.tier];
      if (n) params.set('tier', n);
    }
    if (filters.skills.length > 0) params.set('skills', filters.skills.join(','));
    if (filters.deadlineBefore) params.set('deadline_before', filters.deadlineBefore);
    return `/api/bounties/search?${params}`;
  };

  const searchQuery = useQuery({
    queryKey: ['bounty-board-search', filters, sortBy, page],
    queryFn: async () => {
      const res = await fetch(buildSearchUrl());
      if (!res.ok) return { items: [] as Record<string, unknown>[], total: 0 };
      const data = (await res.json()) as { items: Record<string, unknown>[]; total: number };
      return data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  // Supplementary feeds (hot + recommended) — results not used directly
  useQuery({
    queryKey: ['bounty-board-hot'],
    queryFn: async () => {
      const res = await fetch('/api/bounties/hot');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  useQuery({
    queryKey: ['bounty-board-recommended'],
    queryFn: async () => {
      const res = await fetch('/api/bounties/recommended');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  const rawItems = searchQuery.data?.items ?? [];
  const total = searchQuery.data?.total ?? 0;
  const bounties = rawItems.map(mapApiBounty);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return {
    bounties,
    loading: searchQuery.isLoading,
    error: searchQuery.error,
    filters,
    sortBy,
    page,
    totalPages,
    total,
    setFilter,
    setSortBy,
    setPage: setPageState,
    resetFilters,
  };
}
