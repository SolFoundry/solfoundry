/**
 * useActivityFeed - Real-time WebSocket Activity Feed Hook
 * SolFoundry Bounty Platform - T3 Bounty #860
 *
 * Connects to WebSocket server for real-time activity updates
 * with automatic reconnection and polling fallback.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export type ActivityType =
  | 'bounty_posted'
  | 'bounty_submitted'
  | 'bounty_reviewed'
  | 'bounty_completed'
  | 'leaderboard_change';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  actor: string;
  timestamp: string;
  bountyId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityFeedConfig {
  url?: string;
  path?: string;
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  filterTypes?: ActivityType[];
}

const DEFAULT_CONFIG: Required<ActivityFeedConfig> = {
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  path: '/activity-feed',
  autoConnect: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  filterTypes: [],
};

interface UseActivityFeedReturn {
  events: ActivityEvent[];
  connected: boolean;
  connecting: boolean;
  error: string | null;
  setFilters: (types: ActivityType[]) => void;
  clearEvents: () => void;
  reconnect: () => void;
  disconnect: () => void;
}

export function useActivityFeed(config: ActivityFeedConfig = {}): UseActivityFeedReturn {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const filterTypesRef = useRef<ActivityType[]>(mergedConfig.filterTypes);

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const filterEvents = useCallback(
    (newEvents: ActivityEvent[]) => {
      const filters = filterTypesRef.current;
      if (filters.length === 0) return newEvents;
      return newEvents.filter((e) => filters.includes(e.type));
    },
    []
  );

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    setConnecting(true);
    setError(null);

    const socket = io(mergedConfig.url, {
      path: mergedConfig.path,
      reconnection: true,
      reconnectionAttempts: mergedConfig.reconnectionAttempts,
      reconnectionDelay: mergedConfig.reconnectionDelay,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
      setConnecting(false);
      setError(null);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
      if (!pollingRef.current) {
        pollingRef.current = setInterval(fetchRecentActivities, 5000);
      }
    });

    socket.on('connect_error', (err: Error) => {
      setError(err.message);
      setConnecting(false);
      setConnected(false);
    });

    socket.on('activity', (message: { event: ActivityType; data: ActivityEvent }) => {
      const filters = filterTypesRef.current;
      if (filters.length > 0 && !filters.includes(message.data.type)) return;
      setEvents((prev) => [message.data, ...prev].slice(0, 50));
    });

    socket.on('activity-history', ({ items }: { items: ActivityEvent[] }) => {
      const filtered = filterEvents(items);
      setEvents(filtered.slice(0, 50));
    });

    socket.on('activities', ({ items }: { items: ActivityEvent[] }) => {
      const filtered = filterEvents(items);
      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newItems = filtered.filter((e) => !existingIds.has(e.id));
        return [...newItems, ...prev].slice(0, 50);
      });
    });

    socketRef.current = socket;
  }, [mergedConfig.url, mergedConfig.path, mergedConfig.reconnectionAttempts, mergedConfig.reconnectionDelay, filterEvents]);

  const fetchRecentActivities = useCallback(async () => {
    try {
      const response = await fetch(`${mergedConfig.url}/api/activities?limit=20`);
      if (!response.ok) return;
      const data = await response.json();
      const filtered = filterEvents(data.items || []);
      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newItems = filtered.filter((e) => !existingIds.has(e.id));
        return [...newItems, ...prev].slice(0, 50);
      });
    } catch {
      // Silently fail during polling
    }
  }, [mergedConfig.url, filterEvents]);

  const setFilters = useCallback((types: ActivityType[]) => {
    filterTypesRef.current = types;
    if (socketRef.current?.connected) {
      socketRef.current.emit('set-filters', { types });
    }
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    connect();
  }, [connect]);

  const disconnect = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (mergedConfig.autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [mergedConfig.autoConnect, connect, disconnect]);

  return {
    events,
    connected,
    connecting,
    error,
    setFilters,
    clearEvents,
    reconnect,
    disconnect,
  };
}
