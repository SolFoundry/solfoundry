import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Bounty, BountyBoardFilters, BountySortBy, SearchResponse } from '../types/bounty';
import { DEFAULT_FILTERS } from '../types/bounty';
import api from '../services/api';

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
    creatorType: b.creator_type || b.creatorType || 'platform',
    githubIssueUrl: b.github_issue_url || b.githubIssueUrl || undefined,
    relevanceScore: b.relevance_score ?? 0,
    skillMatchCount: b.skill_match_count ?? 0,
  };
}

function buildSearchParams(
  filters: BountyBoardFilters,
  sortBy: BountySortBy,
  page: number,
  perPage: number,
): Record<string, any> {
  const p: Record<string, any> = {};
  if (filters.searchQuery.trim()) p.q = filters.searchQuery.trim();
  if (filters.tier !== 'all') {
    p.tier = filters.tier === 'T1' ? 1 : filters.tier === 'T2' ? 2 : 3;
  }
  if (filters.status !== 'all') {
    const map: Record<string, string> = {
      open: 'open',
      'in-progress': 'in_progress',
      completed: 'completed',
    };
    p.status = map[filters.status] || filters.status;
  }
  if (filters.skills.length) p.skills = filters.skills.join(',');
  if (filters.rewardMin) p.reward_min = filters.rewardMin;
  if (filters.rewardMax) p.reward_max = filters.rewardMax;
  if (filters.creatorType !== 'all') p.creator_type = filters.creatorType;
  if (filters.category !== 'all') p.category = filters.category;
  if (filters.deadlineBefore) {
    p.deadline_before = new Date(filters.deadlineBefore + 'T23:59:59Z').toISOString();
  }
  p.sort = sortBy;
  p.page = page;
  p.per_page = perPage;
  return p;
}

export function useBountyBoard() {
  const [filters, setFilters] = useState<BountyBoardFilters>(DEFAULT_FILTERS);
  const [sortBy, setSortByRaw] = useState<BountySortBy>('newest');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const setSortBy = useCallback((s: BountySortBy | string) => {
    setSortByRaw(s as BountySortBy);
    setPage(1);
  }, []);

  const setFilter = useCallback(
    <K extends keyof BountyBoardFilters>(k: K, v: BountyBoardFilters[K]) => {
      setFilters((p) => ({ ...p, [k]: v }));
      setPage(1);
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  // Main Search Query
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['bounties', filters, sortBy, page],
    queryFn: async (): Promise<SearchResponse> => {
      const params = buildSearchParams(filters, sortBy, page, perPage);
      const { data } = await api.get('/bounties/search', { params });
      return {
        ...data,
        items: data.items.map(mapApiBounty),
      };
    },
  });

  // Hot Bounties
  const { data: hotBounties = [] } = useQuery({
    queryKey: ['bounties', 'hot'],
    queryFn: async (): Promise<Bounty[]> => {
      const { data } = await api.get('/bounties/hot', { params: { limit: 6 } });
      return data.map(mapApiBounty);
    },
  });

  // Recommended Bounties
  const { data: recommendedBounties = [] } = useQuery({
    queryKey: ['bounties', 'recommended', filters.skills],
    queryFn: async (): Promise<Bounty[]> => {
      const skills = filters.skills.length > 0 ? filters.skills : ['react', 'typescript', 'rust'];
      const { data } = await api.get('/bounties/recommended', {
        params: { skills: skills.join(','), limit: 6 },
      });
      return data.map(mapApiBounty);
    },
  });

  const bounties = searchData?.items || [];
  const total = searchData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return {
    bounties,
    total,
    filters,
    sortBy,
    loading: searchLoading,
    page,
    totalPages,
    hotBounties,
    recommendedBounties,
    setFilter,
    resetFilters,
    setSortBy,
    setPage,
  };
}
