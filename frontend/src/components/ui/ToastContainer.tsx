import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { Toast, ToastVariant } from '../../contexts/ToastContext';
import { useToast } from '../../contexts/ToastContext';

const variantStyles: Record<ToastVariant, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: <CheckCircle className="w-5 h-5 text-emerald" />,
  },
  error: {
    bg: 'bg-status-error/10',
    border: 'border-status-error/30',
    icon: <AlertCircle className="w-5 h-5 text-status-error" />,
  },
  warning: {
    bg: 'bg-amber/10',
    border: 'border-amber/30',
    icon: <AlertTriangle className="w-5 h-5 text-amber" />,
  },
  info: {
    bg: 'bg-status-info/10',
    border: 'border-status-info/30',
    icon: <Info className="w-5 h-5 text-status-info" />,
  },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const styles = variantStyles[toast.variant];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      role="alert"
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${styles.bg} ${styles.border} backdrop-blur-sm min-w-[320px] max-w-[420px] shadow-lg`}
    >
      <span className="flex-shrink-0 mt-0.5">{styles.icon}</span>
      <p className="flex-1 text-sm text-text-primary leading-snug">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 w-5 h-5 text-text-muted hover:text-text-secondary transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}