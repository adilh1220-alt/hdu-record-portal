
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
// @ts-ignore
import { collection, onSnapshot, setDoc, doc, deleteDoc, query, orderBy, updateDoc, where } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { Patient, PatientStatus, PatientCategory, CodeStatus, TriagePriority, ClinicalUnit } from '../types';
import { exportPatientsPDF, exportPatientSummaryPDF, generateKidneyCentreLogoBase64 } from '../services/pdfService';
import { downloadCSV } from '../services/exportService';
import { useAuth } from '../contexts/AuthContext';
import { useUnit } from '../contexts/UnitContext';
import { useSearch } from '../contexts/SearchContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useToast } from '../contexts/ToastContext';
import { activityService } from '../services/activityService';
import { CONSULTANTS, CATEGORIES, LOCATIONS, CODE_STATUSES, TRIAGE_PRIORITIES, TRIAGE_COLORS, CLINICAL_UNITS, UNIT_DETAILS } from '../constants';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';
import ExportModal from './ExportModal';
import { VoiceDictationButton } from './VoiceDictationButton';
import { ActiveFiltersBar } from './ActiveFiltersBar';
import { PatientStatusTimeline } from './PatientStatusTimeline';
import PatientQRCodeModal from './PatientQRCodeModal';
import QRScannerModal from './QRScannerModal';
import { QrCode } from 'lucide-react';

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
  const confirm = useConfirm();

  const STORAGE_KEY = editingPatient 
    ? `hdu_draft_admission_${activeUnit}_edit_${editingPatient.id}`
    : `hdu_draft_admission_${activeUnit}`;

  const getDraftValue = (field: string, defaultValue: any) => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed[field] !== undefined) {
          return parsed[field];
        }
      }
    } catch (e) {
      console.error(e);
    }
    return defaultValue;
  };

  const [hasRestoredDraft, setHasRestoredDraft] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return !!(parsed.name || parsed.regNo || parsed.gender || parsed.category || parsed.location || parsed.codeStatus || parsed.consultant);
      }
    } catch {
      // ignore
    }
    return false;
  });

  const [formName, setFormName] = useState(() => getDraftValue('name', editingPatient?.name || ''));
  const [formRegNo, setFormRegNo] = useState(() => getDraftValue('regNo', editingPatient?.regNo || ''));
  const [formGender, setFormGender] = useState(() => getDraftValue('gender', editingPatient?.gender || ''));
  const [formCategory, setFormCategory] = useState(() => getDraftValue('category', editingPatient?.category || ''));
  const [formLocation, setFormLocation] = useState(() => getDraftValue('location', editingPatient?.location || ''));
  const [formCodeStatus, setFormCodeStatus] = useState(() => getDraftValue('codeStatus', editingPatient?.codeStatus || ''));
  const [formTriagePriority, setFormTriagePriority] = useState<TriagePriority>(() => getDraftValue('triagePriority', editingPatient?.triagePriority || 'Stable'));
  const [formConsultant, setFormConsultant] = useState(() => getDraftValue('consultant', editingPatient?.consultant || ''));
  const [formInDate, setFormInDate] = useState(() => getDraftValue('admissionDate', editingPatient?.admissionDate || new Date().toISOString().split('T')[0]));
  const [formOutDate, setFormOutDate] = useState(() => getDraftValue('dischargeDate', editingPatient?.dischargeDate || ''));
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  const [consultantSearch, setConsultantSearch] = useState(() => getDraftValue('consultant', editingPatient?.consultant || ''));
  const [isConsultantListOpen, setIsConsultantListOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { canManageRecords } = useAuth();

  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

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

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [consultantSuggestions]);

  const selectConsultant = (c: string) => {
    setFormConsultant(c);
    setConsultantSearch(c);
    setIsConsultantListOpen(false);
    setTouched(prev => ({ ...prev, consultant: true }));
    // Focus management: Move to next field
    setTimeout(() => {
      document.getElementById('hdu-field-admissionDate')?.focus();
    }, 0);
  };

  // Debounced Auto-save to LocalStorage
  useEffect(() => {
    const isChanged = 
      formName !== (editingPatient?.name || '') ||
      formRegNo !== (editingPatient?.regNo || '') ||
      formGender !== (editingPatient?.gender || '') ||
      formCategory !== (editingPatient?.category || '') ||
      formLocation !== (editingPatient?.location || '') ||
      formCodeStatus !== (editingPatient?.codeStatus || '') ||
      formTriagePriority !== (editingPatient?.triagePriority || 'Stable') ||
      formConsultant !== (editingPatient?.consultant || '') ||
      formInDate !== (editingPatient?.admissionDate || new Date().toISOString().split('T')[0]) ||
      formOutDate !== (editingPatient?.dischargeDate || '');

    if (!isChanged && !editingPatient) {
      return;
    }

    setIsDraftSaving(true);
    const timer = setTimeout(() => {
      try {
        const draftData = {
          name: formName,
          regNo: formRegNo,
          gender: formGender,
          category: formCategory,
          location: formLocation,
          codeStatus: formCodeStatus,
          triagePriority: formTriagePriority,
          consultant: formConsultant,
          admissionDate: formInDate,
          dischargeDate: formOutDate,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draftData));
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (e) {
        console.error('Failed to auto-save draft:', e);
      } finally {
        setIsDraftSaving(false);
      }
    }, 1000); // 1s debounce

    return () => clearTimeout(timer);
  }, [formName, formRegNo, formGender, formCategory, formLocation, formCodeStatus, formTriagePriority, formConsultant, formInDate, formOutDate, STORAGE_KEY, editingPatient]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isConsultantListOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsConsultantListOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < consultantSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && highlightedIndex < consultantSuggestions.length) {
          e.preventDefault();
          selectConsultant(consultantSuggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsConsultantListOpen(false);
        break;
      case 'Tab':
        if (highlightedIndex >= 0 && highlightedIndex < consultantSuggestions.length) {
          selectConsultant(consultantSuggestions[highlightedIndex]);
        } else {
          setIsConsultantListOpen(false);
        }
        break;
    }
  };

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

    // Remove draft from LocalStorage on successful submit
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error(err);
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
      triagePriority: formTriagePriority,
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
      {hasRestoredDraft && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Unsaved draft auto-restored</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              const isConfirmed = await confirm({
                title: "Discard Auto-Restored Draft",
                message: "Are you sure you want to discard this unsaved draft and reset the form?",
                confirmLabel: "Discard Draft",
                cancelLabel: "Keep Draft",
                variant: "warning"
              });
              if (!isConfirmed) return;
              try {
                localStorage.removeItem(STORAGE_KEY);
                setHasRestoredDraft(false);
                setFormName(editingPatient?.name || '');
                setFormRegNo(editingPatient?.regNo || '');
                setFormGender(editingPatient?.gender || '');
                setFormCategory(editingPatient?.category || '');
                setFormLocation(editingPatient?.location || '');
                setFormCodeStatus(editingPatient?.codeStatus || '');
                setFormTriagePriority(editingPatient?.triagePriority || 'Stable');
                setFormConsultant(editingPatient?.consultant || '');
                setConsultantSearch(editingPatient?.consultant || '');
                setFormInDate(editingPatient?.admissionDate || new Date().toISOString().split('T')[0]);
                setFormOutDate(editingPatient?.dischargeDate || '');
                setLastSavedTime(null);
              } catch (e) {
                console.error(e);
              }
            }}
            className="text-[9px] font-black text-amber-500 hover:text-amber-600 underline uppercase tracking-wider cursor-pointer"
          >
            Discard Draft
          </button>
        </div>
      )}
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
      <div className="grid grid-cols-3 gap-4">
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
        <InputWrapper label="Triage Priority *" field="triagePriority">
          <select 
            id="hdu-field-triagePriority"
            value={formTriagePriority} 
            onChange={(e) => setFormTriagePriority(e.target.value as TriagePriority)} 
            className={getInputClass('triagePriority')}
          >
            {TRIAGE_PRIORITIES.map(tp => <option key={tp} value={tp}>{tp}</option>)}
          </select>
        </InputWrapper>
      </div>
      <div className="relative" ref={dropdownRef}>
        <InputWrapper label="Consultant *" field="consultant" error={errors.consultant} touched={touched.consultant}>
          <div className="relative" role="combobox" aria-expanded={isConsultantListOpen} aria-haspopup="listbox" aria-controls="consultant-listbox">
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
              onKeyDown={handleKeyDown}
              onBlur={() => handleBlur('consultant')}
              placeholder="Search Specialist..."
              className={getInputClass('consultant')}
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls="consultant-listbox"
              aria-activedescendant={highlightedIndex >= 0 ? `consultant-option-${highlightedIndex}` : undefined}
            />
            <div className="absolute right-3 top-2.5 text-slate-300 pointer-events-none">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </InputWrapper>
        
        {isConsultantListOpen && (
          <div 
            id="consultant-listbox"
            role="listbox"
            className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2"
          >
            {consultantSuggestions.length > 0 ? (
              consultantSuggestions.map((c, idx) => (
                <button
                  key={idx}
                  id={`consultant-option-${idx}`}
                  role="option"
                  aria-selected={highlightedIndex === idx}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} 
                  onClick={() => selectConsultant(c)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`w-full text-left px-4 py-2.5 text-[10px] font-bold border-b border-slate-50 last:border-0 transition-colors ${
                    highlightedIndex === idx 
                      ? 'bg-red-50 text-red-600' 
                      : 'text-slate-700 hover:bg-slate-50 hover:text-red-600'
                  }`}
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

      <div className="flex items-center justify-between px-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
        {isDraftSaving ? (
          <span className="flex items-center gap-1.5 text-red-500 animate-pulse">
            <svg className="animate-spin h-3 w-3 text-red-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Auto-saving draft...
          </span>
        ) : lastSavedTime ? (
          <span>Draft auto-saved at {lastSavedTime}</span>
        ) : (
          <span>Draft auto-saved locally</span>
        )}
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

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onTransfer: (destUnit: ClinicalUnit, destLocation: string, reason: string) => Promise<void>;
  isSaving: boolean;
}

const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose, patient, onTransfer, isSaving }) => {
  const [destUnit, setDestUnit] = useState<ClinicalUnit>('HDU');
  const [destLocation, setDestLocation] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (patient) {
      const otherUnits = CLINICAL_UNITS.filter(u => u !== patient.unit);
      if (otherUnits.length > 0) {
        setDestUnit(otherUnits[0]);
      }
      setDestLocation('');
      setReason('');
      setError('');
    }
  }, [patient]);

  if (!patient) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destUnit) {
      setError('Destination Unit is required');
      return;
    }
    if (!destLocation.trim()) {
      setError('Destination Location is required');
      return;
    }
    if (!reason.trim()) {
      setError('Transfer reason is required');
      return;
    }
    onTransfer(destUnit, destLocation.trim(), reason.trim());
  };

  const otherUnits = CLINICAL_UNITS.filter(u => u !== patient.unit);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Transfer Patient: ${patient.name}`} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4 text-[10px] uppercase font-bold text-slate-700">
        <div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Current Placement</span>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-[10px]">
            <div>
              <p className="text-slate-900">{UNIT_DETAILS[patient.unit]?.label || patient.unit}</p>
              <p className="text-[8px] text-slate-400 mt-0.5">Location: {patient.location || 'N/A'}</p>
            </div>
            <span className="bg-slate-200 px-2.5 py-1 rounded text-slate-700">{patient.unit}</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Destination Unit *</label>
          <select 
            value={destUnit} 
            onChange={(e) => setDestUnit(e.target.value as ClinicalUnit)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-100 bg-white cursor-pointer"
          >
            {otherUnits.map(unit => (
              <option key={unit} value={unit}>
                {UNIT_DETAILS[unit]?.label || unit} ({unit})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Destination Location *</label>
          <div className="flex gap-2">
            <select
              value={LOCATIONS.includes(destLocation) ? destLocation : ''}
              onChange={(e) => setDestLocation(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-100 bg-white cursor-pointer flex-1"
            >
              <option value="">Select Location...</option>
              {LOCATIONS.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
              <option value="custom">Custom...</option>
            </select>
            {(!LOCATIONS.includes(destLocation) || destLocation === 'custom') && (
              <input 
                type="text" 
                placeholder="Enter Specific Location/Bed..." 
                value={destLocation === 'custom' ? '' : destLocation}
                onChange={(e) => setDestLocation(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-100 flex-1 placeholder:text-slate-300"
              />
            )}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Reason for Transfer *</label>
            <VoiceDictationButton 
              onTranscript={(text) => setReason(prev => prev ? `${prev} ${text}` : text)} 
              lightTheme 
            />
          </div>
          <textarea 
            rows={3}
            placeholder="E.g., Clinical deterioration requiring intensive monitoring, step-down to ward, scheduled surgery..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-100 placeholder:text-slate-300 font-medium normal-case"
          />
        </div>

        {error && (
          <p className="text-[8px] font-bold text-red-500 uppercase tracking-tighter">{error}</p>
        )}

        <div className="pt-2 flex gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors uppercase text-[10px] tracking-wider"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isSaving}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors uppercase text-[10px] tracking-wider shadow-lg shadow-red-100 flex items-center justify-center gap-1"
          >
            {isSaving ? 'Processing...' : 'Confirm Transfer'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onOpenTransferModal?: (patient: Patient) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, patient, onOpenTransferModal }) => {
  if (!patient) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Status & Bed Assignment Timeline: ${patient.name}`} maxWidth="max-w-2xl">
      <PatientStatusTimeline
        patient={patient}
        onClose={onClose}
        onOpenTransferModal={onOpenTransferModal}
      />
    </Modal>
  );
};

