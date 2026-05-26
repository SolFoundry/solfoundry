import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title?: string;
  duration?: number;
}

interface Toast {
  id: string;
  message: string;
  title?: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, options?: ToastOptions) => string;
  dismissToast: (id: string) => void;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
}

const DEFAULT_DURATION = 5000;
const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, { icon: React.ElementType; border: string; iconClass: string; title: string }> = {
  success: {
    icon: CheckCircle2,
    border: 'border-emerald-border bg-emerald-bg text-emerald',
    iconClass: 'text-emerald',
    title: 'Success',
  },
  error: {
    icon: AlertCircle,
    border: 'border-status-error/30 bg-status-error/10 text-status-error',
    iconClass: 'text-status-error',
    title: 'Error',
  },
  warning: {
    icon: TriangleAlert,
    border: 'border-status-warning/30 bg-status-warning/10 text-status-warning',
    iconClass: 'text-status-warning',
    title: 'Warning',
  },
  info: {
    icon: Info,
    border: 'border-status-info/30 bg-status-info/10 text-status-info',
    iconClass: 'text-status-info',
    title: 'Info',
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const styles = variantStyles[toast.variant];
  const Icon = styles.icon;

  React.useEffect(() => {
    if (toast.duration <= 0) return;
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timeout);
  }, [toast.duration, toast.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 32, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 32, scale: 0.98 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      role="alert"
      aria-live="assertive"
      className={`w-full max-w-sm rounded-xl border bg-forge-900 shadow-2xl shadow-black/40 ${styles.border}`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${styles.iconClass}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">{toast.title ?? styles.title}</p>
          <p className="mt-0.5 text-sm text-text-secondary break-words">{toast.message}</p>
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => onDismiss(toast.id)}
          className="rounded p-1 text-text-muted transition-colors hover:bg-forge-800 hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info', options?: ToastOptions) => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setToasts((current) => [
      ...current,
      {
        id,
        message,
        variant,
        title: options?.title,
        duration: options?.duration ?? DEFAULT_DURATION,
      },
    ]);

    return id;
  }, []);

  const value = useMemo<ToastContextValue>(() => ({
    showToast,
    dismissToast,
    success: (message, options) => showToast(message, 'success', options),
    error: (message, options) => showToast(message, 'error', options),
    warning: (message, options) => showToast(message, 'warning', options),
    info: (message, options) => showToast(message, 'info', options),
  }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-20 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
