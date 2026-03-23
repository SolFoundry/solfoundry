/**
 * WebSocket hook for real-time admin dashboard updates.
 * Connects to the existing /ws endpoint using the admin token as the identity.
 * @module hooks/useAdminWebSocket
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { getAdminToken } from './useAdminData';

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface AdminWsEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

const WS_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000')
  .replace(/^http/, 'ws');

const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

export function useAdminWebSocket(onEvent?: (event: AdminWsEvent) => void) {
  const [status, setStatus] = useState<WsStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<AdminWsEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnect = useRef(true);

  const connect = useCallback(() => {
    const token = getAdminToken();
    if (!token) {
      setStatus('error');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      reconnectAttempts.current = 0;
      // Subscribe to the admin channel
      ws.send(JSON.stringify({ action: 'subscribe', topic: 'admin' }));
    };

    ws.onmessage = (evt) => {
      try {
        const raw = JSON.parse(evt.data as string);
        const event: AdminWsEvent = {
          type: raw.type ?? raw.action ?? 'unknown',
          payload: raw.payload ?? raw,
          timestamp: raw.timestamp ?? new Date().toISOString(),
        };
        setLastEvent(event);
        onEvent?.(event);
      } catch {
        // Non-JSON frames (e.g. heartbeat pings) are silently ignored
      }
    };

    ws.onerror = () => {
      setStatus('error');
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;

      if (!shouldReconnect.current) return;

      const delay = Math.min(
        BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts.current,
        MAX_RECONNECT_DELAY_MS,
      );
      reconnectAttempts.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };
  }, [onEvent]);

  useEffect(() => {
    shouldReconnect.current = true;
    connect();

    return () => {
      shouldReconnect.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  // connect is stable (useCallback with no deps that change), so this is safe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnect = useCallback(() => {
    shouldReconnect.current = false;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    setStatus('disconnected');
  }, []);

  return { status, lastEvent, disconnect };
}
