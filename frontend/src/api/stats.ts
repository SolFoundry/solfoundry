import { apiClient } from '../services/apiClient';
import type { PlatformStats } from '../types/leaderboard';

export async function getPlatformStats(): Promise<PlatformStats> {
  const response = await apiClient<PlatformStats | Record<string, unknown>>('/api/stats');
  // Normalize response shape
  const r = response as Record<string, unknown>;
  return {
    open_bounties: (r.open_bounties as number) ?? (r.active_bounties as number) ?? 0,
    total_paid_usdc: (r.total_paid_usdc as number) ?? (r.total_rewards_paid as number) ?? 0,
    total_contributors: (r.total_contributors as number) ?? (r.contributors as number) ?? 0,
    total_bounties: (r.total_bounties as number) ?? 0,
  };
}
