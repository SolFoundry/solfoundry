import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Toast Item Component
interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

const toastStyles = {
  success: 'bg-emerald-bg border-emerald text-emerald',
  error: 'bg-status-error/10 border-status-error text-status-error',
  warning: 'bg-amber-500/10 border-amber-500 text-amber-400',
  info: 'bg-blue-500/10 border-blue-500 text-blue-400',
};

const toastIcons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

function ToastItem({ toast, onClose }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-xl shadow-lg
        min-w-[280px] max-w-[400px]
        ${toastStyles[toast.type]}
        ${isExiting ? 'animate-toast-exit' : 'animate-toast-enter'}
      `}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-current/20 text-xs font-bold">
        {toastIcons[toast.type]}
      </span>
      <p className="flex-1 text-sm font-medium text-text-primary">{toast.message}</p>
      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 rounded hover:bg-current/10 transition-colors"
        aria-label="Close"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// Toast Container - renders outside the component tree
export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onClose={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>,
    document.body
  );
}

// Auto-dismiss hook
export function ToastAutoDismiss() {
  const { toasts, removeToast } = useToast();

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    toasts.forEach((toast) => {
      if (toast.duration && toast.duration > 0) {
        const timer = setTimeout(() => {
          removeToast(toast.id);
        }, toast.duration);
        timers.push(timer);
      }
    });
    
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [toasts, removeToast]);

  return null;
}