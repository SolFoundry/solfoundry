import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideInRight } from '../../lib/animations';
import { timeAgo } from '../../lib/utils';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import type { ActivityEvent } from '../../api/activity';

function getActionText(type: ActivityEvent['type']) {
  switch (type) {
    case 'completed': return 'earned';
    case 'submitted': return 'submitted';
    case 'posted': return 'posted';
    case 'review': return 'AI Review passed for';
    case 'payout': return 'paid';
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

export function ActivityFeed({ events }: { events?: ActivityEvent[] }) {
  const activityQuery = useActivityFeed();
  const isControlled = events !== undefined;
  const displayEvents = isControlled ? events : activityQuery.data ?? [];
  const [visibleEvents, setVisibleEvents] = useState<ActivityEvent[]>(displayEvents.slice(0, 4));

  useEffect(() => {
    setVisibleEvents(displayEvents.slice(0, 4));
  }, [displayEvents]);

  const isUnavailable = !isControlled && activityQuery.isError;
  const isEmpty = !isUnavailable && !activityQuery.isLoading && visibleEvents.length === 0;

  return (
    <section className="w-full border-y border-border bg-forge-900/50 py-4 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-glow" />
          <span className="font-mono text-xs text-text-muted uppercase tracking-wider">Recent Activity</span>
        </div>
        <div className="space-y-1">
          {activityQuery.isLoading && !isControlled ? (
            <p className="px-3 py-2 text-sm text-text-muted">Loading recent activity...</p>
          ) : null}
          {isUnavailable ? (
            <p className="px-3 py-2 text-sm text-text-muted">Activity feed is temporarily unavailable.</p>
          ) : null}
          {isEmpty ? (
            <p className="px-3 py-2 text-sm text-text-muted">No recent activity.</p>
          ) : null}
          {!activityQuery.isLoading && !isUnavailable && visibleEvents.length > 0 ? (
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
          ) : null}
        </div>
      </div>
    </section>
  );
}
