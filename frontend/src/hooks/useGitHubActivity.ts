import { useQuery } from '@tanstack/react-query';
import { fetchGitHubActivity } from '../api/github';

export function useGitHubActivity(username: string | null | undefined, rangeDays: number = 90) {
  return useQuery({
    queryKey: ['github-activity', username, rangeDays],
    queryFn: () => fetchGitHubActivity(username ?? '', rangeDays),
    enabled: !!username,
    staleTime: 5 * 60_000,
  });
}
