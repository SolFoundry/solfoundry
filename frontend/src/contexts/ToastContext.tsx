'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { Toast, ToastOptions, ToastVariant } from '../types/toast';

interface ToastState {
  toasts: Toast[];
}

type ToastAction =
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'REMOVE_TOAST'; id: string };

const MAX_TOASTS = 3;

const toastReducer = (state: ToastState, action: ToastAction): ToastState => {
  switch (action.type) {
    case 'ADD_TOAST':
      // Keep only the last MAX_TOASTS
      const newToasts = [...state.toasts, action.toast].slice(-MAX_TOASTS);
      return { toasts: newToasts };
    case 'REMOVE_TOAST':
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
};

interface ToastContextValue {
  toasts: Toast[];
  toast: (options: ToastOptions) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] });

  const toast = useCallback((options: ToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast: Toast = {
      id,
      message: options.message,
      variant: options.variant || 'info',
      duration: options.duration ?? 5000,
    };
    dispatch({ type: 'ADD_TOAST', toast: newToast });
  }, []);

  const createVariantToast = useCallback(
    (variant: ToastVariant) => (message: string, duration?: number) => {
      toast({ message, variant, duration });
    },
    [toast]
  );

  const dismiss = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', id });
  }, []);

  const value: ToastContextValue = {
    toasts: state.toasts,
    toast,
    success: createVariantToast('success'),
    error: createVariantToast('error'),
    warning: createVariantToast('warning'),
    info: createVariantToast('info'),
    dismiss,
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastContext;