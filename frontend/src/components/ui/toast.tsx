"use client";
import { useEffect, useState, useCallback } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ToastStore {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

let toastStore: ToastStore | null = null;
const listeners = new Set<() => void>();
let state = { toasts: [] as Toast[] };

function notify() {
  listeners.forEach((l) => l());
}

export const toast = {
  success: (message: string, duration = 5000) =>
    toastStore?.addToast("success", message, duration),
  error: (message: string, duration = 5000) =>
    toastStore?.addToast("error", message, duration),
  warning: (message: string, duration = 5000) =>
    toastStore?.addToast("warning", message, duration),
  info: (message: string, duration = 5000) =>
    toastStore?.addToast("info", message, duration),
};

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

export function useToastStore() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 5000) => {
      const id = genId();
      state.toasts = [...state.toasts, { id, type, message, duration }];
      notify();
      if (duration > 0) {
        setTimeout(() => {
          state.toasts = state.toasts.filter((t) => t.id !== id);
          notify();
        }, duration);
      }
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    state.toasts = state.toasts.filter((t) => t.id !== id);
    notify();
  }, []);

  toastStore = { toasts: state.toasts, addToast, removeToast };

  return {
    toasts: state.toasts,
    addToast,
    removeToast,
  };
}

const typeStyles: Record<
  ToastType,
  { bg: string; border: string; icon: string }
> = {
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-400",
    icon: "✓",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-400",
    icon: "✕",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-400",
    icon: "⚠",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-400",
    icon: "ℹ",
  },
};

const typeText: Record<ToastType, string> = {
  success: "text-emerald-700",
  error: "text-red-700",
  warning: "text-amber-700",
  info: "text-blue-700",
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const { bg, border, icon } = typeStyles[t.type];
        return (
          <div
            key={t.id}
            role="alert"
            aria-live="assertive"
            className={`${bg} ${border} border-l-4 rounded-lg shadow-lg p-4 flex items-start gap-3 animate-slide-in`}
          >
            <span className={`text-xl font-bold ${typeText[t.type]}`}>
              {icon}
            </span>
            <p className={`flex-1 text-sm font-medium ${typeText[t.type]}`}>
              {t.message}
            </p>
            <button
              onClick={() => removeToast(t.id)}
              aria-label="Close notification"
              className={`text-sm hover:opacity-70 ${typeText[t.type]} transition-opacity`}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
