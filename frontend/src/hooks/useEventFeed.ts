/**
 * React hook for real-time on-chain event feed via WebSocket + REST fallback.
 *
 * Subscribes to the 'indexed_events' WebSocket channel for live updates
 * and falls back to polling the REST API when WebSocket is unavailable.
 * Uses React Query for caching and automatic refetching.
 *
 * @module hooks/useEventFeed
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';

/** Shape of a single indexed on-chain event from the API. */
export interface IndexedEvent {
  id: string;
  transaction_signature: string;
  log_index: number;
  event_type: string;
  program_id: string;
  block_slot: number;
  block_time: string;
  source: string;
  accounts: Record<string, unknown>;
  data: Record<string, unknown>;
  user_wallet: string | null;
  bounty_id: string | null;
  amount: number | null;
  status: string;
  indexed_at: string;
}

/** Paginated response from the events query endpoint. */
export interface EventListResponse {
  events: IndexedEvent[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/** Per-source health record. */
export interface IndexerSourceHealth {
  source: string;
  latest_slot: number;
  latest_block_time: string | null;
  events_processed: number;
  last_webhook_received_at: string | null;
  last_error: string | null;
  is_healthy: boolean;
  seconds_behind: number | null;
}

/** Aggregated indexer health status. */
export interface IndexerHealth {
  sources: IndexerSourceHealth[];
  overall_healthy: boolean;
}

/** Filter parameters for the event query. */
export interface EventFilters {
  eventType?: string;
  userWallet?: string;
  bountyId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

/** WebSocket connection URL for the event feed channel. */
const WS_BASE = (import.meta.env?.VITE_WS_URL as string) || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;

/**
 * Hook for querying indexed on-chain events with filtering and pagination.
 *
 * Uses React Query for caching, automatic background refetching, and
 * stale-while-revalidate behavior.
 *
 * @param filters - Optional filter parameters for the query.
 * @returns React Query result with paginated event data.
 */
export function useEventList(filters: EventFilters = {}) {
  const params: Record<string, string | number | boolean | undefined> = {};

  if (filters.eventType) params.event_type = filters.eventType;
  if (filters.userWallet) params.user_wallet = filters.userWallet;
  if (filters.bountyId) params.bounty_id = filters.bountyId;
  if (filters.startDate) params.start_date = filters.startDate;
  if (filters.endDate) params.end_date = filters.endDate;
  if (filters.status) params.status = filters.status;
  if (filters.page) params.page = filters.page;
  if (filters.pageSize) params.page_size = filters.pageSize;

  return useQuery<EventListResponse>({
    queryKey: ['indexed-events', filters],
    queryFn: () => apiClient<EventListResponse>('/api/indexed-events', { params }),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

/**
 * Hook for monitoring indexer health status.
 *
 * Polls the health endpoint every 60 seconds to detect
 * when the indexer falls behind or encounters errors.
 *
 * @returns React Query result with indexer health data.
 */
export function useIndexerHealth() {
  return useQuery<IndexerHealth>({
    queryKey: ['indexer-health'],
    queryFn: () => apiClient<IndexerHealth>('/api/indexed-events/health'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/**
 * Hook for real-time event feed via WebSocket with REST polling fallback.
 *
 * Attempts to connect to the WebSocket server and subscribe to the
 * 'indexed_events' channel. Falls back to polling the REST API at
 * the specified interval if WebSocket connection fails.
 *
 * @param options - Configuration options.
 * @param options.token - Authentication token for WebSocket connection.
 * @param options.onEvent - Callback fired for each new event received.
 * @param options.pollInterval - REST fallback poll interval in ms (default 15000).
 * @returns Object with connection status, recent events, and reconnect function.
 */
export function useRealtimeEventFeed(options: {
  token?: string;
  onEvent?: (event: IndexedEvent) => void;
  pollInterval?: number;
} = {}) {
  const { token, onEvent, pollInterval = 15_000 } = options;
  const [connected, setConnected] = useState(false);
  const [recentEvents, setRecentEvents] = useState<IndexedEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Connect to the WebSocket server and subscribe to indexed_events. */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = `${WS_BASE}/ws${token ? `?token=${token}` : ''}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'indexed_events' }));
      };

      ws.onmessage = (messageEvent) => {
        try {
          const parsed = JSON.parse(messageEvent.data);
          if (parsed.channel === 'indexed_events' && parsed.data?.payload) {
            const eventData = parsed.data.payload as IndexedEvent;
            setRecentEvents((prev) => [eventData, ...prev].slice(0, 50));
            onEvent?.(eventData);
          }
        } catch {
          /* ignore non-JSON messages like pings */
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Auto-reconnect after 5 seconds
        reconnectTimerRef.current = setTimeout(connect, 5_000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      setConnected(false);
    }
  }, [token, onEvent]);

  /** Disconnect from the WebSocket server. */
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // REST polling fallback when WebSocket is not connected
  const { data: polledData } = useQuery<EventListResponse>({
    queryKey: ['indexed-events-poll'],
    queryFn: () => apiClient<EventListResponse>('/api/indexed-events', {
      params: { page_size: 20 },
    }),
    refetchInterval: connected ? false : pollInterval,
    enabled: !connected,
    staleTime: 5_000,
  });

  // Merge polled events when not connected via WebSocket
  const events = connected
    ? recentEvents
    : polledData?.events ?? recentEvents;

  return {
    connected,
    events,
    reconnect: connect,
    disconnect,
  };
}
