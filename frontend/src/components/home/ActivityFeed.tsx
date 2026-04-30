import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideInRight } from '../../lib/animations';
import { timeAgo } from '../../lib/utils';
import { useActivityFeed, ActivityEvent, ActivityType } from '../../hooks/useActivityFeed';

interface ActivityFeedProps {
  events?: ActivityEvent[];
  wsEnabled?: boolean;
  maxEvents?: number;
}

// Map WebSocket activity types to display types
function mapActivityType(type: ActivityType): ActivityEvent['type'] {
  switch (type) {
    case 'bounty_posted': return 'posted';
    case 'bounty_submitted': return 'submitted';
    case 'bounty_reviewed': return 'review';
    case 'bounty_completed': return 'completed';
    case 'leaderboard_change': return 'review';
    default: return 'review';
  }
}

// Mock events for when API doesn't return activity
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

export function ActivityFeed({ events, wsEnabled = true, maxEvents = 4 }: ActivityFeedProps) {
  const [selectedFilters, setSelectedFilters] = useState<ActivityType[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const {
    events: wsEvents,
    connected,
    connecting,
    error,
    setFilters,
    reconnect,
  } = useActivityFeed({
    autoConnect: wsEnabled,
    filterTypes: selectedFilters.length > 0 ? selectedFilters : undefined,
  });

  // Combine WS events with provided events
  const displayEvents = useMemo(() => {
    if (events?.length) return events.slice(0, maxEvents);
    if (wsEvents.length > 0) {
      return wsEvents.slice(0, maxEvents).map((wsEvent) => ({
        id: wsEvent.id,
        type: mapActivityType(wsEvent.type),
        username: wsEvent.actor,
        detail: wsEvent.title,
        timestamp: wsEvent.timestamp,
      }));
    }
    return MOCK_EVENTS;
  }, [events, wsEvents, maxEvents]);

  const handleFilterChange = (type: ActivityType) => {
    const newFilters = selectedFilters.includes(type)
      ? selectedFilters.filter((t) => t !== type)
      : [...selectedFilters, type];
    setSelectedFilters(newFilters);
    setFilters(newFilters);
  };

  return (
    <section className="w-full border-y border-border bg-forge-900/50 py-4 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald animate-pulse-glow' : connecting ? 'bg-yellow animate-pulse' : 'bg-red'}`} />
            <span className="font-mono text-xs text-text-muted uppercase tracking-wider">
              Recent Activity {connected ? '(Live)' : wsEnabled ? '(Reconnecting...)' : '(Offline)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="font-mono text-xs text-text-muted hover:text-text-primary transition-colors"
              aria-label="Toggle activity filters"
            >
              Filter
            </button>
            {error && (
              <button
                onClick={reconnect}
                className="font-mono text-xs text-yellow hover:text-yellow/80 transition-colors"
                aria-label="Reconnect WebSocket"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>

        {/* Filter dropdown */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 flex flex-wrap gap-2"
            >
              {(['bounty_posted', 'bounty_submitted', 'bounty_reviewed', 'bounty_completed', 'leaderboard_change'] as ActivityType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleFilterChange(type)}
                  className={`font-mono text-xs px-2 py-1 rounded transition-colors ${
                    selectedFilters.includes(type)
                      ? 'bg-emerald/20 text-emerald'
                      : 'bg-forge-800 text-text-muted hover:bg-forge-700'
                  }`}
                >
                  {type.replace(/_/g, ' ')}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

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
      </div>
    </section>
  );
}
