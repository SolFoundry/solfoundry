import { useQuery } from '@tanstack/react-query';
import { fetchFndryPrice } from '../api/fndryPrice';

export function useFndryPrice() {
  return useQuery({
    queryKey: ['fndry-price'],
    queryFn: fetchFndryPrice,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  });
}
