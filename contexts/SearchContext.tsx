import React, { createContext, useContext, useState, useEffect } from 'react';

export type SeverityLevel = 'ALL' | 'CRITICAL' | 'URGENT' | 'STABLE' | 'HIGH' | 'MEDIUM' | 'LOW';

export type SearchScope = 'ALL' | 'patients' | 'endoscopy' | 'mortality' | 'safety' | 'inventory' | 'tasks';

interface SearchContextType {
  isAdvancedSearchOpen: boolean;
  openAdvancedSearch: () => void;
  closeAdvancedSearch: () => void;
  toggleAdvancedSearch: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  severity: SeverityLevel;
  setSeverity: (sev: SeverityLevel) => void;
  scope: SearchScope;
  setScope: (scope: SearchScope) => void;
  setDateRangePreset: (preset: 'today' | '7days' | '30days' | 'thisMonth' | 'clear') => void;
  resetFilters: () => void;
  isFilterActive: boolean;
  activeFilterCount: number;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [severity, setSeverity] = useState<SeverityLevel>('ALL');
  const [scope, setScope] = useState<SearchScope>('ALL');

  const openAdvancedSearch = () => setIsAdvancedSearchOpen(true);
  const closeAdvancedSearch = () => setIsAdvancedSearchOpen(false);
  const toggleAdvancedSearch = () => setIsAdvancedSearchOpen(prev => !prev);

  const setDateRangePreset = (preset: 'today' | '7days' | '30days' | 'thisMonth' | 'clear') => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'clear') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (preset === 'today') {
      const todayStr = formatDate(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setStartDate(formatDate(past));
      setEndDate(formatDate(today));
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setStartDate(formatDate(past));
      setEndDate(formatDate(today));
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(today));
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSeverity('ALL');
    setScope('ALL');
  };

  const activeFilterCount = [
    Boolean(searchQuery.trim()),
    Boolean(startDate),
    Boolean(endDate),
    severity !== 'ALL',
    scope !== 'ALL'
  ].filter(Boolean).length;

  const isFilterActive = activeFilterCount > 0;

  // Global Alt+S keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        openAdvancedSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <SearchContext.Provider
      value={{
        isAdvancedSearchOpen,
        openAdvancedSearch,
        closeAdvancedSearch,
        toggleAdvancedSearch,
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
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};
