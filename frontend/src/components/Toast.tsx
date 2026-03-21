/**
 * Toast — Notification system for SolFoundry.
 *
 * Usage:
 *   const { toast, dismiss } = useToast();
 *   toast.success('Bounty claimed!');
 *   toast.error('Transaction failed');
 *
 * Mount <ToastContainer /> once at the app root (inside the provider or layout).
 *
 * @module Toast
 */
import React, { useEffect, useState, createContext, useContext, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
}

interface ToastControls {
  success: (message: string) => string;
  error: (message: string) => string;
  warning: (message: string) => string;
  info: (message: string) => string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: ToastControls;
  dismiss: (id: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 4000;
const MAX_TOASTS = 4;

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * ToastProvider — wraps your app and makes the useToast() hook available.
 * Also mounts the ToastContainer automatically.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
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
      setToasts((prev) => {
        const trimmed =
          prev.length >= MAX_TOASTS ? prev.slice(prev.length - (MAX_TOASTS - 1)) : prev;
        return [...trimmed, { id, type, message, createdAt: Date.now() }];
      });
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  const toast: ToastControls = {
    success: (msg) => add('success', msg),
    error: (msg) => add('error', msg),
    warning: (msg) => add('warning', msg),
    info: (msg) => add('info', msg),
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useToast — access the toast API from any child component.
 *
 * @example
 *   const { toast, dismiss } = useToast();
 *   toast.success('Done!');
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}

// ─── Toast colours ─────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<
  ToastType,
  { border: string; icon: string; iconBg: string; label: string }
> = {
  success: {
    border: 'border-l-green-500',
    icon: '✓',
    iconBg: 'bg-green-500/20 text-green-400',
    label: 'Success',
  },
  error: {
    border: 'border-l-red-500',
    icon: '✕',
    iconBg: 'bg-red-500/20 text-red-400',
    label: 'Error',
  },
  warning: {
    border: 'border-l-yellow-500',
    icon: '!',
    iconBg: 'bg-yellow-500/20 text-yellow-400',
    label: 'Warning',
  },
  info: {
    border: 'border-l-blue-500',
    icon: 'i',
    iconBg: 'bg-blue-500/20 text-blue-400',
    label: 'Info',
  },
};

// ─── Single Toast ──────────────────────────────────────────────────────────────

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const styles = TYPE_STYLES[toast.type];

  // Slide in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        transition: 'opacity 300ms ease, transform 300ms ease',
        opacity: visible && !leaving ? 1 : 0,
        transform: visible && !leaving ? 'translateX(0)' : 'translateX(100%)',
      }}
      className={`
        flex items-start gap-3 w-80 max-w-[calc(100vw-2rem)]
        bg-gray-800 border border-white/10 border-l-4 ${styles.border}
        rounded-lg shadow-2xl p-4 pointer-events-auto
      `}
    >
      {/* Icon */}
      <span
        className={`
          flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
          text-xs font-bold ${styles.iconBg}
        `}
        aria-hidden="true"
      >
        {styles.icon}
      </span>

      {/* Message */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {styles.label}
        </p>
        <p className="text-sm text-white mt-0.5 break-words">{toast.message}</p>
      </div>

      {/* Close button */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        className="flex-shrink-0 text-gray-500 hover:text-white transition-colors ml-1 -mt-0.5"
      >
        <span aria-hidden="true" className="text-lg leading-none">×</span>
      </button>
    </div>
  );
}

// ─── Container ────────────────────────────────────────────────────────────────

/**
 * ToastContainer — renders the active toast stack in the top-right corner.
 * Mount once near the app root (done automatically by ToastProvider).
 * Can also be used standalone if you manage state via useToast() manually.
 */
export function ToastContainer() {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;
  const { toasts, dismiss } = ctx;

  return (
    <div
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}

export default ToastContainer;
