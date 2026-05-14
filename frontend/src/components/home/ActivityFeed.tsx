import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter } from 'lucide-react';
import { slideInRight } from '../../lib/animations';
import { timeAgo } from '../../lib/utils';
import { useSocket } from '../../hooks/useSocket';

interface ActivityEvent {
  id: string;
  type: 'completed' | 'submitted' | 'posted' | 'review';
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
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

export function ActivityFeed({ events }: { events?: ActivityEvent[] }) {
  const [feedEvents, setFeedEvents] = useState<ActivityEvent[]>(events?.length ? events : MOCK_EVENTS);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['completed', 'submitted', 'posted', 'review']));
  const [showFilters, setShowFilters] = useState(false);

  const handleNewEvent = useCallback((newEvent: ActivityEvent) => {
    setFeedEvents(prev => [newEvent, ...prev].slice(0, 20));
  }, []);

  const { isConnected } = useSocket<ActivityEvent>('activity_feed', handleNewEvent);

  const toggleFilter = (type: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const visibleEvents = feedEvents
    .filter(e => activeFilters.has(e.type))
    .slice(0, 4);

  const ALL_TYPES = ['completed', 'submitted', 'posted', 'review'];

  return (
    <section className="w-full border-y border-border bg-forge-900/50 py-4 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald animate-pulse-glow' : 'bg-status-error'}`} title={isConnected ? "Connected to live feed" : "Disconnected, attempting to reconnect..."} />
            <span className="font-mono text-xs text-text-muted uppercase tracking-wider">
              {isConnected ? "Live Activity" : "Offline"}
            </span>
          </div>
          
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 rounded-md transition-colors flex items-center gap-2 ${showFilters ? 'bg-forge-800 text-text-primary' : 'text-text-muted hover:text-text-secondary hover:bg-forge-800/50'}`}
            title="Filter feed"
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="text-xs font-mono">Filters</span>
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-wrap gap-2 mb-4 overflow-hidden"
            >
              {ALL_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => toggleFilter(type)}
                  className={`px-3 py-1 text-[10px] uppercase tracking-wider font-bold rounded-md border transition-colors ${
                    activeFilters.has(type) 
                      ? 'bg-emerald/10 border-emerald/30 text-emerald' 
                      : 'bg-forge-800 border-border text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {type}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

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
            {visibleEvents.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4 text-center text-sm text-text-muted font-mono">
                No events match your filters.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
