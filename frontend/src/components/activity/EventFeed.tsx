/**
 * EventFeed — real-time on-chain activity widget.
 *
 * Displays live Solana events (escrow, reputation, bounty) streamed via WebSocket
 * with a polling fallback. Supports per-type filtering and indexer health display.
 */
import React, { useState, useMemo } from 'react';
import { useRealtimeEventFeed, useIndexerHealth } from '../../hooks/useEventFeed';
import type { IndexedEvent } from '../../hooks/useEventFeed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEventType(raw: string): string {
  return raw
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatAmount(n: number): string {
  return n.toLocaleString();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const EVENT_COLORS: Record<string, string> = {
  escrow_created: 'bg-[#14F195]/20 text-[#14F195]',
  escrow_released: 'bg-purple-500/20 text-purple-400',
  reputation_updated: 'bg-blue-500/20 text-blue-400',
  bounty_created: 'bg-yellow-500/20 text-yellow-400',
  bounty_submitted: 'bg-orange-500/20 text-orange-400',
  leaderboard_changed: 'bg-pink-500/20 text-pink-400',
};

function eventColor(type: string): string {
  return EVENT_COLORS[type] ?? 'bg-white/10 text-white/60';
}

// ---------------------------------------------------------------------------
// EventRow
// ---------------------------------------------------------------------------

function EventRow({ event }: { event: IndexedEvent }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      {/* Type badge */}
      <span
        className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${eventColor(event.event_type)}`}
      >
        {formatEventType(event.event_type)}
      </span>

      {/* Details */}
      <div className="flex-1 min-w-0">
        {event.bounty_id && (
          <p className="text-xs text-white/50 truncate">bounty: {event.bounty_id}</p>
        )}
        {event.user_wallet && (
          <p className="text-xs font-mono text-white/40 truncate">{event.user_wallet}</p>
        )}
        {event.amount != null && (
          <p className="text-xs text-[#14F195] mt-0.5">
            {formatAmount(event.amount)} $FNDRY
          </p>
        )}
      </div>

      {/* Time */}
      <span className="shrink-0 text-xs text-white/30">{timeAgo(event.block_time)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EventFeed
// ---------------------------------------------------------------------------

export function EventFeed() {
  const { connected, events, reconnect } = useRealtimeEventFeed();
  const { data: health } = useIndexerHealth();
  const [typeFilter, setTypeFilter] = useState('');

  // Unique event types for the filter dropdown (derived from live events)
  const eventTypes = useMemo(
    () => Array.from(new Set(events.map((e) => e.event_type))).sort(),
    [events],
  );

  const filtered = useMemo(
    () => (typeFilter ? events.filter((e) => e.event_type === typeFilter) : events),
    [events, typeFilter],
  );

  const totalIndexed = useMemo(() => {
    if (!health) return null;
    return health.sources.reduce((sum, s) => sum + s.events_processed, 0);
  }, [health]);

  const isUnhealthy = health && !health.overall_healthy;

  const countLabel = `${filtered.length} ${filtered.length === 1 ? 'event' : 'events'}`;

  return (
    <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">On-Chain Events</h2>
          <span
            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
              connected
                ? 'bg-[#14F195]/20 text-[#14F195]'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? 'bg-[#14F195] animate-pulse' : 'bg-yellow-400'
              }`}
            />
            {connected ? 'Live' : 'Polling'}
          </span>
          {!connected && (
            <button
              onClick={reconnect}
              className="text-xs text-white/50 hover:text-white underline"
            >
              Reconnect
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {totalIndexed != null && (
            <span className="text-xs text-white/40">
              {totalIndexed.toLocaleString()} total indexed
            </span>
          )}
          <span className="text-xs text-white/30">{countLabel}</span>
        </div>
      </div>

      {/* Indexer health warning */}
      {isUnhealthy && (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <span className="text-yellow-400 text-xs font-medium">Indexer Behind</span>
          <span className="text-yellow-400/60 text-xs">
            Some sources may be delayed
          </span>
        </div>
      )}

      {/* Filter bar */}
      <div className="px-4 py-2 border-b border-white/5">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"
        >
          <option value="">All event types</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>
              {formatEventType(t)}
            </option>
          ))}
        </select>
      </div>

      {/* Event list */}
      <div className="px-4 max-h-96 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-white/30 text-center py-8">
            Waiting for on-chain events...
          </p>
        ) : (
          filtered.map((event) => <EventRow key={event.id} event={event} />)
        )}
      </div>
    </div>
  );
}
