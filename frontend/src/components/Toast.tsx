import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { border: string; bg: string; icon: string; Icon: React.FC<{ className?: string }> }> = {
  success: {
    border: 'border-status-success/30',
    bg: 'bg-status-success/10',
    icon: 'text-status-success',
    Icon: CheckCircle,
  },
  error: {
    border: 'border-status-error/30',
    bg: 'bg-status-error/10',
    icon: 'text-status-error',
    Icon: AlertCircle,
  },
  warning: {
    border: 'border-status-warning/30',
    bg: 'bg-status-warning/10',
    icon: 'text-status-warning',
    Icon: AlertTriangle,
  },
  info: {
    border: 'border-status-info/30',
    bg: 'bg-status-info/10',
    icon: 'text-status-info',
    Icon: Info,
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const style = VARIANT_STYLES[toast.variant];
  const { Icon: IconComponent } = style;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const duration = toast.duration ?? 5000;

  useEffect(() => {
    if (duration > 0) {
      timerRef.current = setTimeout(() => onDismiss(toast.id), duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95, transition: { duration: 0.2 } }}
      className={`flex items-start gap-3 p-4 rounded-xl border ${style.border} ${style.bg} bg-forge-900 w-80 shadow-lg`}
      role="alert"
    >
      <IconComponent className={`w-5 h-5 mt-0.5 flex-shrink-0 ${style.icon}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{toast.title}</p>
        {toast.message && (
          <p className="mt-1 text-xs text-text-secondary">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-forge-700 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-text-muted" />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const showToast = useCallback((t: Omit<Toast, 'id'>) => {
    counterRef.current += 1;
    const id = `toast-${counterRef.current}-${Date.now()}`;
    setToasts(prev => [...prev, { ...t, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto">
          <AnimatePresence mode="popLayout">
            {toasts.map(t => (
              <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
