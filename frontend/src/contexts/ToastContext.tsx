import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, description?: string) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, description }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = (m: string, d?: string) => showToast('success', m, d);
  const error = (m: string, d?: string) => showToast('error', m, d);
  const info = (m: string, d?: string) => showToast('info', m, d);
  const warning = (m: string, d?: string) => showToast('warning', m, d);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className={`pointer-events-auto relative p-4 rounded-xl border shadow-lg flex gap-3 overflow-hidden bg-forge-900 ${
                toast.type === 'success' ? 'border-emerald/50' :
                toast.type === 'error' ? 'border-red-500/50' :
                toast.type === 'warning' ? 'border-amber-500/50' :
                'border-blue-500/50'
              }`}
            >
              <div className="flex-shrink-0">
                {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-text-primary">{toast.message}</p>
                {toast.description && (
                  <p className="text-xs text-text-muted mt-0.5">{toast.description}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              {/* Progress bar animation */}
              <motion.div 
                className={`absolute bottom-0 left-0 h-1 ${
                  toast.type === 'success' ? 'bg-emerald' :
                  toast.type === 'error' ? 'bg-red-500' :
                  toast.type === 'warning' ? 'bg-amber-500' :
                  'bg-blue-500'
                }`}
                initial={{ width: '100%' }}
                animate={{ width: 0 }}
                transition={{ duration: 5, ease: 'linear' }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
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
