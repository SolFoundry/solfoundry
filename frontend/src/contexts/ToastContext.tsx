import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
}

interface ToastInput {
  title: string;
  message?: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-emerald/40 bg-forge-900 text-emerald',
  error: 'border-status-error/40 bg-forge-900 text-status-error',
  warning: 'border-status-warning/40 bg-forge-900 text-status-warning',
  info: 'border-status-info/40 bg-forge-900 text-status-info',
};

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = icons[toast.variant];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 48, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      role="alert"
      className={`pointer-events-auto w-full max-w-sm rounded-lg border shadow-xl shadow-black/20 ${variantStyles[toast.variant]}`}
    >
      <div className="flex gap-3 p-4">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
          {toast.message && <p className="mt-1 text-sm text-text-muted">{toast.message}</p>}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-forge-800 transition-colors"
        >
          <X className="w-4 h-4" />
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

  const showToast = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();
    const toast: Toast = {
      id,
      title: input.title,
      message: input.message,
      variant: input.variant ?? 'info',
    };
    setToasts((current) => [toast, ...current].slice(0, 5));
    window.setTimeout(() => dismissToast(id), 5_000);
    return id;
  }, [dismissToast]);

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 pointer-events-none">
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
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
