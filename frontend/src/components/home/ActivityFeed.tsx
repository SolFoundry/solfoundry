import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideInRight } from '../../lib/animations';
import { timeAgo } from '../../lib/utils';
import { getRecentActivity } from '../../api/activity';

export interface ActivityEvent {
  id: string;
  type: 'completed' | 'submitted' | 'posted' | 'review' | 'payout';
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

/** Fallback mock events when the API is unreachable */
const MOCK_EVENTS: ActivityEvent[] = [
  {
    id: 'm1',
    type: 'completed',
    username: 'devbuilder',
    detail: '$500 USDC from Bounty #42',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    id: 'm2',
    type: 'submitted',
    username: 'KodeSage',
    detail: 'PR to Bounty #38',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'm3',
    type: 'posted',
    username: 'SolanaLabs',
    detail: 'Bounty #145 — $3,500 USDC',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'm4',
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

const REFRESH_INTERVAL_MS = 30_000; // 30-second auto-refresh

export function ActivityFeed({ events: externalEvents }: { events?: ActivityEvent[] }) {
  const [apiEvents, setApiEvents] = useState<ActivityEvent[]>([]);
  const [apiFailed, setApiFailed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActivity = useCallback(async () => {
    const data = await getRecentActivity();
    if (data.length > 0) {
      setApiEvents(data);
      setApiFailed(false);
    } else {
      setApiFailed(true);
    }
  }, []);

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchActivity();
    intervalRef.current = setInterval(fetchActivity, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchActivity]);

  // External events override (for page-level props)
  const displayEvents = externalEvents?.length
    ? externalEvents.slice(0, 5)
    : apiEvents.length > 0
      ? apiEvents.slice(0, 5)
      : MOCK_EVENTS;

  const [visibleEvents, setVisibleEvents] = useState<ActivityEvent[]>(displayEvents.slice(0, 5));

  useEffect(() => {
    setVisibleEvents(displayEvents.slice(0, 5));
  }, [displayEvents]);

  return (
    <section className="w-full border-y border-border bg-forge-900/50 py-4 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`w-2 h-2 rounded-full animate-pulse-glow ${
              apiFailed && !externalEvents ? 'bg-status-warning' : 'bg-emerald'
            }`}
          />
          <span className="font-mono text-xs text-text-muted uppercase tracking-wider">
            Recent Activity
            {apiFailed && !externalEvents && ' (demo mode)'}
          </span>
        </div>
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
      </div>
    </section>
  );
}
