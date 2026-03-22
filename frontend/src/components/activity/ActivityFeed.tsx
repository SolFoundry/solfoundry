import { useState, useEffect, useCallback } from 'react';
import type { ActivityEvent, ActivityEventType } from '../../types/activity';
import { SkeletonActivityFeed } from '../common/Skeleton';
import { NoActivityYet } from '../common/EmptyState';
import { TimeAgo } from '../common/TimeAgo';

// ── Relative time formatting ────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + (minutes === 1 ? ' minute ago' : ' minutes ago');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  const days = Math.floor(hours / 24);
  return days + (days === 1 ? ' day ago' : ' days ago');
}

// ── Event type config ───────────────────────────────────────────────────────

interface EventConfig {
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const EVENT_CONFIG: Record<ActivityEventType, EventConfig> = {
  bounty_created: { icon: '🟢', color: 'text-accent-green', bgColor: 'bg-accent-green/10', borderColor: 'border-accent-green/20' },
  pr_submitted: { icon: '🔵', color: 'text-accent-blue', bgColor: 'bg-accent-blue/10', borderColor: 'border-accent-blue/20' },
  review_completed: { icon: '⭐', color: 'text-accent-gold', bgColor: 'bg-accent-gold/10', borderColor: 'border-accent-gold/20' },
  payout_sent: { icon: '💰', color: 'text-solana-green', bgColor: 'bg-solana-green/10', borderColor: 'border-solana-green/20' },
  new_contributor: { icon: '👤', color: 'text-solana-purple', bgColor: 'bg-solana-purple/10', borderColor: 'border-solana-purple/20' },
};

// ── Event description builders ──────────────────────────────────────────────

function formatRewardCompact(amount: number): string {
  return amount >= 1000 ? (amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1) + 'k' : String(amount);
}

function buildDescription(event: ActivityEvent): string {
  const d = event.data;
  switch (event.type) {
    case 'bounty_created':
      return 'New bounty: ' + (d.title ?? 'Untitled') + ' — ' + formatRewardCompact(d.reward ?? 0) + ' $FNDRY';
    case 'pr_submitted':
      return (d.user ?? 'Someone') + ' submitted PR for ' + (d.bountyTitle ?? 'a bounty');
    case 'review_completed':
      return (d.bountyTitle ?? 'A bounty') + ' scored ' + (d.score ?? 0) + '/10';
    case 'payout_sent':
      return formatRewardCompact(d.amount ?? 0) + ' $FNDRY paid to ' + (d.user ?? 'contributor');
    case 'new_contributor':
      return (d.user ?? 'Someone') + ' joined SolFoundry';
  }
}

// ── Props ───────────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  events?: ActivityEvent[];
  maxEvents?: number;
  title?: string;
  viewAllHref?: string;
  className?: string;
  variant?: 'sidebar' | 'full';
  loading?: boolean;
}

// ── Component ───────────────────────────────────────────────────────────────

export function ActivityFeed({
  events = [],
  maxEvents = 20,
  title = 'Activity Feed',
  viewAllHref = '#',
  className = '',
  variant = 'sidebar',
  loading = false,
}: ActivityFeedProps) {
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

  const displayed = events.slice(0, maxEvents);

  const staggerEntrance = useCallback(() => {
    displayed.forEach((event, i) => {
      setTimeout(() => {
        setVisibleIds(prev => {
          const next = new Set(prev);
          next.add(event.id);
          return next;
        });
      }, i * 60);
    });
  }, [displayed]);

  useEffect(() => {
    staggerEntrance();
  }, [staggerEntrance]);

  // Refresh relative timestamps every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const isFullWidth = variant === 'full';

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return <SkeletonActivityFeed count={5} className={className} />;
  }

  // ── Empty state ─────────────────────────────────────────────────────────
  if (events.length === 0) {
    return (
      <div
        className={'rounded-xl border border-surface-300 bg-surface-50 ' + className}
        data-testid="activity-feed-empty"
      >
        <div className="p-5 border-b border-surface-300">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
        </div>
        <NoActivityYet />
      </div>
    );
  }

  // ── Feed ────────────────────────────────────────────────────────────────
  return (
    <div
      className={'rounded-xl border border-surface-300 bg-surface-50 flex flex-col ' + className}
      data-testid="activity-feed"
      role="feed"
      aria-label="Platform activity feed"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-surface-300">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-solana-green animate-pulse" />
          <h2 className="text-sm font-semibold text-white">{title}</h2>
        </div>
        <span className="text-xs text-gray-500">{displayed.length} events</span>
      </div>

      {/* Event list */}
      <div
        className={'overflow-y-auto divide-y divide-surface-300 ' + (isFullWidth ? 'max-h-[600px]' : 'max-h-[480px]')}
        role="list"
      >
        {displayed.map(event => {
          const config = EVENT_CONFIG[event.type];
          const visible = visibleIds.has(event.id);

          return (
            <div
              key={event.id}
              className={
                'flex items-start gap-3 p-4 transition-colors hover:bg-surface-100 ' +
                (visible ? 'animate-feed-in' : 'opacity-0 -translate-y-2')
              }
              role="listitem"
              data-testid={'activity-event-' + event.id}
            >
              {/* Icon */}
              <div
                className={
                  'flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border text-sm ' +
                  config.bgColor + ' ' + config.borderColor
                }
                aria-hidden="true"
              >
                {config.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={'text-xs leading-relaxed ' + (isFullWidth ? 'sm:text-sm' : '')}>
                  <span className="text-gray-300">{buildDescription(event)}</span>
                </p>
                <TimeAgo date={event.timestamp} className="text-[11px] text-gray-600 mt-0.5 block" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {events.length > maxEvents && (
        <div className="border-t border-surface-300 p-3 text-center">
          <a
            href={viewAllHref}
            className="text-xs text-solana-purple hover:text-solana-green transition-colors"
          >
            View All Activity &rarr;
          </a>
        </div>
      )}
    </div>
  );
}