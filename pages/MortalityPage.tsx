import React, { useState, useMemo, useEffect, useRef } from 'react';
// @ts-ignore
import { collection, onSnapshot, setDoc, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { Patient, PatientStatus, PatientCategory, CodeStatus, ClinicalUnit } from '../types';
import { exportPatientsPDF } from '../services/pdfService';
import { downloadCSV } from '../services/exportService';
import { useAuth } from '../contexts/AuthContext';
import { useUnit } from '../contexts/UnitContext';
import { CONSULTANTS, CATEGORIES, LOCATIONS, CODE_STATUSES, UNIT_DETAILS } from '../constants';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import ExportModal from '../components/ExportModal';

const InputWrapper = ({ label, field, children }: { label: string, field: string, children?: React.ReactNode }) => (
  <div className="space-y-1">
    <label htmlFor={`mortality-field-${field}`} className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{label}</label>
    {children}
  </div>
);

interface MortalityFormProps {
  editingPatient: Patient | null;
  autoSerialNo: string;
  onSave: (patientData: Patient) => Promise<void>;
  isSaving: boolean;
  activeUnit: ClinicalUnit;
}

const MortalityForm = React.memo(({ editingPatient, autoSerialNo, onSave, isSaving, activeUnit }: MortalityFormProps) => {
  const [formName, setFormName] = useState(editingPatient?.name || '');
  const [formRegNo, setFormRegNo] = useState(editingPatient?.regNo || '');
  const [formGender, setFormGender] = useState(editingPatient?.gender || '');
  const [formCategory, setFormCategory] = useState(editingPatient?.category || '');
  const [formLocation, setFormLocation] = useState(editingPatient?.location || '');
  const [formCodeStatus, setFormCodeStatus] = useState(editingPatient?.codeStatus || '');
  const [formConsultant, setFormConsultant] = useState(editingPatient?.consultant || '');
  const [formInDate, setFormInDate] = useState(editingPatient?.admissionDate || new Date().toISOString().split('T')[0]);
  const [formExpiryDate, setFormExpiryDate] = useState(editingPatient?.dischargeDate || new Date().toISOString().split('T')[0]);

  const los = useMemo(() => {
    if (!formInDate || !formExpiryDate) return 0;
    const start = new Date(formInDate);
    const end = new Date(formExpiryDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diff = end.getTime() - start.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }, [formInDate, formExpiryDate]);

  const isFormValid = useMemo(() => {
    return formName.trim() && formRegNo.trim() && formGender && formCategory && formLocation && formCodeStatus && formConsultant && formInDate && formExpiryDate;
  }, [formName, formRegNo, formGender, formCategory, formLocation, formCodeStatus, formConsultant, formInDate, formExpiryDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSaving) return;

    onSave({
      id: editingPatient?.id || '',
      unit: activeUnit,
      serialNo: editingPatient?.serialNo || autoSerialNo,
      regNo: formRegNo.trim().toUpperCase(),
      name: formName.trim().toUpperCase(),
      gender: formGender,
      admissionDate: formInDate,
      dischargeDate: formExpiryDate,
      category: formCategory as PatientCategory,
      location: formLocation,
      codeStatus: formCodeStatus as CodeStatus,
      consultant: formConsultant,
      status: PatientStatus.DECEASED,
      lengthOfStay: los
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputWrapper label="Serial No (Internal)" field="serial">
          <input 
            id="mortality-field-serial"
            value={editingPatient ? editingPatient.serialNo : autoSerialNo} 
            readOnly 
            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-400 cursor-not-allowed" 
          />
        </InputWrapper>
        <InputWrapper label="Reg No *" field="regNo">
          <input 
            id="mortality-field-regNo"
            value={formRegNo} 
            onChange={(e) => setFormRegNo(e.target.value.toUpperCase())} 
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-red-200" 
            placeholder="E-XXXX" 
            required 
          />
        </InputWrapper>
      </div>
      <InputWrapper label="Patient Full Name *" field="name">
        <input 
          id="mortality-field-name"
          value={formName} 
          onChange={(e) => setFormName(e.target.value.toUpperCase())} 
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-red-200" 
          placeholder="LEGAL IDENTITY" 
          required 
        />
      </InputWrapper>
      <div className="grid grid-cols-2 gap-4">
        <InputWrapper label="Gender *" field="gender">
          <select 
            id="mortality-field-gender"
            value={formGender} 
            onChange={(e) => setFormGender(e.target.value)} 
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200" 
            required
          >
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </InputWrapper>
        <InputWrapper label="Category *" field="category">
          <select 
            id="mortality-field-category"
            value={formCategory} 
            onChange={(e) => setFormCategory(e.target.value)} 
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200" 
            required
          >
            <option value="">Select</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </InputWrapper>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InputWrapper label="Location *" field="location">
          <select 
            id="mortality-field-location"
            value={formLocation} 
            onChange={(e) => setFormLocation(e.target.value)} 
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200" 
            required
          >
            <option value="">Select</option>
            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </InputWrapper>
        <InputWrapper label="Code Status *" field="code">
          <select 
            id="mortality-field-code"
            value={formCodeStatus} 
            onChange={(e) => setFormCodeStatus(e.target.value)} 
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200" 
            required
          >
            <option value="">Select</option>
            {CODE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </InputWrapper>
      </div>
      <InputWrapper label="Consultant *" field="consultant">
        <select 
          id="mortality-field-consultant"
          value={formConsultant} 
          onChange={(e) => setFormConsultant(e.target.value)} 
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200" 
          required
        >
          <option value="">Select Specialist</option>
          {CONSULTANTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </InputWrapper>
      <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
        <InputWrapper label="Admission Date *" field="in">
          <input 
            id="mortality-field-in"
            type="date" 
            value={formInDate} 
            onChange={(e) => setFormInDate(e.target.value)} 
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none bg-white focus:ring-1 focus:ring-red-200" 
            required 
          />
        </InputWrapper>
        <InputWrapper label="Date of Expiry *" field="out">
          <input 
            id="mortality-field-out"
            type="date" 
            value={formExpiryDate} 
            onChange={(e) => setFormExpiryDate(e.target.value)} 
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none bg-white focus:ring-1 focus:ring-red-200" 
            required 
          />
        </InputWrapper>
      </div>
      <div className="flex justify-between items-center px-4 py-3 bg-slate-900 rounded-xl border border-slate-800 shadow-sm">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Calculated LOS:</span>
        <span className="text-sm font-black text-white">{los} Days</span>
      </div>
      <button 
        type="submit" 
        disabled={!isFormValid || isSaving} 
        className={`w-full py-3 rounded-xl font-black text-[10px] text-white uppercase tracking-widest transition-all ${isFormValid && !isSaving ? 'bg-red-600 shadow-lg hover:bg-red-700 active:scale-95' : 'bg-slate-300 cursor-not-allowed'}`}
      >
        {isSaving ? "Archiving..." : editingPatient ? "Update Archive Entry" : "Finalize Expiry Log"}
      </button>
    </form>
  );
});

MortalityForm.displayName = 'MortalityForm';

type SortKey = keyof Patient;
type SortDirection = 'asc' | 'desc';

const MortalityPage: React.FC = () => {
  const { activeUnit } = useUnit();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Input states (raw user input)
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  
  // Applied states (used for filtering)
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
    key: 'dischargeDate', 
    direction: 'desc' 
  });

  const prevIdsRef = useRef<Set<string>>(new Set());
  const { isAdmin, canManageRecords } = useAuth();

  useEffect(() => {
    setLoading(true);
    const q = collection(db, 'mortality_records');
    
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const patientData = snapshot.docs
        .map((d: any) => ({ id: d.id, ...d.data() }))
        .filter((p: Patient) => p.unit === activeUnit) as Patient[];
      
      const currentIds = new Set(patientData.map(p => p.id));
      if (prevIdsRef.current.size > 0) {
        const newlyCreated = patientData.find(p => !prevIdsRef.current.has(p.id));
        if (newlyCreated) {
          setNewlyAddedId(newlyCreated.id);
          setTimeout(() => setNewlyAddedId(null), 3000);
        }
      }
      prevIdsRef.current = currentIds;
      setPatients(patientData);
      setLoading(false);
    }, (error) => {
      console.error("Mortality Query Error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeUnit]);

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleApplyDateFilter = () => {
    if (!startDateInput || !endDateInput) {
      alert('Please select both FROM and TO dates to filter the archived records.');
      return;
    }

    const start = new Date(startDateInput);
    const end = new Date(endDateInput);

    if (end < start) {
      alert('Invalid Date Range: End date cannot be before start date.');
      return;
    }

    setAppliedStartDate(startDateInput);
    setAppliedEndDate(endDateInput);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStartDateInput('');
    setEndDateInput('');
    setAppliedStartDate('');
    setAppliedEndDate('');
  };

  const sortedAndFiltered = useMemo(() => {
    const filtered = patients.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.regNo.toLowerCase().includes(searchTerm.toLowerCase());
      
      const expiryDateStr = p.dischargeDate || '';
      if (!expiryDateStr && (appliedStartDate || appliedEndDate)) return false;
      
      const expiryDate = new Date(expiryDateStr);
      expiryDate.setHours(0, 0, 0, 0);
      
      let matchesStartDate = true;
      if (appliedStartDate) {
        const start = new Date(appliedStartDate);
        start.setHours(0, 0, 0, 0);
        matchesStartDate = expiryDate >= start;
      }
      
      let matchesEndDate = true;
      if (appliedEndDate) {
        const end = new Date(appliedEndDate);
        end.setHours(0, 0, 0, 0);
        matchesEndDate = expiryDate <= end;
      }

      return matchesSearch && matchesStartDate && matchesEndDate;
    });

    return [...filtered].sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];

      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      if (sortConfig.key === 'serialNo' || sortConfig.key === 'lengthOfStay') {
        const numA = typeof aValue === 'string' ? parseInt(aValue.replace(/\D/g, ''), 10) : aValue;
        const numB = typeof bValue === 'string' ? parseInt(bValue.replace(/\D/g, ''), 10) : bValue;
        aValue = isNaN(numA) ? 0 : numA;
        bValue = isNaN(numB) ? 0 : numB;
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [patients, searchTerm, appliedStartDate, appliedEndDate, sortConfig]);

  const handleExportAction = (opts: any) => {
    const reportTitle = `${activeUnit} Mortality Archive`;
    const headers = ['S.No', 'Reg No', 'Patient Name', 'Gender', 'Category', 'Code', 'Consultant', 'In-Date', 'Out-Date', 'LOS'];
    const rows = sortedAndFiltered.map(p => [
      p.serialNo, 
      p.regNo, 
      p.name, 
      p.gender,
      p.category, 
      p.codeStatus, 
      p.consultant, 
      p.admissionDate,
      p.dischargeDate || 'N/A',
      p.lengthOfStay
    ]);

    if (opts.format === 'CSV') {
      downloadCSV(reportTitle, headers, rows);
    } else {
      exportPatientsPDF(sortedAndFiltered, { 
        generatedBy: opts.generatedBy, 
        filters: `Unit: ${activeUnit}, Archive: Mortality, Period: ${appliedStartDate || 'Any'} to ${appliedEndDate || 'Any'}` 
      });
    }
  };

  const autoSerialNo = useMemo(() => {
    if (patients.length === 0) return 'M-001';
    const nums = patients.map(p => {
        const match = p.serialNo?.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
    }).filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `M-${(max + 1).toString().padStart(3, '0')}`;
  }, [patients]);

  const handleSave = async (patientData: Patient) => {
    setIsSaving(true);
    try {
      const patientRef = patientData.id ? doc(db, 'mortality_records', patientData.id) : doc(collection(db, 'mortality_records'));
      const finalData = { ...patientData, id: patientRef.id };
      await setDoc(patientRef, finalData);
      setIsModalOpen(false);
      setEditingPatient(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const SortIndicator = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <div className="w-3 h-3 ml-1 opacity-20"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg></div>;
    return (
      <div className="w-3 h-3 ml-1 text-red-500 animate-in fade-in zoom-in duration-300">
        {sortConfig.direction === 'asc' ? (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 15l7-7 7 7" /></svg>
        ) : (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M19 9l-7 7-7-7" /></svg>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{activeUnit} Mortality Archive</h1>
        <p className="text-slate-500 text-sm font-medium italic">Secure clinical repository for historical {UNIT_DETAILS[activeUnit].label} records</p>
      </header>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 gap-2">
            <div className="flex-1 flex items-center bg-white border border-slate-200 px-3 py-2 rounded-lg max-w-md focus-within:ring-1 focus-within:ring-red-200 shadow-sm">
              <svg className="w-4 h-4 text-slate-400 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input 
                type="text" 
                placeholder={`Search ${activeUnit} Archive...`}
                className="bg-transparent text-[10px] font-bold outline-none flex-1 uppercase"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {canManageRecords && (
              <button 
                onClick={() => { setEditingPatient(null); setIsModalOpen(true); }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg flex items-center gap-2 shadow-red-100"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                Log Expiry
              </button>
            )}
          </div>
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-sm"
          >
            Export Records
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">From:</label>
            <input 
              type="date" 
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-slate-50"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">To:</label>
            <input 
              type="date" 
              value={endDateInput}
              onChange={(e) => setEndDateInput(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-slate-50"
            />
          </div>
          <button 
            onClick={handleApplyDateFilter}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            Fetch Data
          </button>
          <button 
            onClick={resetFilters}
            className="ml-auto text-[9px] font-black text-red-600 uppercase tracking-widest hover:text-red-700 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
            Reset
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto whitespace-nowrap max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-slate-100 border-t-slate-800 rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accessing {activeUnit} Archive...</p>
            </div>
          ) : (
            <table className="w-full text-left min-w-[1000px] border-separate border-spacing-0">
              <thead className="bg-slate-900 text-white sticky top-0 z-10 shadow-md">
                <tr className="text-[10px] font-black uppercase tracking-widest select-none">
                  <th className="px-6 py-5 w-20 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('serialNo')}>
                    <div className="flex items-center">S.No <SortIndicator column="serialNo" /></div>
                  </th>
                  <th className="px-6 py-5 w-32 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('regNo')}>
                    <div className="flex items-center">Reg No <SortIndicator column="regNo" /></div>
                  </th>
                  <th className="px-6 py-5 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Patient Identity <SortIndicator column="name" /></div>
                  </th>
                  <th className="px-6 py-5 w-40 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('consultant')}>
                    <div className="flex items-center">Consultant <SortIndicator column="consultant" /></div>
                  </th>
                  <th className="px-6 py-5 w-32 text-center cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('dischargeDate')}>
                    <div className="flex items-center justify-center">Expiry Date <SortIndicator column="dischargeDate" /></div>
                  </th>
                  <th className="px-6 py-5 w-20 text-center cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => handleSort('lengthOfStay')}>
                    <div className="flex items-center justify-center">LOS <SortIndicator column="lengthOfStay" /></div>
                  </th>
                  <th className="px-6 py-5 w-24 text-right bg-slate-900">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                {sortedAndFiltered.map((p) => (
                  <tr 
                    key={p.id} 
                    className={`transition-all group cursor-pointer ${
                      newlyAddedId === p.id 
                        ? 'bg-red-50/70 border-l-4 border-l-red-500 animate-in fade-in duration-1000' 
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => { setEditingPatient(p); setIsModalOpen(true); }}
                  >
                    <td className="px-6 py-4 text-slate-400">{p.serialNo}</td>
                    <td className="px-6 py-4 font-mono text-slate-900">{p.regNo}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-[10px] shrink-0 ${
                            newlyAddedId === p.id ? 'bg-red-600 border-red-600 text-white' : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}>
                            {p.name?.[0] || '?'}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-red-600 border-2 border-white rounded-full shadow-sm" title="Deceased Status"></span>
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 text-xs font-bold uppercase">{p.name}</span>
                            <span className="inline-block bg-red-50 text-red-700 text-[7px] font-black px-1.5 py-0.5 rounded border border-red-100 tracking-tighter uppercase shrink-0">Expired</span>
                          </div>
                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">{p.gender} | {p.category} | {p.location || 'N/A'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 truncate">{p.consultant}</td>
                    <td className="px-6 py-4 text-center text-slate-500 font-mono">{p.dischargeDate}</td>
                    <td className="px-6 py-4 text-center text-red-600 bg-red-50/20">{p.lengthOfStay}d</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={(e) => { e.stopPropagation(); setEditingPatient(p); setIsModalOpen(true); }} className="p-2 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-all active:scale-95">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        {isAdmin && (
                            <button onClick={(e) => { e.stopPropagation(); setIdToDelete(p.id); setIsConfirmOpen(true); }} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all active:scale-95">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedAndFiltered.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic font-medium">No archived records match your criteria.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { if(!isSaving) { setIsModalOpen(false); setEditingPatient(null); } }} 
        title={editingPatient ? `Modify Archive Entry` : `Log New Unit Expiry`}
      >
        <MortalityForm 
          key={editingPatient?.id || 'new-expiry'}
          editingPatient={editingPatient}
          autoSerialNo={autoSerialNo}
          onSave={handleSave}
          isSaving={isSaving}
          activeUnit={activeUnit}
        />
      </Modal>

      <ConfirmModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={async () => { if(idToDelete) { await deleteDoc(doc(db, 'mortality_records', idToDelete)); setIdToDelete(null); } }} title="Purge Archive Entry" message="Permanently remove this record from the archive?" />
      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        onExport={handleExportAction} 
        title="Archive Export" 
      />
    </div>
  );
};

export default MortalityPage;