import React, { createContext, useContext, useState, useCallback } from "react";

interface Toast { id: string; message: string; type: "success" | "error" | "warning" | "info"; }
interface ToastContextType { toasts: Toast[]; showToast: (message: string, type: Toast["type"]) => void; hideToast: (id: string) => void; }

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => hideToast(id), 3000);
  }, []);
  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  return (
    <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`${t.type === "success" ? "bg-green-500" : t.type === "error" ? "bg-red-500" : t.type === "warning" ? "bg-yellow-500" : "bg-blue-500"} text-white px-4 py-3 rounded-lg shadow-lg min-w-[300px] flex items-center justify-between`}>
            <span>{t.message}</span>
            <button onClick={() => hideToast(t.id)} className="ml-4">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};

export default ToastProvider;
