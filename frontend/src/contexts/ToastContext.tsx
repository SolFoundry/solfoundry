import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
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
  pushToast: (toast: ToastInput) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-emerald/40 bg-emerald-bg text-emerald',
  error: 'border-status-error/40 bg-status-error/10 text-status-error',
  warning: 'border-status-warning/40 bg-status-warning/10 text-status-warning',
  info: 'border-status-info/40 bg-status-info/10 text-status-info',
};

const variantIcon: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4" />,
  error: <AlertCircle className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  info: <Info className="w-4 h-4" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((toast: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, title: toast.title, message: toast.message, variant: toast.variant ?? 'info' }]);
    window.setTimeout(() => removeToast(id), 5000);
  }, [removeToast]);

  const value = useMemo(() => ({ pushToast, removeToast }), [pushToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              role="alert"
              initial={{ opacity: 0, x: 32, y: -8 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ duration: 0.18 }}
              className={`rounded-lg border px-3 py-2.5 shadow-lg backdrop-blur-sm ${variantStyles[toast.variant]}`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5">{variantIcon[toast.variant]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">{toast.title}</p>
                  {toast.message && <p className="mt-1 text-xs text-text-secondary">{toast.message}</p>}
                </div>
                <button onClick={() => removeToast(toast.id)} className="text-text-muted hover:text-text-primary transition-colors" aria-label="Close notification">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
