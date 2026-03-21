/**
 * Toast — Individual toast notification with variant styling and dismiss button.
 * @module components/common/Toast
 */
import { useEffect, useState } from 'react';
import type { Toast as ToastType, ToastVariant } from '../../types/toast';

// ============================================================================
// Types
// ============================================================================

export interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

// ============================================================================
// Variant Config
// ============================================================================

interface VariantConfig {
  container: string;
  icon: JSX.Element;
  progressBar: string;
}

const variantConfig: Record<ToastVariant, VariantConfig> = {
  success: {
    container: 'border-emerald-500/30 bg-emerald-500/10',
    progressBar: 'bg-emerald-500',
    icon: (
      <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  error: {
    container: 'border-red-500/30 bg-red-500/10',
    progressBar: 'bg-red-500',
    icon: (
      <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  warning: {
    container: 'border-amber-500/30 bg-amber-500/10',
    progressBar: 'bg-amber-500',
    icon: (
      <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  info: {
    container: 'border-blue-500/30 bg-blue-500/10',
    progressBar: 'bg-blue-500',
    icon: (
      <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
  },
};

// ============================================================================
// Component
// ============================================================================

/**
 * Single toast notification with slide-in animation, progress bar, and dismiss.
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const config = variantConfig[toast.variant];

  // Trigger entrance animation on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        'relative w-80 overflow-hidden rounded-lg border backdrop-blur-md shadow-lg shadow-black/20',
        'transition-all duration-200 ease-out',
        config.container,
        isVisible && !isExiting
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0',
      ].join(' ')}
    >
      {/* Content */}
      <div className="flex items-start gap-3 px-4 py-3">
        {config.icon}
        <p className="flex-1 text-sm text-white/90 leading-snug pt-0.5 wrap-break-word">
          {toast.message}
        </p>
        <button
          onClick={handleDismiss}
          className="p-0.5 -mr-1 -mt-0.5 text-white/40 hover:text-white/80 rounded transition-colors"
          aria-label="Dismiss notification"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      {toast.duration > 0 && (
        <div className="h-0.5 w-full bg-white/5">
          <div
            className={`h-full ${config.progressBar} opacity-60`}
            style={{
              animation: `toast-progress ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default Toast;
