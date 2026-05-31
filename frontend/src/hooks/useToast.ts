import { ToastType } from '../contexts/ToastContext';
import { useToast } from '../contexts/ToastContext';

export function useToastHook() {
  const { showToast } = useToast();
  
  return {
    success: (message: string, duration?: number) => showToast(message, 'success', duration),
    error: (message: string, duration?: number) => showToast(message, 'error', duration),
    warning: (message: string, duration?: number) => showToast(message, 'warning', duration),
    info: (message: string, duration?: number) => showToast(message, 'info', duration),
  };
}
