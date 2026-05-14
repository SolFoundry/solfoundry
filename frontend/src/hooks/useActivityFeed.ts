import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  ActivityEvent,
  FeedEventType,
  ConnectionStatus,
  NotificationPreferences,
} from '../types/activity';
import { DEFAULT_NOTIFICATION_PREFS } from '../types/activity';
import { apiClient } from '../services/apiClient';

/* ─── Config ─── */

const POLL_INTERVAL_MS = 15_000; // 15s polling when WS unavailable
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const MAX_EVENTS = 200;
const NOTIF_STORAGE_KEY = 'solfoundry-notification-prefs';

/* ─── Hook ─── */

export function useActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [filters, setFilters] = useState<Set<FeedEventType>>(new Set());
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => {
    try {
      const stored = localStorage.getItem(NOTIF_STORAGE_KEY);
      return stored ? { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(stored) } : DEFAULT_NOTIFICATION_PREFS;
    } catch {
      return DEFAULT_NOTIFICATION_PREFS;
    }
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setInterval>>();
  const mountedRef = useRef(true);

  /* ── Persist prefs ── */
  const updatePrefs = useCallback((update: Partial<NotificationPreferences>) => {
    setPrefs(prev => {
      const next = { ...prev, ...update };
      try { localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  /* ── Add event with dedup + cap ── */
  const addEvent = useCallback((event: ActivityEvent) => {
    if (!prefs[event.type as keyof NotificationPreferences]) return; // muted
    setEvents(prev => {
      if (prev.some(e => e.id === event.id)) return prev; // dedup
      const next = [event, ...prev];
      return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
    });
  }, [prefs]);

  /* ── Polling fallback ── */
  const poll = useCallback(async () => {
    try {
      const data = await apiClient<{ events: ActivityEvent[] }>('/api/activity', {
        params: { limit: 20 },
      });
      if (mountedRef.current && data?.events) {
        for (const ev of data.events) {
          addEvent({ ...ev, source: ev.source ?? 'poll' });
        }
        setStatus('polling');
      }
    } catch {
      // API not available yet — that's fine, we'll retry
    }
  }, [addEvent]);

  /* ── WebSocket connection ── */
  const connectWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Determine WS URL from current origin
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/activity`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setStatus('reconnecting');

      ws.onopen = () => {
        if (mountedRef.current) {
          setStatus('connected');
          reconnectAttempt.current = 0;
        }
      };

      ws.onmessage = (msg) => {
        try {
          const event: ActivityEvent = JSON.parse(msg.data);
          if (mountedRef.current) addEvent({ ...event, source: 'ws' });
        } catch { /* malformed */ }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setStatus('disconnected');
        scheduleReconnect();
      };

      ws.onerror = () => {
        // onclose will fire after this
      };
    } catch {
      // WebSocket constructor failed (unlikely)
      scheduleReconnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addEvent]);

  /* ── Reconnect with exponential backoff ── */
  const scheduleReconnect = useCallback(() => {
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt.current, RECONNECT_MAX_MS);
    reconnectAttempt.current += 1;

    // After 3 failed WS attempts, fall back to polling
    if (reconnectAttempt.current > 3) {
      setStatus('polling');
      return;
    }

    setTimeout(() => {
      if (mountedRef.current) connectWs();
    }, delay);
  }, [connectWs]);

  /* ── Lifecycle ── */
  useEffect(() => {
    mountedRef.current = true;
    connectWs();

    // Start polling as a parallel data source (fills gaps WS might miss)
    poll(); // initial fetch
    pollTimer.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (wsRef.current) wsRef.current.close();
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Manual reconnect ── */
  const reconnect = useCallback(() => {
    reconnectAttempt.current = 0;
    connectWs();
  }, [connectWs]);

  /* ── Filtered events ── */
  const filteredEvents = filters.size > 0
    ? events.filter(e => filters.has(e.type))
    : events;

  return {
    events: filteredEvents,
    allEvents: events,
    status,
    filters,
    setFilters,
    prefs,
    updatePrefs,
    reconnect,
  };
}
