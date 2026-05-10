import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastInput {
  type: ToastType;
  title: string;
  message?: string;
}

interface Toast extends ToastInput {
  id: string;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles: Record<ToastType, { text: string; border: string; icon: React.ReactNode }> = {
  success: {
    text: 'text-status-success',
    border: 'border-status-success/30',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  error: {
    text: 'text-status-error',
    border: 'border-status-error/30',
    icon: <XCircle className="w-4 h-4" />,
  },
  warning: {
    text: 'text-status-warning',
    border: 'border-status-warning/30',
    icon: <TriangleAlert className="w-4 h-4" />,
  },
  info: {
    text: 'text-status-info',
    border: 'border-status-info/30',
    icon: <Info className="w-4 h-4" />,
  },
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: ToastInput) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => removeToast(id), 5_000);
  }, [removeToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => {
          const style = toastStyles[toast.type];
          return (
            <div
              key={toast.id}
              role="alert"
              className={`animate-[toast-slide-in_180ms_ease-out] rounded-xl border ${style.border} bg-forge-900/95 p-4 shadow-2xl shadow-black/30 backdrop-blur`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 ${style.text}`}>{style.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${style.text}`}>{toast.title}</p>
                  {toast.message && <p className="mt-1 text-sm text-text-secondary">{toast.message}</p>}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => removeToast(toast.id)}
                  className="rounded-md p-1 text-text-muted transition-colors hover:bg-forge-800 hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
