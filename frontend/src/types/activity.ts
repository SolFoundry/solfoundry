export type ActivityEventType = 'completed' | 'submitted' | 'posted' | 'review' | 'payout';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}
