/**
 * ToastContainer — Renders active toasts with framer-motion animations.
 * Fixed to top-right corner, stacked vertically.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast, type ToastType } from '../contexts/ToastContext';

const ICON_MAP: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-status-success" />,
  error: <XCircle className="w-5 h-5 text-status-error" />,
  warning: <AlertTriangle className="w-5 h-5 text-status-warning" />,
  info: <Info className="w-5 h-5 text-status-info" />,
};

const BORDER_MAP: Record<ToastType, string> = {
  success: 'border-l-status-success',
  error: 'border-l-status-error',
  warning: 'border-l-status-warning',
  info: 'border-l-status-info',
};

function ToastItem({
  id,
  type,
  title,
  message,
  onDismiss,
}: {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
      className={`
        flex items-start gap-3 p-4 pr-3
        w-80 rounded-lg shadow-lg
        bg-forge-800 border border-border
        border-l-4 ${BORDER_MAP[type]}
      `}
    >
      <span className="shrink-0 mt-0.5">{ICON_MAP[type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{title}</p>
        {message && (
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{message}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-forge-700 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem
              id={t.id}
              type={t.type}
              title={t.title}
              message={t.message}
              onDismiss={() => removeToast(t.id)}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}