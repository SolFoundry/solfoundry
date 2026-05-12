import { useQuery } from '@tanstack/react-query';
import { listActivity } from '../api/activity';

export interface UseActivityEventsOptions {
  enabled?: boolean;
  limit?: number;
  refetchIntervalMs?: number;
}

export function useActivityEvents({
  enabled = true,
  limit = 4,
  refetchIntervalMs = 30_000,
}: UseActivityEventsOptions = {}) {
  return useQuery({
    queryKey: ['activity', limit],
    queryFn: () => listActivity({ limit }),
    enabled,
    refetchInterval: enabled ? refetchIntervalMs : false,
    staleTime: refetchIntervalMs,
    retry: false,
  });
}
