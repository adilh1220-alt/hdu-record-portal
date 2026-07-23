import React, { useState, useEffect } from 'react';
import { Keyboard, X, ChevronDown, ChevronUp, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const ShortcutsOverlay: React.FC = () => {
  const { isAdmin } = useAuth();
  
  // State for visibility and minimization
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hdu_shortcuts_visible');
      return saved !== 'false'; // Default to visible to help new users discover it
    }
    return true;
  });

  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hdu_shortcuts_minimized');
      return saved === 'true'; // Default to expanded
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('hdu_shortcuts_visible', String(isVisible));
  }, [isVisible]);

  useEffect(() => {
    localStorage.setItem('hdu_shortcuts_minimized', String(isMinimized));
  }, [isMinimized]);

  // Support toggling overlay via Alt + H
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isVisible) {
    // Return a very small, unobtrusive trigger button at bottom-right when completely hidden
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 no-print flex items-center space-x-2 px-3 py-2 bg-slate-950 text-white rounded-full shadow-lg border border-slate-800 hover:bg-slate-900 transition-all hover:scale-105 active:scale-95 group font-medium text-xs"
        title="Show Keyboard Shortcuts (Alt+H)"
        id="shortcuts-restore-btn"
      >
        <Keyboard className="w-4 h-4 text-red-500 animate-pulse group-hover:scale-110 transition-transform" />
        <span>Shortcuts (Alt+H)</span>
      </button>
    );
  }

  const tabShortcuts = [
    { key: 'Alt + 1', label: 'Facility Dashboard' },
    { key: 'Alt + 2', label: 'Unit Census' },
    { key: 'Alt + 3', label: 'Clinical Tasks' },
    { key: 'Alt + 4', label: 'Unit Stock' },
    { key: 'Alt + 5', label: 'Unit Mortality' },
    { key: 'Alt + 6', label: 'Clinical Incident' },
    { key: 'Alt + 7', label: 'Endoscopy Reporting' },
    { key: 'Alt + 8', label: 'Endoscopy Logs' },
  ];

  const actionShortcuts = [
    { key: 'Alt + N', label: 'New Record (Admission/Stock/Incident/Procedure)' },
    { key: 'Alt + S', label: 'Focus Search Bar' },
    { key: 'Alt + E', label: 'Open Export Modal' },
    { key: 'Alt + P', label: 'Print Active View' },
    { key: 'Alt + H', label: 'Toggle Help Widget' },
  ];

  if (isAdmin) {
    actionShortcuts.push({ key: 'Alt + L', label: 'Go to Activity Logs' });
  }

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 no-print flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl transition-all duration-300 overflow-hidden w-80 md:w-85"
      id="shortcuts-floating-widget"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded bg-red-100 dark:bg-red-950/40 flex items-center justify-center text-red-600 dark:text-red-400">
            <Keyboard className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Keyboard Assistant</h3>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Learn Navigation Shortcuts</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          {/* Minimize / Maximize toggle */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isMinimized ? 'Expand Guide' : 'Minimize Guide'}
            id="shortcuts-minimize-btn"
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {/* Close/Hide Button */}
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Hide Widget (Alt+H to restore)"
            id="shortcuts-hide-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {!isMinimized && (
        <div className="p-4 max-h-[320px] overflow-y-auto space-y-4 font-sans text-xs">
          {/* Tabs Navigation */}
          <div>
            <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest block mb-2">
              Tab Navigation
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {tabShortcuts.map((s, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100/80 dark:border-slate-800/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/80 transition-colors group"
                >
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium tracking-tight">
                    {s.label}
                  </span>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-mono font-black text-red-600 dark:text-red-400 shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical & Action Keys */}
          <div>
            <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest block mb-2">
              Clinical Actions
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {actionShortcuts.map((s, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100/80 dark:border-slate-800/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/80 transition-colors group"
                >
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium tracking-tight">
                    {s.label}
                  </span>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-mono font-black text-red-600 dark:text-red-400 shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div className="flex items-center space-x-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[9px] text-slate-400 dark:text-slate-500 font-medium">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Click any shortcut while typing or navigating to perform action!</span>
          </div>
        </div>
      )}

      {/* Mini state banner when minimized */}
      {isMinimized && (
        <div 
          onClick={() => setIsMinimized(false)}
          className="px-4 py-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100/50 dark:hover:bg-red-950/30 cursor-pointer flex items-center justify-between text-[10px] font-bold text-red-600 dark:text-red-400 transition-colors"
          id="shortcuts-expand-strip"
        >
          <span>13 available shortcuts are hidden</span>
          <span className="underline hover:no-underline">Expand</span>
        </div>
      )}
    </div>
  );
};
