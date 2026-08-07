import React, { useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  Calendar, 
  Filter, 
  RotateCcw, 
  Check, 
  SlidersHorizontal, 
  AlertCircle, 
  ShieldAlert, 
  CheckCircle2, 
  Layers, 
  Sparkles,
  Command
} from 'lucide-react';
import { useSearch, SeverityLevel, SearchScope } from '../contexts/SearchContext';

interface AdvancedSearchModalProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({ activeTab, setActiveTab }) => {
  const {
    isAdvancedSearchOpen,
    closeAdvancedSearch,
    searchQuery,
    setSearchQuery,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    severity,
    setSeverity,
    scope,
    setScope,
    setDateRangePreset,
    resetFilters,
    isFilterActive,
    activeFilterCount,
  } = useSearch();

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isAdvancedSearchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isAdvancedSearchOpen]);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAdvancedSearchOpen) {
        closeAdvancedSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdvancedSearchOpen, closeAdvancedSearch]);

  if (!isAdvancedSearchOpen) return null;

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (scope !== 'ALL' && setActiveTab) {
      const scopeToTabMap: Record<string, string> = {
        patients: 'active',
        endoscopy: 'endoscopy-logs',
        mortality: 'mortality',
        safety: 'safety',
        inventory: 'inventory',
        tasks: 'tasks'
      };
      if (scopeToTabMap[scope]) {
        setActiveTab(scopeToTabMap[scope]);
      }
    }
    closeAdvancedSearch();
  };

  const severityOptions: { id: SeverityLevel; label: string; sub: string; color: string; icon: any }[] = [
    { id: 'ALL', label: 'All Severities', sub: 'No severity filter', color: 'bg-slate-100 text-slate-700 border-slate-300', icon: Filter },
    { id: 'CRITICAL', label: 'Critical / High', sub: 'Triage Critical, High Tasks, Low Inventory', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: ShieldAlert },
    { id: 'URGENT', label: 'Urgent / Medium', sub: 'Triage Urgent, Medium Tasks', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertCircle },
    { id: 'STABLE', label: 'Stable / Low', sub: 'Triage Stable, Low Priority', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  ];

  const scopeOptions: { id: SearchScope; label: string }[] = [
    { id: 'ALL', label: 'All Sections' },
    { id: 'patients', label: 'In-Patient Census' },
    { id: 'endoscopy', label: 'Endoscopy Reports' },
    { id: 'mortality', label: 'Mortality Records' },
    { id: 'safety', label: 'Safety Incidents' },
    { id: 'inventory', label: 'Inventory Items' },
    { id: 'tasks', label: 'Tasks' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="advanced-search-title"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="advanced-search-title" className="text-lg font-black tracking-tight">Advanced Cross-Table Filter</h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-800 text-slate-300 rounded border border-slate-700">
                  Alt + S
                </span>
              </div>
              <p className="text-xs text-slate-400">Filter by date range, severity level, and keyword across all clinical tables</p>
            </div>
          </div>
          <button
            onClick={closeAdvancedSearch}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleApply} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 1. Keyword Search Bar */}
          <div className="space-y-1.5">
            <label htmlFor="adv-search-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex justify-between items-center">
              <span>Keyword / Patient Name / MRN Search</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[10px] font-medium text-slate-500 hover:text-slate-800 underline"
                >
                  Clear search term
                </button>
              )}
            </label>
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="adv-search-input"
                ref={searchInputRef}
                type="text"
                placeholder="Search patient name, MRN, doctor, procedure, item name, or task..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white text-sm transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 2. Target Section / Scope */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" /> Target Table Scope
            </label>
            <div className="flex flex-wrap gap-1.5">
              {scopeOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScope(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    scope === opt.id
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Date Range Selector & Presets */}
          <div className="space-y-3 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-600" /> Filter By Date Range
              </label>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => setDateRangePreset('clear')}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800"
                >
                  Reset Date Filter
                </button>
              )}
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => setDateRangePreset('today')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-white text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateRangePreset('7days')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-white text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setDateRangePreset('30days')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-white text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => setDateRangePreset('thisMonth')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-white text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
              >
                This Month
              </button>
            </div>

            {/* Custom Date Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">End Date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          {/* 4. Severity Level Filter */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-slate-600" /> Severity Level &amp; Priority
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {severityOptions.map((opt) => {
                const IconComponent = opt.icon;
                const isSelected = severity === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSeverity(opt.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between ${
                      isSelected
                        ? 'ring-2 ring-slate-900 border-slate-900 shadow-sm bg-slate-900 text-white'
                        : `${opt.color} hover:brightness-95`
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-white/20 text-white' : 'bg-white/80'}`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div>
                        <div className={`text-xs font-bold ${isSelected ? 'text-white' : ''}`}>
                          {opt.label}
                        </div>
                        <div className={`text-[10px] ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                          {opt.sub}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="bg-white text-slate-900 rounded-full p-0.5 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            {isFilterActive ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                {activeFilterCount} Filter{activeFilterCount > 1 ? 's' : ''} Active
              </span>
            ) : (
              <span className="text-slate-400 text-xs italic">No active filters applied</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {isFilterActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset All
              </button>
            )}
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" /> Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSearchModal;
