import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideInRight } from '../../lib/animations';
import { timeAgo } from '../../lib/utils';

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

async function fetchActivity(): Promise<ActivityEvent[]> {
  const response = await fetch('/api/activity');
  if (!response.ok) throw new Error('Failed to load activity');
  const payload = await response.json();
  return Array.isArray(payload) ? payload : payload.items ?? [];
}

export function ActivityFeed({ events }: { events?: ActivityEvent[] }) {
  const [visibleEvents, setVisibleEvents] = useState<ActivityEvent[]>(events?.slice(0, 4) ?? []);
  const [isLoading, setIsLoading] = useState(!events);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (events) {
      setVisibleEvents(events.slice(0, 4));
      setIsLoading(false);
      return undefined;
    }

    let cancelled = false;

    const loadActivity = async () => {
      try {
        const activity = await fetchActivity();
        if (!cancelled) {
          setVisibleEvents(activity.slice(0, 4));
          setIsError(false);
        }
      } catch {
        if (!cancelled) setIsError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadActivity();
    const intervalId = window.setInterval(loadActivity, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [events]);

  return (
    <section className="w-full border-y border-border bg-forge-900/50 py-4 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-glow" />
          <span className="font-mono text-xs text-text-muted uppercase tracking-wider">Recent Activity</span>
        </div>
        <div className="space-y-1">
          {isLoading && (
            <p className="py-3 px-3 text-sm text-text-muted">Loading activity...</p>
          )}
          {!isLoading && isError && (
            <p className="py-3 px-3 text-sm text-text-muted">Activity is temporarily unavailable.</p>
          )}
          {!isLoading && !isError && visibleEvents.length === 0 && (
            <p className="py-3 px-3 text-sm text-text-muted">No recent activity</p>
          )}
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
