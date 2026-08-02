import { useQuery } from '@tanstack/react-query';
import { getGitHubActivity, computeGitHubStats } from '../api/github';
import type { GitHubActivityEvent, GitHubStats } from '../api/github';

interface GitHubActivityResult {
  events: GitHubActivityEvent[];
  stats: GitHubStats;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Hook to fetch and compute GitHub activity for a user.
 */
export function useGitHubActivity(username: string | null | undefined): GitHubActivityResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['github-activity', username],
    queryFn: () => getGitHubActivity(username!),
    enabled: !!username,
    staleTime: 5 * 60_000,   // 5 min cache
    retry: 1,
  });

  const events = data ?? [];
  const stats = computeGitHubStats(events);

  return { events, stats, isLoading, isError };
}