import { apiClient } from '../services/apiClient';

export interface ActivityEvent {
  id: string;
  type: 'bounty_completed' | 'pr_submitted' | 'payout_sent' | 'bounty_created' | 'pr_merged';
  username: string;
  avatar_url: string | null;
  bounty_title: string;
  amount?: string;
  pr_number?: number;
  created_at: string;
}

export interface ActivityFeedResponse {
  events: ActivityEvent[];
  total: number;
  has_more: boolean;
}

export async function fetchActivity(since?: string): Promise<ActivityFeedResponse> {
  const params = since ? `?since=${encodeURIComponent(since)}` : '';
  return apiClient<ActivityFeedResponse>(`/api/activity${params}`);
}
