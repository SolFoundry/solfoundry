import { createContext, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { ToastItem } from '../components/ui/Toast';
import type { Toast, ToastVariant } from '../components/ui/Toast';

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;
function genId() {
  return `toast-${++counter}-${Date.now()}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration?: number) => {
      const id = genId();
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, dismissToast }}>
      {children}
      {createPortal(
        <div
          aria-label="Notifications"
          className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        >
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onDismiss={dismissToast} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
