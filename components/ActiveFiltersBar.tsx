import React from 'react';
import { SlidersHorizontal, X, Calendar, ShieldAlert, Search, RotateCcw } from 'lucide-react';
import { useSearch } from '../contexts/SearchContext';

export const ActiveFiltersBar: React.FC = () => {
  const {
    searchQuery,
    startDate,
    endDate,
    severity,
    scope,
    openAdvancedSearch,
    resetFilters,
    isFilterActive,
    setSearchQuery,
    setStartDate,
    setEndDate,
    setSeverity,
    setScope,
  } = useSearch();

  if (!isFilterActive) return null;

  const severityLabels: Record<string, string> = {
    CRITICAL: 'Critical / High',
    URGENT: 'Urgent / Medium',
    STABLE: 'Stable / Low',
  };

  const scopeLabels: Record<string, string> = {
    patients: 'In-Patient Census',
    endoscopy: 'Endoscopy Reports',
    mortality: 'Mortality Records',
    safety: 'Safety Incidents',
    inventory: 'Inventory Items',
    tasks: 'Tasks',
  };

  return (
    <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl border border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150 my-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[10px] bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
          <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" /> Active Filters:
        </span>

        {/* Query Chip */}
        {searchQuery.trim() && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-medium">
            <Search className="w-3 h-3 text-slate-400" />
            <span>"{searchQuery}"</span>
            <button
              onClick={() => setSearchQuery('')}
              className="text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-slate-700"
              title="Clear keyword search"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}

        {/* Date Range Chip */}
        {(startDate || endDate) && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-medium">
            <Calendar className="w-3 h-3 text-blue-400" />
            <span>
              {startDate || 'Start'} &rarr; {endDate || 'End'}
            </span>
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-slate-700"
              title="Clear date filter"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}

        {/* Severity Chip */}
        {severity !== 'ALL' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-medium">
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            <span>Severity: {severityLabels[severity] || severity}</span>
            <button
              onClick={() => setSeverity('ALL')}
              className="text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-slate-700"
              title="Clear severity filter"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}

        {/* Scope Chip */}
        {scope !== 'ALL' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-medium">
            <span>Scope: {scopeLabels[scope] || scope}</span>
            <button
              onClick={() => setScope('ALL')}
              className="text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-slate-700"
              title="Clear scope filter"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={openAdvancedSearch}
          className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1"
        >
          Modify (Alt+S)
        </button>
        <button
          onClick={resetFilters}
          className="text-[11px] font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" /> Clear All
        </button>
      </div>
    </div>
  );
};

export default ActiveFiltersBar;
