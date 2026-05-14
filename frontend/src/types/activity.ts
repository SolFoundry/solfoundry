/**
 * Activity event types for the real-time WebSocket activity feed.
 * Covers platform-level events (bounty lifecycle, submissions, reviews)
 * and on-chain events (escrow, reputation changes).
 *
 * @module types/activity
 */

/* ─── Activity Event Types ─── */

/** Platform-level activity event types. */
export type ActivityEventType =
  | 'BOUNTY_CREATED'
  | 'BOUNTY_FUNDED'
  | 'SUBMISSION_MADE'
  | 'REVIEW_COMPLETED'
  | 'LEADERBOARD_CHANGE';

/** On-chain event types (from Solana program account changes). */
export type OnChainEventType =
  | 'escrow_created'
  | 'escrow_released'
  | 'escrow_refunded'
  | 'reputation_updated'
  | 'review_fee_paid';

/** All event types the feed can display. */
export type FeedEventType = ActivityEventType | OnChainEventType;

/* ─── Activity Event ─── */

export interface ActivityEvent {
  id: string;
  type: FeedEventType;
  /** Human-readable title for the event (e.g. "Bounty Created"). */
  title: string;
  /** Longer description or detail line. */
  description?: string;
  /** Username of the actor (if applicable). */
  username?: string | null;
  /** Avatar URL for the actor. */
  avatar_url?: string | null;
  /** Bounty ID this event relates to (if applicable). */
  bounty_id?: string | null;
  /** Bounty title this event relates to (if applicable). */
  bounty_title?: string | null;
  /** Token amount involved (raw, e.g. lamports). */
  amount?: number | null;
  /** ISO timestamp of when the event occurred. */
  timestamp: string;
  /** Source of the event — 'ws' for WebSocket, 'poll' for polling, 'chain' for on-chain. */
  source: 'ws' | 'poll' | 'chain';
  /** Transaction signature for on-chain events. */
  tx_signature?: string | null;
}

/* ─── Indexed On-Chain Event (from indexer API) ─── */

export interface IndexedEvent {
  id: string;
  transaction_signature: string;
  log_index: number;
  event_type: OnChainEventType;
  program_id: string;
  block_slot: number;
  block_time: string;
  source: string;
  accounts: Record<string, string>;
  data: Record<string, unknown>;
  user_wallet: string | null;
  bounty_id: string | null;
  amount: number | null;
  status: string;
  indexed_at: string;
}

/* ─── Indexer Health ─── */

export interface IndexerSourceHealth {
  source: string;
  is_healthy: boolean;
  events_processed: number;
}

export interface IndexerHealth {
  sources: IndexerSourceHealth[];
  overall_healthy: boolean;
}

/* ─── Notification Preferences ─── */

export interface NotificationPreferences {
  BOUNTY_CREATED: boolean;
  BOUNTY_FUNDED: boolean;
  SUBMISSION_MADE: boolean;
  REVIEW_COMPLETED: boolean;
  LEADERBOARD_CHANGE: boolean;
  escrow_created: boolean;
  escrow_released: boolean;
  reputation_updated: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  BOUNTY_CREATED: true,
  BOUNTY_FUNDED: true,
  SUBMISSION_MADE: true,
  REVIEW_COMPLETED: true,
  LEADERBOARD_CHANGE: false,
  escrow_created: true,
  escrow_released: true,
  reputation_updated: false,
};

/* ─── Connection State ─── */

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'polling';

/* ─── Label helpers ─── */

const ACTIVITY_LABELS: Record<FeedEventType, string> = {
  BOUNTY_CREATED: 'Bounty Created',
  BOUNTY_FUNDED: 'Bounty Funded',
  SUBMISSION_MADE: 'Submission Made',
  REVIEW_COMPLETED: 'Review Completed',
  LEADERBOARD_CHANGE: 'Leaderboard Change',
  escrow_created: 'Escrow Created',
  escrow_released: 'Escrow Released',
  escrow_refunded: 'Escrow Refunded',
  reputation_updated: 'Reputation Updated',
  review_fee_paid: 'Review Fee Paid',
};

export function getEventLabel(type: FeedEventType): string {
  return ACTIVITY_LABELS[type] ?? type;
}

const EVENT_ICONS: Record<FeedEventType, string> = {
  BOUNTY_CREATED: 'PlusCircle',
  BOUNTY_FUNDED: 'Wallet',
  SUBMISSION_MADE: 'GitPullRequest',
  REVIEW_COMPLETED: 'CheckCircle',
  LEADERBOARD_CHANGE: 'Trophy',
  escrow_created: 'Lock',
  escrow_released: 'Unlock',
  escrow_refunded: 'RotateCcw',
  reputation_updated: 'Star',
  review_fee_paid: 'Receipt',
};

export function getEventIcon(type: FeedEventType): string {
  return EVENT_ICONS[type] ?? 'Activity';
}
