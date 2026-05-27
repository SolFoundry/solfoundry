import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideInRight } from '../../lib/animations';
import { timeAgo } from '../../lib/utils';
import { getActivityFeed } from '../../api/activity';
import type { ActivityEvent } from '../../api/activity';

// Fallback mock events when API is unavailable
const MOCK_EVENTS: ActivityEvent[] = [
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
    type: 'posted',
    username: 'SolanaLabs',
    detail: 'Bounty #145 — $3,500 USDC',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    type: 'review',
    username: 'AI Review',
    detail: 'Bounty #42 — 8.5/10',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

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

export function ActivityFeed({ events: propEvents }: { events?: ActivityEvent[] }) {
  const [fetchedEvents, setFetchedEvents] = useState<ActivityEvent[] | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const fetchActivity = useCallback(async () => {
    const result = await getActivityFeed();
    if (result.length > 0) {
      setFetchedEvents(result);
      setIsOnline(true);
    } else if (fetchedEvents === null) {
      // Only show fallback on first load if API returned nothing
      // (Don't switch to mock if API was working and now empty)
      setIsOnline(false);
    }
  }, [fetchedEvents]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Use prop events if provided, otherwise fetched or mock
  const displayEvents = propEvents?.length
    ? propEvents
    : fetchedEvents?.length
      ? fetchedEvents
      : MOCK_EVENTS;

  const [visibleEvents, setVisibleEvents] = useState<ActivityEvent[]>(displayEvents.slice(0, 4));

  useEffect(() => {
    setVisibleEvents(displayEvents.slice(0, 4));
  }, [displayEvents]);

  return (
    <section className="w-full border-y border-border bg-forge-900/50 py-4 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-glow" />
          <span className="font-mono text-xs text-text-muted uppercase tracking-wider">Recent Activity</span>
          {fetchedEvents && fetchedEvents.length > 0 && (
            <span className="text-[10px] font-mono text-emerald/60">LIVE</span>
          )}
          {!isOnline && (
            <span className="text-[10px] font-mono text-text-muted/40">DEMO</span>
          )}
        </div>
        <div className="space-y-1">
          {visibleEvents.length === 0 ? (
            <p className="text-sm text-text-muted/50 text-center py-4 font-mono">
              No recent activity
            </p>
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
