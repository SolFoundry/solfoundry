/**
 * Real-time on-chain event feed component for the dashboard.
 *
 * Displays a live stream of indexed Solana program events with
 * filtering by event type, connection status indicator, and
 * auto-scrolling for new events. Uses the useRealtimeEventFeed
 * hook for WebSocket-based real-time updates with REST fallback.
 *
 * @module components/activity/EventFeed
 */

import React, { useState, useMemo } from 'react';
import {
  useRealtimeEventFeed,
  useIndexerHealth,
  type IndexedEvent,
} from '../../hooks/useEventFeed';

/** Human-readable labels for on-chain event types. */
const EVENT_TYPE_LABELS: Record<string, string> = {
  escrow_created: 'Escrow Created',
  escrow_released: 'Escrow Released',
  escrow_funded: 'Escrow Funded',
  escrow_refunded: 'Escrow Refunded',
  reputation_updated: 'Reputation Updated',
  stake_deposited: 'Stake Deposited',
};

/** Color classes for each event type badge. */
const EVENT_TYPE_COLORS: Record<string, string> = {
  escrow_created: 'bg-[#9945FF]/20 text-[#9945FF]',
  escrow_released: 'bg-[#14F195]/20 text-[#14F195]',
  escrow_funded: 'bg-blue-500/20 text-blue-400',
  escrow_refunded: 'bg-orange-500/20 text-orange-400',
  reputation_updated: 'bg-yellow-500/20 text-yellow-400',
  stake_deposited: 'bg-cyan-500/20 text-cyan-400',
};

/**
 * Format a transaction signature for display by truncating the middle.
 *
 * @param signature - Full base-58 transaction signature.
 * @returns Truncated signature like "5abc...xyz1".
 */
function truncateSignature(signature: string): string {
  if (signature.length <= 16) return signature;
  return `${signature.slice(0, 8)}...${signature.slice(-8)}`;
}

/**
 * Format a timestamp into a relative time string (e.g., "2m ago").
 *
 * @param timestamp - ISO 8601 timestamp string.
 * @returns Human-readable relative time.
 */
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Single event row in the feed.
 *
 * Displays event type badge, transaction signature link, wallet
 * address, amount, and relative timestamp.
 */
function EventRow({ event }: { event: IndexedEvent }) {
  const typeLabel = EVENT_TYPE_LABELS[event.event_type] || event.event_type;
  const typeColor = EVENT_TYPE_COLORS[event.event_type] || 'bg-gray-500/20 text-gray-400';
  const timestamp = event.block_time || event.indexed_at;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
      {/* Event type badge */}
      <span className={`px-2 py-0.5 rounded text-xs font-mono whitespace-nowrap ${typeColor}`}>
        {typeLabel}
      </span>

      {/* Transaction signature */}
      <a
        href={`https://solscan.io/tx/${event.transaction_signature}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-mono text-gray-400 hover:text-[#9945FF] transition-colors"
        title={event.transaction_signature}
      >
        {truncateSignature(event.transaction_signature)}
      </a>

      {/* Wallet */}
      {event.user_wallet && (
        <span className="text-xs font-mono text-gray-500 hidden sm:inline" title={event.user_wallet}>
          {truncateSignature(event.user_wallet)}
        </span>
      )}

      {/* Amount */}
      {event.amount != null && (
        <span className="text-xs font-mono text-[#14F195] ml-auto">
          {Number(event.amount).toLocaleString()} $FNDRY
        </span>
      )}

      {/* Timestamp */}
      <span className="text-xs text-gray-500 ml-auto whitespace-nowrap">
        {formatRelativeTime(timestamp)}
      </span>
    </div>
  );
}

/** Available event type filter options. */
const EVENT_TYPES = [
  { value: '', label: 'All Events' },
  { value: 'escrow_created', label: 'Escrow Created' },
  { value: 'escrow_released', label: 'Escrow Released' },
  { value: 'escrow_funded', label: 'Escrow Funded' },
  { value: 'escrow_refunded', label: 'Escrow Refunded' },
  { value: 'reputation_updated', label: 'Reputation Updated' },
  { value: 'stake_deposited', label: 'Stake Deposited' },
];

/**
 * Real-time on-chain event feed dashboard widget.
 *
 * Features:
 * - Live WebSocket connection with auto-reconnect
 * - REST polling fallback when WebSocket is unavailable
 * - Event type filtering
 * - Indexer health status indicator
 * - Solscan links for transaction inspection
 *
 * @param props.token - Optional auth token for WebSocket connection.
 * @returns The event feed component.
 */
export function EventFeed({ token }: { token?: string }) {
  const [filterType, setFilterType] = useState('');
  const { connected, events, reconnect } = useRealtimeEventFeed({ token });
  const { data: health } = useIndexerHealth();

  /** Filtered events based on selected event type. */
  const filteredEvents = useMemo(() => {
    if (!filterType) return events;
    return events.filter((event) => event.event_type === filterType);
  }, [events, filterType]);

  const isHealthy = health?.overall_healthy ?? true;

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white font-mono">
            On-Chain Events
          </h3>
          {/* Connection status indicator */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-[#14F195] animate-pulse' : 'bg-gray-500'
              }`}
            />
            <span className="text-xs text-gray-500">
              {connected ? 'Live' : 'Polling'}
            </span>
          </div>
          {/* Indexer health */}
          {!isHealthy && (
            <span className="px-2 py-0.5 rounded text-xs bg-orange-500/20 text-orange-400">
              Indexer Behind
            </span>
          )}
        </div>

        {/* Filter dropdown */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 font-mono focus:outline-none focus:border-[#9945FF]/50"
        >
          {EVENT_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Event list */}
      <div className="max-h-[400px] overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm font-mono">
            {events.length === 0
              ? 'Waiting for on-chain events...'
              : 'No events match the selected filter'}
          </div>
        ) : (
          filteredEvents.map((event) => (
            <EventRow key={`${event.transaction_signature}-${event.log_index}`} event={event} />
          ))
        )}
      </div>

      {/* Footer with stats */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 bg-white/[0.02]">
        <span className="text-xs text-gray-500 font-mono">
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
        </span>
        {health?.sources && health.sources.length > 0 && (
          <span className="text-xs text-gray-500 font-mono">
            {health.sources.reduce((sum, s) => sum + s.events_processed, 0).toLocaleString()} total indexed
          </span>
        )}
        {!connected && (
          <button
            onClick={reconnect}
            className="text-xs text-[#9945FF] hover:text-[#9945FF]/80 font-mono"
          >
            Reconnect
          </button>
        )}
      </div>
    </div>
  );
}

export default EventFeed;
