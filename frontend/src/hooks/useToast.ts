/**
 * useToast — Lightweight toast notification hook.
 * Supports success, error, warning, and info toasts.
 * Max 4 toasts stacked; auto-dismiss after 4s.
 * @module useToast
 */
import { useState, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  /** Timestamp when the toast was created (ms) */
  createdAt: number;
}

export interface ToastControls {
  success: (message: string) => string;
  error: (message: string) => string;
  warning: (message: string) => string;
  info: (message: string) => string;
}

export interface UseToastReturn {
  toasts: Toast[];
  toast: ToastControls;
  dismiss: (id: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 4000;
const MAX_TOASTS = 4;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    // Clear the auto-dismiss timer if present
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (type: ToastType, message: string): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: Toast = { id, type, message, createdAt: Date.now() };

      setToasts((prev) => {
        // Trim to MAX_TOASTS - 1 to make room for the new one
        const trimmed = prev.length >= MAX_TOASTS ? prev.slice(prev.length - (MAX_TOASTS - 1)) : prev;
        return [...trimmed, newToast];
      });

      // Auto-dismiss
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);

      return id;
    },
    [dismiss],
  );

  const toast: ToastControls = {
    success: (message) => add('success', message),
    error: (message) => add('error', message),
    warning: (message) => add('warning', message),
    info: (message) => add('info', message),
  };

  return { toasts, toast, dismiss };
}
