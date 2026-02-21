
import React, { useState, useMemo, useEffect, useRef } from 'react';
// @ts-ignore
import { collection, onSnapshot, setDoc, doc, deleteDoc, query, orderBy, updateDoc, where } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { Patient, PatientStatus, PatientCategory, CodeStatus } from '../types';
import { exportPatientsPDF } from '../services/pdfService';
import { downloadCSV } from '../services/exportService';
import { useAuth } from '../contexts/AuthContext';
import { useUnit } from '../contexts/UnitContext';
import { CONSULTANTS, CATEGORIES, LOCATIONS, CODE_STATUSES } from '../constants';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';
import ExportModal from './ExportModal';

interface FormErrors {
  name?: string;
  regNo?: string;
  gender?: string;
  category?: string;
  location?: string;
  codeStatus?: string;
  consultant?: string;
  admissionDate?: string;
  dischargeDate?: string;
}

const InputWrapper = ({ label, field, children, error, touched }: { label: string, field: string, children?: React.ReactNode, error?: string, touched?: boolean }) => (
  <div className="space-y-1">
    <label htmlFor={`hdu-field-${field}`} className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{label}</label>
    {children}
    {touched && error && (
      <p className="text-[8px] font-bold text-red-500 uppercase tracking-tighter mt-0.5 ml-1">{error}</p>
    )}
  </div>
);

interface AdmissionFormProps {
  editingPatient: Patient | null;
  autoSerialNo: string;
  onSave: (patientData: Omit<Patient, 'id'>) => Promise<void>;
  onArchive: (patient: Patient) => void;
  isSaving: boolean;
  onCancel: () => void;
}

