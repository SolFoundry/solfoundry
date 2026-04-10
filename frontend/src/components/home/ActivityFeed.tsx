import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideInRight } from '../../lib/animations';
import { timeAgo } from '../../lib/utils';
import { useActivityFeed } from '../../hooks/useActivityFeed';

interface ActivityEvent {
  id: string;
  type: 'completed' | 'submitted' | 'posted' | 'review';
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2">
      <span className="font-mono text-xs text-text-muted">No recent activity</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 py-2 px-3 animate-pulse">
          <div className="w-6 h-6 rounded-full bg-forge-800 flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-forge-800 rounded w-3/4" />
          </div>
          <div className="h-3 bg-forge-800 rounded w-10" />
        </div>
      ))}
    </div>
  );
}

export function ActivityFeed() {
  const { data: events, isLoading, isError } = useActivityFeed({ limit: 10 });

  const displayEvents = events?.length ? events.slice(0, 4) : null;
  const hasEvents = displayEvents && displayEvents.length > 0;

  return (
    <section className="w-full border-y border-border bg-forge-900/50 py-4 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-glow" />
          <span className="font-mono text-xs text-text-muted uppercase tracking-wider">Recent Activity</span>
          {isError && (
            <span className="font-mono text-xs text-red-400 ml-auto">Connection lost — retrying</span>
          )}
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : hasEvents ? (
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
        ) : (
          <EmptyState />
        )}
      </div>
    </section>
  );
}
