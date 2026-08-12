import React, { useEffect, useState, useMemo, useRef } from 'react';
import { activityService, UserActivity } from '../services/activityService';
import { useAuth } from '../contexts/AuthContext';
import { useUnit } from '../contexts/UnitContext';
import { UNIT_DETAILS, CLINICAL_UNITS } from '../constants';

const ActivityLogsPage: React.FC = () => {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleFocusSearch = () => {
      searchInputRef.current?.focus();
    };
    window.addEventListener('app:focus-search', handleFocusSearch);
    return () => {
      window.removeEventListener('app:focus-search', handleFocusSearch);
    };
  }, []);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [maxLogs, setMaxLogs] = useState(100);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { currentUser } = useAuth();
  const { activeUnit } = useUnit();

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

  // Filter logic
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      // Search term
      const matchesSearch = 
        activity.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.performedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.recordType.toLowerCase().includes(searchTerm.toLowerCase());

      // Action Filter
      const matchesAction = actionFilter === 'ALL' || activity.action === actionFilter;

      // Record Type Filter
      const matchesType = typeFilter === 'ALL' || activity.recordType === typeFilter;

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

      return matchesSearch && matchesAction && matchesType && matchesUnit && matchesDate;
    });
  }, [activities, searchTerm, actionFilter, typeFilter, unitFilter, startDate, endDate]);

  // Statistics
  const stats = useMemo(() => {
    const counts = {
      total: filteredActivities.length,
      create: 0,
      modify: 0,
      delete: 0
    };

    filteredActivities.forEach(act => {
      if (act.action === 'CREATE') counts.create++;
      else if (act.action === 'MODIFY') counts.modify++;
      else if (act.action === 'DELETE') counts.delete++;
    });

    return counts;
  }, [filteredActivities]);

  const RECORD_TYPES = [
    'ALL',
    'Patient Record',
    'Endoscopy Record',
    'Clinical Task',
    'Safety Incident',
    'Mortality Record',
    'Inventory Item'
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-red-200 shadow-sm animate-pulse">
              Hidden Security Console
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase mt-2">
            System User Activity Trail
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Audit-grade sequence of record additions, modifications, and deletions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Limit:</label>
            <select
              value={maxLogs}
              onChange={(e) => setMaxLogs(Number(e.target.value))}
              className="bg-transparent text-slate-800 text-[10px] font-black outline-none cursor-pointer"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-3 bg-slate-900 hover:bg-slate-800 text-white transition-all rounded-xl shadow-lg shadow-slate-100 flex items-center gap-2 text-xs font-black uppercase tracking-widest"
          >
            {refreshing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span>Refresh Logs</span>
          </button>
        </div>
      </header>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">TOTAL LOGGED EVENTS</span>
          <span className="text-2xl font-black text-slate-900 mt-2">{stats.total}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col border-l-4 border-l-emerald-500">
          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">RECORD CREATIONS</span>
          <span className="text-2xl font-black text-slate-900 mt-2">{stats.create}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col border-l-4 border-l-blue-500">
          <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">RECORD MODIFICATIONS</span>
          <span className="text-2xl font-black text-slate-900 mt-2">{stats.modify}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col border-l-4 border-l-red-500">
          <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">RECORD DELETIONS</span>
          <span className="text-2xl font-black text-slate-900 mt-2">{stats.delete}</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative" title="Search activities (Alt+S)">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by patient name, physician, description, keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-16 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 outline-none text-xs font-semibold dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:focus:ring-red-950"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <kbd className="pointer-events-none absolute right-3 top-3 hidden sm:flex items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] font-black text-slate-400 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500">
              Alt+S
            </kbd>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase bg-white cursor-pointer"
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="MODIFY">Modify</option>
              <option value="DELETE">Delete</option>
            </select>

            {/* Record Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase bg-white cursor-pointer"
            >
              {RECORD_TYPES.map(type => (
                <option key={type} value={type}>{type === 'ALL' ? 'All Types' : type}</option>
              ))}
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

            {/* Clear Filters Button */}
            <button
              onClick={() => {
                setSearchTerm('');
                setActionFilter('ALL');
                setTypeFilter('ALL');
                setUnitFilter('ALL');
                setStartDate('');
                setEndDate('');
              }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filter by Date Range:</span>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase">From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase">To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold outline-none"
            />
          </div>
        </div>
      </div>

      {/* Activities Feed */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-[10px] font-black text-slate-100 uppercase tracking-[0.2em] flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Raw Activity Streams
          </h2>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
            Showing {filteredActivities.length} logs
          </span>
        </div>

        <div className="divide-y divide-slate-100 max-h-[800px] overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-4 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-48 bg-slate-200 rounded" />
                    <div className="h-3 w-3/4 bg-slate-100 rounded" />
                  </div>
                  <div className="h-3 w-20 bg-slate-200 rounded shrink-0" />
                </div>
              ))}
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 border border-slate-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No activity logs match the criteria.</p>
            </div>
          ) : (
            filteredActivities.map((activity) => (
              <div key={activity.id} className="p-5 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4 animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-start gap-4">
                  {/* Action Badge */}
                  <div className={`w-24 shrink-0 flex flex-col items-center py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                    activity.action === 'CREATE'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : activity.action === 'MODIFY'
                      ? 'bg-blue-50 text-blue-700 border-blue-100'
                      : 'bg-red-50 text-red-700 border-red-100'
                  }`}>
                    {activity.action}
                  </div>

                  {/* Log Details */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase">
                        {activity.recordType}
                      </span>
                      {activity.unit && (
                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase">
                          Unit: {activity.unit}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-800 leading-relaxed mt-1">
                      {activity.details}
                    </p>
                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1">
                      <span className="text-slate-600 font-black">{activity.performedBy}</span>
                      <span>•</span>
                      <span>{new Date(activity.timestamp).toLocaleDateString()} at {new Date(activity.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                {/* ISO Timestamp / Diagnostic */}
                <div className="hidden md:block text-right shrink-0">
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-tighter">
                    {new Date(activity.timestamp).toISOString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-800 text-center">
          <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em]">
            Department of Medical Safety & Systems Quality Control
          </p>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogsPage;
