import { useState, useEffect } from "react";
import type { Toast, ToastType } from "../contexts/ToastContext";

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

const STYLES: Record<ToastType, string> = {
  success: "bg-green-600 text-white",
  error: "bg-red-600 text-white",
  warning: "bg-yellow-500 text-black",
  info: "bg-blue-600 text-white",
};

export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg
        transition-all duration-300 ease-in-out
        ${STYLES[toast.type]}
        ${visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
    >
      <span className="text-lg font-bold" aria-hidden>
        {ICONS[toast.type]}
      </span>
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-2 text-current opacity-70 hover:opacity-100 transition-opacity text-lg leading-none"
        aria-label="Dismiss notification"
      >
        &times;
      </button>
    </div>
  );
}
