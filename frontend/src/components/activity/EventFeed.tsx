import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, RotateCcw, RefreshCw, Filter } from 'lucide-react';
import { useRealtimeEventFeed, useIndexerHealth } from '../../hooks/useEventFeed';
import type { IndexedEvent } from '../../hooks/useEventFeed';
import { timeAgo, formatCurrency } from '../../lib/utils';

/* ─── Event type display helpers ────────────────────────────────────── */

const EVENT_TYPE_LABELS: Record<string, string> = {
  escrow_created: 'Escrow Created',
  escrow_released: 'Escrow Released',
  escrow_refunded: 'Escrow Refunded',
  escrow_disputed: 'Escrow Disputed',
  reputation_updated: 'Reputation Updated',
  bounty_created: 'Bounty Created',
  bounty_claimed: 'Bounty Claimed',
  bounty_completed: 'Bounty Completed',
  submission_approved: 'Submission Approved',
  review_completed: 'Review Completed',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  escrow_created: 'text-emerald',
  escrow_released: 'text-emerald',
  escrow_refunded: 'text-status-warning',
  escrow_disputed: 'text-status-error',
  reputation_updated: 'text-purple',
  bounty_created: 'text-emerald',
  bounty_claimed: 'text-status-info',
  bounty_completed: 'text-emerald',
  submission_approved: 'text-emerald',
  review_completed: 'text-magenta',
};

function getEventLabel(type: string): string {
  return EVENT_TYPE_LABELS[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getEventColor(type: string): string {
  return EVENT_TYPE_COLORS[type] ?? 'text-text-secondary';
}

/* ─── Event Item ────────────────────────────────────────────────────── */

function EventItem({ event }: { event: IndexedEvent }) {
  const color = getEventColor(event.event_type);
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-forge-850 transition-colors duration-150">
      <div className={`w-2 h-2 rounded-full ${color.replace('text-', 'bg-')} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-secondary truncate">
          <span className={`font-medium ${color}`}>{getEventLabel(event.event_type)}</span>
          {event.bounty_id && (
            <span className="text-text-muted ml-1">#{event.bounty_id}</span>
          )}
        </p>
        <p className="font-mono text-xs text-text-muted truncate">
          {event.user_wallet
            ? `${event.user_wallet.slice(0, 6)}...${event.user_wallet.slice(-4)}`
            : 'System'}
          {event.amount != null && (
            <span className="ml-2 text-emerald">{formatCurrency(event.amount, 0)} $FNDRY</span>
          )}
        </p>
      </div>
      <span className="font-mono text-xs text-text-muted flex-shrink-0 whitespace-nowrap">
        {timeAgo(event.indexed_at)}
      </span>
    </div>
  );
}

/* ─── EventFeed component ───────────────────────────────────────────── */

export function EventFeed() {
  const { connected, events, reconnect, disconnect } = useRealtimeEventFeed();
  const { data: health, isLoading: healthLoading } = useIndexerHealth();

  const [filterType, setFilterType] = useState<string>('all');

  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return events;
    return events.filter((e) => e.event_type === filterType);
  }, [events, filterType]);

  // Unique event types for the filter dropdown
  const eventTypes = useMemo(() => {
    const types = new Set(events.map((e) => e.event_type));
    return Array.from(types).sort();
  }, [events]);

  // Compute total indexed events from health data
  const totalIndexed = useMemo(() => {
    if (!health?.sources) return 0;
    return health.sources.reduce((sum, s) => sum + s.events_processed, 0);
  }, [health]);

  // Check if any indexer source is unhealthy
  const anyUnhealthy = useMemo(() => {
    if (!health?.sources) return false;
    return health.sources.some((s) => !s.is_healthy);
  }, [health]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-display text-text-primary tracking-wider uppercase">
            On-Chain Events
          </h1>
          {connected ? (
            <span className="flex items-center gap-1.5 text-xs font-mono text-emerald">
              <Wifi className="w-3 h-3" />
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-mono text-status-warning">
              <WifiOff className="w-3 h-3" />
              Polling
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!connected && (
            <button
              onClick={reconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-text-secondary
                bg-forge-800 hover:bg-forge-700 rounded-lg border border-border
                hover:border-border-hover transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reconnect
            </button>
          )}
          {connected && (
            <button
              onClick={disconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-text-secondary
                bg-forge-800 hover:bg-forge-700 rounded-lg border border-border
                hover:border-border-hover transition-colors"
            >
              <WifiOff className="w-3 h-3" />
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Indexer health warning */}
      {anyUnhealthy && !healthLoading && (
        <div className="mb-4 p-3 rounded-lg border border-status-warning/30 bg-status-warning/5">
          <p className="text-xs font-mono text-status-warning flex items-center gap-2">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Indexer Behind &mdash; some event sources are catching up
          </p>
        </div>
      )}

      {/* Total indexed + filter */}
      <div className="flex items-center justify-between mb-4">
        {totalIndexed > 0 && (
          <span className="font-mono text-xs text-text-muted">
            {formatCurrency(totalIndexed, 0)} total indexed
          </span>
        )}
        {totalIndexed === 0 && <span />}
        <div className="flex items-center gap-2">
          <Filter className="w-3 h-3 text-text-muted" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="appearance-none bg-forge-800 border border-border rounded-lg px-3 py-1.5
              text-xs font-mono text-text-secondary cursor-pointer
              hover:border-border-hover focus:outline-none focus:border-border-active
              transition-colors"
          >
            <option value="all">All Events</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {getEventLabel(type)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Event count */}
      <p className="font-mono text-xs text-text-muted mb-3">
        {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
      </p>

      {/* Event list */}
      <div className="space-y-0.5">
        <AnimatePresence mode="popLayout">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                transition={{ duration: 0.25 }}
                layout
              >
                <EventItem event={event} />
              </motion.div>
            ))
          ) : (
            <div className="py-12 text-center">
              <p className="font-mono text-sm text-text-muted">
                Waiting for on-chain events...
              </p>
              <p className="font-mono text-xs text-text-muted mt-2">
                Events will appear here as they are indexed from the blockchain
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}