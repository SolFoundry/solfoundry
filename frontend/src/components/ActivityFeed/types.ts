export enum ActivityEventType {
  BOUNTY_CREATED = 'BOUNTY_CREATED',
  PR_SUBMITTED = 'PR_SUBMITTED',
  REVIEW_COMPLETED = 'REVIEW_COMPLETED',
  PAYOUT_SENT = 'PAYOUT_SENT'
}

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  title: string;
  description: string;
  timestamp: Date;
  user?: {
    id: string;
    username: string;
    avatar?: string;
  };
  bounty?: {
    id: string;
    title: string;
    reward: number;
    token: string;
  };
  amount?: number;
  score?: number;
  metadata?: Record<string, any>;
}

export interface ActivityEventConfig {
  icon: string;
  color: string;
  bgColor: string;
}

export interface ActivityFeedProps {
  events?: ActivityEvent[];
  maxEvents?: number;
  showLoadMore?: boolean;
  onLoadMore?: () => void;
  loading?: boolean;
  className?: string;
}

export interface MockActivityData {
  events: ActivityEvent[];
  users: Array<{
    id: string;
    username: string;
    avatar: string;
  }>;
  bounties: Array<{
    id: string;
    title: string;
    reward: number;
    token: string;
  }>;
}
