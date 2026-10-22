import { useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const variantConfig: Record<
  ToastVariant,
  { icon: React.FC<{ className?: string }>; border: string; bg: string; text: string }
> = {
  success: {
    icon: CheckCircle,
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
  },
  error: {
    icon: AlertCircle,
    border: 'border-red-500/40',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
  },
  info: {
    icon: Info,
    border: 'border-blue-500/40',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
  },
};

export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { icon: Icon, border, bg, text } = variantConfig[toast.variant];
  const duration = toast.duration ?? 5000;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast.id), duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, duration, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`
        flex items-start gap-3 w-80 max-w-full px-4 py-3 rounded-lg border
        ${border} ${bg}
        shadow-lg shadow-black/40 backdrop-blur-sm
        animate-slide-in-right
      `}
    >
      <Icon className={`shrink-0 mt-0.5 h-4 w-4 ${text}`} />
      <p className="flex-1 text-sm text-white/90 leading-snug">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 mt-0.5 text-white/40 hover:text-white/80 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
