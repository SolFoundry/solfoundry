import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { listBounties, getBounty } from '../api/bounties';
import type { BountiesListParams } from '../api/bounties';

/**
 * Single-page query hook for fetching bounties with the given filter params.
 * Caches results for 30 seconds.
 * @param params - Filter params such as status, skill, tier, etc.
 */
export function useBounties(params?: BountiesListParams) {
  return useQuery({
    queryKey: ['bounties', params],
    queryFn: () => listBounties(params),
    staleTime: 30_000,
  });
}

/**
 * Infinite-query hook for paginated bounty lists with optional server-side search.
 * @param params - Filter params (status, skill, tier, etc.); optionally includes query for server-side text search.
 * @returns Infinite query result yielding pages of bounty items with total count.
 */
export function useInfiniteBounties(params?: Omit<BountiesListParams, 'offset'> & { query?: string }) {
  return useInfiniteQuery({
    queryKey: ['bounties-infinite', params],
    queryFn: ({ pageParam = 0 }) =>
      listBounties({ ...params, offset: pageParam as number, limit: 12 }),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, p) => sum + p.items.length, 0);
      if (loaded >= (lastPage.total ?? 0)) return undefined;
      return loaded;
    },
    initialPageParam: 0,
    staleTime: 30_000,
  });
}

/**
 * Single-page query hook for fetching a single bounty by ID.
 * @param id - The bounty ID; query is disabled when id is undefined.
 */
export function useBounty(id: string | undefined) {
  return useQuery({
    queryKey: ['bounty', id],
    queryFn: () => getBounty(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}
