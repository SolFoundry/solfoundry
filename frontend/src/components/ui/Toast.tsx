import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useToastContext } from '../../contexts/ToastContext';
import type { Toast, ToastVariant } from '../../contexts/ToastContext';

const variantStyles: Record<ToastVariant, { bg: string; border: string; icon: typeof CheckCircle; iconColor: string }> = {
  success: {
    bg: 'bg-emerald-bg',
    border: 'border-emerald-border',
    icon: CheckCircle,
    iconColor: 'text-emerald',
  },
  error: {
    bg: 'bg-red-950/30',
    border: 'border-red-500/30',
    icon: AlertCircle,
    iconColor: 'text-red-400',
  },
  warning: {
    bg: 'bg-amber-950/30',
    border: 'border-amber-500/30',
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
  },
  info: {
    bg: 'bg-purple-bg',
    border: 'border-purple-border',
    icon: Info,
    iconColor: 'text-purple-light',
  },
};

function ToastItem({ id, message, variant }: { id: string; message: string; variant: ToastVariant }) {
  const { removeToast } = useToastContext();
  const style = variantStyles[variant];
  const Icon = style.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      role="alert"
      aria-live="assertive"
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm
        ${style.bg} ${style.border}
        min-w-[300px] max-w-[420px]
      `}
    >
      <Icon className={`w-5 h-5 ${style.iconColor} flex-shrink-0 mt-0.5`} aria-hidden="true" />
      <p className="text-sm text-forge-100 flex-1 leading-relaxed">{message}</p>
      <button
        onClick={() => removeToast(id)}
        className="flex-shrink-0 p-1 rounded-md text-forge-400 hover:text-forge-200 hover:bg-forge-700/50 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function ToastContainer() {
  const { toasts } = useToastContext();

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-3"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast: Toast) => (
          <ToastItem key={toast.id} {...toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
