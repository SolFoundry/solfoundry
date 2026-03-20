export type ActivityEventType =
  | 'bounty_created'
  | 'pr_submitted'
  | 'review_completed'
  | 'payout_sent'
  | 'new_contributor';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  timestamp: string;
  data: {
    title?: string;
    user?: string;
    reward?: number;
    amount?: number;
    score?: number;
    bountyTitle?: string;
  };
}
