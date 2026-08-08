/**
 * ToastContext — global toast notification system.
 *
 * Provides a `useToast()` hook that surfaces success, error, warning, and info
 * toasts. Toasts auto-dismiss after 5 seconds, support manual close, stack
 * vertically in the top-right corner, and announce themselves to screen
 * readers via `role="alert"`.
 *
 * Usage:
 * ```
 * const toast = useToast();
 * toast.success('Bounty created');
 * toast.error('Something went wrong');
 * toast.warning('Deadline approaching');
 * toast.info('Good to know');
 * ```
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastContextValue {
  /** Show a success toast. */
  success: (title: string, description?: string) => void;
  /** Show an error toast. */
  error: (title: string, description?: string) => void;
  /** Show a warning toast. */
  warning: (title: string, description?: string) => void;
  /** Show an info toast. */
  info: (title: string, description?: string) => void;
  /** Dismiss a toast by id. */
  dismiss: (id: number) => void;
}

const AUTO_DISMISS_MS = 5000;

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_CONFIG: Record<ToastVariant, { icon: React.ReactNode; ring: string; iconColor: string }> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />,
    ring: 'border-status-success/40',
    iconColor: 'text-status-success',
  },
  error: {
    icon: <XCircle className="h-5 w-5" aria-hidden="true" />,
    ring: 'border-status-error/40',
    iconColor: 'text-status-error',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
    ring: 'border-status-warning/40',
    iconColor: 'text-status-warning',
  },
  info: {
    icon: <Info className="h-5 w-5" aria-hidden="true" />,
    ring: 'border-status-info/40',
    iconColor: 'text-status-info',
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, title: string, description?: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, variant, title, description }]);
      if (AUTO_DISMISS_MS > 0) {
        window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      }
    },
    [dismiss],
  );

  const api = useMemo<ToastContextValue>(
    () => ({
      success: (title: string, description?: string) => push('success', title, description),
      error: (title: string, description?: string) => push('error', title, description),
      warning: (title: string, description?: string) => push('warning', title, description),
      info: (title: string, description?: string) => push('info', title, description),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Top-right toast stack */}
      <div
        className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const cfg = VARIANT_CONFIG[toast.variant];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                role="alert"
                className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${cfg.ring} bg-forge-800 p-4 shadow-lg shadow-black/40`}
              >
                <span className={`mt-0.5 flex-shrink-0 ${cfg.iconColor}`}>{cfg.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                      {toast.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="flex-shrink-0 rounded-md p-1 text-text-muted transition-colors hover:text-text-primary hover:bg-white/5"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}