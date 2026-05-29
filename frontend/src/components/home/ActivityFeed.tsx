import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideInRight } from '../../lib/animations';
import { timeAgo } from '../../lib/utils';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import type { ActivityEvent } from '../../types/activity';

function getActionText(type: ActivityEvent['type']) {
  switch (type) {
    case 'completed': return 'earned';
    case 'submitted': return 'submitted';
    case 'posted': return 'posted';
    case 'review': return 'AI Review passed for';
    case 'payout': return 'received payout for';
    default: return 'updated';
  }
}

function EventItem({ event }: { event: ActivityEvent }) {
  const isMagenta = event.type === 'review';
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-forge-850 transition-colors duration-150">
      {event.avatar_url ? (
        <img src={event.avatar_url} className="w-6 h-6 rounded-full flex-shrink-0" alt="" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-forge-700 flex-shrink-0 flex items-center justify-center">
          <span className="font-mono text-xs text-text-muted">{event.username[0]?.toUpperCase()}</span>
        </div>
      )}
      <p className="text-sm text-text-secondary flex-1 truncate">
        <span className="font-medium text-text-primary">{event.username}</span>
        {' '}{getActionText(event.type)}{' '}
        <span className={`font-mono ${isMagenta ? 'text-magenta' : 'text-emerald'}`}>{event.detail}</span>
      </p>
      <span className="font-mono text-xs text-text-muted flex-shrink-0">{timeAgo(event.timestamp)}</span>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg">
      <div className="w-6 h-6 rounded-full bg-forge-800 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 rounded bg-forge-800 animate-pulse w-4/5" />
        <div className="h-2.5 rounded bg-forge-800 animate-pulse w-2/5" />
      </div>
    </div>
  );
}

export function ActivityFeed({ events }: { events?: ActivityEvent[] }) {
  const activityQuery = useActivityFeed();
  const feedEvents = useMemo(
    () => (events ?? activityQuery.data ?? []).slice(0, 4),
    [events, activityQuery.data],
  );
  const hasEvents = feedEvents.length > 0;
  const isLoading = !events && activityQuery.isLoading && !activityQuery.data;
  const hasError = !events && activityQuery.isError && !hasEvents;
  const headerStatus = !events && activityQuery.isError ? 'Delayed' : 'Live';

  return (
    <section className="w-full border-y border-border bg-forge-900/50 py-4 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-glow" />
          <span className="font-mono text-xs text-text-muted uppercase tracking-wider">Recent Activity</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted/70">
            {headerStatus}
          </span>
        </div>
        {isLoading ? (
          <div className="space-y-1" data-testid="activity-feed-loading">
            {Array.from({ length: 4 }, (_, index) => (
              <ActivitySkeleton key={index} />
            ))}
          </div>
        ) : hasError ? (
          <div
            className="rounded-lg border border-border bg-forge-900 px-4 py-4 text-sm text-text-muted"
            data-testid="activity-feed-error"
          >
            Activity feed unavailable right now.
          </div>
        ) : !hasEvents ? (
          <div
            className="rounded-lg border border-border bg-forge-900 px-4 py-4 text-sm text-text-muted"
            data-testid="activity-feed-empty"
          >
            No recent activity
          </div>
        ) : (
          <div className="space-y-1" data-testid="activity-feed-events">
            <AnimatePresence mode="popLayout">
              {feedEvents.map((event) => (
                <motion.div
                  key={event.id}
                  variants={slideInRight}
                  initial="initial"
                  animate="animate"
                  exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                  layout
                >
                  <EventItem event={event} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}
