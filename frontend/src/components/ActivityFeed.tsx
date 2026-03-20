/** Activity feed showing recent platform events with icons and relative timestamps. */
import React from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FeedEventType =
  | 'bounty_created'
  | 'pr_submitted'
  | 'review_completed'
  | 'payout_sent'
  | 'new_contributor';

export interface FeedEvent {
  id: string;
  type: FeedEventType;
  description: string;
  timestamp: Date;
}

interface ActivityFeedProps {
  maxEvents?: number;
  className?: string;
  events?: FeedEvent[];
}

// ── Event config ──────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  FeedEventType,
  { icon: string; color: string; bg: string; label: string }
> = {
  bounty_created: {
    icon: '🟢',
    color: 'text-green-400',
    bg: 'bg-green-900/30 border-green-800/40',
    label: 'Bounty Created',
  },
  pr_submitted: {
    icon: '🔵',
    color: 'text-blue-400',
    bg: 'bg-blue-900/30 border-blue-800/40',
    label: 'PR Submitted',
  },
  review_completed: {
    icon: '⭐',
    color: 'text-yellow-400',
    bg: 'bg-yellow-900/30 border-yellow-800/40',
    label: 'Review Completed',
  },
  payout_sent: {
    icon: '💰',
    color: 'text-green-400',
    bg: 'bg-green-900/30 border-green-800/40',
    label: 'Payout Sent',
  },
  new_contributor: {
    icon: '👤',
    color: 'text-purple-400',
    bg: 'bg-purple-900/30 border-purple-800/40',
    label: 'New Contributor',
  },
};

// ── Mock data ─────────────────────────────────────────────────────────────────

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

const MOCK_EVENTS: FeedEvent[] = [
  { id: 'e1', type: 'bounty_created', description: 'New T1 bounty: Implement agent registration API', timestamp: hoursAgo(1) },
  { id: 'e2', type: 'pr_submitted', description: 'ChainForge submitted PR for bounty #183', timestamp: hoursAgo(2) },
  { id: 'e3', type: 'review_completed', description: 'AI reviewer scored NeuralCraft\'s PR: 94/100', timestamp: hoursAgo(3) },
  { id: 'e4', type: 'payout_sent', description: '18,000 $FNDRY sent to PixelPush for bounty #176', timestamp: hoursAgo(4) },
  { id: 'e5', type: 'new_contributor', description: 'New contributor joined: DevAgent-X', timestamp: hoursAgo(5) },
  { id: 'e6', type: 'bounty_created', description: 'New T2 bounty: Add semantic search to bounty discovery', timestamp: hoursAgo(8) },
  { id: 'e7', type: 'pr_submitted', description: 'PixelPush submitted PR for bounty #192', timestamp: hoursAgo(10) },
  { id: 'e8', type: 'review_completed', description: 'AI reviewer scored ChainForge\'s PR: 89/100', timestamp: hoursAgo(14) },
  { id: 'e9', type: 'payout_sent', description: '25,000 $FNDRY sent to NeuralCraft for bounty #188', timestamp: hoursAgo(18) },
  { id: 'e10', type: 'new_contributor', description: 'New contributor joined: CodeScout', timestamp: hoursAgo(22) },
  { id: 'e11', type: 'bounty_created', description: 'New T3 bounty: Implement Solana staking contract', timestamp: hoursAgo(26) },
  { id: 'e12', type: 'pr_submitted', description: 'NeuralCraft submitted PR for bounty #195', timestamp: hoursAgo(30) },
  { id: 'e13', type: 'review_completed', description: 'AI reviewer scored OptiMax\'s PR: 96/100', timestamp: hoursAgo(36) },
  { id: 'e14', type: 'payout_sent', description: '32,000 $FNDRY sent to ChainForge for bounty #179', timestamp: hoursAgo(42) },
  { id: 'e15', type: 'new_contributor', description: 'New contributor joined: SecureAI', timestamp: hoursAgo(47) },
];

// ── Relative time ─────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  maxEvents = 20,
  className = '',
  events,
}) => {
  const [visible, setVisible] = React.useState(false);

  // Fade in on mount
  React.useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const source = events ?? MOCK_EVENTS;
  const items = source.slice(0, Math.min(maxEvents, 20));

  if (items.length === 0) {
    return (
      <div className={`bg-gray-800 rounded-xl p-6 text-center ${className}`}>
        <p className="text-gray-500 text-sm">No recent activity.</p>
      </div>
    );
  }

  return (
    <div
      className={`bg-gray-800 rounded-xl overflow-hidden ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-white">Activity Feed</h2>
        <a
          href="/bounties"
          className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          View All →
        </a>
      </div>

      {/* Events */}
      <ul className="divide-y divide-gray-700/50">
        {items.map((event, idx) => {
          const cfg = EVENT_CONFIG[event.type];
          return (
            <li
              key={event.id}
              className="flex items-start gap-3 px-5 py-3 hover:bg-gray-750 transition-colors"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(4px)',
                transition: `opacity 0.3s ease ${idx * 30}ms, transform 0.3s ease ${idx * 30}ms`,
              }}
            >
              {/* Icon */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 border ${cfg.bg}`}>
                {cfg.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${cfg.color} mb-0.5`}>{cfg.label}</p>
                <p className="text-sm text-gray-300 leading-snug">{event.description}</p>
              </div>

              {/* Timestamp */}
              <span className="text-xs text-gray-500 shrink-0 mt-0.5">
                {relativeTime(event.timestamp)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ActivityFeed;
