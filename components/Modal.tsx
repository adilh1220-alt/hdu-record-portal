
import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  hideHeader?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md', hideHeader = false }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shouldShowHeader = !hideHeader && Boolean(title);

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className={`relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto transform transition-all animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 my-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {shouldShowHeader ? (
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-20 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-full bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 backdrop-blur-xs transition-all shadow-xs"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
