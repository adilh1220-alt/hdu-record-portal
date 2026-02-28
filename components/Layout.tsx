
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUnit } from '../contexts/UnitContext';
import { CLINICAL_UNITS, UNIT_DETAILS } from '../constants';
import ConfirmModal from './ConfirmModal';
import SettingsModal from './SettingsModal';
import ShortcutsModal from './ShortcutsModal';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isLogoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isShortcutsOpen, setShortcutsOpen] = useState(false);
  const { currentUser, logout, isAdmin } = useAuth();
  const { activeUnit, setActiveUnit } = useUnit();

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
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all ${
        activeTab === id 
          ? 'bg-slate-800 text-white shadow-lg border border-slate-700' 
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
      }`}
    >
      {icon}
      <span className={`${!isSidebarOpen && 'hidden'} font-medium`}>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`bg-slate-900 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col`}>
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
          <div className={`flex items-center space-x-2 overflow-hidden ${!isSidebarOpen && 'hidden'}`}>
            <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xl">+</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">The Kidney Centre</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)} 
            className="text-slate-400 hover:text-white p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>

        {/* Unit Selection Terminal */}
        <div className={`p-4 border-b border-slate-800 ${(!isSidebarOpen || !isAdmin) && 'hidden'}`}>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3 ml-1">Select Unit</label>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              {CLINICAL_UNITS.slice(0, 4).map(unit => (
                <button
                  key={unit}
                  onClick={() => setActiveUnit(unit)}
                  className={`py-2 px-1 rounded-lg text-[9px] font-black transition-all border leading-tight ${
                    activeUnit === unit 
                      ? `${UNIT_DETAILS[unit].color} text-white border-transparent shadow-lg scale-105` 
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
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
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
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
          {isAdmin && (
            <>
              <div className="pt-2">
                <div className="px-3 mb-2">
                  <p className={`text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] ${!isSidebarOpen && 'hidden'}`}>Central Admin</p>
                </div>
                <NavItem id="users" label="User Access" icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                } />
                <NavItem id="endoscopy" label="Endoscopy Logs" icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                } />
              </div>
            </>
          )}
          
          <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full flex items-center space-x-3 p-3 rounded-lg transition-all text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className={`${!isSidebarOpen && 'hidden'} font-medium`}>Security</span>
            </button>
            <button
              onClick={() => setLogoutConfirmOpen(true)}
              className="w-full flex items-center space-x-3 p-3 rounded-lg transition-all text-red-400 hover:bg-red-900/20 hover:text-red-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              <span className={`${!isSidebarOpen && 'hidden'} font-medium`}>Sign Out</span>
            </button>
            <button
              onClick={() => setShortcutsOpen(true)}
              className="w-full flex items-center space-x-3 p-3 rounded-lg transition-all text-slate-500 hover:bg-slate-800 hover:text-white mt-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className={`${!isSidebarOpen && 'hidden'} font-medium`}>Keyboard Help</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center space-x-3 p-2 text-slate-400">
             <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
               {currentUser?.displayName?.[0] || 'U'}
             </div>
             {isSidebarOpen && <div className="overflow-hidden">
               <p className="text-xs font-bold text-white truncate">{currentUser?.displayName || 'User'}</p>
               <div className="flex items-center gap-2">
                 <p className="text-[10px] text-red-400 font-bold uppercase tracking-tighter">{currentUser?.role}</p>
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

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative p-8">
        {children}
      </main>

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
    </div>
  );
};

export default Layout;
