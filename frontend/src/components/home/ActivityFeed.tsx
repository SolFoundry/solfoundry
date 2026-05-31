import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideInRight } from '../../lib/animations';
import { timeAgo } from '../../lib/utils';
import { useActivity } from '../../hooks/useActivity';
import type { ActivityEvent } from '../../api/activity';

function getActionText(type: ActivityEvent['type']) {
  switch (type) {
    case 'completed': return 'earned';
    case 'submitted': return 'submitted';
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

export function ActivityFeed({ events: propEvents }: { events?: ActivityEvent[] } = {}) {
  // If parent passes events, use those (preserves API). Otherwise fetch from hook.
  const { data: fetchedEvents, isLoading, isError } = useActivity(10);

  // Priority: explicit prop > fetched events
  const events = propEvents ?? fetchedEvents ?? [];
  const displayEvents = events.slice(0, 4);

  return (
    <section className="w-full border-y border-border bg-forge-900/50 py-4 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-3">
          <span className={`w-2 h-2 rounded-full ${isError ? 'bg-text-muted' : 'bg-emerald animate-pulse-glow'}`} />
          <span className="font-mono text-xs text-text-muted uppercase tracking-wider">Recent Activity</span>
        </div>

        {isLoading && displayEvents.length === 0 && (
          <div className="space-y-1.5 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-gradient-to-r from-forge-900 via-forge-850 to-forge-900 bg-[length:200%_100%] animate-shimmer" />
            ))}
          </div>
        )}

        {!isLoading && displayEvents.length === 0 && (
          <div className="text-center py-3">
            <p className="text-sm text-text-muted">No recent activity</p>
            {isError && (
              <p className="text-xs text-text-muted mt-1 font-mono">Activity API unavailable — check back soon.</p>
            )}
          </div>
        )}

        {displayEvents.length > 0 && (
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {displayEvents.map((event) => (
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
