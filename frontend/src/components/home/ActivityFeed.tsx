import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideInRight } from '../../lib/animations';
import { timeAgo } from '../../lib/utils';
import { useActivity } from '../../hooks/useActivity';
import type { ActivityEvent } from '../../api/activity';

const FALLBACK_EVENTS: ActivityEvent[] = [
  {
    id: '1',
    type: 'completed',
    username: 'devbuilder',
    detail: '$500 USDC from Bounty #42',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    type: 'submitted',
    username: 'KodeSage',
    detail: 'PR to Bounty #38',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    type: 'payout',
    username: 'SolFoundry',
    detail: 'FNDRY payout released',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
];

function getActionText(type: ActivityEvent['type']) {
  switch (type) {
    case 'completed':
      return 'earned';
    case 'submitted':
      return 'submitted';
    case 'posted':
      return 'posted';
    case 'review':
      return 'reviewed';
    case 'payout':
      return 'received';
    default:
      return 'updated';
  }
}

function EventItem({ event }: { event: ActivityEvent }) {
  const isAccent = event.type === 'review' ? 'text-magenta' : 'text-emerald';
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-forge-850 transition-colors duration-150 min-w-0">
      {event.avatar_url ? (
        <img src={event.avatar_url} className="w-6 h-6 rounded-full flex-shrink-0" alt="" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-forge-700 flex-shrink-0 flex items-center justify-center">
          <span className="font-mono text-xs text-text-muted">{event.username[0]?.toUpperCase()}</span>
        </div>
      )}
      <p className="text-sm text-text-secondary flex-1 min-w-0">
        <span className="font-medium text-text-primary">{event.username}</span>{' '}
        {getActionText(event.type)}{' '}
        <span className={`font-mono ${isAccent} break-words`}>{event.detail}</span>
      </p>
      <span className="font-mono text-xs text-text-muted flex-shrink-0">{timeAgo(event.timestamp)}</span>
    </div>
  );
}

export function ActivityFeed() {
  const { data, isLoading, isError } = useActivity();
  const displayEvents = isError ? FALLBACK_EVENTS : data ?? [];
  const visibleEvents = displayEvents.slice(0, 4);

  return (
    <section className="w-full border-y border-border bg-forge-900/50 py-4 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-glow" />
          <span className="font-mono text-xs text-text-muted uppercase tracking-wider">Recent Activity</span>
        </div>

        {isLoading && (
          <div className="space-y-1" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-forge-800 overflow-hidden">
                  <div className="h-full w-full bg-gradient-to-r from-forge-800 via-forge-700 to-forge-800 bg-[length:200%_100%] animate-shimmer" />
                </div>
                <div className="flex-1 h-4 rounded bg-forge-800 overflow-hidden">
                  <div className="h-full w-full bg-gradient-to-r from-forge-800 via-forge-700 to-forge-800 bg-[length:200%_100%] animate-shimmer" />
                </div>
                <div className="w-12 h-3 rounded bg-forge-800 overflow-hidden">
                  <div className="h-full w-full bg-gradient-to-r from-forge-800 via-forge-700 to-forge-800 bg-[length:200%_100%] animate-shimmer" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && visibleEvents.length === 0 && !isError && (
          <div className="py-4 px-3 text-sm text-text-muted">No recent activity</div>
        )}

        {!isLoading && visibleEvents.length > 0 && (
          <div className="space-y-1">
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
          </div>
        )}

        {isError && (
          <div className="mt-3 text-xs text-text-muted font-mono">API unavailable — showing fallback activity.</div>
        )}
      </div>
    </section>
  );
}