interface PrintSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
}

const PrintSummaryModal: React.FC<PrintSummaryModalProps> = ({ isOpen, onClose, patient }) => {
  const { currentUser } = useAuth();
  
  if (!patient) return null;

  const currentDisplayName = currentUser?.displayName || currentUser?.email || 'Medical Practitioner';

  const handleBrowserPrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    exportPatientSummaryPDF(patient, currentDisplayName);
  };

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Patient Summary Report" maxWidth="max-w-3xl">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #clinical-print-section, #clinical-print-section * {
            visibility: visible !important;
          }
          #clinical-print-section {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            color: black !important;
            padding: 24px !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <div className="space-y-6">
        {/* On-screen control bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 print:hidden">
          <div>
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Clinical Export Suite</h4>
            <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Select your preferred output format for medical records.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleBrowserPrint}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors uppercase text-[9px] font-black tracking-wider flex items-center gap-1.5 active:scale-95 shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 1.523a1.125 1.125 0 01-1.12 1.227H7.231c-.615 0-1.114-.507-1.12-1.125L6.34 18m11.32 0h-11.32m11.32 0a3 3 0 003-3V9.75a3 3 0 00-3-3h-11.32a3 3 0 00-3 3V15a3 3 0 003 3m11.32-11.25V4.5a2.25 2.25 0 00-2.25-2.25h-6.75a2.25 2.25 0 00-2.25 2.25v2.25m6.75 0h-6.75M8.25 10.5h.008v.008H8.25V10.5zm.375 0a.375 0 11-.75 0 .375 0 01.75 0z" />
              </svg>
              Print Document
            </button>
            <button 
              onClick={handleDownloadPDF}
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors uppercase text-[9px] font-black tracking-wider flex items-center gap-1.5 active:scale-95 shadow-sm shadow-red-100"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Save As PDF
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div 
          id="clinical-print-section" 
          className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm text-slate-800 space-y-6 overflow-y-auto max-h-[60vh] print:max-h-none print:border-none print:shadow-none font-sans"
        >
          {/* Header Banner */}
          <div className="border-b-4 border-slate-900 pb-4 flex flex-col items-center justify-center space-y-2">
            <img 
              src={generateKidneyCentreLogoBase64()} 
              alt="The Kidney Centre Logo" 
              className="h-16 w-auto object-contain mb-1"
            />
            <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight uppercase">
              CLINICAL INPATIENT &amp; PROCEDURE SUMMARY
            </h1>
            <h2 className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest">
              Patient Summary &amp; Movement Audit Record
            </h2>
            <div className="flex items-center justify-center gap-4 text-[8px] md:text-[9px] text-slate-400 font-mono uppercase tracking-wider pt-1">
              <span>Record ID: {patient.id}</span>
              <span>•</span>
              <span>Generated by: {currentDisplayName}</span>
              <span>•</span>
              <span>Timestamp: {new Date().toLocaleString()}</span>
            </div>
          </div>

          {/* Core Demographics Grid */}
          <div className="space-y-2">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">I. PATIENT PROFILE</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-bold text-slate-700 uppercase">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 transition-all duration-300 hover:shadow-md hover:shadow-slate-100 hover:bg-white hover:-translate-y-0.5 cursor-pointer">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</span>
                <span className="text-slate-900 block font-black text-xs">{patient.name}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 transition-all duration-300 hover:shadow-md hover:shadow-slate-100 hover:bg-white hover:-translate-y-0.5 cursor-pointer">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">MR Number</span>
                <span className="text-slate-900 block font-mono font-black text-xs">{patient.regNo}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 transition-all duration-300 hover:shadow-md hover:shadow-slate-100 hover:bg-white hover:-translate-y-0.5 cursor-pointer">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Patient Gender</span>
                <span className="text-slate-900 block">{patient.gender}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 transition-all duration-300 hover:shadow-md hover:shadow-slate-100 hover:bg-white hover:-translate-y-0.5 cursor-pointer">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Patient Category</span>
                <span className="text-slate-900 block">{patient.category}</span>
              </div>
            </div>
          </div>

          {/* Placement and Clinical Flags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Clinical Placement Card */}
            <div className="space-y-2">
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">II. CURRENT PLACEMENT</h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-[10px] font-bold text-slate-700 uppercase space-y-2 transition-all duration-300 hover:shadow-md hover:shadow-slate-100 hover:bg-white hover:-translate-y-0.5 cursor-pointer">
                <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Clinical Ward</span>
                  <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded text-[9px]">{patient.unit} Unit</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Assigned Bed Location</span>
                  <span className="text-slate-900 font-black">{patient.location || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Admitting Consultant</span>
                  <span className="text-slate-900 font-black">{patient.consultant}</span>
                </div>
              </div>
            </div>

            {/* Critical Codes Card */}
            <div className="space-y-2">
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">III. CLINICAL FLAGS</h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-[10px] font-bold text-slate-700 uppercase space-y-2 transition-all duration-300 hover:shadow-md hover:shadow-slate-100 hover:bg-white hover:-translate-y-0.5 cursor-pointer">
                <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Triage Status Priority</span>
                  <span className={`px-2 py-0.5 rounded text-[8px] border ${TRIAGE_COLORS[patient.triagePriority || 'Stable'] || 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                    {patient.triagePriority || 'Stable'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Resuscitation Code Status</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${patient.codeStatus === 'Full Code' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                    {patient.codeStatus}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Duration of stay (LOS)</span>
                  <span className="text-red-600 font-black text-xs">{patient.lengthOfStay || 0} Days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Admission & Discharge Timestamps */}
          <div className="space-y-2">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">IV. ADMISSION PERIOD</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] font-bold text-slate-700 uppercase">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Admitted timestamp</span>
                  <span className="text-slate-900 block font-mono mt-0.5">{formatDateTime(patient.admissionDate)}</span>
                </div>
                <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Discharged timestamp</span>
                  <span className="text-slate-900 block font-mono mt-0.5">
                    {patient.dischargeDate ? formatDateTime(patient.dischargeDate) : (
                      <span className="text-green-600 font-black">ACTIVE ADMISSION (IN-CENSUS)</span>
                    )}
                  </span>
                </div>
                <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Movement Trail Log */}
          <div className="space-y-3">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">V. CLINICAL TRANSFER TIMELINE</h3>
            {(!patient.transferHistory || patient.transferHistory.length === 0) ? (
              <div className="text-center py-6 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">No Unit Transfers Logged</p>
                <p className="text-[8px] text-slate-300 uppercase tracking-wide mt-1">Patient has remained in current location since initial entry.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[9px] font-bold text-slate-700 uppercase">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400">
                      <th className="py-2 font-bold tracking-wider">Date &amp; Time</th>
                      <th className="py-2 font-bold tracking-wider">Unit Transition</th>
                      <th className="py-2 font-bold tracking-wider">Location Change</th>
                      <th className="py-2 font-bold tracking-wider">Reason for Transfer</th>
                      <th className="py-2 font-bold tracking-wider">Authorized Staff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patient.transferHistory.map((log, index) => (
                      <tr key={index} className="text-[9px]">
                        <td className="py-2.5 font-mono text-slate-500 font-normal">{formatDateTime(log.timestamp)}</td>
                        <td className="py-2.5 font-black text-slate-900">{log.fromUnit} &rarr; {log.toUnit}</td>
                        <td className="py-2.5 text-slate-600">{log.fromLocation || 'N/A'} &rarr; {log.toLocation || 'N/A'}</td>
                        <td className="py-2.5 font-medium normal-case text-slate-600 tracking-tight">{log.reason}</td>
                        <td className="py-2.5 text-slate-500">{log.performedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Signature & Clinic Seal Sign-Off Box */}
          <div className="pt-10 grid grid-cols-2 gap-8 text-center text-[9px] font-bold text-slate-400 uppercase tracking-wider print:pt-16">
            <div className="space-y-1">
              <div className="border-b border-slate-300 w-full h-8"></div>
              <span>Attending clinician signature</span>
            </div>
            <div className="space-y-1">
              <div className="border-b border-slate-300 w-full h-8"></div>
              <span>Witness / nursing charge signature</span>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100 text-center text-[7px] text-slate-400 uppercase tracking-widest font-bold leading-relaxed">
            Clinical report compiled officially by The Kidney Centre Medical Records.
            <br />
            Confidential medical information. For authorized healthcare provider use only.
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex justify-end print:hidden">
          <button 
            type="button" 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors uppercase text-[10px] tracking-wider font-bold"
          >
            Close Report
          </button>
        </div>
      </div>
    </Modal>
  );
};

type SortKey = keyof Patient;
type SortDirection = 'asc' | 'desc';

const PatientTable: React.FC = () => {
  const { activeUnit } = useUnit();
  const { isAdmin, canManageRecords, currentUser } = useAuth();
  const { 
    searchQuery: advSearchQuery, 
    startDate: advStartDate, 
    endDate: advEndDate, 
    severity: advSeverity, 
    scope: advScope, 
    openAdvancedSearch 
  } = useSearch();
  const { toast } = useToast();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [mrnFilter, setMrnFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [consultantFilter, setConsultantFilter] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isMortalityConfirmOpen, setIsMortalityConfirmOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferringPatient, setTransferringPatient] = useState<Patient | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);
  const [isPrintSummaryModalOpen, setIsPrintSummaryModalOpen] = useState(false);
  const [printPatient, setPrintPatient] = useState<Patient | null>(null);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [qrModalPatient, setQrModalPatient] = useState<Patient | null>(null);

  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [expandedTimelinePatientId, setExpandedTimelinePatientId] = useState<string | null>(null);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [patientToArchive, setPatientToArchive] = useState<Patient | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const prevPatientIdsRef = useRef<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleNewRecord = () => {
      if (canManageRecords) {
        setEditingPatient(null);
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

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
    key: 'serialNo', 
    direction: 'desc' 
  });

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
        
        await activityService.logActivity(
          'MODIFY',
          'Patient Record',
          `Modified clinical record for patient ${patientData.name} (Reg No: ${patientData.regNo})`,
          currentUser?.displayName || currentUser?.email || 'Anonymous User',
          activeUnit
        );
        
        setShowUpdateToast(true);
        setTimeout(() => setShowUpdateToast(false), 3000);
        toast.recordSaved(`Updated record for ${patientData.name} (Reg No: ${patientData.regNo})`);
      } else {
        const newRef = doc(collection(db, 'patients'));
        await setDoc(newRef, {
          id: newRef.id,
          ...patientData
        });
        
        await activityService.logActivity(
          'CREATE',
          'Patient Record',
          `Admitted new patient ${patientData.name} (Reg No: ${patientData.regNo}) to ${activeUnit}`,
          currentUser?.displayName || currentUser?.email || 'Anonymous User',
          activeUnit
        );
        toast.recordSaved(`Admitted patient ${patientData.name} to ${activeUnit}`);
      }
      setIsModalOpen(false);
      setEditingPatient(null);
    } catch (err) {
      console.error("Clinical Sync Failure:", err);
      toast.error('Failed to sync patient record with database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTransfer = async (destUnit: ClinicalUnit, destLocation: string, reason: string) => {
    if (!transferringPatient || !canManageRecords) return;
    setIsSaving(true);
    try {
      const timestamp = new Date().toISOString();
      const currentDisplayName = currentUser?.displayName || currentUser?.email || 'Medical Staff';
      
      const newTransferLog = {
        timestamp,
        fromUnit: transferringPatient.unit,
        toUnit: destUnit,
        fromLocation: transferringPatient.location,
        toLocation: destLocation,
        reason,
        performedBy: currentDisplayName,
      };

      const existingHistory = transferringPatient.transferHistory || [];
      const updatedHistory = [...existingHistory, newTransferLog];

      const patientRef = doc(db, 'patients', transferringPatient.id);
      await updateDoc(patientRef, {
        unit: destUnit,
        location: destLocation,
        transferHistory: updatedHistory
      });

      await activityService.logActivity(
        'MODIFY',
        'Patient Record',
        `Transferred patient ${transferringPatient.name} (Reg No: ${transferringPatient.regNo}) from ${transferringPatient.unit} to ${destUnit} (Reason: ${reason})`,
        currentUser?.displayName || currentUser?.email || 'Anonymous User',
        activeUnit
      );

      setTransferringPatient(null);
      setIsTransferModalOpen(false);
      
      setShowUpdateToast(true);
      setTimeout(() => setShowUpdateToast(false), 3000);
      toast.recordSaved(`Transferred patient ${transferringPatient.name} to ${destUnit}`);
    } catch (err) {
      console.error("Failed to transfer patient:", err);
      toast.error('Transfer failed. Please check network connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportAction = (opts: any) => {
    const reportTitle = `${activeUnit} Clinical Census`;
    const headers = ['S.No', 'Reg No', 'Patient Name', 'Gender', 'Category', 'Triage', 'Code', 'Consultant', 'In-Date', 'Out-Date', 'LOS'];
    const rows = sortedAndFiltered.map(p => [
      p.serialNo, 
      p.regNo, 
      p.name, 
      p.gender,
      p.category, 
      p.triagePriority || 'Stable',
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
    toast.exportComplete(`${opts.format || 'Census'} report generated for ${activeUnit}`);
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
    toast.searchUpdated(`Date range filter set: ${startDateInput} to ${endDateInput}`);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStartDateInput('');
    setEndDateInput('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setConsultantFilter('');
    setMrnFilter('');
    setNameFilter('');
    toast.searchUpdated('All search and filter conditions cleared.');
  };

  const isFilterActive = !!(appliedStartDate || appliedEndDate || consultantFilter || mrnFilter || nameFilter || searchTerm);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advSearchQuery, appliedStartDate, advStartDate, appliedEndDate, advEndDate, advSeverity, consultantFilter, activeUnit, mrnFilter, nameFilter]);

  const sortedAndFiltered = useMemo(() => {
    const combinedQuery = [searchTerm, advSearchQuery].filter(Boolean).join(' ').toLowerCase().trim();
    const tokens = combinedQuery.split(/\s+/).filter(t => t.length > 0);
    
    const effectiveStart = appliedStartDate || advStartDate;
    const effectiveEnd = appliedEndDate || advEndDate;

    const filtered = patients.filter(p => {
      const matchesSearch = tokens.length === 0 || tokens.every(token => {
        return (
          p.name.toLowerCase().includes(token) || 
          p.regNo.toLowerCase().includes(token) ||
          p.consultant.toLowerCase().includes(token) ||
          p.codeStatus.toLowerCase().includes(token) ||
          p.category.toLowerCase().includes(token) ||
          (p.gender && p.gender.toLowerCase().includes(token)) ||
          (p.location && p.location.toLowerCase().includes(token)) ||
          (p.serialNo && p.serialNo.toLowerCase().includes(token)) ||
          (p.status && p.status.toLowerCase().includes(token))
        );
      });
      
      const admissionDate = new Date(p.admissionDate);
      admissionDate.setHours(0, 0, 0, 0);
      
      let matchesStartDate = true;
      if (effectiveStart) {
        const start = new Date(effectiveStart);
        start.setHours(0, 0, 0, 0);
        matchesStartDate = admissionDate >= start;
      }
      
      let matchesEndDate = true;
      if (effectiveEnd) {
        const end = new Date(effectiveEnd);
        end.setHours(0, 0, 0, 0);
        matchesEndDate = admissionDate <= end;
      }

      let matchesSeverity = true;
      if (advSeverity !== 'ALL') {
        if (advSeverity === 'CRITICAL') {
          matchesSeverity = p.triagePriority === 'Critical' || p.codeStatus === 'DNR';
        } else if (advSeverity === 'URGENT') {
          matchesSeverity = p.triagePriority === 'Urgent';
        } else if (advSeverity === 'STABLE') {
          matchesSeverity = p.triagePriority === 'Stable' || p.codeStatus === 'Full Code';
        }
      }

      const matchesConsultant = !consultantFilter || p.consultant === consultantFilter;

      let matchesMrn = true;
      if (mrnFilter.trim()) {
        matchesMrn = p.regNo.toLowerCase().includes(mrnFilter.toLowerCase().trim());
      }

      let matchesName = true;
      if (nameFilter.trim()) {
        matchesName = p.name.toLowerCase().includes(nameFilter.toLowerCase().trim());
      }

      return matchesSearch && matchesStartDate && matchesEndDate && matchesSeverity && matchesConsultant && matchesMrn && matchesName;
    });

    return [...filtered].sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];

      if (sortConfig.key === 'status') {
        aValue = a.dischargeDate ? 'Discharged' : (a.status || 'Active');
        bValue = b.dischargeDate ? 'Discharged' : (b.status || 'Active');
      } else if (sortConfig.key === 'admissionDate' || sortConfig.key === 'dischargeDate') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      } else if (sortConfig.key === 'lengthOfStay') {
        aValue = calculateDynamicLOS(a.admissionDate, a.dischargeDate);
        bValue = calculateDynamicLOS(b.admissionDate, b.dischargeDate);
      } else if (sortConfig.key === 'serialNo') {
        aValue = parseInt((aValue || '0').toString(), 10) || 0;
        bValue = parseInt((bValue || '0').toString(), 10) || 0;
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [patients, searchTerm, advSearchQuery, appliedStartDate, advStartDate, appliedEndDate, advEndDate, advSeverity, sortConfig, consultantFilter, mrnFilter, nameFilter]);

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
      
      await activityService.logActivity(
        'MODIFY',
        'Patient Record',
        `Archived patient ${patientToArchive.name} (Reg No: ${patientToArchive.regNo}) to Mortality Records (Deceased)`,
        currentUser?.displayName || currentUser?.email || 'Anonymous User',
        activeUnit
      );
      
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
            <div className="relative flex-1 max-w-lg" title="Search patients (Alt+S)">
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Search by Patient Name, MR Number, Consultant, or Location..."
                className="pl-10 pr-36 py-2.5 border border-slate-200 rounded-xl w-full text-[11px] font-bold outline-none focus:ring-2 focus:ring-red-100 shadow-sm transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:focus:ring-red-950"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <div className="absolute right-2 top-1.5 flex items-center gap-1.5">
                <VoiceDictationButton 
                  onTranscript={(text) => setSearchTerm(text)}
                  size="sm"
                  lightTheme={true}
                  context="search"
                />
                <button
                  type="button"
                  onClick={openAdvancedSearch}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[9px] font-black text-slate-700 shadow-sm hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                  title="Open Advanced Filter (Alt+S)"
                >
                  <span className="font-sans font-bold text-[10px]">Filter</span>
                  <kbd className="text-[8px] opacity-70 bg-slate-200 dark:bg-slate-700 px-1 rounded">Alt+S</kbd>
                </button>
              </div>
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
            <button 
              type="button"
              onClick={() => setIsQRScannerOpen(true)}
              className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-lg active:scale-95 flex items-center gap-2"
              title="Scan Patient Bedside QR Code using mobile/desktop camera"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan QR</span>
            </button>
          </div>
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-sm active:scale-95"
          >
            Export Records
          </button>
        </div>

        <ActiveFiltersBar />

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
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Consultant:</label>
            <select 
              value={consultantFilter}
              onChange={(e) => setConsultantFilter(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-slate-50 cursor-pointer"
            >
              <option value="">All Specialists</option>
              {CONSULTANTS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={handleApplyDateFilter}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            Fetch Data
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 text-[9px] font-black uppercase tracking-wider shadow-sm">
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Records Fetched: <span className="text-emerald-950 font-black text-[11px] px-1.5 py-0.5 bg-emerald-200/60 rounded ml-0.5">{sortedAndFiltered.length}</span>
          </div>
          {isFilterActive && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
               <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
               <span className="text-[8px] font-black uppercase tracking-widest">Active Filters ({sortedAndFiltered.length} of {patients.length})</span>
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
        <div className="overflow-auto max-h-[600px] whitespace-nowrap scroll-smooth">
          {loading ? (
            <div className="p-4 space-y-3 animate-pulse min-w-[1000px]">
              <div className="h-10 bg-slate-900 rounded-lg w-full flex items-center px-4 justify-between">
                <div className="h-3 w-12 bg-slate-700 rounded" />
                <div className="h-3 w-24 bg-slate-700 rounded" />
                <div className="h-3 w-36 bg-slate-700 rounded" />
                <div className="h-3 w-28 bg-slate-700 rounded" />
                <div className="h-3 w-20 bg-slate-700 rounded" />
                <div className="h-3 w-28 bg-slate-700 rounded" />
              </div>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="h-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg w-full flex items-center px-4 justify-between border border-slate-100 dark:border-slate-800">
                  <div className="h-4 w-10 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-left min-w-[1200px] border-separate border-spacing-0">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 shadow-xs border-b border-slate-200">
                <tr className="text-[10px] font-black uppercase tracking-widest select-none border-b border-slate-200">
                  <th 
                    className={`px-4 py-4 w-16 text-center cursor-pointer transition-all duration-200 group border-b border-slate-200 ${sortConfig.key === 'serialNo' ? 'bg-slate-200 text-red-600' : 'hover:bg-slate-200/80'}`} 
                    onClick={() => handleSort('serialNo')}
                  >
                    <div className="flex items-center justify-center">S.No <SortIndicator column="serialNo" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-32 cursor-pointer transition-all duration-200 group border-b border-slate-200 ${sortConfig.key === 'regNo' ? 'bg-slate-200 text-red-600' : 'hover:bg-slate-200/80'}`} 
                    onClick={() => handleSort('regNo')}
                  >
                    <div className="flex items-center">Reg No <SortIndicator column="regNo" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 cursor-pointer transition-all duration-200 group border-b border-slate-200 ${sortConfig.key === 'name' ? 'bg-slate-200 text-red-600' : 'hover:bg-slate-200/80'}`} 
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">Patient Identity <SortIndicator column="name" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-28 cursor-pointer transition-all duration-200 group border-b border-slate-200 ${sortConfig.key === 'category' ? 'bg-slate-200 text-red-600' : 'hover:bg-slate-200/80'}`} 
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center">Category <SortIndicator column="category" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-24 cursor-pointer transition-all duration-200 group border-b border-slate-200 ${sortConfig.key === 'location' ? 'bg-slate-200 text-red-600' : 'hover:bg-slate-200/80'}`} 
                    onClick={() => handleSort('location')}
                  >
                    <div className="flex items-center">Location <SortIndicator column="location" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-24 text-center cursor-pointer transition-all duration-200 group border-b border-slate-200 ${sortConfig.key === 'codeStatus' ? 'bg-slate-200 text-red-600' : 'hover:bg-slate-200/80'}`} 
                    onClick={() => handleSort('codeStatus')}
                  >
                    <div className="flex items-center justify-center">Code <SortIndicator column="codeStatus" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-40 cursor-pointer transition-all duration-200 group border-b border-slate-200 ${sortConfig.key === 'consultant' ? 'bg-slate-200 text-red-600' : 'hover:bg-slate-200/80'}`} 
                    onClick={() => handleSort('consultant')}
                  >
                    <div className="flex items-center">Consultant <SortIndicator column="consultant" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-32 text-center cursor-pointer transition-all duration-200 group border-b border-slate-200 ${sortConfig.key === 'admissionDate' ? 'bg-slate-200 text-red-600' : 'hover:bg-slate-200/80'}`} 
                    onClick={() => handleSort('admissionDate')}
                    title="Click to sort by Date of Admission"
                  >
                    <div className="flex items-center justify-center">In Date <SortIndicator column="admissionDate" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-32 text-center cursor-pointer transition-all duration-200 group border-b border-slate-200 ${sortConfig.key === 'status' || sortConfig.key === 'dischargeDate' ? 'bg-slate-200 text-red-600' : 'hover:bg-slate-200/80'}`} 
                    onClick={() => handleSort('status')}
                    title="Click to sort by Patient Status"
                  >
                    <div className="flex items-center justify-center">Out Date / Status <SortIndicator column="status" /></div>
                  </th>
                  <th 
                    className={`px-4 py-4 w-24 text-center cursor-pointer transition-all duration-200 group border-b border-slate-200 ${sortConfig.key === 'lengthOfStay' ? 'bg-slate-200 text-red-600' : 'hover:bg-slate-200/80'}`} 
                    onClick={() => handleSort('lengthOfStay')}
                    title="Click to sort by Length of Stay"
                  >
                    <div className="flex items-center justify-center">Stay <SortIndicator column="lengthOfStay" /></div>
                  </th>
                  <th className="px-4 py-4 w-28 text-right bg-slate-100 text-slate-700 border-b border-slate-200">Action</th>
                </tr>
                <tr className="bg-slate-100/90 border-b border-slate-200">
                  <th className="px-2 py-1.5 bg-slate-100 border-b border-slate-200 text-center"></th>
                  <th className="px-3 py-1.5 bg-slate-100 border-b border-slate-200">
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="Search Reg No..."
                        value={mrnFilter}
                        onChange={(e) => setMrnFilter(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[9px] font-extrabold outline-none text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-red-400 transition-all uppercase"
                      />
                      {mrnFilter && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setMrnFilter(''); }}
                          className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-700 text-[9px] font-black cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="px-3 py-1.5 bg-slate-100 border-b border-slate-200">
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="Search Name..."
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-[9px] font-extrabold outline-none text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-red-400 transition-all uppercase"
                      />
                      {nameFilter && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setNameFilter(''); }}
                          className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-700 text-[9px] font-black cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="px-2 py-1.5 bg-slate-100 border-b border-slate-200"></th>
                  <th className="px-2 py-1.5 bg-slate-100 border-b border-slate-200"></th>
                  <th className="px-2 py-1.5 bg-slate-100 border-b border-slate-200"></th>
                  <th className="px-2 py-1.5 bg-slate-100 border-b border-slate-200"></th>
                  <th className="px-2 py-1.5 bg-slate-100 border-b border-slate-200"></th>
                  <th className="px-2 py-1.5 bg-slate-100 border-b border-slate-200"></th>
                  <th className="px-2 py-1.5 bg-slate-100 border-b border-slate-200 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[10px] font-bold text-slate-700 uppercase relative">
                  {paginatedPatients.map((p, idx) => (
                    <React.Fragment key={p.id}>
                      <motion.tr 
                        layout="position"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ 
                          duration: 0.22,
                          delay: Math.min(idx * 0.02, 0.12),
                          ease: "easeOut" 
                        }}
                        className={`transition-all duration-150 group cursor-pointer border-l-4 border-b border-b-slate-100/80 ${
                          expandedTimelinePatientId === p.id
                            ? 'bg-indigo-50/70 border-l-indigo-600 shadow-sm'
                            : newlyAddedId === p.id 
                            ? 'bg-blue-50/80 border-l-blue-500 shadow-sm' 
                            : 'even:bg-slate-50/50 hover:bg-sky-50/80 hover:border-l-red-500 hover:shadow-xs'
                        }`}
                        onClick={() => { setEditingPatient(p); setIsModalOpen(true); }}
                      >
                        <td className="px-4 py-3 text-center text-slate-400 font-mono text-[9px]">{p.serialNo}</td>
                        <td className="px-4 py-3 font-mono text-slate-900 font-bold">{p.regNo}</td>
                        <td className="px-4 py-3">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <p className="text-slate-900 font-extrabold uppercase group-hover:text-red-700 transition-colors">{p.name}</p>
                                </div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{p.gender}</p>
                            </div>
                        </td>
                        <td className="px-4 py-3">
                           <span className="bg-slate-100/90 text-slate-700 px-2.5 py-1 rounded-full text-[9px] font-bold border border-slate-200/80 shadow-2xs">
                             {p.category}
                           </span>
                        </td>
                        <td className="px-4 py-3">
                           <button
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation();
                               setExpandedTimelinePatientId(expandedTimelinePatientId === p.id ? null : p.id);
                             }}
                             className="inline-flex items-center gap-1 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full text-[9px] font-extrabold border border-indigo-100 shadow-2xs transition-all cursor-pointer group/loc"
                             title="Click to view bed placement and transfer timeline"
                           >
                             <span className="w-1 h-1 rounded-full bg-indigo-500"></span>
                             {p.location || 'N/A'}
                             <svg className="w-2.5 h-2.5 text-indigo-500 ml-0.5 group-hover/loc:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                             </svg>
                           </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                           <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black border ${
                             p.codeStatus === 'Full Code' 
                               ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                               : 'bg-rose-50 text-rose-700 border-rose-200'
                           }`}>
                             <span className={`w-1.5 h-1.5 rounded-full ${p.codeStatus === 'Full Code' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                             {p.codeStatus}
                           </span>
                        </td>
                        <td className="px-4 py-3 truncate font-medium text-slate-800">{p.consultant}</td>
                        <td className="px-4 py-3 text-center text-slate-600 font-mono text-[9px] font-bold">{formatDate(p.admissionDate)}</td>
                        <td className="px-4 py-3 text-center">
                          {!p.dischargeDate ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-emerald-100/80 text-emerald-800 border border-emerald-300/80">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                              Active
                            </span>
                          ) : (
                            <span className="font-mono text-slate-500 text-[9px] font-bold">
                              {formatDate(p.dischargeDate)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-extrabold text-red-600 bg-red-50/30 rounded-md">{calculateDynamicLOS(p.admissionDate, p.dischargeDate)}d</td>
                        <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end space-x-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                                {canManageRecords && (
                                    <>
                                        <button onClick={(e) => { e.stopPropagation(); setEditingPatient(p); setIsModalOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95" title="Edit Admission">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setTransferringPatient(p); setIsTransferModalOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all active:scale-95" title="Transfer Patient">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L17.5 12M21 7.5H7.5" /></svg>
                                        </button>
                                    </>
                                )}
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setExpandedTimelinePatientId(expandedTimelinePatientId === p.id ? null : p.id); 
                                  }} 
                                  className={`p-1.5 rounded-lg transition-all active:scale-95 ${
                                    expandedTimelinePatientId === p.id
                                      ? 'bg-indigo-600 text-white shadow-xs'
                                      : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                                  }`} 
                                  title="Toggle Status Timeline"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setQrModalPatient(p); 
                                  }} 
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all active:scale-95" 
                                  title="Generate & View Bedside QR Code"
                                >
                                  <QrCode className="w-4 h-4" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setPrintPatient(p); setIsPrintSummaryModalOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all active:scale-95" title="Print Clinical Summary">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 1.523a1.125 1.125 0 01-1.12 1.227H7.231c-.615 0-1.114-.507-1.12-1.125L6.34 18m11.32 0h-11.32m11.32 0a3 3 0 003-3V9.75a3 3 0 00-3-3h-11.32a3 3 0 00-3 3V15a3 3 0 003 3m11.32-11.25V4.5a2.25 2.25 0 00-2.25-2.25h-6.75a2.25 2.25 0 00-2.25 2.25v2.25m6.75 0h-6.75M8.25 10.5h.008v.008H8.25V10.5zm.375 0a.375 0 11-.75 0 .375 0 01.75 0z" />
                                    </svg>
                                </button>
                                {isAdmin && (
                                    <button onClick={(e) => { e.stopPropagation(); setIdToDelete(p.id); setIsConfirmOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all active:scale-95" title="Purge Record">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                )}
                            </div>
                        </td>
                      </motion.tr>
                      {expandedTimelinePatientId === p.id && (
                        <tr key={`timeline-expanded-${p.id}`} className="bg-slate-100/90 border-b-2 border-indigo-200">
                          <td colSpan={11} className="p-3 sm:p-4">
                            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                <div className="flex items-center space-x-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
                                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                                    Visual Status & Bed Movement Timeline — {p.name} ({p.regNo})
                                  </h4>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setHistoryPatient(p);
                                      setIsHistoryModalOpen(true);
                                    }}
                                    className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-md transition-colors"
                                  >
                                    Modal View
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedTimelinePatientId(null);
                                    }}
                                    className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-800 px-2.5 py-1 rounded-md hover:bg-slate-100 cursor-pointer transition-colors"
                                  >
                                    Close Timeline ✕
                                  </button>
                                </div>
                              </div>
                              <PatientStatusTimeline
                                patient={p}
                                compact={true}
                                onOpenTransferModal={(pat) => {
                                  setTransferringPatient(pat);
                                  setIsTransferModalOpen(true);
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {paginatedPatients.length === 0 && (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <td colSpan={11} className="px-4 py-10 text-center text-slate-400 italic font-medium">No records match your search or date criteria.</td>
                      </motion.tr>
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
        onConfirm={async () => { 
          if (idToDelete) { 
            const pat = patients.find(p => p.id === idToDelete);
            const patName = pat ? pat.name : 'Unknown';
            const patReg = pat ? pat.regNo : 'Unknown';
            await deleteDoc(doc(db, 'patients', idToDelete)); 
            
            await activityService.logActivity(
              'DELETE',
              'Patient Record',
              `Deleted clinical record for patient ${patName} (Reg No: ${patReg})`,
              currentUser?.displayName || currentUser?.email || 'Anonymous User',
              activeUnit
            );
            
            setIdToDelete(null); 
          } 
        }} 
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

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => { setIsTransferModalOpen(false); setTransferringPatient(null); }}
        patient={transferringPatient}
        onTransfer={handleTransfer}
        isSaving={isSaving}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => { setIsHistoryModalOpen(false); setHistoryPatient(null); }}
        patient={historyPatient}
      />

      <PrintSummaryModal
        isOpen={isPrintSummaryModalOpen}
        onClose={() => { setIsPrintSummaryModalOpen(false); setPrintPatient(null); }}
        patient={printPatient}
      />

      <PatientQRCodeModal
        isOpen={!!qrModalPatient}
        onClose={() => setQrModalPatient(null)}
        patient={qrModalPatient}
        type="patient"
      />

      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        patients={patients}
        onSelectPatient={(patient) => {
          setEditingPatient(patient);
          setIsModalOpen(true);
        }}
      />
    </div>
  );
};

export default PatientTable;