const AdmissionForm = React.memo(({ editingPatient, autoSerialNo, onSave, onArchive, isSaving }: AdmissionFormProps) => {
  const { activeUnit } = useUnit();
  const [formName, setFormName] = useState(editingPatient?.name || '');
  const [formRegNo, setFormRegNo] = useState(editingPatient?.regNo || '');
  const [formGender, setFormGender] = useState(editingPatient?.gender || '');
  const [formCategory, setFormCategory] = useState(editingPatient?.category || '');
  const [formLocation, setFormLocation] = useState(editingPatient?.location || '');
  const [formCodeStatus, setFormCodeStatus] = useState(editingPatient?.codeStatus || '');
  const [formConsultant, setFormConsultant] = useState(editingPatient?.consultant || '');
  const [formInDate, setFormInDate] = useState(editingPatient?.admissionDate || new Date().toISOString().split('T')[0]);
  const [formOutDate, setFormOutDate] = useState(editingPatient?.dischargeDate || '');
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  const [consultantSearch, setConsultantSearch] = useState(editingPatient?.consultant || '');
  const [isConsultantListOpen, setIsConsultantListOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { canManageRecords } = useAuth();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsConsultantListOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const newErrors: FormErrors = {};
    if (formName.trim().length < 3) newErrors.name = "Name must be at least 3 characters.";
    if (!/^[A-Z\s.-]+$/i.test(formName) && formName.trim()) newErrors.name = "Name should only contain letters.";
    if (!formRegNo.trim()) newErrors.regNo = "MR Number is required.";
    else if (!/^[A-Z0-9-]+$/i.test(formRegNo)) newErrors.regNo = "Invalid format.";
    if (!formGender) newErrors.gender = "Selection required.";
    if (!formCategory) newErrors.category = "Selection required.";
    if (!formLocation) newErrors.location = "Selection required.";
    if (!formCodeStatus) newErrors.codeStatus = "Selection required.";
    if (!formConsultant) newErrors.consultant = "Consultant required.";
    
    if (!formInDate) {
      newErrors.admissionDate = "Admission date required.";
    } else {
      const selectedDate = new Date(formInDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (selectedDate > today) newErrors.admissionDate = "Admission cannot be in future.";
    }

    if (formOutDate && formInDate) {
      const inDateObj = new Date(formInDate);
      const outDateObj = new Date(formOutDate);
      if (outDateObj < inDateObj) {
        newErrors.dischargeDate = "Discharge cannot be before admission.";
      }
    }

    setErrors(newErrors);
  }, [formName, formRegNo, formGender, formCategory, formLocation, formCodeStatus, formConsultant, formInDate, formOutDate]);

  const los = useMemo(() => {
    if (!formInDate) return 0;
    const start = new Date(formInDate);
    const end = formOutDate ? new Date(formOutDate) : new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [formInDate, formOutDate]);

  const consultantSuggestions = useMemo(() => {
    const term = consultantSearch.toLowerCase();
    return CONSULTANTS.filter(c => c.toLowerCase().includes(term));
  }, [consultantSearch]);

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const isFormValid = useMemo(() => {
    return Object.keys(errors).length === 0 && formName.trim() && formRegNo.trim() && formConsultant;
  }, [errors, formName, formRegNo, formConsultant]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSaving) {
      setTouched({
        name: true, regNo: true, gender: true, category: true, location: true,
        codeStatus: true, consultant: true, admissionDate: true, dischargeDate: true
      });
      return;
    }

    let status = PatientStatus.ACTIVE;
    if (formOutDate) {
        status = PatientStatus.DISCHARGED;
    }

    onSave({
      unit: editingPatient ? editingPatient.unit : activeUnit,
      serialNo: editingPatient ? editingPatient.serialNo : autoSerialNo,
      regNo: formRegNo.trim().toUpperCase(),
      name: formName.trim().toUpperCase(),
      gender: formGender,
      admissionDate: formInDate,
      category: formCategory as PatientCategory,
      location: formLocation,
      codeStatus: formCodeStatus as CodeStatus,
      consultant: formConsultant,
      lengthOfStay: los,
      dischargeDate: formOutDate || undefined,
      status: status
    });
  };

  const getInputClass = (field: string) => `w-full px-3 py-2 border rounded-lg text-[10px] font-bold outline-none transition-all ${
    touched[field] && errors[field as keyof FormErrors]
      ? 'border-red-500 bg-red-50 focus:ring-1 focus:ring-red-200'
      : 'border-slate-200 focus:ring-1 focus:ring-red-200'
  }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputWrapper label="Serial No (Internal)" field="serialNo">
          <input 
            value={editingPatient ? editingPatient.serialNo : autoSerialNo} 
            readOnly 
            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-400 cursor-not-allowed" 
          />
        </InputWrapper>
        <InputWrapper label="MR Number *" field="regNo" error={errors.regNo} touched={touched.regNo}>
          <input 
            id="hdu-field-regNo"
            value={formRegNo} 
            onChange={(e) => setFormRegNo(e.target.value.toUpperCase())} 
            onBlur={() => handleBlur('regNo')}
            className={`${getInputClass('regNo')} uppercase`} 
            placeholder="e.g. 12345"
            maxLength={15}
            inputMode="text"
            autoCapitalize="characters"
          />
        </InputWrapper>
      </div>
      <InputWrapper label="Patient Full Name *" field="name" error={errors.name} touched={touched.name}>
        <input 
          id="hdu-field-name"
          value={formName} 
          onChange={(e) => setFormName(e.target.value.toUpperCase())} 
          onBlur={() => handleBlur('name')}
          className={`${getInputClass('name')} uppercase`} 
          placeholder="ENTER LEGAL NAME"
          autoCapitalize="characters"
        />
      </InputWrapper>
      <div className="grid grid-cols-2 gap-4">
        <InputWrapper label="Gender *" field="gender" error={errors.gender} touched={touched.gender}>
          <select 
            id="hdu-field-gender"
            value={formGender} 
            onChange={(e) => setFormGender(e.target.value)} 
            onBlur={() => handleBlur('gender')}
            className={getInputClass('gender')}
          >
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </InputWrapper>
        <InputWrapper label="Category *" field="category" error={errors.category} touched={touched.category}>
          <select 
            id="hdu-field-category"
            value={formCategory} 
            onChange={(e) => setFormCategory(e.target.value as PatientCategory)} 
            onBlur={() => handleBlur('category')}
            className={getInputClass('category')}
          >
            <option value="">Select</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </InputWrapper>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InputWrapper label="Location *" field="location" error={errors.location} touched={touched.location}>
          <select 
            id="hdu-field-location"
            value={formLocation} 
            onChange={(e) => setFormLocation(e.target.value)} 
            onBlur={() => handleBlur('location')}
            className={getInputClass('location')}
          >
            <option value="">Select</option>
            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </InputWrapper>
        <InputWrapper label="Code Status *" field="codeStatus" error={errors.codeStatus} touched={touched.codeStatus}>
          <select 
            id="hdu-field-codeStatus"
            value={formCodeStatus} 
            onChange={(e) => setFormCodeStatus(e.target.value)} 
            onBlur={() => handleBlur('codeStatus')}
            className={getInputClass('codeStatus')}
          >
            <option value="">Select</option>
            {CODE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </InputWrapper>
      </div>
      <div className="relative" ref={dropdownRef}>
        <InputWrapper label="Consultant *" field="consultant" error={errors.consultant} touched={touched.consultant}>
          <div className="relative">
            <input 
              id="hdu-field-consultant"
              type="text"
              value={consultantSearch}
              onFocus={() => setIsConsultantListOpen(true)}
              onChange={(e) => {
                setConsultantSearch(e.target.value);
                setFormConsultant(e.target.value);
                setIsConsultantListOpen(true);
              }}
              onBlur={() => handleBlur('consultant')}
              placeholder="Search Specialist..."
              className={getInputClass('consultant')}
              autoComplete="off"
            />
            <div className="absolute right-3 top-2.5 text-slate-300 pointer-events-none">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </InputWrapper>
        
        {isConsultantListOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2">
            {consultantSuggestions.length > 0 ? (
              consultantSuggestions.map((c, idx) => (
                <button
                  key={idx}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} 
                  onClick={() => {
                    setFormConsultant(c);
                    setConsultantSearch(c);
                    setIsConsultantListOpen(false);
                    setTouched(prev => ({ ...prev, consultant: true }));
                  }}
                  className="w-full text-left px-4 py-2.5 text-[10px] font-bold text-slate-700 hover:bg-slate-50 hover:text-red-600 border-b border-slate-50 last:border-0 transition-colors"
                >
                  {c}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-[10px] text-slate-400 font-medium italic">
                No matching specialists found.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
        <InputWrapper label="Admission Date *" field="admissionDate" error={errors.admissionDate} touched={touched.admissionDate}>
          <input 
            id="hdu-field-admissionDate"
            type="date" 
            value={formInDate} 
            onChange={(e) => setFormInDate(e.target.value)} 
            onBlur={() => handleBlur('admissionDate')}
            className={getInputClass('admissionDate')} 
          />
        </InputWrapper>
        <InputWrapper label="Discharge Date" field="dischargeDate" error={errors.dischargeDate} touched={touched.dischargeDate}>
          <input 
            id="hdu-field-dischargeDate"
            type="date" 
            value={formOutDate} 
            onChange={(e) => setFormOutDate(e.target.value)} 
            onBlur={() => handleBlur('dischargeDate')}
            className={getInputClass('dischargeDate')} 
          />
        </InputWrapper>
      </div>

      <div className="flex justify-between items-center px-4 py-3 bg-slate-900 rounded-xl border border-slate-800 shadow-sm animate-in fade-in zoom-in duration-300">
        <div className="flex items-center gap-2 text-white">
          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shadow-sm">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter">Stay for {activeUnit}:</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-sm font-black text-white leading-none">{los} Days</span>
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {formOutDate ? 'Post-Discharge Total' : 'Active Admission'}
          </span>
        </div>
      </div>

      <div className="pt-2 flex flex-col gap-3">
        <button 
          type="submit"
          disabled={!isFormValid || isSaving} 
          className={`w-full py-3 rounded-xl font-black text-[10px] text-white uppercase tracking-widest transition-all ${isFormValid && !isSaving ? 'bg-red-600 shadow-lg hover:bg-red-700 active:scale-[0.98]' : 'bg-slate-300 cursor-not-allowed'}`}
        >
          {isSaving ? "Synchronizing..." : editingPatient ? "Update Record" : "Commit Admission"}
        </button>
        
        {editingPatient && canManageRecords && (
          <button 
            type="button"
            onClick={() => onArchive(editingPatient)}
            className="w-full py-2.5 rounded-xl font-black text-[9px] text-amber-600 bg-amber-50 border border-amber-100 uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Archive as Deceased
          </button>
        )}
      </div>
    </form>
  );
});

type SortKey = keyof Patient;
type SortDirection = 'asc' | 'desc';

const PatientTable: React.FC = () => {
  const { activeUnit } = useUnit();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isMortalityConfirmOpen, setIsMortalityConfirmOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [patientToArchive, setPatientToArchive] = useState<Patient | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const prevPatientIdsRef = useRef<Set<string>>(new Set());

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
    key: 'serialNo', 
    direction: 'desc' 
  });

  const { isAdmin, canManageRecords } = useAuth();

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'patients'),
      where('unit', '==', activeUnit)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const patientData = snapshot.docs
        .map((d: any) => ({ id: d.id, ...d.data() })) as Patient[];
      
      const sortedData = [...patientData].sort((a, b) => {
          const serialA = parseInt(a.serialNo || '0', 10);
          const serialB = parseInt(b.serialNo || '0', 10);
          return serialB - serialA; 
      });

      const currentIds = new Set(sortedData.map(p => p.id));
      const previousIds = prevPatientIdsRef.current;
      
      if (previousIds.size > 0) {
        const newlyCreated = sortedData.find(p => !previousIds.has(p.id));
        if (newlyCreated) {
           setNewlyAddedId(newlyCreated.id);
           setTimeout(() => setNewlyAddedId(null), 3000);
        }
      }
      
      prevPatientIdsRef.current = currentIds;
      setPatients(sortedData);
      setLoading(false);
    }, (error) => {
      console.error("Firebase Sync Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeUnit]);

  const autoSerialNo = useMemo(() => {
    if (patients.length === 0) return '001';
    const nums = patients.map(p => parseInt(p.serialNo || '0')).filter(n => !isNaN(n));
    if (nums.length === 0) return '001';
    const max = Math.max(...nums);
    return (max + 1).toString().padStart(3, '0');
  }, [patients]);

  const handleSave = async (patientData: Omit<Patient, 'id'>) => {
    setIsSaving(true);
    try {
      if (editingPatient) {
        const patientRef = doc(db, 'patients', editingPatient.id);
        await updateDoc(patientRef, { ...patientData });
        setShowUpdateToast(true);
        setTimeout(() => setShowUpdateToast(false), 3000);
      } else {
        const newRef = doc(collection(db, 'patients'));
        await setDoc(newRef, {
          id: newRef.id,
          ...patientData
        });
      }
      setIsModalOpen(false);
      setEditingPatient(null);
    } catch (err) {
      console.error("Clinical Sync Failure:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportAction = (opts: any) => {
    const reportTitle = `${activeUnit} Clinical Census`;
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
        filters: `Unit: ${activeUnit}, Status: Active Census` 
      });
    }
  };

  const calculateDynamicLOS = (admissionDate: string, dischargeDate?: string) => {
    if (!admissionDate) return 0;
    const start = new Date(admissionDate);
    const end = dischargeDate ? new Date(dischargeDate) : new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diff = end.getTime() - start.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Active';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '--';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, appliedStartDate, appliedEndDate, activeUnit]);

  const sortedAndFiltered = useMemo(() => {
    const tokens = searchTerm.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
    
    const filtered = patients.filter(p => {
      const matchesSearch = tokens.every(token => {
        return (
          p.name.toLowerCase().includes(token) || 
          p.regNo.toLowerCase().includes(token) ||
          p.consultant.toLowerCase().includes(token) ||
          p.codeStatus.toLowerCase().includes(token) ||
          p.category.toLowerCase().includes(token) ||
          (p.location && p.location.toLowerCase().includes(token)) ||
          (p.serialNo && p.serialNo.toLowerCase().includes(token)) ||
          (p.status && p.status.toLowerCase().includes(token))
        );
      });
      
      const admissionDate = new Date(p.admissionDate);
      admissionDate.setHours(0, 0, 0, 0);
      
      let matchesStartDate = true;
      if (appliedStartDate) {
        const start = new Date(appliedStartDate);
        start.setHours(0, 0, 0, 0);
        matchesStartDate = admissionDate >= start;
      }
      
      let matchesEndDate = true;
      if (appliedEndDate) {
        const end = new Date(appliedEndDate);
        end.setHours(0, 0, 0, 0);
        matchesEndDate = admissionDate <= end;
      }

      return matchesSearch && matchesStartDate && matchesEndDate;
    });

    return [...filtered].sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];

      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      if (sortConfig.key === 'serialNo' || sortConfig.key === 'lengthOfStay') {
        aValue = parseInt(aValue.toString(), 10) || 0;
        bValue = parseInt(bValue.toString(), 10) || 0;
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

  const totalPages = Math.ceil(sortedAndFiltered.length / itemsPerPage);
  const paginatedPatients = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAndFiltered.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAndFiltered, currentPage, itemsPerPage]);

  const handleArchiveClick = (patient: Patient) => {
    setPatientToArchive(patient);
    setIsMortalityConfirmOpen(true);
  };

  const confirmArchiveDeceased = async () => {
    if (!patientToArchive || !canManageRecords) return;
    
    try {
      const expiryDate = new Date().toISOString().split('T')[0];
      const archiveData: Patient = { 
          ...patientToArchive, 
          status: PatientStatus.DECEASED, 
          dischargeDate: expiryDate,
          lengthOfStay: calculateDynamicLOS(patientToArchive.admissionDate, expiryDate)
      };
      await setDoc(doc(db, 'mortality_records', patientToArchive.id), archiveData);
      await deleteDoc(doc(db, 'patients', patientToArchive.id));
      setIsModalOpen(false);
      setEditingPatient(null);
      setPatientToArchive(null);
    } catch (err) {
      console.error("Failed to archive record:", err);
    }
  };

  const SortIndicator = ({ column }: { column: SortKey }) => {
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
      {showUpdateToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl border border-slate-700 animate-in slide-in-from-top-4 flex items-center gap-3">
          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7"/></svg>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">Record Updated Successfully!</span>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 gap-2">
            <div className="relative flex-1 max-w-lg">
              <input 
                type="text" 
                placeholder={`Search Name, MR#, Consultant, Bed, Category...`}
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
                onClick={() => { setEditingPatient(null); setIsModalOpen(true); }}
                className="bg-red-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg active:scale-95 flex items-center gap-2 shadow-red-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                Admission
              </button>
            )}
          </div>
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-sm active:scale-95"
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[600px] whitespace-nowrap scroll-smooth">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-slate-100 border-t-red-600 rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synchronizing {activeUnit} Census...</p>
            </div>
          ) : (
            <table className="w-full text-left min-w-[1200px] border-separate border-spacing-0">
              <thead className="bg-slate-900 text-white sticky top-0 z-10 shadow-md">
                <tr className="text-[10px] font-black uppercase tracking-widest select-none">
                  <th 
                    className={`px-4 py-4 w-16 text-center cursor-pointer transition-all duration-200 group ${sortConfig.key === 'serialNo' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('serialNo')}
                  >
                    <div className="flex items-center justify-center">S.No <SortIndicator column="serialNo" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-32 cursor-pointer transition-all duration-200 group ${sortConfig.key === 'regNo' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('regNo')}
                  >
                    <div className="flex items-center">Reg No <SortIndicator column="regNo" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 cursor-pointer transition-all duration-200 group ${sortConfig.key === 'name' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">Patient Identity <SortIndicator column="name" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-28 cursor-pointer transition-all duration-200 group ${sortConfig.key === 'category' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center">Category <SortIndicator column="category" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-24 cursor-pointer transition-all duration-200 group ${sortConfig.key === 'location' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('location')}
                  >
                    <div className="flex items-center">Location <SortIndicator column="location" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-24 text-center cursor-pointer transition-all duration-200 group ${sortConfig.key === 'codeStatus' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('codeStatus')}
                  >
                    <div className="flex items-center justify-center">Code <SortIndicator column="codeStatus" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-40 cursor-pointer transition-all duration-200 group ${sortConfig.key === 'consultant' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('consultant')}
                  >
                    <div className="flex items-center">Consultant <SortIndicator column="consultant" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-32 text-center cursor-pointer transition-all duration-200 group ${sortConfig.key === 'admissionDate' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('admissionDate')}
                  >
                    <div className="flex items-center justify-center">In Date <SortIndicator column="admissionDate" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-32 text-center cursor-pointer transition-all duration-200 group ${sortConfig.key === 'dischargeDate' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('dischargeDate')}
                  >
                    <div className="flex items-center justify-center">Out Date <SortIndicator column="dischargeDate" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-24 text-center cursor-pointer transition-all duration-200 group ${sortConfig.key === 'admissionDate' ? 'bg-slate-800 text-red-400' : 'hover:bg-slate-800'}`} 
                    onClick={() => handleSort('admissionDate')}
                  >
                    <div className="flex items-center justify-center">Stay <SortIndicator column="admissionDate" /></div>
                  </th>
                  <th className="px-4 py-4 w-28 text-right bg-slate-900">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[10px] font-bold text-slate-700 uppercase">
                {paginatedPatients.map(p => (
                  <tr 
                    key={p.id} 
                    className={`transition-all group cursor-pointer ${
                      newlyAddedId === p.id 
                        ? 'bg-blue-50/70 border-l-4 border-l-blue-500 animate-in fade-in duration-1000' 
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => { setEditingPatient(p); setIsModalOpen(true); }}
                  >
                    <td className="px-4 py-3 text-center text-slate-400">{p.serialNo}</td>
                    <td className="px-4 py-3 font-mono text-slate-900">{p.regNo}</td>
                    <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-[10px] shrink-0 ${
                              newlyAddedId === p.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-100 border-slate-200 text-slate-600'
                            }`}>
                                {p.name?.[0] || '?'}
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-slate-900 uppercase">{p.name}</p>
                                  {p.status === PatientStatus.DISCHARGED && (
                                    <span className="bg-slate-200 text-slate-600 text-[6px] font-black px-1 py-0.5 rounded uppercase tracking-tighter">DC</span>
                                  )}
                                </div>
                                <p className="text-[8px] text-slate-400">{p.gender}</p>
                            </div>
                        </div>
                    </td>
                    <td className="px-4 py-3">
                       <span className="bg-slate-100 px-2 py-0.5 rounded text-[8px] border border-slate-200">{p.category}</span>
                    </td>
                    <td className="px-4 py-3">
                       <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[8px] border border-blue-100">{p.location || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] ${p.codeStatus === 'Full Code' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                        {p.codeStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 truncate">{p.consultant}</td>
                    <td className="px-4 py-3 text-center text-slate-500 font-mono">{formatDate(p.admissionDate)}</td>
                    <td className="px-4 py-3 text-center text-slate-500 font-mono">
                      <span className={!p.dischargeDate ? "text-green-600 font-black tracking-tighter" : ""}>
                        {formatDate(p.dischargeDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-red-600 bg-red-50/20">{calculateDynamicLOS(p.admissionDate, p.dischargeDate)}d</td>
                    <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={(e) => { e.stopPropagation(); setEditingPatient(p); setIsModalOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95" title="Edit Admission">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            {isAdmin && (
                                <button onClick={(e) => { e.stopPropagation(); setIdToDelete(p.id); setIsConfirmOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all active:scale-95" title="Purge Record">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            )}
                        </div>
                    </td>
                  </tr>
                ))}
                {paginatedPatients.length === 0 && (
                    <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400 italic font-medium">No records match your search or date criteria.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination Controls */}
        {!loading && sortedAndFiltered.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Showing <span className="text-slate-900">{Math.min(sortedAndFiltered.length, (currentPage - 1) * itemsPerPage + 1)}</span> to <span className="text-slate-900">{Math.min(sortedAndFiltered.length, currentPage * itemsPerPage)}</span> of <span className="text-slate-900">{sortedAndFiltered.length}</span> Records
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-1.5 rounded-lg border transition-all ${currentPage === 1 ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:scale-95'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
              </button>
              
              <div className="flex items-center gap-1 px-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all ${currentPage === pageNum ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`p-1.5 rounded-lg border transition-all ${currentPage === totalPages ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:scale-95'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { if(!isSaving) { setIsModalOpen(false); setEditingPatient(null); } }} 
        title={editingPatient ? `Modify ${activeUnit} Record` : `${activeUnit} Registration`}
      >
        <AdmissionForm 
          key={editingPatient?.id || 'new-admission'}
          editingPatient={editingPatient}
          autoSerialNo={autoSerialNo}
          isSaving={isSaving}
          onSave={handleSave}
          onArchive={handleArchiveClick}
          onCancel={() => { setIsModalOpen(false); setEditingPatient(null); }}
        />
      </Modal>

      <ConfirmModal 
        isOpen={isConfirmOpen} 
        onClose={() => setIsConfirmOpen(false)} 
        onConfirm={async () => { if(idToDelete) { await deleteDoc(doc(db, 'patients', idToDelete)); setIdToDelete(null); } }} 
        title="Confirm Purge" 
        message="Permanently delete this clinical admission record?" 
      />

      <ConfirmModal 
        isOpen={isMortalityConfirmOpen} 
        onClose={() => { setIsMortalityConfirmOpen(false); setPatientToArchive(null); }} 
        onConfirm={confirmArchiveDeceased} 
        title="Clinical Death Audit" 
        message="Are you certain you want to archive this patient as Deceased? This will permanently move the record to the Mortality Archive and remove it from active census." 
        confirmLabel="Finalize Archive"
        variant="warning"
      />

      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        onExport={handleExportAction} 
        title="Census Audit Export" 
      />
    </div>
  );
};

export default PatientTable;
