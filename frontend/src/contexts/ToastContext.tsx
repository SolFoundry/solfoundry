/**
 * ToastContext — Global toast notification state via React context + useReducer.
 * Supports up to 3 visible toasts with auto-dismiss and manual close.
 * @module contexts/ToastContext
 */
import { createContext, useContext, useReducer, useCallback, useRef, ReactNode } from 'react';
import type { Toast, ToastAction, ToastState, ToastOptions, ToastContextValue } from '../types/toast';

// ============================================================================
// Constants
// ============================================================================

const MAX_VISIBLE_TOASTS = 3;
const DEFAULT_DURATION = 5000;

// ============================================================================
// Reducer
// ============================================================================

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD_TOAST': {
      const updated = [action.payload, ...state.toasts];
      return { toasts: updated.slice(0, MAX_VISIBLE_TOASTS) };
    }
    case 'REMOVE_TOAST':
      return { toasts: state.toasts.filter((t) => t.id !== action.payload.id) };
    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================================================
// Hook
// ============================================================================

/**
 * Access the toast notification system from any component.
 * @throws Error if used outside ToastProvider
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface ToastProviderProps {
  children: ReactNode;
}

let toastCounter = 0;

/**
 * ToastProvider — Wraps the app to provide toast notification capabilities.
 *
 * Usage:
 * ```tsx
 * const { success, error } = useToast();
 * success('Bounty submitted!');
 * error('Transaction failed');
 * ```
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] });
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    dispatch({ type: 'REMOVE_TOAST', payload: { id } });
  }, []);

  const addToast = useCallback(
    (options: ToastOptions): string => {
      const id = `toast-${++toastCounter}-${Date.now()}`;
      const duration = options.duration ?? DEFAULT_DURATION;

      const toast: Toast = {
        id,
        message: options.message,
        variant: options.variant ?? 'info',
        duration,
        createdAt: Date.now(),
      };

      dispatch({ type: 'ADD_TOAST', payload: toast });

      if (duration > 0) {
        const timer = setTimeout(() => {
          timersRef.current.delete(id);
          dispatch({ type: 'REMOVE_TOAST', payload: { id } });
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [],
  );

  const success = useCallback(
    (message: string, duration?: number) => addToast({ message, variant: 'success', duration }),
    [addToast],
  );

  const error = useCallback(
    (message: string, duration?: number) => addToast({ message, variant: 'error', duration }),
    [addToast],
  );

  const warning = useCallback(
    (message: string, duration?: number) => addToast({ message, variant: 'warning', duration }),
    [addToast],
  );

  const info = useCallback(
    (message: string, duration?: number) => addToast({ message, variant: 'info', duration }),
    [addToast],
  );

  const value: ToastContextValue = {
    toasts: state.toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

// ============================================================================
// Exports
// ============================================================================

export default ToastProvider;
