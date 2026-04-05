/**
 * useEventFeed — real-time on-chain event feed via WebSocket with polling fallback.
 *
 * Connects to the backend WebSocket endpoint. When the socket is unavailable or
 * drops, automatically falls back to HTTP polling and exposes a `reconnect` helper.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types (exported so tests + components can import them)
// ---------------------------------------------------------------------------

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

export interface IndexerSourceHealth {
  source: string;
  is_healthy: boolean;
  events_processed: number;
}

export interface IndexerHealth {
  sources: IndexerSourceHealth[];
  overall_healthy: boolean;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WS_PATH = '/ws/events';
const POLL_INTERVAL_MS = 5_000;
const MAX_EVENTS = 100; // cap buffer to avoid unbounded growth

// ---------------------------------------------------------------------------
// useRealtimeEventFeed
// ---------------------------------------------------------------------------

export function useRealtimeEventFeed() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<IndexedEvent[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Polling fallback ----
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/events?limit=20');
        if (!res.ok) return;
        const body: { items: IndexedEvent[] } = await res.json();
        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const incoming = body.items.filter((e) => !existingIds.has(e.id));
          if (!incoming.length) return prev;
          return [...incoming, ...prev].slice(0, MAX_EVENTS);
        });
      } catch {
        // silently ignore network errors during polling
      }
    }, POLL_INTERVAL_MS);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ---- WebSocket connection ----
  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}://${host}${WS_PATH}`);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      stopPolling();
    };

    ws.onmessage = (msg) => {
      try {
        const event: IndexedEvent = JSON.parse(msg.data);
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      setConnected(false);
      startPolling();
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [startPolling, stopPolling]);

  const disconnect = useCallback(() => {
    socketRef.current?.close();
    stopPolling();
    setConnected(false);
  }, [stopPolling]);

  const reconnect = useCallback(() => {
    disconnect();
    connect();
  }, [connect, disconnect]);

  // Initial connect
  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.close();
      stopPolling();
    };
  }, [connect, stopPolling]);

  return { connected, events, reconnect, disconnect };
}

// ---------------------------------------------------------------------------
// useIndexerHealth
// ---------------------------------------------------------------------------

async function fetchIndexerHealth(): Promise<IndexerHealth> {
  const res = await fetch('/api/events/health');
  if (!res.ok) throw new Error('health check failed');
  return res.json();
}

export function useIndexerHealth() {
  return useQuery<IndexerHealth>({
    queryKey: ['indexer-health'],
    queryFn: fetchIndexerHealth,
    refetchInterval: 30_000,
    retry: false,
  });
}
