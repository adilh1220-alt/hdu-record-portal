import React from 'react';

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  subMessage?: string;
  inline?: boolean;
  className?: string;
}

export const DynamicRoundedLoader: React.FC<{
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showCenterIcon?: boolean;
}> = ({ size = 'md', className = '', showCenterIcon = true }) => {
  const dimensions = {
    xs: { outer: 'w-4 h-4', stroke: 3.5, center: 'w-2 h-2', icon: 'w-1.5 h-1.5' },
    sm: { outer: 'w-5 h-5', stroke: 3.5, center: 'w-2.5 h-2.5', icon: 'w-2 h-2' },
    md: { outer: 'w-8 h-8', stroke: 4, center: 'w-4 h-4', icon: 'w-2.5 h-2.5' },
    lg: { outer: 'w-12 h-12', stroke: 4, center: 'w-6 h-6', icon: 'w-3.5 h-3.5' },
    xl: { outer: 'w-16 h-16', stroke: 4.5, center: 'w-8 h-8', icon: 'w-4.5 h-4.5' },
  };

  const dim = dimensions[size] || dimensions.md;

  return (
    <div className={`relative inline-flex items-center justify-center ${dim.outer} ${className}`}>
      {/* Dynamic Rounded Arc SVG */}
      <svg className="w-full h-full animate-dynamic-spin" viewBox="0 0 50 50">
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth={dim.stroke}
          className="text-slate-200/80 dark:text-slate-700/60"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="url(#dynamic-loader-gradient)"
          strokeWidth={dim.stroke}
          strokeLinecap="round"
          className="animate-dynamic-dash"
        />
        <defs>
          <linearGradient id="dynamic-loader-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="60%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>

      {/* Center dynamic mini pulse on larger sizes */}
      {showCenterIcon && (size === 'md' || size === 'lg' || size === 'xl') && (
        <div className={`absolute ${dim.center} rounded-full bg-white dark:bg-slate-900 shadow-xs flex items-center justify-center`}>
          <svg className={`${dim.icon} text-indigo-600 dark:text-indigo-400 animate-pulse`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
      )}
    </div>
  );
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message = 'Loading Clinical Data...',
  subMessage = 'Connecting to The Kidney Centre Database',
  inline = false,
  className = ''
}) => {
  if (inline) {
    return (
      <div className={`inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 ${className}`}>
        <DynamicRoundedLoader size={size === 'xl' || size === 'lg' ? 'md' : size} showCenterIcon={false} />
        {message && <span className="text-xs font-semibold">{message}</span>}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center my-auto min-h-[200px] animate-fadeIn ${className}`}>
      {/* Rounded Dynamic Loader */}
      <div className="relative mb-4">
        <div className="absolute -inset-3 rounded-full bg-indigo-500/10 dark:bg-indigo-400/10 animate-pulse blur-md" />
        <DynamicRoundedLoader size={size === 'sm' ? 'md' : size === 'xs' ? 'sm' : 'lg'} />
      </div>

      {/* Title & Subtitle */}
      <div className="space-y-1 max-w-sm">
        <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
          {message}
        </h4>
        {subMessage && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {subMessage}
          </p>
        )}
      </div>

      {/* Dynamic Shimmer Bar */}
      <div className="w-40 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-4 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-teal-400 to-indigo-500 animate-dynamic-shimmer rounded-full" />
      </div>
    </div>
  );
};

export interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  showHeader?: boolean;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 7,
  cols = 6,
  showHeader = true
}) => {
  return (
    <div className="p-4 space-y-3 animate-pulse min-w-[900px] w-full">
      {showHeader && (
        <div className="h-11 bg-slate-900 dark:bg-slate-800 rounded-xl w-full flex items-center px-4 justify-between border border-slate-800">
          <div className="h-3 w-12 bg-slate-700 rounded" />
          <div className="h-3 w-28 bg-slate-700 rounded" />
          <div className="h-3 w-36 bg-slate-700 rounded" />
          <div className="h-3 w-28 bg-slate-700 rounded" />
          <div className="h-3 w-20 bg-slate-700 rounded" />
          <div className="h-3 w-24 bg-slate-700 rounded" />
        </div>
      )}

      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 bg-slate-50 dark:bg-slate-800/40 rounded-xl w-full flex items-center px-4 justify-between border border-slate-200/60 dark:border-slate-700/50"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="h-4 w-10 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  );
};

export const StatCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3 animate-pulse">
    <div className="flex justify-between items-center">
      <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
      <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
    </div>
    <div className="h-8 w-16 bg-slate-300 dark:bg-slate-600 rounded-lg" />
    <div className="h-2.5 w-32 bg-slate-100 dark:bg-slate-700 rounded" />
  </div>
);

export const ChartSkeleton: React.FC<{ title: string; subTitle?: string }> = ({ title, subTitle }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4 animate-pulse">
    <div className="space-y-1">
      <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">{title}</h3>
      {subTitle && <p className="text-xs text-slate-400">{subTitle}</p>}
    </div>
    <div className="h-64 bg-slate-100 dark:bg-slate-700/50 rounded-xl flex items-end p-4 gap-3 justify-between">
      {[40, 65, 30, 85, 50, 75, 90, 60, 45, 70, 55, 80].map((h, idx) => (
        <div key={idx} className="w-full bg-slate-200 dark:bg-slate-600 rounded-t-md" style={{ height: `${h}%` }} />
      ))}
    </div>
  </div>
);

export const DataSyncBadge: React.FC<{ isSyncing?: boolean; label?: string }> = ({
  isSyncing = false,
  label = 'Live Data Connected'
}) => {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
      <span className="relative flex h-2 w-2">
        {isSyncing ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </>
        ) : (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </>
        )}
      </span>
      <span>{isSyncing ? 'Syncing...' : label}</span>
    </div>
  );
};

export const ButtonSpinner: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={`${className} animate-dynamic-spin flex-shrink-0`} viewBox="0 0 24 24" fill="none">
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeWidth="3"
      className="opacity-25"
    />
    <path
      d="M12 3a9 9 0 0 1 9 9"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      className="opacity-90"
    />
  </svg>
);
