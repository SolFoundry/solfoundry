'use client';

import React, { useEffect } from 'react';
import { Toast as ToastType } from '../../types/toast';

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

const variantStyles: Record<string, { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'bg-green-900/90',
    border: 'border-green-500',
    icon: '✓',
  },
  error: {
    bg: 'bg-red-900/90',
    border: 'border-red-500',
    icon: '✕',
  },
  warning: {
    bg: 'bg-yellow-900/90',
    border: 'border-yellow-500',
    icon: '⚠',
  },
  info: {
    bg: 'bg-blue-900/90',
    border: 'border-blue-500',
    icon: 'ℹ',
  },
};

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const style = variantStyles[toast.variant] || variantStyles.info;

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      className={`
        ${style.bg} ${style.border}
        border-l-4 rounded-r-lg shadow-lg
        p-3 min-w-[280px] max-w-[400px]
        flex items-start gap-3
        animate-slide-in
        transition-all duration-300
      `}
      role="alert"
    >
      {/* Icon */}
      <span className="text-lg shrink-0">{style.icon}</span>
      
      {/* Message */}
      <p className="text-white text-sm flex-1 break-words">{toast.message}</p>
      
      {/* Close button */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-gray-400 hover:text-white transition-colors shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
};

export default Toast;