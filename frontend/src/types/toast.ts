/**
 * Toast notification types
 */

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  duration?: number;
}