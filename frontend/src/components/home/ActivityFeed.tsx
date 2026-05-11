import React from 'react';
import { GitPullRequest, CheckCircle, DollarSign, Plus, Merge } from 'lucide-react';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import type { ActivityEvent } from '../../api/activity';

const eventConfig: Record<ActivityEvent['type'], {
  icon: React.ElementType;
  color: string;
  label: string;
}> = {
  bounty_completed: { icon: CheckCircle, color: 'text-emerald', label: 'completed' },
  pr_submitted: { icon: GitPullRequest, color: 'text-tier-t2', label: 'submitted PR' },
  payout_sent: { icon: DollarSign, color: 'text-tier-t1', label: 'received payout' },
  bounty_created: { icon: Plus, color: 'text-status-info', label: 'created bounty' },
  pr_merged: { icon: Merge, color: 'text-emerald', label: 'merged PR' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function ActivityItem({ event }: { event: ActivityEvent }) {
  const config = eventConfig[event.type];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-surface-hover transition-colors">
      {/* Avatar */}
      {event.avatar_url ? (
        <img src={event.avatar_url} alt={event.username} className="w-8 h-8 rounded-full" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-surface-card flex items-center justify-center text-xs font-mono text-text-muted">
          {event.username.slice(0, 2).toUpperCase()}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">
          <span className="font-medium">{event.username}</span>{' '}
          <span className="text-text-secondary">{config.label}</span>
          {' — '}
          <span className="font-medium truncate">{event.bounty_title}</span>
        </p>
        {event.amount && (
          <span className="text-xs text-tier-t1 font-medium">{event.amount} $FNDRY</span>
        )}
      </div>

      {/* Icon + Time */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Icon className={`w-4 h-4 ${config.color}`} />
        <span className="text-xs text-text-muted">{timeAgo(event.created_at)}</span>
      </div>
    </div>
  );
}

export function ActivityFeed() {
  const { events, isLoading, isError, refetch } = useActivityFeed();

  if (isLoading && events.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2 px-3">
            <div className="w-8 h-8 rounded-full bg-surface-card animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-4 bg-surface-card rounded animate-pulse w-3/4" />
              <div className="h-3 bg-surface-card rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-text-muted text-sm">No recent activity</p>
        {isError && (
          <button
            onClick={refetch}
            className="mt-2 text-xs text-emerald hover:underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event) => (
        <ActivityItem key={event.id} event={event} />
      ))}
    </div>
  );
}

export default ActivityFeed;
