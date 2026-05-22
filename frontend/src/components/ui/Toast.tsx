import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
}

const iconMap: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2715',
  warning: '\u26A0',
  info: '\u2139',
};

const colorMap: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'bg-emerald-bg', border: 'border-emerald-border', icon: 'text-emerald' },
  error:   { bg: 'bg-red-950/40', border: 'border-red-800/40', icon: 'text-status-error' },
  warning: { bg: 'bg-amber-950/40', border: 'border-amber-800/40', icon: 'text-status-warning' },
  info:    { bg: 'bg-cyan-950/40', border: 'border-cyan-800/40', icon: 'text-status-info' },
};

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const c = colorMap[toast.type];

  return (
    <div
      role="alert"
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm
        min-w-[320px] max-w-[420px] shadow-lg
        ${c.bg} ${c.border}
        transition-all duration-300 ease-in-out
        ${exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
    >
      <span className={`text-lg font-bold mt-0.5 ${c.icon}`}>{iconMap[toast.type]}</span>
      <p className="flex-1 text-sm text-text-primary">{toast.message}</p>
      <button
        onClick={() => { setExiting(true); setTimeout(() => onDismiss(toast.id), 300); }}
        className="text-text-muted hover:text-text-primary transition-colors text-sm leading-none p-0.5"
        aria-label="Close notification"
      >
        {'\u2715'}
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto animate-slide-in-right">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
