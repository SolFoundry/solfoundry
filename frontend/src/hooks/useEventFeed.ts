import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../services/apiClient';

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface IndexedEvent {
  id: string;
  transaction_signature: string | null;
  log_index: number;
  event_type: string;
  program_id: string;
  block_slot: number;
  block_time: string;
  source: string;
  accounts: Record<string, string>;
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

export interface RealtimeEventFeedState {
  connected: boolean;
  events: IndexedEvent[];
  reconnect: () => void;
  disconnect: () => void;
}

/* ─── WebSocket URL ─────────────────────────────────────────────────── */

const WS_BASE = import.meta.env?.VITE_WS_URL
  ? (import.meta.env.VITE_WS_URL as string)
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

const WS_ENDPOINT = `${WS_BASE}/api/events/ws`;

/* ─── Hook: useRealtimeEventFeed ────────────────────────────────────── */

export function useRealtimeEventFeed(): RealtimeEventFeedState {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<IndexedEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_ENDPOINT);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (msg: MessageEvent) => {
        try {
          const parsed = JSON.parse(msg.data) as IndexedEvent;
          setEvents((prev) => [parsed, ...prev].slice(0, 100));
        } catch {
          // ignore unparseable messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Auto-reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch {
      // connection failed silently
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    setEvents([]);
    connect();
  }, [connect, disconnect]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { connected, events, reconnect, disconnect };
}

/* ─── Hook: useIndexerHealth ────────────────────────────────────────── */

export function useIndexerHealth() {
  const [data, setData] = useState<IndexerHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchHealth() {
      try {
        const result = await apiClient<IndexerHealth>('/api/events/health');
        if (!cancelled) {
          setData(result);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { data, isLoading };
}