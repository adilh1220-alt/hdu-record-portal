import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import ConfirmModal from '../components/ConfirmModal';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    variant: 'danger' | 'warning' | 'info';
    resolver: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    title: 'Confirm Action',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    variant: 'danger',
    resolver: null,
  });

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
      
      setModalState({
        isOpen: true,
        title: opts.title || (opts.variant === 'warning' ? 'Warning' : opts.variant === 'info' ? 'Please Confirm' : 'Confirm Deletion'),
        message: opts.message,
        confirmLabel: opts.confirmLabel || 'Confirm',
        cancelLabel: opts.cancelLabel || 'Cancel',
        variant: opts.variant || 'danger',
        resolver: resolve,
      });
    });
  }, []);

  const handleClose = () => {
    if (modalState.resolver) {
      modalState.resolver(false);
    }
    setModalState((prev) => ({ ...prev, isOpen: false, resolver: null }));
  };

  const handleConfirm = () => {
    if (modalState.resolver) {
      modalState.resolver(true);
    }
    setModalState((prev) => ({ ...prev, isOpen: false, resolver: null }));
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmModal
        isOpen={modalState.isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={modalState.title}
        message={modalState.message}
        confirmLabel={modalState.confirmLabel}
        cancelLabel={modalState.cancelLabel}
        variant={modalState.variant}
      />
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ((options: ConfirmOptions | string) => Promise<boolean>) => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
};
