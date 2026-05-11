import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

// Types
export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number; // ms, default 5000
  dismissible?: boolean;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
}

// Context
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// Variant config
const variantConfig: Record<ToastVariant, {
  icon: React.ElementType;
  bgClass: string;
  borderClass: string;
  iconClass: string;
}> = {
  success: {
    icon: CheckCircle,
    bgClass: 'bg-emerald/10',
    borderClass: 'border-emerald/20',
    iconClass: 'text-emerald',
  },
  error: {
    icon: AlertCircle,
    bgClass: 'bg-status-error/10',
    borderClass: 'border-status-error/20',
    iconClass: 'text-status-error',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-tier-t2/10',
    borderClass: 'border-tier-t2/20',
    iconClass: 'text-tier-t2',
  },
  info: {
    icon: Info,
    bgClass: 'bg-status-info/10',
    borderClass: 'border-status-info/20',
    iconClass: 'text-status-info',
  },
};

// Single Toast Item
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const config = variantConfig[toast.variant];
  const Icon = config.icon;
  const duration = toast.duration ?? 5000;

  useEffect(() => {
    if (duration <= 0) return; // persistent toast
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 300); // match exit animation
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm
        ${config.bgClass} ${config.borderClass}
        transition-all duration-300 ease-in-out
        ${isExiting
          ? 'translate-x-full opacity-0'
          : 'translate-x-0 opacity-100 animate-slide-in-right'
        }
      `}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconClass}`} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-text-secondary mt-1">{toast.message}</p>
        )}
      </div>

      {(toast.dismissible !== false) && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4 text-text-muted" />
        </button>
      )}
    </div>
  );
}

// Provider
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (title: string, message?: string) => addToast({ variant: 'success', title, message }),
    [addToast]
  );
  const error = useCallback(
    (title: string, message?: string) => addToast({ variant: 'error', title, message, duration: 8000 }),
    [addToast]
  );
  const warning = useCallback(
    (title: string, message?: string) => addToast({ variant: 'warning', title, message }),
    [addToast]
  );
  const info = useCallback(
    (title: string, message?: string) => addToast({ variant: 'info', title, message }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}

      {/* Toast Container — fixed top-right, stacks downward */}
      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
