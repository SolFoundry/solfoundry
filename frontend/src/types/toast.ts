/**
 * Toast notification type definitions
 * @module types/toast
 */

// ============================================================================
// Types
// ============================================================================

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  /** Toast message content */
  message: string;
  /** Visual variant — determines color and icon */
  variant?: ToastVariant;
  /** Auto-dismiss duration in milliseconds (0 to disable) */
  duration?: number;
}

export interface Toast {
  /** Unique identifier */
  id: string;
  /** Toast message content */
  message: string;
  /** Visual variant */
  variant: ToastVariant;
  /** Auto-dismiss duration in ms */
  duration: number;
  /** Timestamp when the toast was created */
  createdAt: number;
}

// ============================================================================
// State & Actions
// ============================================================================

export interface ToastState {
  toasts: Toast[];
}

export type ToastAction =
  | { type: 'ADD_TOAST'; payload: Toast }
  | { type: 'REMOVE_TOAST'; payload: { id: string } };

// ============================================================================
// Context
// ============================================================================

export interface ToastContextValue {
  toasts: Toast[];
  addToast: (options: ToastOptions) => string;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
}
