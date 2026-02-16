
import React, { createContext, useContext, useState } from 'react';
import { ClinicalUnit } from '../types';

interface UnitContextType {
  activeUnit: ClinicalUnit;
  setActiveUnit: (unit: ClinicalUnit) => void;
}

const UnitContext = createContext<UnitContextType | undefined>(undefined);

export const UnitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeUnit, setActiveUnit] = useState<ClinicalUnit>(() => {
    return (localStorage.getItem('hdu_active_unit') as ClinicalUnit) || 'HDU';
  });

  const handleSetUnit = (unit: ClinicalUnit) => {
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
