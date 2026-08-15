
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PatientTable from './components/PatientTable';
import InventoryTable from './components/InventoryTable';
import MortalityPage from './pages/MortalityPage';
import EndoscopyPage from './pages/EndoscopyPage';
import SafetyIncidentsPage from './pages/SafetyIncidentsPage';
import TasksPage from './pages/TasksPage';
import AuthForm from './components/AuthForm';
import UserManagement from './pages/UserManagement';
import ActivityLogsPage from './pages/ActivityLogsPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UnitProvider, useUnit } from './contexts/UnitContext';
import { SearchProvider } from './contexts/SearchContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { ToastProvider } from './contexts/ToastContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { AdvancedSearchModal } from './components/AdvancedSearchModal';
import { UNIT_DETAILS } from './constants';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { RecordVerificationModal } from './components/RecordVerificationModal';
import { IdleTimer } from './components/IdleTimer';

const MainAppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isPrintPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [isVerifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyParams, setVerifyParams] = useState<{
    type: string;
    id?: string;
    mrn?: string;
    name?: string;
    date?: string;
  } | null>(null);

  const { currentUser, isAdmin, loading } = useAuth();
  const { activeUnit } = useUnit();

  // Check URL params for QR verification deep links
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const verifyType = params.get('verify');
      if (verifyType) {
        setVerifyParams({
          type: verifyType,
          id: params.get('id') || undefined,
          mrn: params.get('mrn') || undefined,
          name: params.get('name') || undefined,
          date: params.get('date') || undefined,
        });
        setVerifyModalOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab Navigation: Alt + 1-7
      if (e.altKey && !isNaN(Number(e.key))) {
        const key = Number(e.key);
        const tabs = ['dashboard', 'active', 'tasks', 'inventory', 'mortality', 'safety', 'endoscopy-report', 'endoscopy-logs'];
        if (key >= 1 && key <= tabs.length) {
          const targetTab = tabs[key - 1];
          setActiveTab(targetTab);
        }
      }

      // Action Shortcuts: Alt + N (New), Alt + S (Search), Alt + E (Export), Alt + P (Print)
      if (e.altKey) {
        if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('app:new-record'));
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('app:focus-search'));
        } else if (e.key.toLowerCase() === 'e') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('app:export'));
        } else if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          setPrintPreviewOpen(true);
        } else if (e.key.toLowerCase() === 'l' && isAdmin) {
          e.preventDefault();
          setActiveTab('activity-logs');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin]);

  // Reset to appropriate active tab on login based on assigned unit or default
  useEffect(() => {
    if (currentUser) {
      if (currentUser.assignedUnit === 'ENDOSCOPY') {
        setActiveTab('endoscopy-report');
      } else if (currentUser.assignedUnit) {
        setActiveTab('active');
      } else {
        setActiveTab('dashboard');
      }
    }
  }, [currentUser?.uid, currentUser?.assignedUnit]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-3" />
        <div className="text-white font-bold text-base tracking-tight">Initializing HDU Clinical System...</div>
        <div className="text-slate-400 text-xs mt-0.5">Please wait a moment</div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthForm />;
  }

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'active':
        return (
          <div className="space-y-6">
            <header className="flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">In-Patient Census</h1>
                <p className="text-slate-500 text-sm font-medium">For <span className="text-slate-900 font-bold">{UNIT_DETAILS[activeUnit].label}</span></p>
              </div>
              <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-sm ${UNIT_DETAILS[activeUnit].color}`}>
                Active Unit: {activeUnit}
              </div>
            </header>
            <PatientTable />
          </div>
        );
      case 'tasks':
        return <TasksPage />;
      case 'endoscopy-report':
        return (
          <EndoscopyPage
            key="endoscopy-report"
            initialWorkspaceOpen={true}
            onExit={() => setActiveTab('endoscopy-logs')}
          />
        );
      case 'endoscopy-logs':
        return (
          <EndoscopyPage
            key="endoscopy-logs"
            initialWorkspaceOpen={false}
          />
        );
      case 'inventory':
        return <InventoryTable />;
      case 'mortality':
        return <MortalityPage />;
      case 'safety':
        return <SafetyIncidentsPage />;
      case 'users':
        return isAdmin ? <UserManagement /> : <Dashboard />;
      case 'activity-logs':
        return isAdmin ? <ActivityLogsPage /> : <Dashboard />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <IdleTimer />
      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onPrintClick={() => setPrintPreviewOpen(true)}
      >
        {renderContent()}
      </Layout>
      <PrintPreviewModal 
        isOpen={isPrintPreviewOpen} 
        onClose={() => setPrintPreviewOpen(false)} 
        initialTab={activeTab} 
      />
      <AdvancedSearchModal 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      <RecordVerificationModal
        isOpen={isVerifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        verifyParams={verifyParams}
        onNavigateToTab={(tab) => setActiveTab(tab)}
      />
    </>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <LoadingProvider>
      <UnitProvider>
        <SearchProvider>
          <ConfirmProvider>
            <ToastProvider>
              <MainAppContent />
            </ToastProvider>
          </ConfirmProvider>
        </SearchProvider>
      </UnitProvider>
    </LoadingProvider>
  </AuthProvider>
);

export default App;
