
import React from 'react';
import Modal from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = 'danger'
}) => {
  const getIconAndBg = () => {
    switch (variant) {
      case 'danger':
        return {
          bg: 'bg-red-100 text-red-600 border border-red-200',
          btn: 'bg-red-600 hover:bg-red-700 text-white shadow-red-200',
          icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          )
        };
      case 'warning':
        return {
          bg: 'bg-amber-100 text-amber-700 border border-amber-200',
          btn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200',
          icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          )
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-100 text-blue-700 border border-blue-200',
          btn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200',
          icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          )
        };
    }
  };

  const styleConfig = getIconAndBg();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col items-center text-center space-y-4 py-2">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${styleConfig.bg} shadow-sm`}>
          {styleConfig.icon}
        </div>
        <div className="px-2">
          <p className="text-slate-700 text-xs sm:text-sm font-semibold leading-relaxed">{message}</p>
        </div>
        <div className="flex w-full gap-3 pt-4 border-t border-slate-100">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-200 transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button 
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer ${styleConfig.btn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
