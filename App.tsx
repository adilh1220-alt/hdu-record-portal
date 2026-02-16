
import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PatientTable from './components/PatientTable';
import InventoryTable from './components/InventoryTable';
import MortalityPage from './pages/MortalityPage';
import EndoscopyPage from './pages/EndoscopyPage';
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
                <p className="text-slate-500 text-sm font-medium">Live bed occupancy for <span className="text-slate-900 font-bold">{UNIT_DETAILS[activeUnit].label}</span></p>
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
        return <EndoscopyPage />;
      case 'inventory':
        return <InventoryTable />;
      case 'mortality':
        return <MortalityPage />;
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
