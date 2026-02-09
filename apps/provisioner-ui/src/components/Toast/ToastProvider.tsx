import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import './toast.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (toast: Omit<Toast, 'id'>) => string;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TOAST_DURATIONS: Record<ToastType, number> = {
  success: 4000,
  error: 6000,
  warning: 5000,
  info: 4000,
};

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const TOAST_COLORS: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-200 text-green-900',
  error: 'bg-red-50 border-red-200 text-red-900',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
};

const TOAST_ICON_COLORS: Record<ToastType, string> = {
  success: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-yellow-600',
  info: 'text-blue-600',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const toast = useCallback((toastData: Omit<Toast, 'id'>): string => {
    const id = generateId();
    const newToast: Toast = {
      ...toastData,
      id,
      duration: toastData.duration || TOAST_DURATIONS[toastData.type],
    };

    setToasts(prev => {
      const updated = [...prev, newToast];
      if (updated.length > 5) {
        return updated.slice(-5);
      }
      return updated;
    });

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, newToast.duration);
    }

    return id;
  }, []);

  const success = useCallback((title: string, message?: string) => {
    return toast({ type: 'success', title, message });
  }, [toast]);

  const error = useCallback((title: string, message?: string) => {
    return toast({ type: 'error', title, message });
  }, [toast]);

  const warning = useCallback((title: string, message?: string) => {
    return toast({ type: 'warning', title, message });
  }, [toast]);

  const info = useCallback((title: string, message?: string) => {
    return toast({ type: 'info', title, message });
  }, [toast]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => {
      const toastToDismiss = prev.find(t => t.id === id);
      if (toastToDismiss?.onClose) {
        toastToDismiss.onClose();
      }
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissAll();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dismissAll]);

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, warning, info, dismiss, dismissAll }}>
      {children}
      <div
        className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              pointer-events-auto relative p-4 rounded-lg border shadow-lg
              transform transition-all duration-300 ease-out
              animate-slide-in-right
              ${TOAST_COLORS[t.type]}
            `}
            role="alert"
            aria-atomic="true"
          >
            <div className="flex items-start gap-3">
              <span className={`text-xl ${TOAST_ICON_COLORS[t.type]}`} aria-hidden="true">
                {TOAST_ICONS[t.type]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{t.title}</p>
                {t.message && (
                  <p className="mt-1 text-sm opacity-90">{t.message}</p>
                )}
                {t.action && (
                  <button
                    onClick={t.action.onClick}
                    className="mt-2 text-sm font-medium underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current rounded px-2 py-1 -ml-2"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-black/5"
                aria-label="Dismiss notification"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastProvider;
