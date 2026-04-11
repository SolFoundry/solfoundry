import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastVariant;
}

export interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: ToastVariant) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ─── Config ───────────────────────────────────────────────────────────────────

const TOAST_DURATION = 5000;

const variantConfig: Record<
  ToastVariant,
  { icon: React.ReactNode; bg: string; border: string; iconColor: string; progressColor: string }
> = {
  success: {
    icon: <CheckCircle size={18} />,
    bg: 'bg-emerald-bg',
    border: 'border-emerald-border',
    iconColor: 'text-emerald',
    progressColor: 'bg-emerald',
  },
  error: {
    icon: <XCircle size={18} />,
    bg: 'bg-status-error/10',
    border: 'border-status-error/30',
    iconColor: 'text-status-error',
    progressColor: 'bg-status-error',
  },
  warning: {
    icon: <AlertTriangle size={18} />,
    bg: 'bg-status-warning/10',
    border: 'border-status-warning/30',
    iconColor: 'text-status-warning',
    progressColor: 'bg-status-warning',
  },
  info: {
    icon: <Info size={18} />,
    bg: 'bg-status-info/10',
    border: 'border-status-info/30',
    iconColor: 'text-status-info',
    progressColor: 'bg-status-info',
  },
};

// ─── Individual Toast Item ─────────────────────────────────────────────────────

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { icon, bg, border, iconColor, progressColor } = variantConfig[toast.type];
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = progressRef.current;
    if (!el) return;
    el.style.transition = 'none';
    el.style.width = '100%';

    requestAnimationFrame(() => {
      el.style.transition = `width ${TOAST_DURATION}ms linear`;
      el.style.width = '0%';
    });

    const timer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`relative flex items-start gap-3 w-80 rounded-lg border ${bg} ${border} backdrop-blur-sm shadow-xl overflow-hidden`}
    >
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
        <div ref={progressRef} className={`h-full ${progressColor}`} style={{ width: '100%' }} />
      </div>

      {/* Icon */}
      <div className={`flex-shrink-0 mt-3 ml-3 ${iconColor}`}>{icon}</div>

      {/* Message */}
      <div className="flex-1 py-3 pr-8 min-w-0">
        <p className="text-sm text-text-primary leading-relaxed">{toast.message}</p>
      </div>

      {/* Close button */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="absolute top-2 right-2 p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

// ─── Toast Container ───────────────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Provider & Hook ──────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastVariant = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={hideToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
