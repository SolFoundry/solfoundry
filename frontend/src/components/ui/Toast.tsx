'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ─── Variant Styles ───────────────────────────────────────────────────────────

const variantStyles: Record<ToastVariant, { bg: string; border: string; icon: string; iconColor: string }> = {
  success: {
    bg: 'bg-forge-900',
    border: 'border-emerald/30',
    icon: '✓',
    iconColor: 'text-emerald',
  },
  error: {
    bg: 'bg-forge-900',
    border: 'border-status-error/30',
    icon: '✕',
    iconColor: 'text-status-error',
  },
  warning: {
    bg: 'bg-forge-900',
    border: 'border-status-warning/30',
    icon: '⚠',
    iconColor: 'text-status-warning',
  },
  info: {
    bg: 'bg-forge-900',
    border: 'border-status-info/30',
    icon: 'ℹ',
    iconColor: 'text-status-info',
  },
};

// ─── Individual Toast Item ─────────────────────────────────────────────────────

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const { bg, border, icon, iconColor } = variantStyles[toast.variant];
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setVisible(true));

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100);
      setProgress(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        handleRemove();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [toast.duration]);

  const handleRemove = () => {
    setVisible(false);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        relative w-80 overflow-hidden rounded-xl border shadow-2xl
        transition-all duration-300 ease-out
        ${bg} ${border}
        ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      {/* Progress bar */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 transition-all duration-50 ease-linear ${
          toast.variant === 'success' ? 'bg-emerald' :
          toast.variant === 'error' ? 'bg-status-error' :
          toast.variant === 'warning' ? 'bg-status-warning' : 'bg-status-info'
        }`}
        style={{ width: `${progress}%` }}
      />

      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <span className={`mt-0.5 text-lg ${iconColor}`}>{icon}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
          {toast.description && (
            <p className="mt-1 text-xs text-text-secondary leading-relaxed">{toast.description}</p>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={handleRemove}
          className="text-text-muted hover:text-text-primary transition-colors text-sm leading-none"
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Toast Container ──────────────────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${++toastIdCounter}-${Date.now()}`;
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]); // max 5 toasts
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Listen for global show-toast events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      addToast(detail);
    };
    window.addEventListener('show-toast', handler);
    return () => window.removeEventListener('show-toast', handler);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

// ─── Convenience functions (use via hook or import toast fn) ──────────────────

export function showToast(
  variant: ToastVariant,
  title: string,
  description?: string,
  duration = 5000
) {
  // Dispatches a custom event that the ToastProvider listens to
  window.dispatchEvent(
    new CustomEvent('show-toast', { detail: { variant, title, description, duration } })
  );
}

export const toast = {
  success: (title: string, description?: string, duration = 5000) =>
    showToast('success', title, description, duration),
  error: (title: string, description?: string, duration = 5000) =>
    showToast('error', title, description, duration),
  warning: (title: string, description?: string, duration = 5000) =>
    showToast('warning', title, description, duration),
  info: (title: string, description?: string, duration = 5000) =>
    showToast('info', title, description, duration),
};
