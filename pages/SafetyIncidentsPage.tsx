import React, { useState, useMemo, useEffect, useRef } from 'react';
// @ts-ignore
import { collection, onSnapshot, setDoc, doc, deleteDoc, query, where, updateDoc } from 'firebase/firestore';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { db } from '../services/firebaseConfig';
import { IncidentRecord, ClinicalUnit } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useUnit } from '../contexts/UnitContext';
import { UNIT_DETAILS, INCIDENT_CATEGORIES, CLINICAL_UNITS } from '../constants';
import { exportIncidentsPDF } from '../services/pdfService';
import { downloadCSV } from '../services/exportService';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import ExportModal from '../components/ExportModal';

const InputWrapper = ({ label, field, children, error }: { label: string, field: string, children?: React.ReactNode, error?: string }) => (
  <div className="space-y-1">
    <label htmlFor={`incident-field-${field}`} className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1">{label}</label>
    {children}
    {error && <p className="text-[9px] font-bold text-red-500 ml-1 mt-0.5 uppercase tracking-tighter italic">! {error}</p>}
  </div>
);

interface IncidentFormProps {
  editingIncident: IncidentRecord | null;
  autoSerialNo: string;
  onSave: (incidentData: IncidentRecord) => Promise<void>;
  isSaving: boolean;
  activeUnit: ClinicalUnit;
  currentUser: any;
}

const IncidentForm = React.memo(({ editingIncident, autoSerialNo, onSave, isSaving, activeUnit, currentUser }: IncidentFormProps) => {
  const [formName, setFormName] = useState(editingIncident?.patientName || '');
  const [formRegNo, setFormRegNo] = useState(editingIncident?.regNo || '');
  const [formDate, setFormDate] = useState(editingIncident?.incidentDate || new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState(editingIncident?.category || '');
  const [formUnit, setFormUnit] = useState<ClinicalUnit>(editingIncident?.unit || activeUnit);
  const [formDescription, setFormDescription] = useState(editingIncident?.description || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formName.trim()) newErrors.name = "Patient identity is mandatory";
    if (!formRegNo.trim()) newErrors.regNo = "Registration number required";
    if (!formDate) newErrors.date = "Incident date must be specified";
    if (!formCategory) newErrors.category = "Please select an incident category";
    return newErrors;
  };

  useEffect(() => {
    const newErrors = validate();
    setErrors(prev => {
      const filteredErrors: Record<string, string> = {};
      Object.keys(newErrors).forEach(key => {
        if (touched[key]) filteredErrors[key] = newErrors[key];
      });
      return filteredErrors;
    });
  }, [formName, formRegNo, formDate, formCategory, touched]);

  const isFormValid = useMemo(() => {
    const e = validate();
    return Object.keys(e).length === 0;
  }, [formName, formRegNo, formDate, formCategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched({
        name: true,
        regNo: true,
        date: true,
        category: true
      });
      return;
    }

    if (isSaving) return;

    onSave({
      id: editingIncident?.id || '',
      serialNo: editingIncident?.serialNo || autoSerialNo,
      patientName: formName.trim().toUpperCase(),
      regNo: formRegNo.trim().toUpperCase(),
      incidentDate: formDate,
      unit: formUnit,
      category: formCategory,
      description: formDescription,
      reportedBy: currentUser?.displayName || 'Unknown',
      createdAt: editingIncident?.createdAt || new Date().toISOString()
    });
  };

  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ],
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputWrapper label="Serial No (Internal)" field="serial">
          <input 
            id="incident-field-serial"
            value={editingIncident ? editingIncident.serialNo : autoSerialNo} 
            readOnly 
            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-400 cursor-not-allowed" 
          />
        </InputWrapper>
        <InputWrapper label="Reg No *" field="regNo" error={errors.regNo}>
          <input 
            id="incident-field-regNo"
            value={formRegNo} 
            onChange={(e) => setFormRegNo(e.target.value.toUpperCase())} 
            onBlur={() => setTouched(prev => ({ ...prev, regNo: true }))}
            className={`w-full px-4 py-3 border rounded-xl text-[11px] font-bold uppercase outline-none transition-all ${errors.regNo ? 'border-red-500 bg-red-50/30 ring-1 ring-red-200' : 'border-slate-200 focus:ring-2 focus:ring-red-100'}`} 
            placeholder="E-XXXX" 
            required 
          />
        </InputWrapper>
      </div>
      <InputWrapper label="Patient Full Name *" field="name" error={errors.name}>
        <input 
          id="incident-field-name"
          value={formName} 
          onChange={(e) => setFormName(e.target.value.toUpperCase())} 
          onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
          className={`w-full px-4 py-3 border rounded-xl text-[11px] font-bold uppercase outline-none transition-all ${errors.name ? 'border-red-500 bg-red-50/30 ring-1 ring-red-200' : 'border-slate-200 focus:ring-2 focus:ring-red-100'}`} 
          placeholder="LEGAL IDENTITY" 
          required 
        />
      </InputWrapper>
      <div className="grid grid-cols-2 gap-4">
        <InputWrapper label="Incident Date *" field="date" error={errors.date}>
          <input 
            id="incident-field-date"
            type="date" 
            value={formDate} 
            onChange={(e) => setFormDate(e.target.value)} 
            onBlur={() => setTouched(prev => ({ ...prev, date: true }))}
            className={`w-full px-4 py-3 border rounded-xl text-[11px] font-bold outline-none transition-all ${errors.date ? 'border-red-500 bg-red-50/30 ring-1 ring-red-200' : 'border-slate-200 bg-white focus:ring-2 focus:ring-red-100'}`} 
            required 
          />
        </InputWrapper>
        <InputWrapper label="Unit/Location *" field="unit">
          <select 
            id="incident-field-unit"
            value={formUnit} 
            onChange={(e) => setFormUnit(e.target.value as ClinicalUnit)} 
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-red-100 transition-all bg-white cursor-pointer" 
            required
          >
            {CLINICAL_UNITS.map(u => <option key={u} value={u}>{UNIT_DETAILS[u].label}</option>)}
          </select>
        </InputWrapper>
      </div>
      <InputWrapper label="Incident Category *" field="category" error={errors.category}>
        <select 
          id="incident-field-category"
          value={formCategory} 
          onChange={(e) => setFormCategory(e.target.value)} 
          onBlur={() => setTouched(prev => ({ ...prev, category: true }))}
          className={`w-full px-4 py-3 border rounded-xl text-[11px] font-bold outline-none transition-all bg-white cursor-pointer ${errors.category ? 'border-red-500 ring-1 ring-red-200' : 'border-slate-200 focus:ring-2 focus:ring-red-100'}`} 
          required
        >
          <option value="">Select Category</option>
          {INCIDENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </InputWrapper>

      <InputWrapper label="Detailed Description" field="description">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden min-h-[150px]">
          <ReactQuill 
            theme="snow"
            value={formDescription}
            onChange={setFormDescription}
            modules={quillModules}
            placeholder="Describe the incident in detail..."
            className="h-full"
          />
        </div>
      </InputWrapper>

      <button 
        type="submit" 
        disabled={!isFormValid || isSaving} 
        className={`w-full py-4 rounded-xl font-black text-[10px] text-white uppercase tracking-widest transition-all shadow-xl ${isFormValid && !isSaving ? 'bg-red-600 hover:bg-red-700 active:scale-95 shadow-red-100' : 'bg-slate-300 cursor-not-allowed shadow-none'}`}
      >
        {isSaving ? "Synchronizing..." : editingIncident ? "Update Incident Record" : "Commit Incident Report"}
      </button>
    </form>
  );
});

