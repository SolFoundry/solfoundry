import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideInRight } from '../../lib/animations';
import { timeAgo } from '../../lib/utils';
import { ActivityFeedSkeleton } from '../skeletons/Skeleton';
import type { ActivityEvent } from '../../types/activity';

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

interface ActivityFeedProps {
  events?: ActivityEvent[];
  isLoading?: boolean;
  isError?: boolean;
}

export function ActivityFeed({ events, isLoading, isError }: ActivityFeedProps) {
  if (isLoading) {
    return <ActivityFeedSkeleton />;
  }

  const displayEvents = events?.slice(0, 4) ?? [];
  const isEmpty = !isLoading && displayEvents.length === 0;

  return (
    <section className="w-full border-y border-border bg-forge-900/50 py-4 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-3">
          <span className={`w-2 h-2 rounded-full ${isError ? 'bg-amber-500' : 'bg-emerald'} animate-pulse-glow`} />
          <span className="font-mono text-xs text-text-muted uppercase tracking-wider">Recent Activity</span>
        </div>

        {isEmpty ? (
          <p className="text-sm text-text-muted py-2 px-3">No recent activity</p>
        ) : (
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
