import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';

// 14 minutes before warning (840,000 ms)
const IDLE_LIMIT = 14 * 60 * 1000;
// 60 seconds warning duration (totaling 15 minutes / 900,000 ms)
const WARNING_DURATION = 60;

export const IdleTimer: React.FC = () => {
  const { logout } = useAuth();
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_DURATION);
  
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = async () => {
    localStorage.setItem('hdu_inactivity_logout', 'true');
    await logout();
  };

  const resetTimer = () => {
    lastActivityRef.current = Date.now();
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Set timer to trigger warning after IDLE_LIMIT
    timerRef.current = setTimeout(() => {
      setIsWarningOpen(true);
      setSecondsLeft(WARNING_DURATION);
    }, IDLE_LIMIT);
  };

  // Activity events listener
  useEffect(() => {
    const handleActivity = () => {
      // If warning modal is already open, do not reset automatically on ambient events
      // to avoid bypassing security if the mouse was bumped or page scrolled ambiently.
      // They must explicitly click "Extend Session".
      if (!isWarningOpen) {
        resetTimer();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'click', 'touchstart'];
    
    // Register events
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Initial timer setup
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isWarningOpen]);

  // Handle countdown when warning is active
  useEffect(() => {
    if (isWarningOpen) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      
      countdownRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [isWarningOpen]);

  const extendSession = () => {
    setIsWarningOpen(false);
    resetTimer();
  };

  const manualSignOut = () => {
    setIsWarningOpen(false);
    handleLogout();
  };

  if (!isWarningOpen) return null;

  return (
    <Modal
      isOpen={isWarningOpen}
      onClose={extendSession}
      title="Security Session Timeout"
    >
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-black uppercase text-slate-900 dark:text-slate-100 tracking-tight">
              Inactivity Warning
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-sm">
              Your session is about to expire due to security compliance. You will be logged out in{' '}
              <span className="text-red-600 dark:text-red-400 font-bold font-mono text-lg">{secondsLeft}</span> seconds.
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-red-500 h-full transition-all duration-1000 ease-linear"
            style={{ width: `${(secondsLeft / WARNING_DURATION) * 100}%` }}
          />
        </div>

        <div className="flex gap-4 pt-2">
          <button
            onClick={manualSignOut}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
          >
            Sign Out
          </button>
          <button
            onClick={extendSession}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-95"
          >
            Extend Session
          </button>
        </div>
      </div>
    </Modal>
  );
};
