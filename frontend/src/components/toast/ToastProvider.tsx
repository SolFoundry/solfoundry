import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => string;
  dismissToast: (id: string) => void;
  success: (message: string) => string;
  error: (message: string) => string;
  warning: (message: string) => string;
  info: (message: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const iconByVariant = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const classByVariant: Record<ToastVariant, string> = {
  success: 'border-emerald/30 bg-emerald/10 text-emerald',
  error: 'border-status-error/30 bg-status-error/10 text-status-error',
  warning: 'border-status-warning/30 bg-status-warning/10 text-status-warning',
  info: 'border-status-info/30 bg-status-info/10 text-status-info',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((current) => [...current, { id, message, variant }]);
      window.setTimeout(() => dismissToast(id), 5_000);
      return id;
    },
    [dismissToast],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      dismissToast,
      success: (message) => showToast(message, 'success'),
      error: (message) => showToast(message, 'error'),
      warning: (message) => showToast(message, 'warning'),
      info: (message) => showToast(message, 'info'),
    }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
        aria-live="polite"
        aria-relevant="additions removals"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const Icon = iconByVariant[toast.variant];
            return (
              <motion.div
                key={toast.id}
                role="alert"
                initial={{ opacity: 0, x: 32, y: -8 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 32, transition: { duration: 0.18 } }}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-xl shadow-black/30 backdrop-blur-sm ${classByVariant[toast.variant]}`}
                data-testid="toast"
              >
                <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p className="min-w-0 flex-1 text-sm font-medium leading-5">{toast.message}</p>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
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
