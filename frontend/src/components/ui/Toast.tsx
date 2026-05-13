import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

/* ─── Types ─── */

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

/* ─── Context ─── */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

/* ─── Provider ─── */

export function ToastProvider({ children }: { children: React.ReactNode }) {
 const [toasts, setToasts] = useState<Toast[]>([]);
 const counter = useRef(0);
 const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

 const removeToast = useCallback((id: string) => {
   // Clear auto-dismiss timer when manually dismissed
   const timer = timers.current.get(id);
   if (timer) {
     clearTimeout(timer);
     timers.current.delete(id);
   }
   setToasts((prev) => prev.filter((t) => t.id !== id));
 }, []);

 const addToast = useCallback(
 (toast: Omit<Toast, 'id'>) => {
   const id = `toast-${++counter.current}`;
   const duration = toast.duration ?? 5000;
   setToasts((prev) => [...prev, { ...toast, id }]);

   if (duration > 0) {
     const timer = setTimeout(() => {
       timers.current.delete(id);
       removeToast(id);
     }, duration);
     timers.current.set(id, timer);
   }
 },
 [removeToast],
 );

 // Cleanup all timers on unmount
 useEffect(() => {
   return () => {
     timers.current.forEach((timer) => clearTimeout(timer));
     timers.current.clear();
   };
 }, []);

 return (
 <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
 {children}
 <ToastContainer toasts={toasts} onDismiss={removeToast} />
 </ToastContext.Provider>
 );
}

/* ─── Toast Container ─── */

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ─── Toast Item ─── */

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: <CheckCircle className="w-5 h-5 text-emerald shrink-0" />,
  },
  error: {
    bg: 'bg-status-error/10',
    border: 'border-status-error/30',
    icon: <AlertCircle className="w-5 h-5 text-status-error shrink-0" />,
  },
  warning: {
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/30',
    icon: <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />,
  },
  info: {
    bg: 'bg-status-info/10',
    border: 'border-status-info/30',
    icon: <Info className="w-5 h-5 text-status-info shrink-0" />,
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const style = VARIANT_STYLES[toast.variant];

  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border ${style.bg} ${style.border} backdrop-blur-sm shadow-lg shadow-black/20 max-w-sm`}
    >
      {style.icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-text-muted mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-text-muted hover:text-text-primary transition-colors p-0.5"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}
