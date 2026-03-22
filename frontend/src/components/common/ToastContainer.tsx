/**
 * ToastContainer — Renders the toast stack in a fixed portal.
 * On mobile: bottom-center stacked from bottom.
 * On desktop (sm+): top-right corner, fixed width.
 * Reads from ToastContext and renders up to 3 visible toasts.
 * @module components/common/ToastContainer
 */
import { createPortal } from 'react-dom';
import { useToast } from '../../contexts/ToastContext';
import { Toast } from './Toast';

// ============================================================================
// Component
// ============================================================================

/**
 * Fixed-position container that renders active toasts.
 * Responsive: bottom-center on mobile, top-right on desktop.
 * Place once at the app root (inside ToastProvider).
 */
export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      aria-label="Notifications"
      className="fixed z-200 flex flex-col gap-3 pointer-events-none bottom-4 left-4 right-4 sm:bottom-auto sm:top-4 sm:left-auto sm:right-4 sm:w-80"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-full sm:w-80">
          <Toast toast={toast} onDismiss={removeToast} />
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ============================================================================
// Exports
// ============================================================================

export default ToastContainer;
