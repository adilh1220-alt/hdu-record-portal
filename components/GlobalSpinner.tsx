import React from 'react';

interface GlobalSpinnerProps {
  isOpen: boolean;
  message?: string;
  subMessage?: string;
}

export const GlobalSpinner: React.FC<GlobalSpinnerProps> = ({
  isOpen,
  message = 'Fetching Clinical Data...',
  subMessage = 'The Kidney Centre - High Dependency Unit',
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/40 backdrop-blur-md transition-all duration-300 animate-fadeIn select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Loading indicator"
    >
      <div className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.25)] border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center max-w-sm w-full mx-4 text-center transform transition-all scale-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Dynamic Rounded Orbital Spinner (Dhol / Cylindrical Inspired Modern Arc) */}
        <div className="relative flex items-center justify-center mb-5">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute w-20 h-20 bg-indigo-500/15 dark:bg-indigo-400/20 rounded-full blur-xl animate-pulse" />
          <div className="absolute w-14 h-14 bg-emerald-500/10 dark:bg-emerald-400/15 rounded-full blur-md" />

          {/* Outer Counter-Rotating Orbit Ring with Dot */}
          <svg className="w-16 h-16 animate-dynamic-counter-spin" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 8"
              className="text-slate-300 dark:text-slate-700 opacity-60"
            />
            <circle
              cx="32"
              cy="4"
              r="2.5"
              fill="currentColor"
              className="text-indigo-600 dark:text-indigo-400 shadow-sm"
            />
          </svg>

          {/* Core Dynamic Rounded Arc Spinner */}
          <svg className="absolute w-12 h-12 animate-dynamic-spin" viewBox="0 0 50 50">
            {/* Background Track */}
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-slate-100 dark:text-slate-800"
            />
            {/* Dynamic Rounded Foreground Stroke */}
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="none"
              stroke="url(#global-spinner-gradient)"
              strokeWidth="4"
              strokeLinecap="round"
              className="animate-dynamic-dash"
            />
            <defs>
              <linearGradient id="global-spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center Dynamic Medical Pulse Icon */}
          <div className="absolute w-7 h-7 rounded-full bg-white dark:bg-slate-950 shadow-inner border border-slate-100 dark:border-slate-800 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
        </div>

        {/* Dynamic Loading Message */}
        <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight uppercase mb-1">
          {message}
        </h3>
        
        {/* Subtitle / Department Badge */}
        {subMessage && (
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tracking-wide mb-3 line-clamp-1">
            {subMessage}
          </p>
        )}

        {/* Shimmering Dynamic Track Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-1 rounded-full overflow-hidden relative mb-2.5">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-teal-400 to-indigo-500 animate-dynamic-shimmer rounded-full" />
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span>Synchronizing System State</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSpinner;
