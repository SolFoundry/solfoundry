import { apiClient } from '../services/apiClient';
import type { PlatformStats } from '../types/leaderboard';

export async function getPlatformStats(): Promise<PlatformStats> {
export async function getPlatformStats(): Promise<PlatformStats> {
  const response = await apiClient<PlatformStats | Record<string, unknown>>('/api/stats');
  if (!response) {
    throw new Error('Invalid response from API');
  }
  const r = response as Record<string, unknown>;
  if (typeof r !== 'object' || r === null) {
    throw new Error('Invalid response shape');
  }
  return {
    open_bounties: typeof r.open_bounties === 'number' ? r.open_bounties : typeof r.active_bounties === 'number' ? r.active_bounties : 0,
    total_paid_usdc: typeof r.total_paid_usdc === 'number' ? r.total_paid_usdc : typeof r.total_rewards_paid === 'number' ? r.total_rewards_paid : 0,
    total_contributors: typeof r.total_contributors === 'number' ? r.total_contributors : typeof r.contributors === 'number' ? r.contributors : 0,
    total_bounties: typeof r.total_bounties === 'number' ? r.total_bounties : 0,
  };
}
