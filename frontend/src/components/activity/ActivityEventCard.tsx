import React from 'react';
import { motion } from 'framer-motion';
import {
  PlusCircle,
  Wallet,
  GitPullRequest,
  CheckCircle,
  Trophy,
  Lock,
  Unlock,
  RotateCcw,
  Star,
  Receipt,
  Activity,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ActivityEvent, FeedEventType } from '../../types/activity';
import { getEventLabel } from '../../types/activity';

/* ─── Icon mapping ─── */

const ICON_MAP: Record<string, React.ElementType> = {
  PlusCircle,
  Wallet,
  GitPullRequest,
  CheckCircle,
  Trophy,
  Lock,
  Unlock,
  RotateCcw,
  Star,
  Receipt,
  Activity,
};

const EVENT_COLORS: Record<FeedEventType, string> = {
  BOUNTY_CREATED: 'text-emerald',
  BOUNTY_FUNDED: 'text-emerald',
  SUBMISSION_MADE: 'text-blue-400',
  REVIEW_COMPLETED: 'text-amber-400',
  LEADERBOARD_CHANGE: 'text-purple-400',
  escrow_created: 'text-emerald',
  escrow_released: 'text-amber-400',
  escrow_refunded: 'text-red-400',
  reputation_updated: 'text-purple-400',
  review_fee_paid: 'text-text-muted',
};

/* ─── Helpers ─── */

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/* ─── Component ─── */

interface ActivityEventCardProps {
  event: ActivityEvent;
}

export function ActivityEventCard({ event }: ActivityEventCardProps) {
  const Icon = ICON_MAP[getEventIconName(event.type)] ?? Activity;
  const colorClass = EVENT_COLORS[event.type] ?? 'text-text-muted';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3 px-4 py-3 rounded-lg bg-forge-900 border border-border hover:border-forge-600 transition-colors"
    >
      {/* Icon */}
      <div className={`mt-0.5 shrink-0 ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{getEventLabel(event.type)}</span>
          <span className="text-xs text-text-muted">{timeAgo(event.timestamp)}</span>
        </div>

        {/* Description */}
        {event.description && (
          <p className="mt-0.5 text-xs text-text-muted truncate">{event.description}</p>
        )}

        {/* Actor */}
        {event.username && (
          <span className="text-xs text-text-secondary">@{event.username}</span>
        )}

        {/* Bounty link */}
        {event.bounty_id && event.bounty_title && (
          <Link
            to={`/bounties/${event.bounty_id}`}
            className="block mt-1 text-xs text-emerald hover:text-emerald-light truncate"
          >
            {event.bounty_title}
          </Link>
        )}

        {/* Amount */}
        {event.amount != null && event.amount > 0 && (
          <span className="text-xs font-mono text-emerald">
            {(event.amount / 1_000_000).toLocaleString()} USDC
          </span>
        )}
      </div>

      {/* Source badge */}
      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
        event.source === 'ws' ? 'bg-emerald/10 text-emerald' :
        event.source === 'chain' ? 'bg-purple-400/10 text-purple-400' :
        'bg-forge-800 text-text-muted'
      }`}>
        {event.source}
      </span>
    </motion.div>
  );
}

/* Helper — mirrors the icon map in types/activity.ts */
function getEventIconName(type: FeedEventType): string {
  const map: Record<FeedEventType, string> = {
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
  return map[type] ?? 'Activity';
}
