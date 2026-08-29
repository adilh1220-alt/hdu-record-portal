import React from 'react';
import { 
  ChevronRight, 
  Home, 
  Users, 
  CheckSquare, 
  Package, 
  Activity, 
  AlertTriangle, 
  FileText, 
  Layers, 
  ShieldCheck, 
  History,
  Building2
} from 'lucide-react';
import { UNIT_DETAILS } from '../constants';
import { ClinicalUnit } from '../types';

export interface BreadcrumbProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeUnit: ClinicalUnit;
  className?: string;
}

interface TabMeta {
  label: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TAB_METADATA: Record<string, TabMeta> = {
  dashboard: {
    label: 'Facility Dashboard',
    category: 'Overview',
    icon: Home
  },
  active: {
    label: 'Unit Census & In-Patients',
    category: 'Clinical Care',
    icon: Users
  },
  tasks: {
    label: 'Clinical Tasks',
    category: 'Clinical Care',
    icon: CheckSquare
  },
  inventory: {
    label: 'Unit Stock & Supplies',
    category: 'Logistics',
    icon: Package
  },
  mortality: {
    label: 'Mortality Reviews',
    category: 'Quality & Audit',
    icon: Activity
  },
  safety: {
    label: 'Clinical Incidents & Safety',
    category: 'Quality & Audit',
    icon: AlertTriangle
  },
  'endoscopy-report': {
    label: 'Endoscopy Reporting Suite',
    category: 'Endoscopy Department',
    icon: FileText
  },
  'endoscopy-logs': {
    label: 'Procedure Logs & Archives',
    category: 'Endoscopy Department',
    icon: Layers
  },
  users: {
    label: 'User Access & Permissions',
    category: 'Central Admin',
    icon: ShieldCheck
  },
  'activity-logs': {
    label: 'Audit & Activity Console',
    category: 'Central Admin',
    icon: History
  }
};

export const BreadcrumbNav: React.FC<BreadcrumbProps> = ({
  activeTab,
  setActiveTab,
  activeUnit,
  className = ''
}) => {
  const currentMeta = TAB_METADATA[activeTab] || {
    label: activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('-', ' '),
    category: 'Navigation',
    icon: Home
  };

  const CurrentIcon = currentMeta.icon;
  const unitInfo = (activeUnit && UNIT_DETAILS[activeUnit]) ? UNIT_DETAILS[activeUnit] : { label: activeUnit || 'General', color: 'bg-slate-700' };

  return (
    <nav
      id="app-breadcrumbs"
      aria-label="Breadcrumb Navigation"
      className={`no-print mb-4 px-3.5 py-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs backdrop-blur-xs flex flex-wrap items-center justify-between gap-2 text-xs select-none transition-all ${className}`}
    >
      {/* Breadcrumb Path Items */}
      <ol className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
        {/* 1. Root / Facility Home */}
        <li className="flex items-center">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all font-semibold tracking-tight cursor-pointer ${
              activeTab === 'dashboard' ? 'text-red-600 dark:text-red-400 font-bold' : ''
            }`}
            title="Go to Facility Dashboard"
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">TKC Clinical Hub</span>
            <span className="sm:hidden">Hub</span>
          </button>
        </li>

        {/* Separator 1 */}
        <li className="text-slate-300 dark:text-slate-700 shrink-0" aria-hidden="true">
          <ChevronRight className="w-3.5 h-3.5" />
        </li>

        {/* 2. Functional Category / Section */}
        <li className="flex items-center">
          <span className="px-2 py-1 rounded-lg text-slate-400 dark:text-slate-500 font-bold uppercase text-[9px] tracking-wider bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-800 shrink-0">
            {currentMeta.category}
          </span>
        </li>

        {/* Separator 2 (Only if not on Dashboard root) */}
        {activeTab !== 'dashboard' && (
          <>
            <li className="text-slate-300 dark:text-slate-700 shrink-0" aria-hidden="true">
              <ChevronRight className="w-3.5 h-3.5" />
            </li>

            {/* 3. Active Current Screen */}
            <li className="flex items-center min-w-0" aria-current="page">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50/80 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/40 text-red-700 dark:text-red-300 font-bold truncate">
                <CurrentIcon className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                <span className="truncate max-w-[150px] sm:max-w-[240px] md:max-w-[320px]">
                  {currentMeta.label}
                </span>
              </div>
            </li>
          </>
        )}
      </ol>

      {/* Right Side: Active Unit Pill indicator */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden md:inline text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          Unit:
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white shadow-2xs ${unitInfo?.color || 'bg-slate-700'}`}
          title={`Active Clinical Ward: ${unitInfo?.label || 'General'}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
          {unitInfo?.label || 'General'}
        </span>
      </div>
    </nav>
  );
};

export default BreadcrumbNav;
