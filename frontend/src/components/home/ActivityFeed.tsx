import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideInRight } from '../../lib/animations';
import { timeAgo } from '../../lib/utils';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import type { ActivityEvent } from '../../types/activity';

function getActionText(type: ActivityEvent['type']) {
  switch (type) {
    case 'completed': return 'earned';
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
          <span className="font-mono text-xs text-text-muted">{event.username[0]?.toUpperCase() ?? '?'}</span>
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

function ActivityFeedMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-forge-900 px-3 py-4 text-center">
      <p className="text-sm text-text-muted">{children}</p>
    </div>
  );
}

function ActivityFeedSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading recent activity" className="space-y-1">
      <span className="sr-only">Loading recent activity</span>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full bg-forge-700">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent bg-[length:200%_100%] animate-shimmer" />
          </div>
          <div className="h-4 flex-1 overflow-hidden rounded bg-forge-800">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent bg-[length:200%_100%] animate-shimmer" />
          </div>
          <div className="h-3 w-16 flex-shrink-0 overflow-hidden rounded bg-forge-800">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent bg-[length:200%_100%] animate-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityFeed({ events }: { events?: ActivityEvent[] }) {
  const hasProvidedEvents = events !== undefined;
  const { data: apiEvents = [], isError, isFetching, isLoading } = useActivityFeed(8, !hasProvidedEvents);
  const visibleEvents = (hasProvidedEvents ? events ?? [] : apiEvents).slice(0, 4);
  const showLoading = isLoading && !hasProvidedEvents && visibleEvents.length === 0;
  const showError = isError && !hasProvidedEvents && visibleEvents.length === 0;
  const showEmpty = !showLoading && !showError && visibleEvents.length === 0;

  return (
    <section className="w-full border-y border-border bg-forge-900/50 py-4 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-glow" />
          <span className="font-mono text-xs text-text-muted uppercase tracking-wider">Recent Activity</span>
          {isFetching && !showLoading && !hasProvidedEvents && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald">Updating</span>
          )}
        </div>
        <div className="space-y-1" aria-live="polite">
          {showLoading && <ActivityFeedSkeleton />}
          {showError && <ActivityFeedMessage>Activity feed is temporarily unavailable.</ActivityFeedMessage>}
          {showEmpty && <ActivityFeedMessage>No recent activity</ActivityFeedMessage>}
          {!showLoading && !showError && !showEmpty && (
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
