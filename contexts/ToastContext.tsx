import React, { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
  action?: ToastAction;
  duration?: number;
}

interface ToastContextType {
  showToast: (
    message: string,
    type?: ToastType,
    title?: string,
    action?: ToastAction,
    duration?: number
  ) => void;
  toast: {
    success: (message: string, title?: string, action?: ToastAction, duration?: number) => void;
    error: (message: string, title?: string, action?: ToastAction, duration?: number) => void;
    info: (message: string, title?: string, action?: ToastAction, duration?: number) => void;
    warning: (message: string, title?: string, action?: ToastAction, duration?: number) => void;
    recordSaved: (details?: string, action?: ToastAction) => void;
    exportComplete: (details?: string) => void;
    searchUpdated: (details?: string) => void;
  };
  removeToast: (id: string, message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const activeToastsRef = useRef<Set<string>>(new Set());

  const removeToast = useCallback((id: string, message: string) => {
    activeToastsRef.current.delete(message);
    setToasts((curr) => curr.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = 'success',
      title?: string,
      action?: ToastAction,
      duration: number = 4000
    ) => {
      if (activeToastsRef.current.has(message)) {
        return;
      }
      activeToastsRef.current.add(message);

      const id = Math.random().toString(36).substring(2, 9);

      // Default titles if not provided
      const defaultTitle =
        title ||
        (type === 'success'
          ? 'Record Saved'
          : type === 'error'
          ? 'Action Failed'
          : type === 'warning'
          ? 'Attention'
          : 'Notification');

      setToasts((prev) => [
        ...prev,
        { id, message, type, title: defaultTitle, action, duration },
      ]);

      if (duration > 0) {
        setTimeout(() => {
          activeToastsRef.current.delete(message);
          setToasts((curr) => curr.filter((t) => t.id !== id));
        }, duration);
      }
    },
    []
  );

  const toastHelpers = {
    success: useCallback(
      (message: string, title?: string, action?: ToastAction, duration?: number) =>
        showToast(message, 'success', title || 'Record Saved', action, duration),
      [showToast]
    ),
    error: useCallback(
      (message: string, title?: string, action?: ToastAction, duration?: number) =>
        showToast(message, 'error', title || 'Action Failed', action, duration),
      [showToast]
    ),
    info: useCallback(
      (message: string, title?: string, action?: ToastAction, duration?: number) =>
        showToast(message, 'info', title || 'Notification', action, duration),
      [showToast]
    ),
    warning: useCallback(
      (message: string, title?: string, action?: ToastAction, duration?: number) =>
        showToast(message, 'warning', title || 'Attention', action, duration),
      [showToast]
    ),
    recordSaved: useCallback(
      (details?: string, action?: ToastAction) =>
        showToast(details || 'Changes saved successfully to database.', 'success', 'Record Saved', action),
      [showToast]
    ),
    exportComplete: useCallback(
      (details?: string) =>
        showToast(details || 'Report document generated and downloaded.', 'success', 'Export Complete'),
      [showToast]
    ),
    searchUpdated: useCallback(
      (details?: string) =>
        showToast(details || 'Search filters applied to active dataset.', 'info', 'Search Updated', undefined, 2500),
      [showToast]
    ),
  };

  // Global window event listener for 'app:toast' custom event
  useEffect(() => {
    const handleCustomToast = (e: Event) => {
      const customEvent = e as CustomEvent<{
        message: string;
        type?: ToastType;
        title?: string;
        action?: ToastAction;
        duration?: number;
      }>;
      if (customEvent.detail && customEvent.detail.message) {
        const { message, type, title, action, duration } = customEvent.detail;
        showToast(message, type || 'success', title, action, duration);
      }
    };

    window.addEventListener('app:toast', handleCustomToast);
    return () => window.removeEventListener('app:toast', handleCustomToast);
  }, [showToast]);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        toast: toastHelpers,
        removeToast,
      }}
    >
      {children}

      {/* Floating Global Toast Notification Container */}
      <div
        aria-live="polite"
        className="fixed top-5 right-5 z-[9999] flex flex-col space-y-3 max-w-sm pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((toastItem) => (
            <motion.div
              key={toastItem.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.45)] flex items-center space-x-3 text-slate-100 select-none relative overflow-hidden group min-w-[320px]"
            >
              {/* Left Color Accent Bar */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 ${
                  toastItem.type === 'success'
                    ? 'bg-emerald-500'
                    : toastItem.type === 'error'
                    ? 'bg-red-500'
                    : toastItem.type === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
              />

              {/* Toast Type Icon */}
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  toastItem.type === 'success'
                    ? 'bg-emerald-950/80 text-emerald-400 ring-1 ring-emerald-800/50'
                    : toastItem.type === 'error'
                    ? 'bg-red-950/80 text-red-400 ring-1 ring-red-800/50'
                    : toastItem.type === 'warning'
                    ? 'bg-amber-950/80 text-amber-400 ring-1 ring-amber-800/50'
                    : 'bg-blue-950/80 text-blue-400 ring-1 ring-blue-800/50'
                }`}
              >
                {toastItem.type === 'success' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {toastItem.type === 'error' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {toastItem.type === 'warning' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                )}
                {toastItem.type === 'info' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
              </div>

              {/* Toast Message & Title */}
              <div className="flex-1 min-w-[160px]">
                <p className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center justify-between">
                  <span>{toastItem.title}</span>
                </p>
                <p className="text-[11px] font-medium text-slate-300 mt-0.5 leading-snug">
                  {toastItem.message}
                </p>
              </div>

              {/* Action Button (e.g. Undo) */}
              {toastItem.action && (
                <button
                  onClick={() => {
                    toastItem.action?.onClick();
                    removeToast(toastItem.id, toastItem.message);
                  }}
                  className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-md shadow transition-all flex items-center space-x-1 cursor-pointer shrink-0 border border-amber-300"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                  <span>{toastItem.action.label}</span>
                </button>
              )}

              {/* Close / Dismiss Button */}
              <button
                onClick={() => removeToast(toastItem.id, toastItem.message)}
                className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer shrink-0"
                title="Dismiss notification"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Auto-Dismiss Animated Countdown Progress Bar */}
              {toastItem.duration && toastItem.duration > 0 && (
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: toastItem.duration / 1000, ease: 'linear' }}
                  className={`absolute bottom-0 left-0 h-0.5 ${
                    toastItem.type === 'error'
                      ? 'bg-red-500'
                      : toastItem.type === 'success'
                      ? 'bg-emerald-500'
                      : toastItem.type === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                  }`}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
