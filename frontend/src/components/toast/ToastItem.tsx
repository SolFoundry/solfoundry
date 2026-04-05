import React, { useEffect, useState } from 'react';
import type { Toast, ToastVariant } from './ToastContext';

const variantStyles: Record<ToastVariant, { bg: string; icon: string; border: string }> = {
  success: {
    bg: 'bg-emerald-900/90',
    border: 'border-emerald-500',
    icon: '✓',
  },
  error: {
    bg: 'bg-red-900/90',
    border: 'border-red-500',
    icon: '✕',
  },
  warning: {
    bg: 'bg-amber-900/90',
    border: 'border-amber-500',
    icon: '⚠',
  },
  info: {
    bg: 'bg-blue-900/90',
    border: 'border-blue-500',
    icon: 'ℹ',
  },
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isVisible, setIsVisible] = useState(false);
  const style = variantStyles[toast.variant];

  useEffect(() => {
    // Trigger slide-in animation
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm
        transition-all duration-200 ease-in-out max-w-sm w-full
        ${style.bg} ${style.border}
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <span className="text-lg flex-shrink-0" aria-hidden="true">
        {style.icon}
      </span>
      <p className="text-sm text-white flex-1">{toast.message}</p>
      <button
        onClick={handleDismiss}
        className="text-white/60 hover:text-white transition-colors flex-shrink-0"
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}
