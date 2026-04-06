import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { type ToastType, useToast } from '../../contexts/ToastContext';

const TOAST_STYLES: Record<ToastType, { icon: React.ReactNode; border: string; glow: string; iconColor: string }> = {
  success: {
    icon: <CheckCircle className="w-5 h-5" />,
    border: 'border-status-success/30',
    glow: 'shadow-[0_0_15px_rgba(0,230,118,0.1)]',
    iconColor: 'text-status-success'
  },
  error: {
    icon: <AlertCircle className="w-5 h-5" />,
    border: 'border-status-error/30',
    glow: 'shadow-[0_0_15px_rgba(255,82,82,0.1)]',
    iconColor: 'text-status-error'
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5" />,
    border: 'border-status-warning/30',
    glow: 'shadow-[0_0_15px_rgba(255,179,0,0.1)]',
    iconColor: 'text-status-warning'
  },
  info: {
    icon: <Info className="w-5 h-5" />,
    border: 'border-status-info/30',
    glow: 'shadow-[0_0_15px_rgba(64,196,255,0.1)]',
    iconColor: 'text-status-info'
  }
};

const Toast: React.FC<{ id: string; type: ToastType; message: string; duration?: number }> = ({ 
  id, 
  type, 
  message, 
  duration = 5000 
}) => {
  const { removeToast } = useToast();
  const style = TOAST_STYLES[type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={`relative flex items-center gap-3 p-4 min-w-[320px] max-w-md bg-forge-800 border ${style.border} rounded-xl ${style.glow} backdrop-blur-md z-50`}
    >
      <div className={`shrink-0 ${style.iconColor}`}>
        {style.icon}
      </div>
      
      <p className="flex-1 text-sm font-sans text-text-primary leading-tight">
        {message}
      </p>

      <button 
        onClick={() => removeToast(id)}
        className="shrink-0 p-1 hover:bg-forge-700/50 rounded-lg transition-colors text-text-muted hover:text-text-primary"
      >
        <X className="w-4 h-4" />
      </button>

      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
        className={`absolute bottom-0 left-4 right-4 h-[2px] ${style.iconColor} origin-left opacity-30`}
      />
    </motion.div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast {...toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};
