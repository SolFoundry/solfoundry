import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
  createdAt: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (variant: ToastVariant, message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

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
    (variant: ToastVariant, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const toast: Toast = { id, variant, message, createdAt: Date.now() };
      setToasts((prev) => [...prev, toast]);

      const timer = setTimeout(() => removeToast(id), AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}