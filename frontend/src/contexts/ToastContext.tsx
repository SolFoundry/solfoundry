import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, description?: string) => void;
  removeToast: (id: string) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION = 5000;
const TOAST_CONFIG: Record<ToastType, { icon: React.ReactNode; border: string; bg: string }> = {
  success: {
    icon: <CheckCircle className="w-5 h-5 text-emerald" />,
    border: 'border-emerald/20',
    bg: 'bg-emerald/5',
  },
  error: {
    icon: <AlertCircle className="w-5 h-5 text-status-error" />,
    border: 'border-status-error/20',
    bg: 'bg-status-error/5',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-status-warning" />,
    border: 'border-status-warning/20',
    bg: 'bg-status-warning/5',
  },
  info: {
    icon: <Info className="w-5 h-5 text-status-info" />,
    border: 'border-status-info/20',
    bg: 'bg-status-info/5',
  },
};

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, description?: string) => {
      const id = `toast-${++toastIdCounter}-${Date.now()}`;
      const toast: Toast = { id, type, message, description };
      setToasts((prev) => [...prev, toast]);

      const timer = setTimeout(() => removeToast(id), TOAST_DURATION);
      timersRef.current.set(id, timer);
    },
    [removeToast],
  );

  const success = useCallback((msg: string, desc?: string) => addToast('success', msg, desc), [addToast]);
  const error = useCallback((msg: string, desc?: string) => addToast('error', msg, desc), [addToast]);
  const warning = useCallback((msg: string, desc?: string) => addToast('warning', msg, desc), [addToast]);
  const info = useCallback((msg: string, desc?: string) => addToast('info', msg, desc), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}

      {/* Toast container */}
      <div
        aria-live="polite"
        aria-relevant="additions removals"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const config = TOAST_CONFIG[toast.type];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 100, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.95, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 25, mass: 0.8 }}
                role="alert"
                className={`pointer-events-auto rounded-xl border ${config.border} ${config.bg} bg-forge-900 backdrop-blur-sm shadow-2xl overflow-hidden`}
              >
                <div className="flex items-start gap-3 p-4">
                  <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{toast.message}</p>
                    {toast.description && (
                      <p className="mt-1 text-xs text-text-muted leading-relaxed">{toast.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="flex-shrink-0 p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-forge-800 transition-colors duration-150"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* Progress bar */}
                <motion.div
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: TOAST_DURATION / 1000, ease: 'linear' }}
                  className={`h-0.5 origin-left ${
                    toast.type === 'success'
                      ? 'bg-emerald/40'
                      : toast.type === 'error'
                        ? 'bg-status-error/40'
                        : toast.type === 'warning'
                          ? 'bg-status-warning/40'
                          : 'bg-status-info/40'
                  }`}
                />
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
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
