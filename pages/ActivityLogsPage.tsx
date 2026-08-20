import React, { useEffect, useState, useMemo, useRef } from 'react';
import { activityService, UserActivity, ActivityCategory } from '../services/activityService';
import { useAuth } from '../contexts/AuthContext';
import { useUnit } from '../contexts/UnitContext';
import { UNIT_DETAILS, CLINICAL_UNITS } from '../constants';
import { TableSkeleton } from '../components/LoadingSpinner';
import { db, safeFirestoreWrite, safeFirestoreRead } from '../services/firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import {
  Shield,
  Key,
  Database,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  RefreshCw,
  Search,
  Download,
  Terminal,
  Server,
  HardDrive,
  UserCheck,
  LogOut,
  LogIn,
  Sliders,
  ChevronDown,
  ChevronRight,
  Clock,
  Sparkles,
  HelpCircle,
  Filter
} from 'lucide-react';

interface DiagnosticResult {
  localStorage: { status: 'OK' | 'WARN' | 'FAIL'; message: string; details?: string };
  firestore: { status: 'OK' | 'WARN' | 'FAIL'; message: string; latencyMs?: number };
  session: { status: 'OK' | 'WARN' | 'FAIL'; userEmail?: string; role?: string; uid?: string };
  configIntegrity: { status: 'OK' | 'WARN' | 'FAIL'; message: string };
  timestamp: string;
}

