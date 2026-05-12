import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideInRight } from '../../lib/animations';
import { timeAgo } from '../../lib/utils';
import { useActivityEvents } from '../../hooks/useActivity';
import type { ActivityEvent } from '../../api/activity';

const EMPTY_EVENTS: ActivityEvent[] = [];

function getActionText(type: ActivityEvent['type']) {
  switch (type) {
    case 'completed': return 'completed';
    case 'submitted': return 'submitted';
    case 'payout': return 'paid out';
    case 'posted': return 'posted';
    case 'review': return 'AI Review passed for';
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

function FeedState({ children }: { children: string }) {
  return (
    <div className="py-3 px-3 rounded-lg border border-border/60 bg-forge-900 text-sm text-text-muted">
      {children}
    </div>
  );
}

export function ActivityFeed({
  events,
  refreshIntervalMs = 30_000,
}: {
  events?: ActivityEvent[];
  refreshIntervalMs?: number;
}) {
  const activityQuery = useActivityEvents({
    enabled: events === undefined,
    limit: 4,
    refetchIntervalMs: refreshIntervalMs,
  });

  const displayEvents = events ?? activityQuery.data ?? EMPTY_EVENTS;
  const [visibleEvents, setVisibleEvents] = useState<ActivityEvent[]>(displayEvents.slice(0, 4));
  const isFetchingRealActivity = events === undefined && activityQuery.isLoading;
  const hasActivityError = events === undefined && activityQuery.isError;

  useEffect(() => {
    setVisibleEvents(displayEvents.slice(0, 4));
  }, [displayEvents]);

  return (
    <section className="w-full border-y border-border bg-forge-900/50 py-4 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-glow" />
            <span className="font-mono text-xs text-text-muted uppercase tracking-wider">Recent Activity</span>
          </div>
          {events === undefined && activityQuery.isFetching && !isFetchingRealActivity ? (
            <span className="font-mono text-xs text-text-muted">Refreshing</span>
          ) : null}
        </div>
        <div className="space-y-1">
          {isFetchingRealActivity ? (
            <FeedState>Loading activity...</FeedState>
          ) : hasActivityError ? (
            <FeedState>Activity feed unavailable</FeedState>
          ) : visibleEvents.length === 0 ? (
            <FeedState>No recent activity</FeedState>
          ) : (
            <AnimatePresence mode="popLayout">
              {visibleEvents.map((event) => (
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
          )}
        </div>
      </div>
    </section>
  );
}
