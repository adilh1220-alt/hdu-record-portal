
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUnit } from '../contexts/UnitContext';
import { CLINICAL_UNITS, UNIT_DETAILS } from '../constants';
import ConfirmModal from './ConfirmModal';
import SettingsModal from './SettingsModal';
import ShortcutsModal from './ShortcutsModal';
import { ShortcutsOverlay } from './ShortcutsOverlay';
import { db } from '../services/firebaseConfig';
import { onSnapshotsInSync } from 'firebase/firestore';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onPrintClick?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, onPrintClick }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [isLogoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isShortcutsOpen, setShortcutsOpen] = useState(false);
  const { currentUser, logout, isAdmin } = useAuth();
  const { activeUnit, setActiveUnit } = useUnit();

  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hdu_theme') || 'light';
    }
    return 'light';
  });

  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(new Date());

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      const timer = setTimeout(() => setIsSyncing(false), 1500);
      return () => clearTimeout(timer);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onSnapshotsInSync(db, () => {
        setIsSyncing(true);
        setLastSyncTime(new Date());
        const timer = setTimeout(() => {
          setIsSyncing(false);
        }, 1000);
        return () => clearTimeout(timer);
      });
    } catch (err) {
      console.error("Failed to subscribe to snapshots in sync:", err);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const FirebaseSyncIndicator = ({ isCompact = false }: { isCompact?: boolean }) => {
    const statusText = !isOnline 
      ? 'Offline' 
      : isSyncing 
        ? 'Syncing' 
        : 'Synced';
        
    const statusColor = !isOnline 
      ? 'bg-red-500' 
      : isSyncing 
        ? 'bg-amber-500' 
        : 'bg-emerald-500';

    const tooltip = !isOnline 
      ? 'Offline: Changes will save locally and sync when you reconnect.' 
      : isSyncing 
        ? 'Syncing: Synchronizing clinical ledger with secure Firebase cloud...' 
        : `Synced: Fully connected. Last sync: ${lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'just now'}`;

    if (isCompact) {
      return (
        <div className="flex items-center justify-center p-1 cursor-pointer transition-all hover:opacity-85" title={tooltip}>
          <span className="relative flex h-2.5 w-2.5">
            {isOnline && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isSyncing ? 'bg-amber-400' : 'bg-emerald-400'
              }`}></span>
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusColor}`}></span>
          </span>
        </div>
      );
    }

    return (
      <div 
        className="flex items-center space-x-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-100/60 dark:hover:bg-slate-800/60 cursor-pointer" 
        title={tooltip}
      >
        <div className="relative flex h-2 w-2 shrink-0">
          {isOnline && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isSyncing ? 'bg-amber-400' : 'bg-emerald-400'
            }`}></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${statusColor}`}></span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Cloud Sync</span>
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
              !isOnline 
                ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' 
                : isSyncing 
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 animate-pulse' 
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
            }`}>
              {statusText}
            </span>
          </div>
          <p className="text-[8px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono leading-none">
            {!isOnline 
              ? 'Local cache active' 
              : isSyncing 
                ? 'Securing transactions' 
                : `Verified: ${lastSyncTime ? lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Now'}`
            }
          </p>
        </div>
      </div>
    );
  };

  React.useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('hdu_theme', theme);
  }, [theme]);

  const handleLogout = async () => {
    await logout();
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShortcutsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const NavItem = ({ id, label, icon }: { id: string, label: string, icon: React.ReactNode }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          setSidebarOpen(false);
        }
      }}
      className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all ${
        activeTab === id 
          ? 'bg-red-600 text-white shadow-lg border border-red-700' 
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-500'
      }`}
    >
      {icon}
      <span className={`${!isSidebarOpen && 'hidden'} font-medium`}>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-50
          fixed inset-y-0 left-0 md:relative
          ${isSidebarOpen 
            ? 'w-64 translate-x-0' 
            : 'w-0 -translate-x-full md:w-20 md:translate-x-0 overflow-hidden'
          }
        `}
      >
        <div className={`p-6 flex items-center border-b border-slate-100 dark:border-slate-800 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
          <div className={`flex items-center space-x-2 overflow-hidden ${!isSidebarOpen && 'hidden'}`}>
            <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xl">+</span>
            </div>
            <span className="text-slate-900 dark:text-slate-100 font-bold text-xl tracking-tight">MediLog</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)} 
            className="text-slate-400 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>

        {/* Firebase Sync status (shown below branding header) */}
        <div className={`px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 ${isSidebarOpen ? 'block' : 'hidden md:block'}`}>
          <FirebaseSyncIndicator isCompact={!isSidebarOpen} />
        </div>

        {/* Unit Selection Terminal */}
        <div className={`p-4 border-b border-slate-100 dark:border-slate-800 ${(!isSidebarOpen || !isAdmin) && 'hidden'}`}>
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-3 ml-1">Select Unit</label>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              {CLINICAL_UNITS.slice(0, 4).map(unit => (
                <button
                  key={unit}
                  onClick={() => setActiveUnit(unit)}
                  className={`py-2 px-1 rounded-lg text-[9px] font-black transition-all border leading-tight ${
                    activeUnit === unit 
                      ? `${UNIT_DETAILS[unit].color} text-white border-transparent shadow-lg scale-105` 
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300'
                  }`}
                >
                  {UNIT_DETAILS[unit].label}
                </button>
              ))}
            </div>
            {CLINICAL_UNITS.length > 4 && (
              <button
                onClick={() => setActiveUnit(CLINICAL_UNITS[4])}
                className={`w-full py-2 rounded-lg text-[9px] font-black transition-all border leading-tight ${
                  activeUnit === CLINICAL_UNITS[4] 
                    ? `${UNIT_DETAILS[CLINICAL_UNITS[4]].color} text-white border-transparent shadow-lg scale-[1.02]` 
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {UNIT_DETAILS[CLINICAL_UNITS[4]].label}
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem id="dashboard" label="Facility Dashboard" icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          } />
          <NavItem id="active" label="Unit Census" icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          } />
          <NavItem id="tasks" label="Clinical Tasks" icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          } />
          <NavItem id="inventory" label="Unit Stock" icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          } />
          <NavItem id="mortality" label="Unit Mortality" icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          } />
          <NavItem id="safety" label="Clinical Incident" icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          } />
          <NavItem id="endoscopy-report" label="Endoscopy Reporting" icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          } />
          <NavItem id="endoscopy-logs" label="Endoscopy Logs" icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          } />
          {isAdmin && (
            <>
              <div className="pt-2">
                <div className="px-3 mb-2">
                  <p 
                    onClick={() => {
                      setActiveTab('activity-logs');
                      if (typeof window !== 'undefined' && window.innerWidth < 768) {
                        setSidebarOpen(false);
                      }
                    }}
                    title="Unlock Activity Console"
                    className={`text-[10px] font-black uppercase text-slate-500 hover:text-slate-700 hover:cursor-pointer transition-colors tracking-[0.2em] ${!isSidebarOpen && 'hidden'}`}
                  >
                    Central Admin
                  </p>
                </div>
                <NavItem id="users" label="User Access" icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                } />
              </div>
            </>
          )}
          
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              className="w-full flex items-center space-x-3 p-3 rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-500"
            >
              {theme === 'light' ? (
                <>
                  <svg className="w-6 h-6 text-amber-500 transition-transform duration-300 hover:rotate-45" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707m12.728 12.728A9 9 0 115.636 5.636a9 9 0 0112.728 12.728z" />
                  </svg>
                  <span className={`${!isSidebarOpen && 'hidden'} font-medium`}>Light Mode</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6 text-indigo-400 transition-transform duration-300 hover:-rotate-12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <span className={`${!isSidebarOpen && 'hidden'} font-medium`}>Dark Mode</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setSettingsOpen(true);
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setSidebarOpen(false);
                }
              }}
              className="w-full flex items-center space-x-3 p-3 rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className={`${!isSidebarOpen && 'hidden'} font-medium`}>Security</span>
            </button>
            <button
              onClick={() => {
                setLogoutConfirmOpen(true);
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setSidebarOpen(false);
                }
              }}
              className="w-full flex items-center space-x-3 p-3 rounded-lg transition-all text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              <span className={`${!isSidebarOpen && 'hidden'} font-medium`}>Sign Out</span>
            </button>
            {onPrintClick && (
              <button
                onClick={() => {
                  onPrintClick();
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setSidebarOpen(false);
                  }
                }}
                className="w-full flex items-center space-x-3 p-3 rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-500 mt-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span className={`${!isSidebarOpen && 'hidden'} font-medium`}>Print Report</span>
              </button>
            )}
            <button
              onClick={() => {
                setShortcutsOpen(true);
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setSidebarOpen(false);
                }
              }}
              className="w-full flex items-center space-x-3 p-3 rounded-lg transition-all text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 mt-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className={`${!isSidebarOpen && 'hidden'} font-medium`}>Keyboard Help</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3 p-2 text-slate-600 dark:text-slate-400">
             <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs shrink-0 border border-slate-200 dark:border-slate-700">
               {currentUser?.displayName?.[0] || 'U'}
             </div>
             {isSidebarOpen && <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{currentUser?.displayName || 'User'}</p>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-tighter">{currentUser?.role}</p>
                 {isAdmin && (
                   <span className="px-1.5 py-0.5 bg-red-600 text-white text-[8px] font-black rounded uppercase tracking-widest shadow-sm">
                     Admin
                   </span>
                 )}
               </div>
             </div>}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile / Iframe Header (shown when viewport < 768px) */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between md:hidden no-print shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg focus:outline-none transition-colors"
              aria-label="Open Sidebar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center text-white font-bold text-sm">
                +
              </div>
              <span className="text-slate-900 font-bold text-base tracking-tight">MediLog</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <FirebaseSyncIndicator isCompact={true} />
            <span className={`px-2 py-1 text-[10px] font-black rounded uppercase tracking-wider ${UNIT_DETAILS[activeUnit].color} text-white shadow-sm`}>
              {UNIT_DETAILS[activeUnit].label}
            </span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative p-6 md:p-8 print:p-0 print:overflow-visible">
          {/* Custom High-Fidelity Print Header */}
          <div className="hidden print:block border-b-2 border-red-600 pb-4 mb-6">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-xl font-black text-red-600 uppercase tracking-tight">MediLog</h1>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Clinical Recording & Reporting Portal</p>
              </div>
              <div className="text-right text-[10px] text-slate-400 font-mono font-bold uppercase">
                <div>Date: {new Date().toLocaleDateString()}</div>
                <div>Time: {new Date().toLocaleTimeString()}</div>
                <div>Generated By: {currentUser?.displayName || currentUser?.email || 'Attending Physician'}</div>
              </div>
            </div>
          </div>
          {children}
        </main>
      </div>

      <ConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
        title="Secure Sign Out"
        message="Are you sure you want to end your session? You will be required to re-authenticate for medical data access."
        confirmLabel="Confirm Logout"
        variant="warning"
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <ShortcutsModal 
        isOpen={isShortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      <ShortcutsOverlay />
    </div>
  );
};

export default Layout;