const ActivityLogsPage: React.FC = () => {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'ALL' | 'AUTH_SESSION' | 'CONFIG_PERSISTENCE' | 'CLINICAL'>('ALL');

  // Filters
  const [actionFilter, setActionFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'WARNING' | 'ERROR'>('ALL');
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [maxLogs, setMaxLogs] = useState(100);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Selected Log for metadata inspection
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Diagnostic health probe state
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

  const { currentUser } = useAuth();
  const { activeUnit } = useUnit();

  useEffect(() => {
    const handleFocusSearch = () => {
      searchInputRef.current?.focus();
    };
    window.addEventListener('app:focus-search', handleFocusSearch);
    return () => {
      window.removeEventListener('app:focus-search', handleFocusSearch);
    };
  }, []);

  useEffect(() => {
    loadActivities();
  }, [maxLogs]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const data = await activityService.getActivities(maxLogs);
      setActivities(data);
    } catch (error) {
      console.error("Failed to load user activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const data = await activityService.getActivities(maxLogs);
    setActivities(data);
    setRefreshing(false);
  };

  // Run live session & persistence probe
  const runPersistenceDiagnostic = async () => {
    setRunningDiagnostic(true);
    const result: DiagnosticResult = {
      localStorage: { status: 'OK', message: 'Ready' },
      firestore: { status: 'OK', message: 'Checking...' },
      session: { status: 'OK' },
      configIntegrity: { status: 'OK', message: 'Checking...' },
      timestamp: new Date().toISOString()
    };

    // 1. Test LocalStorage
    try {
      const testKey = '__medilog_test_probe__';
      const testVal = `test_${Date.now()}`;
      localStorage.setItem(testKey, testVal);
      const readVal = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      if (readVal === testVal) {
        result.localStorage = {
          status: 'OK',
          message: 'Local browser storage is fully readable and writable.',
          details: `${Object.keys(localStorage).length} active storage keys detected.`
        };
      } else {
        result.localStorage = {
          status: 'WARN',
          message: 'LocalStorage value mismatch detected during verification write.'
        };
      }
    } catch (e: any) {
      result.localStorage = {
        status: 'FAIL',
        message: `LocalStorage access blocked or quota exceeded: ${e?.message}`
      };
    }

    // 2. Test Firestore sync & latency
    const startFs = performance.now();
    try {
      const probeDocRef = doc(db, 'system_config', '__persistence_probe__');
      await safeFirestoreWrite(async () => {
        await setDoc(probeDocRef, {
          lastProbeAt: new Date().toISOString(),
          probeBy: currentUser?.email || 'Anonymous',
          platform: 'web'
        }, { merge: true });
      }, 4000);

      const snap = await safeFirestoreRead(async () => {
        return await getDoc(probeDocRef);
      }, null, 4000);

      const elapsed = Math.round(performance.now() - startFs);
      if (snap && snap.exists()) {
        result.firestore = {
          status: 'OK',
          message: `Firestore Cloud Database is online and synchronized (${elapsed}ms latency).`,
          latencyMs: elapsed
        };
      } else {
        result.firestore = {
          status: 'WARN',
          message: 'Firestore wrote successfully but read completed via offline fallback cache.',
          latencyMs: elapsed
        };
      }
    } catch (fsErr: any) {
      result.firestore = {
        status: 'FAIL',
        message: `Firestore sync failed or timed out: ${fsErr?.message || 'Offline mode active'}`
      };
    }

    // 3. Test Session Context
    if (currentUser) {
      result.session = {
        status: 'OK',
        userEmail: currentUser.email || 'Anonymous',
        role: currentUser.role,
        uid: currentUser.uid
      };
    } else {
      result.session = {
        status: 'WARN',
        userEmail: 'No active session (Guest / Unauthenticated)'
      };
    }

    // 4. Test Config Integrity
    const hasSmtp = Boolean(localStorage.getItem('medilog_smtp_config_v2'));
    const hasDaily = Boolean(localStorage.getItem('medilog_daily_report_settings_v2'));
    const hasSession = Boolean(localStorage.getItem('hdu_session'));

    if (hasSmtp || hasDaily || hasSession) {
      result.configIntegrity = {
        status: 'OK',
        message: 'Essential system and user configuration keys are present in persistent storage.'
      };
    } else {
      result.configIntegrity = {
        status: 'WARN',
        message: 'No cached local configuration keys detected. New settings will be seeded from Firestore.'
      };
    }

    setDiagnosticResult(result);
    setRunningDiagnostic(false);
    setShowDiagnosticModal(true);

    // Also log this diagnostic probe event
    await activityService.logConfigPersistenceEvent(
      'STORAGE_SYNC',
      'diagnostic_probe',
      `Manual persistence integrity probe executed: LocalStorage=[${result.localStorage.status}], Firestore=[${result.firestore.status}], Session=[${result.session.status}].`,
      currentUser?.email || 'System Inspector',
      'HYBRID',
      result.firestore.status === 'OK' && result.localStorage.status === 'OK' ? 'SUCCESS' : 'WARNING',
      { diagnostic: result }
    );
    loadActivities();
  };

  // Filter logic
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      // Tab category filter
      if (activeTab === 'AUTH_SESSION') {
        const isAuth = activity.category === 'AUTH_SESSION' || 
          activity.action.startsWith('AUTH_') || 
          activity.action === 'SESSION_RESTORE' || 
          activity.action === 'PASSWORD_CHANGE';
        if (!isAuth) return false;
      } else if (activeTab === 'CONFIG_PERSISTENCE') {
        const isConfig = activity.category === 'CONFIG_PERSISTENCE' || 
          activity.action.startsWith('CONFIG_') || 
          activity.action === 'STORAGE_SYNC';
        if (!isConfig) return false;
      } else if (activeTab === 'CLINICAL') {
        const isClinical = activity.category === 'CLINICAL' || 
          activity.action === 'CREATE' || 
          activity.action === 'MODIFY' || 
          activity.action === 'DELETE';
        if (!isClinical) return false;
      }

      // Search term
      const matchesSearch = 
        activity.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.performedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.recordType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (activity.metadata?.configKey && activity.metadata.configKey.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (activity.metadata?.email && activity.metadata.email.toLowerCase().includes(searchTerm.toLowerCase()));

      // Action Filter
      const matchesAction = actionFilter === 'ALL' || activity.action === actionFilter;

      // Status Filter
      const matchesStatus = statusFilter === 'ALL' || (activity.status || 'SUCCESS') === statusFilter;

      // Unit Filter
      const matchesUnit = unitFilter === 'ALL' || activity.unit === unitFilter;

      // Date Range Filter
      let matchesDate = true;
      if (startDate || endDate) {
        const logDate = new Date(activity.timestamp);
        logDate.setHours(0, 0, 0, 0);

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (logDate < start) matchesDate = false;
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(0, 0, 0, 0);
          if (logDate > end) matchesDate = false;
        }
      }

      return matchesSearch && matchesAction && matchesStatus && matchesUnit && matchesDate;
    });
  }, [activities, activeTab, searchTerm, actionFilter, statusFilter, unitFilter, startDate, endDate]);

  // Statistics
  const stats = useMemo(() => {
    const counts = {
      total: activities.length,
      authEvents: 0,
      configEvents: 0,
      failures: 0,
      clinicalChanges: 0
    };

    activities.forEach(act => {
      const isAuth = act.category === 'AUTH_SESSION' || act.action.startsWith('AUTH_') || act.action === 'SESSION_RESTORE';
      const isConfig = act.category === 'CONFIG_PERSISTENCE' || act.action.startsWith('CONFIG_') || act.action === 'STORAGE_SYNC';
      const isClinical = act.category === 'CLINICAL' || act.action === 'CREATE' || act.action === 'MODIFY' || act.action === 'DELETE';

      if (isAuth) counts.authEvents++;
      if (isConfig) counts.configEvents++;
      if (isClinical) counts.clinicalChanges++;
      if (act.status === 'ERROR' || act.status === 'WARNING' || act.action === 'AUTH_FAILED' || act.action === 'CONFIG_FAIL') {
        counts.failures++;
      }
    });

    return counts;
  }, [activities]);

  // Export Logs to JSON
  const exportLogsAsJson = () => {
    const jsonStr = JSON.stringify(filteredActivities, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hdu_activity_session_logs_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Logs to CSV
  const exportLogsAsCsv = () => {
    const headers = ['Timestamp', 'Action', 'Category', 'RecordType', 'Status', 'PerformedBy', 'Unit', 'Details', 'ConfigKey', 'PersistenceLayer'];
    const rows = filteredActivities.map(act => [
      `"${act.timestamp}"`,
      `"${act.action}"`,
      `"${act.category || 'CLINICAL'}"`,
      `"${act.recordType}"`,
      `"${act.status || 'SUCCESS'}"`,
      `"${act.performedBy}"`,
      `"${act.unit || 'Global'}"`,
      `"${(act.details || '').replace(/"/g, '""')}"`,
      `"${act.metadata?.configKey || ''}"`,
      `"${act.metadata?.persistenceLayer || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hdu_activity_session_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActionBadge = (action: string, status?: string) => {
    switch (action) {
      case 'AUTH_LOGIN':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          label: 'LOGIN',
          icon: LogIn
        };
      case 'AUTH_LOGOUT':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          label: 'LOGOUT',
          icon: LogOut
        };
      case 'SESSION_RESTORE':
        return {
          bg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
          label: 'SESSION RESTORE',
          icon: UserCheck
        };
      case 'AUTH_FAILED':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          label: 'AUTH FAILED',
          icon: AlertTriangle
        };
      case 'AUTH_SIGNUP':
        return {
          bg: 'bg-teal-50 text-teal-700 border-teal-200',
          label: 'SIGNUP',
          icon: Key
        };
      case 'PASSWORD_CHANGE':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          label: 'CREDENTIALS',
          icon: Shield
        };
      case 'CONFIG_PERSIST':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          label: 'CONFIG SAVED',
          icon: Sliders
        };
      case 'CONFIG_FAIL':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          label: 'CONFIG FAIL',
          icon: XCircle
        };
      case 'STORAGE_SYNC':
        return {
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          label: 'STORAGE SYNC',
          icon: Database
        };
      case 'CREATE':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          label: 'CREATE',
          icon: CheckCircle2
        };
      case 'MODIFY':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          label: 'MODIFY',
          icon: Activity
        };
      case 'DELETE':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          label: 'DELETE',
          icon: XCircle
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          label: action,
          icon: Activity
        };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border border-slate-800 flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-red-400" />
              Security & Audit Console
            </span>
            <span className="bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md border border-blue-200">
              Auth & Persistence Engine v2.0
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase mt-2">
            System & Session Activity Trail
          </h1>
          <p className="text-slate-500 text-xs mt-1 font-medium max-w-2xl">
            Live telemetry tracking user authentication lifecycles, session restorations, configuration sync states, and clinical modifications.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Persistence Diagnostic Probe Button */}
          <button
            onClick={runPersistenceDiagnostic}
            disabled={runningDiagnostic}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm shadow-indigo-200"
          >
            {runningDiagnostic ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Terminal className="w-4 h-4" />
            )}
            <span>Test Persistence Health</span>
          </button>

          {/* Export Menu */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button
              onClick={exportLogsAsCsv}
              title="Export CSV"
              className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-white rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3 h-3" />
              <span>CSV</span>
            </button>
            <button
              onClick={exportLogsAsJson}
              title="Export JSON"
              className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-white rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3 h-3" />
              <span>JSON</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase transition-all shadow-sm flex items-center gap-1.5"
            title="Refresh All Logs"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Live System Context & Diagnostic Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Session Active
              </span>
              <span className="text-slate-500 text-[10px]">•</span>
              <span className="text-slate-300 text-[10px] font-mono">
                Role: <span className="text-white font-bold">{currentUser?.role || 'Guest'}</span>
              </span>
            </div>
            <p className="text-xs font-bold text-slate-200 mt-0.5">
              {currentUser?.email || 'adilh1220@gmail.com'} <span className="text-slate-400 text-[11px]">({currentUser?.displayName || 'Superuser'})</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-300 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Storage:</span>
            <span className="text-white text-[11px]">LocalStorage + Firestore Hybrid</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <Database className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Sync Buffer:</span>
            <span className="text-white text-[11px] font-mono">{activities.length} Recorded</span>
          </div>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Events */}
        <div 
          onClick={() => setActiveTab('ALL')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === 'ALL' 
              ? 'bg-white border-slate-900 shadow-md ring-2 ring-slate-900/10' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[9px] font-black uppercase tracking-widest">Total Trail Events</span>
            <Activity className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{stats.total}</p>
          <span className="text-[10px] font-bold text-slate-400 mt-1 block">Unified system stream</span>
        </div>

        {/* Auth & Session Events */}
        <div 
          onClick={() => setActiveTab('AUTH_SESSION')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === 'AUTH_SESSION' 
              ? 'bg-cyan-50/50 border-cyan-500 shadow-md ring-2 ring-cyan-500/20' 
              : 'bg-white border-slate-200 hover:border-cyan-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-cyan-600">
            <span className="text-[9px] font-black uppercase tracking-widest">Auth & Sessions</span>
            <Key className="w-4 h-4 text-cyan-600" />
          </div>
          <p className="text-2xl font-black text-cyan-900 mt-2">{stats.authEvents}</p>
          <span className="text-[10px] font-bold text-cyan-600 mt-1 block">Logins, Tokens & Restores</span>
        </div>

        {/* Config & Persistence Events */}
        <div 
          onClick={() => setActiveTab('CONFIG_PERSISTENCE')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === 'CONFIG_PERSISTENCE' 
              ? 'bg-purple-50/50 border-purple-500 shadow-md ring-2 ring-purple-500/20' 
              : 'bg-white border-slate-200 hover:border-purple-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-purple-600">
            <span className="text-[9px] font-black uppercase tracking-widest">Config Persistence</span>
            <Sliders className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-900 mt-2">{stats.configEvents}</p>
          <span className="text-[10px] font-bold text-purple-600 mt-1 block">SMTP, Schedules & Roles</span>
        </div>

        {/* Failures & Challenges */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'ERROR' ? 'ALL' : 'ERROR')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'ERROR' 
              ? 'bg-rose-50/70 border-rose-500 shadow-md ring-2 ring-rose-500/20' 
              : 'bg-white border-slate-200 hover:border-rose-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[9px] font-black uppercase tracking-widest">Failures / Warnings</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-900 mt-2">{stats.failures}</p>
          <span className="text-[10px] font-bold text-rose-600 mt-1 block">
            {statusFilter === 'ERROR' ? 'Showing Errors Only' : 'Click to filter failed events'}
          </span>
        </div>
      </div>

      {/* Tabs Navigation & Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>All Streams ({activities.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('AUTH_SESSION')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'AUTH_SESSION'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Auth & Session Logs ({stats.authEvents})</span>
            </button>

            <button
              onClick={() => setActiveTab('CONFIG_PERSISTENCE')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'CONFIG_PERSISTENCE'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Config Persistence ({stats.configEvents})</span>
            </button>

            <button
              onClick={() => setActiveTab('CLINICAL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'CLINICAL'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Clinical Changes ({stats.clinicalChanges})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logs Limit:</span>
            <select
              value={maxLogs}
              onChange={(e) => setMaxLogs(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold px-2 py-1 rounded-lg outline-none cursor-pointer"
            >
              <option value={50}>50 Logs</option>
              <option value={100}>100 Logs</option>
              <option value={200}>200 Logs</option>
              <option value={500}>500 Logs</option>
            </select>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by user email, action, config key, error message, or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-16 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none text-xs font-bold text-slate-800 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <kbd className="pointer-events-none absolute right-3 top-2.5 hidden sm:flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9px] font-black text-slate-400 shadow-sm">
              Alt+S
            </kbd>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase bg-white cursor-pointer"
            >
              <option value="ALL">All Outcomes</option>
              <option value="SUCCESS">Success Only</option>
              <option value="WARNING">Warnings</option>
              <option value="ERROR">Errors / Failures</option>
            </select>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase bg-white cursor-pointer"
            >
              <option value="ALL">All Actions</option>
              <option value="AUTH_LOGIN">Login</option>
              <option value="SESSION_RESTORE">Session Restore</option>
              <option value="AUTH_LOGOUT">Logout</option>
              <option value="AUTH_FAILED">Auth Failed</option>
              <option value="CONFIG_PERSIST">Config Persist</option>
              <option value="CONFIG_FAIL">Config Fail</option>
              <option value="CREATE">Record Create</option>
              <option value="MODIFY">Record Modify</option>
              <option value="DELETE">Record Delete</option>
            </select>

            {/* Unit Filter */}
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase bg-white cursor-pointer"
            >
              <option value="ALL">All Units</option>
              {CLINICAL_UNITS.map(unit => (
                <option key={unit} value={unit}>{UNIT_DETAILS[unit]?.label || unit}</option>
              ))}
            </select>

            {/* Reset Button */}
            <button
              onClick={() => {
                setSearchTerm('');
                setActionFilter('ALL');
                setStatusFilter('ALL');
                setUnitFilter('ALL');
                setStartDate('');
                setEndDate('');
              }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 text-xs">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            Time Range:
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase">From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-bold outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase">To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-bold outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main Activity Feed Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Table Header / Stream bar */}
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-400" />
            <h2 className="text-xs font-black uppercase tracking-[0.15em] text-slate-200">
              {activeTab === 'AUTH_SESSION' ? 'Authentication & Session Trail' :
               activeTab === 'CONFIG_PERSISTENCE' ? 'Configuration & Storage Persistence Stream' :
               activeTab === 'CLINICAL' ? 'Clinical Modification Audit' :
               'Unified System Activity Stream'}
            </h2>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700 font-mono">
            Showing {filteredActivities.length} logs
          </span>
        </div>

        {/* Activity rows */}
        <div className="divide-y divide-slate-100 max-h-[850px] overflow-y-auto">
          {loading ? (
            <TableSkeleton rows={6} cols={4} showHeader={false} />
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 border border-slate-200">
                <Info className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">
                No activity logs match the selected filter criteria.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setActionFilter('ALL');
                  setStatusFilter('ALL');
                  setUnitFilter('ALL');
                }}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            filteredActivities.map((activity, idx) => {
              const badge = getActionBadge(activity.action, activity.status);
              const BadgeIcon = badge.icon;
              const isExpanded = expandedLogId === (activity.id || `idx_${idx}`);
              const isFailure = activity.status === 'ERROR' || activity.action === 'AUTH_FAILED' || activity.action === 'CONFIG_FAIL';
              const isWarning = activity.status === 'WARNING';

              return (
                <div 
                  key={activity.id || `act_${idx}`} 
                  className={`p-5 transition-colors flex flex-col gap-3 ${
                    isFailure ? 'bg-rose-50/20 hover:bg-rose-50/40' :
                    isWarning ? 'bg-amber-50/20 hover:bg-amber-50/40' :
                    'hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1">
                      {/* Action Badge */}
                      <div className={`w-32 shrink-0 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-xs ${badge.bg}`}>
                        <BadgeIcon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{badge.label}</span>
                      </div>

                      {/* Content */}
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase">
                            {activity.recordType}
                          </span>

                          {activity.unit && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase">
                              Unit: {activity.unit}
                            </span>
                          )}

                          {activity.metadata?.persistenceLayer && (
                            <span className="text-[9px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 uppercase">
                              Layer: {activity.metadata.persistenceLayer}
                            </span>
                          )}

                          {activity.status && activity.status !== 'SUCCESS' && (
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase border ${
                              activity.status === 'ERROR' ? 'bg-red-100 text-red-700 border-red-200' :
                              activity.status === 'WARNING' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                              'bg-blue-100 text-blue-800 border-blue-200'
                            }`}>
                              Status: {activity.status}
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-bold text-slate-800 leading-relaxed mt-1">
                          {activity.details}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-tight pt-1">
                          <span className="text-slate-700 font-black flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-slate-400" />
                            {activity.performedBy}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(activity.timestamp).toLocaleDateString()} at {new Date(activity.timestamp).toLocaleTimeString()}
                          </span>

                          {/* Quick Toggle for Details */}
                          {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : (activity.id || `idx_${idx}`))}
                              className="ml-auto text-indigo-600 hover:text-indigo-800 text-[10px] font-black uppercase flex items-center gap-0.5 cursor-pointer"
                            >
                              {isExpanded ? (
                                <><span>Hide Diagnostics</span> <ChevronDown className="w-3 h-3" /></>
                              ) : (
                                <><span>Inspect Metadata</span> <ChevronRight className="w-3 h-3" /></>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Timestamp Pill */}
                    <div className="hidden md:block text-right shrink-0">
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                        {new Date(activity.timestamp).toISOString().slice(11, 19)} UTC
                      </span>
                    </div>
                  </div>

                  {/* Expandable Metadata & Diagnostics Panel */}
                  {isExpanded && activity.metadata && (
                    <div className="mt-2 p-4 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono border border-slate-800 space-y-2 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5" />
                          Log Technical Metadata & Diagnostics
                        </span>
                        <span className="text-[9px] text-slate-500">ID: {activity.id || 'Buffered'}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                        {activity.metadata.email && (
                          <div><span className="text-slate-400">User Email:</span> <span className="text-cyan-300 font-bold">{activity.metadata.email}</span></div>
                        )}
                        {activity.metadata.role && (
                          <div><span className="text-slate-400">Role Context:</span> <span className="text-purple-300 font-bold">{activity.metadata.role}</span></div>
                        )}
                        {activity.metadata.configKey && (
                          <div><span className="text-slate-400">Target Config Key:</span> <span className="text-emerald-300 font-bold">{activity.metadata.configKey}</span></div>
                        )}
                        {activity.metadata.persistenceLayer && (
                          <div><span className="text-slate-400">Persistence Target:</span> <span className="text-amber-300 font-bold">{activity.metadata.persistenceLayer}</span></div>
                        )}
                        {activity.metadata.errorCode && (
                          <div><span className="text-slate-400">Error Code:</span> <span className="text-rose-400 font-bold">{activity.metadata.errorCode}</span></div>
                        )}
                        {activity.metadata.resolutionSource && (
                          <div><span className="text-slate-400">Resolved Via:</span> <span className="text-teal-300 font-bold">{activity.metadata.resolutionSource}</span></div>
                        )}
                      </div>

                      {/* Raw payload */}
                      <details className="mt-2 pt-2 border-t border-slate-800 text-[10px]">
                        <summary className="cursor-pointer text-slate-400 hover:text-slate-200">View Full JSON Metadata</summary>
                        <pre className="mt-2 p-2 bg-slate-950 rounded text-slate-300 overflow-x-auto text-[10px]">
                          {JSON.stringify(activity.metadata, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider gap-2">
          <span>High Dependency Unit • Systems Quality Control</span>
          <span className="font-mono text-slate-500">Security Audit Protocol ISO-27001 Standard</span>
        </div>
      </div>

      {/* Persistence Diagnostic Results Modal */}
      {showDiagnosticModal && diagnosticResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase">
                    Session & Storage Health Probe
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500">
                    Live end-to-end check of your browser session and cloud sync state
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* 1. LocalStorage Probe */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                {diagnosticResult.localStorage.status === 'OK' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-slate-800">Browser Local Storage</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                      diagnosticResult.localStorage.status === 'OK' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {diagnosticResult.localStorage.status}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-600 mt-0.5">
                    {diagnosticResult.localStorage.message}
                  </p>
                  {diagnosticResult.localStorage.details && (
                    <p className="text-[10px] font-mono text-slate-400 mt-1">
                      {diagnosticResult.localStorage.details}
                    </p>
                  )}
                </div>
              </div>

              {/* 2. Firestore Cloud Probe */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                {diagnosticResult.firestore.status === 'OK' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-slate-800">Firestore Cloud Database</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                      diagnosticResult.firestore.status === 'OK' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {diagnosticResult.firestore.status}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-600 mt-0.5">
                    {diagnosticResult.firestore.message}
                  </p>
                </div>
              </div>

              {/* 3. Session Context */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                <UserCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-slate-800">Authentication Context</span>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                      {diagnosticResult.session.status}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-600 mt-0.5">
                    Active User: <span className="font-bold text-slate-800">{diagnosticResult.session.userEmail}</span> ({diagnosticResult.session.role || 'Staff'})
                  </p>
                </div>
              </div>

              {/* 4. Configuration Persistence Insight */}
              <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-1">
                <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-xs">
                  <HelpCircle className="w-4 h-4 text-indigo-600" />
                  <span>Why do configurations occasionally reset?</span>
                </div>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  User configurations (like SMTP passwords and schedule preferences) are saved in <strong>both Firestore and LocalStorage</strong>. If you log out or clear browser cache, user-specific keys are safely cleared to protect credentials. Upon logging back in, they are immediately re-seeded from your cloud account.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Close Diagnostic Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogsPage;
