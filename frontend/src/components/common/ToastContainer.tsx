/**
 * ToastContainer — Renders the toast stack in a fixed top-right portal.
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
 * Place once at the app root (inside ToastProvider).
 */
export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      aria-label="Notifications"
      className="fixed top-4 right-4 z-200 flex flex-col gap-3 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
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