IncidentForm.displayName = 'IncidentForm';

const SafetyIncidentsPage: React.FC = () => {
  const { activeUnit } = useUnit();
  const { currentUser, isAdmin, canManageRecords } = useAuth();
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [editingIncident, setEditingIncident] = useState<IncidentRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  const [sortConfig, setSortConfig] = useState<{ key: keyof IncidentRecord; direction: 'asc' | 'desc' }>({ 
    key: 'incidentDate', 
    direction: 'desc' 
  });

  const prevIdsRef = useRef<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleNewRecord = () => {
      if (canManageRecords) {
        setEditingIncident(null);
        setIsModalOpen(true);
      }
    };
    const handleFocusSearch = () => {
      searchInputRef.current?.focus();
    };
    const handleExport = () => {
      setIsExportModalOpen(true);
    };

    window.addEventListener('app:new-record', handleNewRecord);
    window.addEventListener('app:focus-search', handleFocusSearch);
    window.addEventListener('app:export', handleExport);

    return () => {
      window.removeEventListener('app:new-record', handleNewRecord);
      window.removeEventListener('app:focus-search', handleFocusSearch);
      window.removeEventListener('app:export', handleExport);
    };
  }, [canManageRecords]);

  useEffect(() => {
    setLoading(true);
    let q = query(collection(db, 'safety_incidents'), where('unit', '==', activeUnit));
    
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as IncidentRecord[];
      
      const currentIds = new Set(data.map(i => i.id));
      if (prevIdsRef.current.size > 0) {
        const newlyCreated = data.find(i => !prevIdsRef.current.has(i.id));
        if (newlyCreated) {
          setNewlyAddedId(newlyCreated.id);
          setTimeout(() => setNewlyAddedId(null), 3000);
        }
      }
      prevIdsRef.current = currentIds;
      setIncidents(data);
      setLoading(false);
    }, (error) => {
      console.error("Safety Incidents Error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeUnit]);

  const autoSerialNo = useMemo(() => {
    if (incidents.length === 0) return '001';
    const nums = incidents.map(i => parseInt(i.serialNo || '0')).filter(n => !isNaN(n));
    if (nums.length === 0) return '001';
    const max = Math.max(...nums);
    return (max + 1).toString().padStart(3, '0');
  }, [incidents]);

  const handleSort = (key: keyof IncidentRecord) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleApplyDateFilter = () => {
    if (!startDateInput || !endDateInput) {
      alert('Please select both FROM and TO dates to filter the records.');
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
    const filtered = incidents.filter(i => {
      const matchesSearch = 
        i.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        i.regNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const incidentDate = new Date(i.incidentDate);
      incidentDate.setHours(0, 0, 0, 0);
      
      let matchesStartDate = true;
      if (appliedStartDate) {
        const start = new Date(appliedStartDate);
        start.setHours(0, 0, 0, 0);
        matchesStartDate = incidentDate >= start;
      }
      
      let matchesEndDate = true;
      if (appliedEndDate) {
        const end = new Date(appliedEndDate);
        end.setHours(0, 0, 0, 0);
        matchesEndDate = incidentDate <= end;
      }

      return matchesSearch && matchesStartDate && matchesEndDate;
    });

    return [...filtered].sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];

      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      if (sortConfig.key === 'serialNo') {
        aValue = parseInt(aValue.toString(), 10) || 0;
        bValue = parseInt(bValue.toString(), 10) || 0;
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [incidents, searchTerm, appliedStartDate, appliedEndDate, sortConfig]);

  const handleSave = async (incidentData: IncidentRecord) => {
    setIsSaving(true);
    try {
      // If incidentData.id exists, we are updating. Otherwise, we generate a new ID.
      const incidentId = incidentData.id || doc(collection(db, 'safety_incidents')).id;
      const incidentRef = doc(db, 'safety_incidents', incidentId);
      
      const finalData = {
        ...incidentData,
        id: incidentId
      };

      // setDoc will create the document if it doesn't exist, or overwrite it if it does.
      await setDoc(incidentRef, finalData);
      
      setIsModalOpen(false);
      setEditingIncident(null);
    } catch (err) {
      console.error("Error saving incident:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (idToDelete) {
      try {
        await deleteDoc(doc(db, 'safety_incidents', idToDelete));
        setIdToDelete(null);
        setIsConfirmOpen(false);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleExportAction = (opts: any) => {
    const reportTitle = `Clinical Incident Report - ${activeUnit}`;
    const headers = ['S.No', 'Date', 'Patient Name', 'Reg No', 'Category', 'Unit', 'Reported By', 'Description'];
    const rows = sortedAndFiltered.map(i => [
      i.serialNo,
      i.incidentDate,
      i.patientName,
      i.regNo,
      i.category,
      UNIT_DETAILS[i.unit].label,
      i.reportedBy,
      i.description ? i.description.replace(/<[^>]*>/g, '') : 'N/A'
    ]);

    if (opts.format === 'CSV') {
      downloadCSV(reportTitle, headers, rows);
    } else {
      exportIncidentsPDF(sortedAndFiltered, { 
        generatedBy: opts.generatedBy, 
        filters: `Unit: ${activeUnit}, Period: ${appliedStartDate || 'Any'} to ${appliedEndDate || 'Any'}` 
      });
    }
  };

  const SortIndicator = ({ column }: { column: keyof IncidentRecord }) => {
    const isActive = sortConfig.key === column;
    if (!isActive) return (
      <div className="w-3 h-3 ml-1.5 opacity-10 group-hover:opacity-40 transition-opacity">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
      </div>
    );
    return (
      <div className="w-3 h-3 ml-1.5 text-red-500 animate-in fade-in zoom-in duration-300">
        {sortConfig.direction === 'asc' ? (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 15l7-7 7 7" /></svg>
        ) : (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M19 9l-7 7-7-7" /></svg>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 relative">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 gap-2">
            <div className="relative flex-1 max-w-lg">
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder={`Search Patient Name, MR#, Category...`}
                className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl w-full text-[11px] font-bold outline-none focus:ring-2 focus:ring-red-100 shadow-sm transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {canManageRecords && (
              <button 
                onClick={() => { setEditingIncident(null); setIsModalOpen(true); }}
                className="bg-red-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg active:scale-95 flex items-center gap-2 shadow-red-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                + ADD INCIDENT
              </button>
            )}
          </div>
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-sm active:scale-95"
          >
            EXPORT RECORDS
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
            FETCH DATA
          </button>
          <button 
            onClick={resetFilters}
            className="ml-auto text-[9px] font-black text-red-600 uppercase tracking-widest hover:text-red-700 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
            RESET
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[600px] whitespace-nowrap scroll-smooth">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-slate-100 border-t-red-600 rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synchronizing Safety Database...</p>
            </div>
          ) : (
            <table className="w-full text-left min-w-[1200px] border-separate border-spacing-0">
              <thead className="bg-slate-900 text-white sticky top-0 z-10 shadow-md">
                <tr className="text-[10px] font-black uppercase tracking-widest select-none">
                  <th 
                    className={`px-4 py-4 w-16 text-center cursor-pointer transition-all duration-200 group ${sortConfig.key === 'serialNo' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('serialNo')}
                  >
                    <div className="flex items-center justify-center">S.NO <SortIndicator column="serialNo" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-32 cursor-pointer transition-all duration-200 group ${sortConfig.key === 'incidentDate' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('incidentDate')}
                  >
                    <div className="flex items-center">DATE <SortIndicator column="incidentDate" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 cursor-pointer transition-all duration-200 group ${sortConfig.key === 'patientName' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('patientName')}
                  >
                    <div className="flex items-center">PATIENT IDENTITY <SortIndicator column="patientName" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-40 cursor-pointer transition-all duration-200 group ${sortConfig.key === 'category' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center">CATEGORY <SortIndicator column="category" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-40 cursor-pointer transition-all duration-200 group ${sortConfig.key === 'unit' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('unit')}
                  >
                    <div className="flex items-center">LOCATION <SortIndicator column="unit" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-40 cursor-pointer transition-all duration-200 group ${sortConfig.key === 'reportedBy' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('reportedBy')}
                  >
                    <div className="flex items-center">REPORTED BY <SortIndicator column="reportedBy" /></div>
                  </th>
                  <th className="px-4 py-4 w-28 text-right bg-slate-900">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                {sortedAndFiltered.map((i) => (
                  <tr 
                    key={i.id} 
                    className={`transition-all group cursor-pointer ${
                      newlyAddedId === i.id 
                        ? 'bg-red-50/70 border-l-4 border-l-red-500 animate-in fade-in duration-1000' 
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => { setEditingIncident(i); setIsModalOpen(true); }}
                  >
                    <td className="px-4 py-4 text-center text-slate-400">{i.serialNo}</td>
                    <td className="px-4 py-4 font-mono text-slate-500">{i.incidentDate}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-slate-900 text-xs font-black tracking-tight">{i.patientName}</span>
                        <span className="text-[9px] text-slate-400 font-bold font-mono">{i.regNo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 rounded-full border text-[8px] font-black tracking-widest uppercase ${
                        i.category === 'Medication Error' ? 'bg-red-50 text-red-700 border-red-100' : 
                        i.category === 'Patient Fall' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                        'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {i.category}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black text-white shadow-sm ${UNIT_DETAILS[i.unit].color}`}>
                        {UNIT_DETAILS[i.unit].label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500 border border-slate-200">
                          {i.reportedBy?.[0]}
                        </div>
                        <span className="text-slate-400 italic lowercase">{i.reportedBy}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {canManageRecords && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setEditingIncident(i); setIsModalOpen(true); }} 
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all active:scale-95 border border-blue-100"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            <span className="text-[9px] font-black uppercase tracking-tighter">Edit</span>
                          </button>
                        )}
                        {isAdmin && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setIdToDelete(i.id); setIsConfirmOpen(true); }} 
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all active:scale-95"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedAndFiltered.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-24 text-center text-slate-400 italic font-medium uppercase tracking-[0.2em]">No safety incidents recorded for this criteria.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { if(!isSaving) { setIsModalOpen(false); setEditingIncident(null); } }} 
        title={editingIncident ? `Modify Incident Record` : `Report Clinical Incident`}
        maxWidth="max-w-2xl"
      >
        <IncidentForm 
          key={editingIncident?.id || 'new-incident'}
          editingIncident={editingIncident}
          autoSerialNo={autoSerialNo}
          onSave={handleSave}
          isSaving={isSaving}
          activeUnit={activeUnit}
          currentUser={currentUser}
        />
      </Modal>

      <ConfirmModal 
        isOpen={isConfirmOpen} 
        onClose={() => setIsConfirmOpen(false)} 
        onConfirm={handleDelete} 
        title="Purge Safety Record" 
        message="Permanently remove this incident report from the clinical safety database? This action will be logged in the permanent audit trail." 
        confirmLabel="Confirm Purge"
        variant="danger"
      />

      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        onExport={handleExportAction} 
        title="Safety Database Export" 
      />
    </div>
  );
};

export default SafetyIncidentsPage;
