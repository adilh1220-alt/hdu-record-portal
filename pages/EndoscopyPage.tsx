import React, { useState, useMemo, useEffect, useRef } from 'react';
// @ts-ignore
import { collection, onSnapshot, setDoc, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { EndoscopyRecord } from '../types';
import { exportEndoscopyPDF } from '../services/pdfService';
import { useAuth } from '../contexts/AuthContext';
import { useUnit } from '../contexts/UnitContext';
import { ENDOSCOPY_DOCTORS, ENDOSCOPY_PROCEDURES, UNIT_DETAILS } from '../constants';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import ExportModal from '../components/ExportModal';

type SortKey = keyof EndoscopyRecord;
type SortDirection = 'asc' | 'desc';

const EndoscopyPage: React.FC = () => {
  const { activeUnit } = useUnit();
  const { isAdmin, canManageRecords } = useAuth();
  const [records, setRecords] = useState<EndoscopyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Input states (unapplied)
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  
  // Applied states (the actual filters)
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<EndoscopyRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
    key: 'serialNo', 
    direction: 'desc' 
  });

  const prevIdsRef = useRef<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleNewRecord = () => {
      if (canManageRecords) {
        setEditingRecord(null);
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

  // Form states
  const [formName, setFormName] = useState('');
  const [formRegNo, setFormRegNo] = useState('');
  const [formDoctor, setFormDoctor] = useState('');
  const [formProcedure, setFormProcedure] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [procedureSearch, setProcedureSearch] = useState('');
  const [isProcedureListOpen, setIsProcedureListOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'endoscopy_records'),
      where('referringUnit', '==', activeUnit)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as EndoscopyRecord[];
      
      const currentIds = new Set(data.map(r => r.id));
      if (prevIdsRef.current.size > 0) {
        const newlyCreated = data.find(r => !prevIdsRef.current.has(r.id));
        if (newlyCreated) {
          setNewlyAddedId(newlyCreated.id);
          setTimeout(() => setNewlyAddedId(null), 3000);
        }
      }
      prevIdsRef.current = currentIds;
      setRecords(data);
      setLoading(false);
    }, (error) => {
      console.error("Endoscopy Log Error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const autoSerialNo = useMemo(() => {
    const unitRecords = records.filter(r => r.referringUnit === activeUnit);
    if (unitRecords.length === 0) return '001';
    const nums = unitRecords.map(r => parseInt(r.serialNo || '0')).filter(n => !isNaN(n));
    if (nums.length === 0) return '001';
    const max = Math.max(...nums);
    return (max + 1).toString().padStart(3, '0');
  }, [records, activeUnit]);

  useEffect(() => {
    if (editingRecord) {
      setFormName(editingRecord.name);
      setFormRegNo(editingRecord.regNo);
      setFormDoctor(editingRecord.doctor);
      setFormProcedure(editingRecord.procedure);
      setProcedureSearch(editingRecord.procedure);
      setFormDate(editingRecord.date);
    } else {
      setFormName('');
      setFormRegNo('');
      setFormDoctor('');
      setFormProcedure('');
      setProcedureSearch('');
      setFormDate(new Date().toISOString().split('T')[0]);
    }
  }, [editingRecord, isModalOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProcedureListOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isDateInFuture = useMemo(() => {
    if (!formDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(formDate);
    return selectedDate > today;
  }, [formDate]);

  const isFormValid = useMemo(() => {
    return formName.trim() && formRegNo.trim() && formDoctor && formProcedure && formDate && !isDateInFuture;
  }, [formName, formRegNo, formDoctor, formProcedure, formDate, isDateInFuture]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleApplyDateFilter = () => {
    if (startDateInput && endDateInput) {
      const start = new Date(startDateInput);
      const end = new Date(endDateInput);
      if (end < start) {
        setAppliedStartDate(endDateInput);
        setAppliedEndDate(startDateInput);
        return;
      }
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
    const filtered = records.filter(r => {
      const matchesSearch = 
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.regNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.doctor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.procedure.toLowerCase().includes(searchTerm.toLowerCase());
      
      const recordDate = r.date; 
      const isAfterStart = !appliedStartDate || recordDate >= appliedStartDate;
      const isBeforeEnd = !appliedEndDate || recordDate <= appliedEndDate;

      return matchesSearch && isAfterStart && isBeforeEnd;
    });

    return [...filtered].sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];

      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      if (sortConfig.key === 'serialNo') {
        const valA = parseInt(aValue.toString(), 10) || 0;
        const valB = parseInt(bValue.toString(), 10) || 0;
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [records, activeUnit, searchTerm, appliedStartDate, appliedEndDate, sortConfig]);

  const procedureSuggestions = useMemo(() => {
    return ENDOSCOPY_PROCEDURES.filter(p => 
      p.toLowerCase().includes(procedureSearch.toLowerCase())
    );
  }, [procedureSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSaving) return;
    setIsSaving(true);
    try {
      const recordRef = editingRecord ? doc(db, 'endoscopy_records', editingRecord.id) : doc(collection(db, 'endoscopy_records'));
      const recordData: EndoscopyRecord = {
        id: recordRef.id,
        referringUnit: activeUnit,
        serialNo: editingRecord ? editingRecord.serialNo : autoSerialNo,
        regNo: formRegNo.trim().toUpperCase(),
        name: formName.trim().toUpperCase(),
        doctor: formDoctor,
        procedure: formProcedure,
        date: formDate
      };
      await setDoc(recordRef, recordData);
      setIsModalOpen(false);
      setEditingRecord(null);
    } catch (err) {
      console.error("Firebase Sync Error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (idToDelete) {
      try {
        await deleteDoc(doc(db, 'endoscopy_records', idToDelete));
        setIdToDelete(null);
      } catch (err) {
        console.error("Failed to delete record:", err);
      }
    }
  };

  const SortIndicator = ({ column }: { column: SortKey }) => {
    const isActive = sortConfig.key === column;
    return (
      <div className={`ml-2 flex flex-col items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-20 group-hover:opacity-50'}`}>
        <svg 
          className={`w-2 h-2 transition-transform ${isActive && sortConfig.direction === 'asc' ? 'text-red-500 scale-125' : 'text-slate-400'}`} 
          fill="currentColor" viewBox="0 0 24 24"
        >
          <path d="M7 14l5-5 5 5H7z" />
        </svg>
        <svg 
          className={`w-2 h-2 transition-transform ${isActive && sortConfig.direction === 'desc' ? 'text-red-500 scale-125' : 'text-slate-400'}`} 
          fill="currentColor" viewBox="0 0 24 24"
        >
          <path d="M7 10l5 5 5-5H7z" />
        </svg>
      </div>
    );
  };

  const isFilterActive = !!(appliedStartDate || appliedEndDate);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{activeUnit} Endoscopy Log</h1>
        <p className="text-slate-500 text-sm font-medium">Procedure monitoring and clinical logging for <span className="text-slate-900 font-bold">{UNIT_DETAILS[activeUnit].label}</span></p>
      </header>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 gap-2">
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder={`Search ${activeUnit} logs...`}
              className="px-4 py-2 border border-slate-200 rounded-lg w-full max-w-md text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {canManageRecords && (
              <button 
                onClick={() => { setEditingRecord(null); setIsModalOpen(true); }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg active:scale-95"
              >
                Log Procedure
              </button>
            )}
          </div>
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-sm active:scale-95"
          >
            Export Logs
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
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-md active:scale-95 flex items-center gap-2"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            Fetch Data
          </button>
          {isFilterActive && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100 animate-pulse">
               <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
               <span className="text-[8px] font-black uppercase tracking-widest">Active Filters</span>
            </div>
          )}
          <button 
            onClick={resetFilters}
            className="ml-auto text-[9px] font-black text-red-600 uppercase tracking-widest hover:text-red-700 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
            Reset
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto whitespace-nowrap max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-slate-100 border-t-red-600 rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Querying Procedures...</p>
            </div>
          ) : (
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="bg-slate-900 text-white sticky top-0 z-10 shadow-md">
                <tr className="text-[10px] font-black uppercase tracking-widest select-none">
                  <th className="px-6 py-5 cursor-pointer hover:bg-slate-800 transition-colors group" onClick={() => handleSort('serialNo')}>
                    <div className="flex items-center">S.No <SortIndicator column="serialNo" /></div>
                  </th>
                  <th className="px-6 py-5 cursor-pointer hover:bg-slate-800 transition-colors group" onClick={() => handleSort('regNo')}>
                    <div className="flex items-center">Reg No <SortIndicator column="regNo" /></div>
                  </th>
                  <th className="px-6 py-5 cursor-pointer hover:bg-slate-800 transition-colors group" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Patient Name <SortIndicator column="name" /></div>
                  </th>
                  <th className="px-6 py-5 cursor-pointer hover:bg-slate-800 transition-colors group" onClick={() => handleSort('doctor')}>
                    <div className="flex items-center">Physician <SortIndicator column="doctor" /></div>
                  </th>
                  <th className="px-6 py-5 cursor-pointer hover:bg-slate-800 transition-colors group" onClick={() => handleSort('procedure')}>
                    <div className="flex items-center">Procedure <SortIndicator column="procedure" /></div>
                  </th>
                  <th className="px-6 py-5 cursor-pointer hover:bg-slate-800 transition-colors group" onClick={() => handleSort('date')}>
                    <div className="flex items-center">Date <SortIndicator column="date" /></div>
                  </th>
                  <th className="px-6 py-5 text-right bg-slate-900">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[10px] font-bold text-slate-700 uppercase">
                {sortedAndFiltered.map((record) => (
                  <tr 
                    key={record.id} 
                    className={`transition-all group cursor-pointer ${
                      newlyAddedId === record.id 
                        ? 'bg-blue-50/70 border-l-4 border-l-blue-500' 
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => { setEditingRecord(record); setIsModalOpen(true); }}
                  >
                    <td className="px-6 py-4 text-slate-400">{record.serialNo}</td>
                    <td className="px-6 py-4 font-mono text-slate-900">{record.regNo}</td>
                    <td className="px-6 py-4 text-slate-900">{record.name}</td>
                    <td className="px-6 py-4">{record.doctor}</td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[8px] border border-slate-200 font-black">
                        {record.procedure}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono">{record.date}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                        {canManageRecords && (
                          <button onClick={(e) => { e.stopPropagation(); setEditingRecord(record); setIsModalOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={(e) => { e.stopPropagation(); setIdToDelete(record.id); setIsConfirmOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedAndFiltered.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic font-medium uppercase tracking-widest">NO ENDOSCOPY RECORDS FOUND FOR THIS CRITERIA</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { if(!isSaving) { setIsModalOpen(false); setEditingRecord(null); } }} 
        title={editingRecord ? `Modify Procedure Entry` : `Log Endoscopy Procedure`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Serial No</label>
              <input value={editingRecord ? editingRecord.serialNo : autoSerialNo} readOnly className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-400 cursor-not-allowed" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">MR Number *</label>
              <input required value={formRegNo} onChange={(e) => setFormRegNo(e.target.value.toUpperCase())} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200" placeholder="e.g. 12345" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Patient Identity *</label>
            <input required value={formName} onChange={(e) => setFormName(e.target.value.toUpperCase())} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200" placeholder="LEGAL NAME" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Operating Physician *</label>
            <select required value={formDoctor} onChange={(e) => setFormDoctor(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200">
              <option value="">Select Doctor</option>
              {ENDOSCOPY_DOCTORS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="relative" ref={dropdownRef}>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Procedure Type *</label>
              <input 
                required 
                value={procedureSearch} 
                onFocus={() => setIsProcedureListOpen(true)}
                onChange={(e) => {
                  setProcedureSearch(e.target.value);
                  setFormProcedure(e.target.value);
                }} 
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200" 
                placeholder="Search Procedure..."
              />
            </div>
            {isProcedureListOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-40 overflow-y-auto">
                {procedureSuggestions.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setFormProcedure(p);
                      setProcedureSearch(p);
                      setIsProcedureListOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-[10px] font-bold hover:bg-slate-50 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Procedure Date *</label>
            <input 
              required 
              type="date" 
              value={formDate} 
              onChange={(e) => setFormDate(e.target.value)} 
              className={`w-full px-3 py-2 border rounded-lg text-[10px] font-bold outline-none focus:ring-1 ${isDateInFuture ? 'border-red-500 focus:ring-red-200' : 'border-slate-200 focus:ring-red-200'}`} 
            />
            {isDateInFuture && (
              <p className="text-[8px] font-bold text-red-500 uppercase tracking-tighter mt-0.5 ml-1">Date cannot be in the future</p>
            )}
          </div>
          <button type="submit" disabled={!isFormValid || isSaving} className={`w-full py-3 rounded-xl font-black text-[10px] text-white uppercase tracking-widest transition-all ${isFormValid && !isSaving ? 'bg-red-600 shadow-lg hover:bg-red-700 active:scale-95' : 'bg-slate-300 cursor-not-allowed'}`}>
            {isSaving ? "Synchronizing..." : editingRecord ? "Update Log Entry" : "Commit Procedure"}
          </button>
        </form>
      </Modal>

      <ConfirmModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={handleDelete} title="Purge Record" message="Permanently delete this procedure log entry?" />
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onExport={(opts) => exportEndoscopyPDF(sortedAndFiltered, { generatedBy: opts.generatedBy, filters: `Unit: ${activeUnit}` })} title="Endoscopy Audit Export" />
    </div>
  );
};

export default EndoscopyPage;