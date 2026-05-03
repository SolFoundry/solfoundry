import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

export interface Toast extends Required<Omit<ToastInput, 'description'>> {
  id: string;
  description?: string;
}

interface ToastContextValue {
  notify: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { icon: React.ComponentType<{ className?: string }>; accent: string; iconColor: string }> = {
  success: { icon: CheckCircle2, accent: 'border-emerald/30', iconColor: 'text-emerald' },
  error: { icon: AlertCircle, accent: 'border-status-error/30', iconColor: 'text-status-error' },
  warning: { icon: AlertTriangle, accent: 'border-status-warning/30', iconColor: 'text-status-warning' },
  info: { icon: Info, accent: 'border-magenta/30', iconColor: 'text-magenta' },
};

export function createToast(input: ToastInput, id = crypto.randomUUID()): Toast {
  return {
    id,
    title: input.title,
    description: input.description,
    variant: input.variant ?? 'info',
    durationMs: input.durationMs ?? 5_000,
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((input: ToastInput) => {
    const toast = createToast(input);
    setToasts((current) => [toast, ...current]);
    window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    return toast.id;
  }, [dismiss]);

  const value = useMemo<ToastContextValue>(() => ({
    notify,
    dismiss,
    success: (title, description) => notify({ title, description, variant: 'success' }),
    error: (title, description) => notify({ title, description, variant: 'error' }),
    warning: (title, description) => notify({ title, description, variant: 'warning' }),
    info: (title, description) => notify({ title, description, variant: 'info' }),
  }), [dismiss, notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3" aria-live="assertive" aria-atomic="true">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const style = VARIANT_STYLES[toast.variant];
            const Icon = style.icon;
            return (
              <motion.div
                key={toast.id}
                role="alert"
                initial={{ opacity: 0, x: 48, y: -8 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 48, scale: 0.98 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className={`pointer-events-auto rounded-xl border ${style.accent} bg-forge-900/95 p-4 shadow-xl shadow-black/40 backdrop-blur-sm`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconColor}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
                    {toast.description && <p className="mt-1 text-sm text-text-secondary">{toast.description}</p>}
                  </div>
                  <button type="button" onClick={() => dismiss(toast.id)} className="rounded-md p-1 text-text-muted hover:bg-forge-800 hover:text-text-primary" aria-label="Dismiss notification">
                    <X className="h-4 w-4" />
                  </button>
                </div>
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
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
