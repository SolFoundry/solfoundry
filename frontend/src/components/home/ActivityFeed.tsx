/**
 * ActivityFeed — Shows recent on-chain / platform events.
 * Fetches from the backend API with 30-second auto-refresh.
 * Falls back to mock data when the API is unavailable.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { slideInRight } from '../../lib/animations';
import { timeAgo } from '../../lib/utils';
import { fetchActivity, type ActivityEvent } from '../../api/activity';

// ── Mock events (fallback when API is unavailable) ──────────────────────────
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

// ── Helpers ─────────────────────────────────────────────────────────────────
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

// ── Component ───────────────────────────────────────────────────────────────
const REFRESH_INTERVAL = 30_000; // 30 seconds

export function ActivityFeed({ events: propEvents }: { events?: ActivityEvent[] }) {
  // If events are passed via props, use them directly (no auto-refresh)
  const isControlled = propEvents !== undefined;

  const [events, setEvents] = useState<ActivityEvent[]>(
    (propEvents?.length ? propEvents : MOCK_EVENTS).slice(0, 4)
  );
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ── Load events from API (with mock fallback) ──
  const loadEvents = useCallback(async () => {
    if (isControlled) return;
    setIsLoading(true);
    try {
      const apiEvents = await fetchActivity(10);
      if (!mountedRef.current) return;
      if (apiEvents && apiEvents.length > 0) {
        setEvents(apiEvents.slice(0, 4));
      } else {
        // API returned empty — use mock data
        setEvents(MOCK_EVENTS.slice(0, 4));
      }
    } catch {
      if (!mountedRef.current) return;
      // API unavailable — keep current events or use mock
      setEvents((prev) => prev.length > 0 ? prev : MOCK_EVENTS.slice(0, 4));
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [isControlled]);

  // ── Initial load + auto-refresh ──
  useEffect(() => {
    mountedRef.current = true;
    if (!isControlled) {
      loadEvents();
      intervalRef.current = setInterval(loadEvents, REFRESH_INTERVAL);
    }
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isControlled, loadEvents]);

  // ── Update when prop events change ──
  useEffect(() => {
    if (isControlled && propEvents) {
      setEvents(propEvents.slice(0, 4));
    }
  }, [propEvents, isControlled]);

  // ── Empty state ──
  const showEmpty = !isLoading && events.length === 0;

  return (
    <section className="w-full border-y border-border bg-forge-900/50 py-4 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-status-warning animate-pulse' : 'bg-emerald animate-pulse-glow'}`} />
            <span className="font-mono text-xs text-text-muted uppercase tracking-wider">Recent Activity</span>
          </div>
          {!isControlled && (
            <button
              onClick={loadEvents}
              disabled={isLoading}
              className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
              aria-label="Refresh activity"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>

        {/* Events list */}
        <div className="space-y-1">
          {showEmpty ? (
            <p className="text-sm text-text-muted text-center py-4">No recent activity</p>
          ) : (
            <AnimatePresence mode="popLayout">
              {events.map((event) => (
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