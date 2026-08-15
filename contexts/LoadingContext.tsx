import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import GlobalSpinner from '../components/GlobalSpinner';

interface LoadingContextType {
  isLoading: boolean;
  message: string;
  subMessage?: string;
  startLoading: (message?: string, subMessage?: string) => void;
  stopLoading: () => void;
  withLoading: <T>(asyncFn: () => Promise<T>, message?: string, subMessage?: string) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeCount, setActiveCount] = useState(0);
  const [loadingState, setLoadingState] = useState<{ message: string; subMessage?: string }>({
    message: 'Fetching Clinical Data...',
    subMessage: 'The Kidney Centre - High Dependency Unit',
  });

  const startLoading = useCallback((message?: string, subMessage?: string) => {
    setActiveCount((count) => count + 1);
    setLoadingState({
      message: message || 'Fetching Clinical Data...',
      subMessage: subMessage || 'The Kidney Centre - HDU Clinical System',
    });
  }, []);

  const stopLoading = useCallback(() => {
    setActiveCount((count) => Math.max(0, count - 1));
  }, []);

  const withLoading = useCallback(
    async <T,>(asyncFn: () => Promise<T>, message?: string, subMessage?: string): Promise<T> => {
      startLoading(message, subMessage);
      try {
        return await asyncFn();
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading]
  );

  const isLoading = activeCount > 0;

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        message: loadingState.message,
        subMessage: loadingState.subMessage,
        startLoading,
        stopLoading,
        withLoading,
      }}
    >
      {children}
      <GlobalSpinner
        isOpen={isLoading}
        message={loadingState.message}
        subMessage={loadingState.subMessage}
      />
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};
