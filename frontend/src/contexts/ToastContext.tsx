import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastRecord extends Required<ToastOptions> {
  id: string;
}

interface ToastContextValue {
  pushToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5" />,
  error: <AlertCircle className="w-5 h-5" />,
  warning: <AlertTriangle className="w-5 h-5" />,
  info: <Info className="w-5 h-5" />,
};

const STYLES: Record<ToastVariant, string> = {
  success: 'border-emerald/30 bg-emerald-bg text-emerald',
  error: 'border-status-error/30 bg-status-error/10 text-status-error',
  warning: 'border-status-warning/30 bg-amber-500/10 text-status-warning',
  info: 'border-status-info/30 bg-status-info/10 text-status-info',
};

function ToastViewport({ toasts, onDismiss }: { toasts: ToastRecord[]; onDismiss: (id: string) => void }) {
  return (
    <div
      className="fixed top-20 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            role="alert"
            initial={{ opacity: 0, x: 80, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`rounded-xl border px-4 py-3 shadow-2xl backdrop-blur ${STYLES[toast.variant]}`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">{ICONS[toast.variant]}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-5">{toast.title}</p>
                {toast.description && (
                  <p className="mt-1 text-sm leading-5 text-text-secondary">{toast.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
                className="flex-shrink-0 text-text-muted transition-colors hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ title, description, variant = 'info', durationMs = 5000 }: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [
        ...current,
        { id, title, description: description ?? '', variant, durationMs },
      ]);
      window.setTimeout(() => dismissToast(id), durationMs);
      return id;
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ pushToast, dismissToast }), [pushToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
