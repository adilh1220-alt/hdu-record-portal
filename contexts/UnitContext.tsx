
import React, { createContext, useContext, useState, useEffect } from 'react';
import { ClinicalUnit } from '../types';
import { useAuth } from './AuthContext';

interface UnitContextType {
  activeUnit: ClinicalUnit;
  setActiveUnit: (unit: ClinicalUnit) => void;
}

const UnitContext = createContext<UnitContextType | undefined>(undefined);

export const UnitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAdmin } = useAuth();
  const [activeUnit, setActiveUnit] = useState<ClinicalUnit>(() => {
    return (localStorage.getItem('hdu_active_unit') as ClinicalUnit) || 'HDU';
  });

  useEffect(() => {
    if (currentUser && !isAdmin && currentUser.assignedUnit) {
      setActiveUnit(currentUser.assignedUnit);
    }
  }, [currentUser, isAdmin]);

  const handleSetUnit = (unit: ClinicalUnit) => {
    if (!isAdmin && currentUser?.assignedUnit && unit !== currentUser.assignedUnit) {
      return; // Prevent switching if not admin and has assigned unit
    }
    setActiveUnit(unit);
    localStorage.setItem('hdu_active_unit', unit);
  };

  return (
    <UnitContext.Provider value={{ activeUnit, setActiveUnit: handleSetUnit }}>
      {children}
    </UnitContext.Provider>
  );
};

export const useUnit = () => {
  const context = useContext(UnitContext);
  if (context === undefined) {
    throw new Error('useUnit must be used within a UnitProvider');
  }
  return context;
};
