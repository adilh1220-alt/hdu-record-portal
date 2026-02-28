
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
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UnitProvider, useUnit } from './contexts/UnitContext';
import { UNIT_DETAILS } from './constants';

const MainAppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { currentUser, isAdmin } = useAuth();
  const { activeUnit } = useUnit();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab Navigation: Alt + 1-7
      if (e.altKey && !isNaN(Number(e.key))) {
        const key = Number(e.key);
        const tabs = ['dashboard', 'active', 'tasks', 'inventory', 'mortality', 'safety', 'endoscopy'];
        if (key >= 1 && key <= tabs.length) {
          const targetTab = tabs[key - 1];
          // Check permissions for endoscopy
          if (targetTab === 'endoscopy' && !isAdmin) return;
          setActiveTab(targetTab);
        }
      }

      // Action Shortcuts: Alt + N (New), Alt + S (Search), Alt + E (Export)
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
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin]);

  // Reset to dashboard on login/logout to prevent session persistence issues
  useEffect(() => {
    if (currentUser) {
      // Role-based redirection: Admins could potentially go to 'users', 
      // but 'dashboard' is generally preferred for overview.
      // We'll default to 'dashboard' for all to satisfy the "instead of the dashboard" requirement.
      setActiveTab('dashboard');
    }
  }, [currentUser?.uid]);

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
      case 'endoscopy':
        return isAdmin ? <EndoscopyPage /> : <Dashboard />;
      case 'inventory':
        return <InventoryTable />;
      case 'mortality':
        return <MortalityPage />;
      case 'safety':
        return <SafetyIncidentsPage />;
      case 'users':
        return isAdmin ? <UserManagement /> : <Dashboard />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <UnitProvider>
      <MainAppContent />
    </UnitProvider>
  </AuthProvider>
);

export default App;
