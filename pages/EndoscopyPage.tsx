import React, { useState, useMemo, useEffect, useRef } from 'react';
// @ts-ignore
import { collection, onSnapshot, setDoc, doc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db, storage } from '../services/firebaseConfig';
// @ts-ignore
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { EndoscopyRecord, Patient, PatientStatus } from '../types';
import { exportEndoscopyPDF, exportSingleEndoscopyReportPDF, generateKidneyCentreLogoBase64 } from '../services/pdfService';
import { useAuth } from '../contexts/AuthContext';
import { useUnit } from '../contexts/UnitContext';
import { useSearch } from '../contexts/SearchContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useToast } from '../contexts/ToastContext';
import { activityService } from '../services/activityService';
import { ENDOSCOPY_DOCTORS, ENDOSCOPY_PROCEDURES, UNIT_DETAILS, CONSULTANTS, CATEGORIES, CODE_STATUSES, TRIAGE_PRIORITIES, formatProcedureDisplay } from '../constants';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import ExportModal from '../components/ExportModal';
import ImageCropperModal from '../components/ImageCropperModal';
import { motion, AnimatePresence } from 'motion/react';
import { VoiceDictationButton } from '../components/VoiceDictationButton';
import { EndoscopyReportPreviewSheet } from '../components/EndoscopyReportPreviewSheet';
import WhatsAppDispatchModal, { COUNTRY_CODES, sanitizeLocalNumber } from '../components/WhatsAppDispatchModal';
import { ActiveFiltersBar } from '../components/ActiveFiltersBar';
import { EndoscopyAnalyticsDashboard } from '../components/EndoscopyAnalyticsDashboard';
import { GastroScopeIcon } from '../components/GastroScopeIcon';

type SortKey = keyof EndoscopyRecord;
type SortDirection = 'asc' | 'desc';

interface EndoscopyPageProps {
  initialWorkspaceOpen?: boolean;
  onExit?: () => void;
  onNewReportClick?: () => void;
}

const getSuggestionsForProcedure = (proc: string) => {
  const p = (proc || '').toLowerCase();
  if (p.includes('colon') || p.includes('lower') || p.includes('sigmo')) {
    return [
      "Cecum", "Ileocecal Valve", "Ascending Colon", "Transverse Colon", 
      "Descending Colon", "Sigmoid Colon", "Rectum", "Normal Mucosa", 
      "Colonic Polyp", "Internal Hemorrhoids", "Diverticula", "Active Bleeding"
    ];
  } else if (p.includes('bronch') || p.includes('lung') || p.includes('airway')) {
    return [
      "Vocal Cords", "Laryngeal Inlet", "Trachea", "Main Carina", 
      "Right Bronchial Tree", "Left Bronchial Tree", "Normal Mucosa", 
      "Mucosal Congestion", "Active Bleeding", "Thick Secretions"
    ];
  } else {
    // Default Gastroscopy / EGD
    return [
      "Esophagus", "GE Junction", "Z-line", "Fundus", "Gastric Body", 
      "Antrum", "Pylorus", "Duodenal Bulb", "Duodenum (D2)", "Normal Mucosa", 
      "Gastric Ulcer", "Varices", "Gastritis", "Active Bleeding"
    ];
  }
};

const isImageTitleInvalid = (title: string) => {
  const t = (title || '').trim();
  if (!t) return true;
  const defaultPattern = /^Image \d+ \(.+\)$/i;
  return defaultPattern.test(t);
};

const EndoscopyPage: React.FC<EndoscopyPageProps> = ({ 
  initialWorkspaceOpen = false, 
  onExit,
  onNewReportClick 
}) => {
  const { activeUnit } = useUnit();
  const { currentUser, isAdmin, canManageRecords } = useAuth();
  const confirm = useConfirm();
  const [records, setRecords] = useState<EndoscopyRecord[]>([]);

  // New states for patient selection/admission modal before creating report
  const [isPatientSelectorOpen, setIsPatientSelectorOpen] = useState(false);
  const [activePatients, setActivePatients] = useState<Patient[]>([]);
  const [selectorSearch, setSelectorSearch] = useState('');
  const [isSelectorQuickAdmission, setIsSelectorQuickAdmission] = useState(false);

  // Quick admission form state in Patient selector modal
  const [admName, setAdmName] = useState('');
  const [admRegNo, setAdmRegNo] = useState('');
  const [admGender, setAdmGender] = useState('Male');
  const [admCategory, setAdmCategory] = useState<any>('Medicine');
  const [admLocation, setAdmLocation] = useState('');
  const [admCodeStatus, setAdmCodeStatus] = useState<any>('Full Code');
  const [admTriage, setAdmTriage] = useState<any>('Stable');
  const [admConsultant, setAdmConsultant] = useState('');
  const [admDate, setAdmDate] = useState(new Date().toISOString().split('T')[0]);
  const [admIsSaving, setAdmIsSaving] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'patients'),
      where('unit', '==', activeUnit)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const patientData = snapshot.docs
        .map((d: any) => ({ id: d.id, ...d.data() })) as Patient[];
      setActivePatients(patientData);
    }, (error) => {
      console.error("Firebase Patients Sync Error inside Endoscopy:", error);
    });

    return () => unsubscribe();
  }, [activeUnit]);

  const handleSelectActivePatient = (patient: Patient) => {
    setFormRegNo(patient.regNo || '');
    setFormName(patient.name || '');
    setFormGender(patient.gender || 'Male');
    setFormDoctor(patient.consultant || '');
    setProcedureSearch('');
    setFormProcedure('');
    
    setIsPatientSelectorOpen(false);
    setEditingRecord(null);
    setIsWorkspaceOpen(true);
  };

  const handleQuickAdmitPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admName || !admRegNo || !admConsultant || !admLocation) {
      alert("Please fill in all required fields.");
      return;
    }
    setAdmIsSaving(true);
    try {
      const nums = activePatients.map(p => parseInt(p.serialNo || '0', 10)).filter(n => !isNaN(n));
      const max = nums.length === 0 ? 0 : Math.max(...nums);
      const newSerialNo = (max + 1).toString().padStart(3, '0');

      const newPatientData: Omit<Patient, 'id'> = {
        unit: activeUnit,
        serialNo: newSerialNo,
        regNo: admRegNo.toUpperCase(),
        name: admName.toUpperCase(),
        gender: admGender,
        admissionDate: admDate,
        category: admCategory,
        location: admLocation,
        codeStatus: admCodeStatus,
        triagePriority: admTriage,
        consultant: admConsultant,
        status: PatientStatus.ACTIVE,
        lengthOfStay: 0,
        transferHistory: []
      };

      const newRef = doc(collection(db, 'patients'));
      await setDoc(newRef, {
        id: newRef.id,
        ...newPatientData
      });

      // Clear the quick admission fields
      setAdmName('');
      setAdmRegNo('');
      setAdmGender('Male');
      setAdmCategory('Medicine');
      setAdmLocation('');
      setAdmCodeStatus('Full Code');
      setAdmTriage('Stable');
      setAdmConsultant('');
      setAdmDate(new Date().toISOString().split('T')[0]);

      // Automatically prefill and open Endoscopy Form with this new patient!
      setFormRegNo(newPatientData.regNo);
      setFormName(newPatientData.name);
      setFormGender(newPatientData.gender);
      setFormDoctor(newPatientData.consultant);
      setProcedureSearch('');
      setFormProcedure('');

      setIsSelectorQuickAdmission(false);
      setIsPatientSelectorOpen(false);
      setEditingRecord(null);
      setIsWorkspaceOpen(true);
    } catch (err) {
      console.error("Clinical Sync Failure:", err);
    } finally {
      setAdmIsSaving(false);
    }
  };

  const {
    searchQuery: advSearchQuery,
    startDate: advStartDate,
    endDate: advEndDate,
    severity: advSeverity,
    openAdvancedSearch
  } = useSearch();

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Input states (unapplied)
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  
  // Applied states (the actual filters)
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(initialWorkspaceOpen);
  const [mainTab, setMainTab] = useState<'analytics' | 'logs'>('analytics');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
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
        setIsWorkspaceOpen(true);
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
  const [formSerialNo, setFormSerialNo] = useState('');

  const [formDoctor, setFormDoctor] = useState('');
  const [formProcedure, setFormProcedure] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState(new Date().toTimeString().split(' ')[0].substring(0, 5));
  
  // New report form states
  const [formAge, setFormAge] = useState('');
  const [formGender, setFormGender] = useState('Male');
  const [formDob, setFormDob] = useState('');
  const [formReferringPhysician, setFormReferringPhysician] = useState('');
  const [formIndications, setFormIndications] = useState('');
  const [formInstruments, setFormInstruments] = useState('');
  const [formMedications, setFormMedications] = useState('');
  const [formVisualization, setFormVisualization] = useState('Clear / Excellent');
  const [formTolerance, setFormTolerance] = useState('Well Tolerated');
  const [formComplications, setFormComplications] = useState('None');
  const [formLimitations, setFormLimitations] = useState('None');
  const [formProcedureTechnique, setFormProcedureTechnique] = useState('');
  const [formFindings, setFormFindings] = useState('');
  const [formEsophagusFindings, setFormEsophagusFindings] = useState('');
  const [formStomachFindings, setFormStomachFindings] = useState('');
  const [formAntrumFindings, setFormAntrumFindings] = useState('');
  const [formDuodenumFindings, setFormDuodenumFindings] = useState('');
  const [formDuodenum2ndPartFindings, setFormDuodenum2ndPartFindings] = useState('');
  const [formColonFindings, setFormColonFindings] = useState('');
  const [formRectumFindings, setFormRectumFindings] = useState('');
  const [formSigmoidColonFindings, setFormSigmoidColonFindings] = useState('');
  const [formTransverseColonFindings, setFormTransverseColonFindings] = useState('');
  const [formDescendingColonFindings, setFormDescendingColonFindings] = useState('');
  const [formAscendingColonFindings, setFormAscendingColonFindings] = useState('');
  const [formCaecumFindings, setFormCaecumFindings] = useState('');
  const [formDiagnosis, setFormDiagnosis] = useState('');
  const [formRecommendations, setFormRecommendations] = useState('');
  const [formIcdCodes, setFormIcdCodes] = useState('');
  const [formCptCodes, setFormCptCodes] = useState('');
  const [formWhatsappCountryCode, setFormWhatsappCountryCode] = useState('+92');
  const [formWhatsappCustomCode, setFormWhatsappCustomCode] = useState('+');
  const [formWhatsappLocalNumber, setFormWhatsappLocalNumber] = useState('');

  const setWhatsappFromFullString = (fullNum: string) => {
    if (!fullNum) {
      setFormWhatsappCountryCode('+92');
      setFormWhatsappCustomCode('+');
      setFormWhatsappLocalNumber('');
      return;
    }
    const matched = COUNTRY_CODES.find(c => c.code !== 'custom' && fullNum.startsWith(c.code));
    if (matched) {
      setFormWhatsappCountryCode(matched.code);
      const local = fullNum.substring(matched.code.length);
      setFormWhatsappLocalNumber(sanitizeLocalNumber(local, matched.code));
    } else if (fullNum.startsWith('+')) {
      setFormWhatsappCountryCode('custom');
      const match = fullNum.match(/^(\+\d{1,4})(.*)$/);
      if (match) {
        setFormWhatsappCustomCode(match[1]);
        setFormWhatsappLocalNumber(sanitizeLocalNumber(match[2], match[1]));
      } else {
        setFormWhatsappCustomCode('+');
        setFormWhatsappLocalNumber(sanitizeLocalNumber(fullNum, '+92'));
      }
    } else {
      setFormWhatsappCountryCode('+92');
      setFormWhatsappLocalNumber(sanitizeLocalNumber(fullNum, '+92'));
    }
  };

  const activeWhatsappPrefix = formWhatsappCountryCode === 'custom' ? formWhatsappCustomCode : formWhatsappCountryCode;
  const sanitizedFormLocalNumber = sanitizeLocalNumber(formWhatsappLocalNumber, activeWhatsappPrefix);
  const formWhatsappNumber = sanitizedFormLocalNumber ? `${activeWhatsappPrefix}${sanitizedFormLocalNumber}` : '';
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedDispatchRecord, setSelectedDispatchRecord] = useState<EndoscopyRecord | null>(null);
  const [formImages, setFormImages] = useState<{ id: string; url: string; title: string }[]>([]);
  const [imageToCrop, setImageToCrop] = useState<{ id?: string; base64: string; title: string } | null>(null);
  const [cropQueue, setCropQueue] = useState<{ base64: string; title: string }[]>([]);
  const [imageBase64Cache, setImageBase64Cache] = useState<Record<string, string>>({});

  // When cropQueue changes and no image is currently being cropped, open the next one
  useEffect(() => {
    if (!imageToCrop && cropQueue.length > 0) {
      const next = cropQueue[0];
      setCropQueue(prev => prev.slice(1));
      setImageToCrop({ base64: next.base64, title: next.title });
    }
  }, [cropQueue, imageToCrop]);

  const [activeFormTab, setActiveFormTab] = useState<'demographics' | 'narrative'>('demographics');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [draftToRestore, setDraftToRestore] = useState<any | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCompactView, setIsCompactView] = useState(false);

  const isBronchoscopy = formProcedure.toLowerCase().includes('bronchoscopy') || formProcedure.toLowerCase().includes('bronch');
  const isColonoscopy = formProcedure.toLowerCase().includes('colonoscopy') || formProcedure.toLowerCase().includes('colon') || formProcedure.toLowerCase().includes('sigmoidoscopy') || formProcedure.toLowerCase().includes('sigmoid');

  interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    title?: string;
    action?: {
      label: string;
      onClick: () => void;
    };
    duration?: number;
  }

  const { toast: globalToast } = useToast();

  const showToast = (
    message: string, 
    type: 'success' | 'error' | 'info' | 'warning' = 'success', 
    title?: string,
    action?: { label: string; onClick: () => void },
    duration: number = 4000
  ) => {
    if (type === 'success') {
      globalToast.success(message, title, action, duration);
    } else if (type === 'error') {
      globalToast.error(message, title, action, duration);
    } else if (type === 'warning') {
      globalToast.warning(message, title, action, duration);
    } else {
      globalToast.info(message, title, action, duration);
    }
  };

  const renderToastContainer = () => null;

  // Global error listener to help debug crashes instantly
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("Global Error Captured:", event.error);
      const msg = event.error?.message || event.message || "Unknown rendering exception";
      showToast(`Interface Error: ${msg}`, "error");
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      // Ignore benign or expected background rejections (e.g., Vite HMR websocket, user cancellation)
      const msg = event.reason?.message || String(event.reason) || "";
      if (!msg || msg.includes('vite') || msg.includes('websocket') || msg.includes('aborted') || msg.includes('canceled')) {
        return;
      }
      console.warn("Unhandled Rejection Captured:", event.reason);
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Warning on accidental page exit/refresh if there are unsaved findings
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasContent = !!(
        formName || formRegNo || formDoctor || formProcedure || 
        formFindings || formEsophagusFindings || formStomachFindings || formAntrumFindings || 
        formDuodenumFindings || formDuodenum2ndPartFindings || formColonFindings || formDiagnosis || 
        formIndications || formRecommendations ||
        formRectumFindings || formSigmoidColonFindings || formTransverseColonFindings ||
        formDescendingColonFindings || formAscendingColonFindings || formCaecumFindings
      );
      if (isWorkspaceOpen && hasContent) {
        e.preventDefault();
        e.returnValue = 'You have unsaved endoscopy report findings. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [
    isWorkspaceOpen, formName, formRegNo, formDoctor, formProcedure,
    formFindings, formEsophagusFindings, formStomachFindings, formAntrumFindings,
    formDuodenumFindings, formDuodenum2ndPartFindings, formColonFindings, formDiagnosis,
    formIndications, formRecommendations,
    formRectumFindings, formSigmoidColonFindings, formTransverseColonFindings,
    formDescendingColonFindings, formAscendingColonFindings, formCaecumFindings
  ]);

  const loadDraft = () => {
    if (!draftToRestore) return;
    setFormName(draftToRestore.name || '');
    setFormRegNo(draftToRestore.regNo || '');
    setFormDoctor(draftToRestore.doctor || '');
    setFormProcedure(draftToRestore.procedure || '');
    setProcedureSearch(draftToRestore.procedure || '');
    setFormDate(draftToRestore.date || new Date().toISOString().split('T')[0]);
    setFormTime(draftToRestore.time || new Date().toTimeString().split(' ')[0].substring(0, 5));
    setFormAge(draftToRestore.age || '');
    setFormGender(draftToRestore.gender || 'Male');
    setFormDob(draftToRestore.dob || '');
    setFormReferringPhysician(draftToRestore.referringPhysician || '');
    setFormIndications(draftToRestore.indications || '');
    setFormInstruments(draftToRestore.instruments || '');
    setFormMedications(draftToRestore.medications || '');
    setFormVisualization(draftToRestore.visualization || 'Clear / Excellent');
    setFormTolerance(draftToRestore.tolerance || 'Well Tolerated');
    setFormComplications(draftToRestore.complications || 'None');
    setFormLimitations(draftToRestore.limitations || 'None');
    setFormProcedureTechnique(draftToRestore.procedureTechnique || '');
    setFormFindings(draftToRestore.findings || '');
    setFormEsophagusFindings(draftToRestore.esophagusFindings || '');
    setFormStomachFindings(draftToRestore.stomachFindings || '');
    setFormAntrumFindings(draftToRestore.antrumFindings || '');
    setFormDuodenumFindings(draftToRestore.duodenumFindings || '');
    setFormDuodenum2ndPartFindings(draftToRestore.duodenum2ndPartFindings || '');
    setFormColonFindings(draftToRestore.colonFindings || '');
    setFormRectumFindings(draftToRestore.rectumFindings || '');
    setFormSigmoidColonFindings(draftToRestore.sigmoidColonFindings || '');
    setFormTransverseColonFindings(draftToRestore.transverseColonFindings || '');
    setFormDescendingColonFindings(draftToRestore.descendingColonFindings || '');
    setFormAscendingColonFindings(draftToRestore.ascendingColonFindings || '');
    setFormCaecumFindings(draftToRestore.caecumFindings || '');
    setFormDiagnosis(draftToRestore.diagnosis || '');
    setFormRecommendations(draftToRestore.recommendations || '');
    setFormIcdCodes(draftToRestore.icdCodes || '');
    setFormCptCodes(draftToRestore.cptCodes || '');
    setWhatsappFromFullString(draftToRestore.whatsappNumber || '');
    setFormImages(draftToRestore.images || []);
    setActiveTemplateId(draftToRestore.activeTemplateId || null);
    setDraftToRestore(null);
  };

  const discardDraft = () => {
    localStorage.removeItem(`hdu_draft_endoscopy_${activeUnit}`);
    setDraftToRestore(null);
  };

  const resetForm = () => {
    if (editingRecord) {
      localStorage.removeItem(`hdu_draft_endoscopy_${activeUnit}_edit_${editingRecord.id}`);
    }
    localStorage.removeItem(`hdu_draft_endoscopy_${activeUnit}`);
    setFormName('');
    setFormRegNo('');
    setWhatsappFromFullString('');
    setFormDoctor('');
    setFormProcedure('');
    setProcedureSearch('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormTime(new Date().toTimeString().split(' ')[0].substring(0, 5));
    setFormAge('');
    setFormGender('Male');
    setFormDob('');
    setFormReferringPhysician('');
    setFormIndications('');
    setFormInstruments('');
    setFormMedications('');
    setFormVisualization('Clear / Excellent');
    setFormTolerance('Well Tolerated');
    setFormComplications('None');
    setFormLimitations('None');
    setFormProcedureTechnique('');
    setFormFindings('');
    setFormEsophagusFindings('');
    setFormStomachFindings('');
    setFormAntrumFindings('');
    setFormDuodenumFindings('');
    setFormDuodenum2ndPartFindings('');
    setFormColonFindings('');
    setFormRectumFindings('');
    setFormSigmoidColonFindings('');
    setFormTransverseColonFindings('');
    setFormDescendingColonFindings('');
    setFormAscendingColonFindings('');
    setFormCaecumFindings('');
    setFormDiagnosis('');
    setFormRecommendations('');
    setFormIcdCodes('');
    setFormCptCodes('');
    setFormImages([]);
    setActiveTemplateId(null);
    setEditingRecord(null);
    setShowValidationErrors(false);
  };

  const [procedureSearch, setProcedureSearch] = useState('');
  const [isProcedureListOpen, setIsProcedureListOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const procedureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    
    // Load local storage backup for immediate display or fallback
    const localDataKey = `hdu_local_endoscopy_records_${activeUnit}`;
    const localData = localStorage.getItem(localDataKey);
    let localRecords: EndoscopyRecord[] = [];
    if (localData) {
      try {
        localRecords = JSON.parse(localData);
      } catch (e) {
        console.error("Failed to parse local endoscopy records backup:", e);
      }
    }

    const q = query(
      collection(db, 'endoscopy_records'),
      where('referringUnit', '==', activeUnit)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const dbData = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as EndoscopyRecord[];
      
      // Load current local storage data dynamically to avoid stale closure references
      const freshLocalData = localStorage.getItem(localDataKey);
      let freshLocalRecords: EndoscopyRecord[] = [];
      if (freshLocalData) {
        try {
          freshLocalRecords = JSON.parse(freshLocalData);
        } catch (e) {
          console.error("Failed to parse dynamic local endoscopy records backup:", e);
        }
      }

      // Merge Firestore records with local backup, preferring Firestore data on collision
      const merged = [...dbData];
      freshLocalRecords.forEach((localRec) => {
        if (!merged.some(r => r.id === localRec.id)) {
          merged.push(localRec);
        }
      });

      const currentIds = new Set(merged.map(r => r.id));
      if (prevIdsRef.current.size > 0) {
        const newlyCreated = merged.find(r => !prevIdsRef.current.has(r.id));
        if (newlyCreated) {
          setNewlyAddedId(newlyCreated.id);
          setTimeout(() => setNewlyAddedId(null), 3000);
        }
      }
      prevIdsRef.current = currentIds;
      setRecords(merged);
      setLoading(false);
    }, (error) => {
      console.warn("Firestore subscription failed, falling back to local storage:", error);
      setRecords(localRecords);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeUnit]);

  const [templateSuccessMsg, setTemplateSuccessMsg] = useState('');

  const applyMasterTemplate = (type: string) => {
    let procedureName = '';
    let esophagusText = '';
    let stomachText = '';
    let antrumText = '';
    let duodenumText = '';
    let duodenumBulbText = '';
    let duodenum2ndPartText = '';
    let colonText = '';
    let rectumText = '';
    let sigmoidColonText = '';
    let transverseColonText = '';
    let descendingColonText = '';
    let ascendingColonText = '';
    let caecumText = '';
    let generalFindings = '';
    let diagnosisText = '';
    let recommendationsText = '';
    let icd = '';
    let cpt = '';
    let indicationsText = '';
    let instrumentsText = '';
    let name = '';

    if (type === 'normal_egd') {
      name = 'Normal EGD (Upper Endoscopy)';
      procedureName = "Esophagogastroduodenoscopy (EGD)";
      indicationsText = "Epigastric pain, dyspepsia, screening.";
      esophagusText = "Normal esophageal mucosa. Z-line is distinct and at normal level (~40cm). No varices, ulceration, stricture, or masses seen.";
      stomachText = "Normal gastric mucosa with regular rugal folds. Body and fundus clear.";
      antrumText = "Normal gastric antrum. Pylorus is patent and easily traversed. No ulcerations, erosions, or masses noted.";
      duodenumBulbText = "Duodenal bulb visualized. Mucosa is normal throughout. No active bleeding, ulceration, or duodenitis seen.";
      duodenum2ndPartText = "Second part of duodenum (D2) visualized. Mucosa is normal with regular villous patterns. No ulcerations, erosions, or masses noted.";
      colonText = "";
      generalFindings = "The upper gastrointestinal endoscopy was uncomplicated. Normal esophagus, stomach, and duodenum.";
      diagnosisText = "Normal Upper Gastrointestinal Endoscopy (EGD)";
      recommendationsText = "No immediate intervention required. Follow-up as clinically indicated.";
      icd = "Z01.89";
      cpt = "43235";
      instrumentsText = "Olympus GIF-H190";
    } else if (type === 'varices_egd') {
      name = 'EGD - Bleeding Esophageal Varices';
      procedureName = "Esophagogastroduodenoscopy (EGD)";
      indicationsText = "Hematemesis, melena, screening for portal hypertension.";
      esophagusText = "Grade III esophageal varices noted in lower third of esophagus with active oozing and positive red color signs (whip-like markings). Band ligation successfully performed.";
      stomachText = "Congestive portal hypertensive gastropathy in body and fundus.";
      antrumText = "Normal gastric antrum. Pylorus is patent.";
      duodenumBulbText = "Normal duodenal bulb mucosa. No active ulcers seen.";
      duodenum2ndPartText = "Normal second part of duodenum (D2) mucosa.";
      colonText = "";
      generalFindings = "EGD showed severe esophageal varices with signs of recent/active hemorrhage. Successful endoscopic band ligation (EBL) performed with 4 bands applied.";
      diagnosisText = "Bleeding Esophageal Varices (Grade III), Portal Hypertensive Gastropathy";
      recommendationsText = "Admit to ICU/HDU for close monitoring. IV Octreotide infusion, monitor hematocrit, repeat endoscopy in 24-48 hours if bleeding recurs. Start beta-blockers when hemodynamically stable.";
      icd = "I85.01, K76.6";
      cpt = "43244";
      instrumentsText = "Olympus GIF-1TH190";
    } else if (type === 'ulcer_egd') {
      name = 'EGD - Gastric Ulcer';
      procedureName = "Esophagogastroduodenoscopy (EGD)";
      indicationsText = "Epigastric burning pain, positive H. pylori stool antigen.";
      esophagusText = "Normal esophageal mucosa. Z-line distinct.";
      stomachText = "Normal gastric mucosa with regular rugal folds. Body and fundus clear.";
      antrumText = "A clean-based, punched-out ulcer of approximately 8mm size noted on the lesser curvature of the gastric antrum. No active bleeding (Forrest Class III). Biopsies obtained from ulcer margin to rule out malignancy.";
      duodenumBulbText = "Normal duodenal bulb.";
      duodenum2ndPartText = "Normal second part of duodenum (D2).";
      colonText = "";
      generalFindings = "EGD revealed a single, moderate-sized benign-appearing gastric antral ulcer. Biopsies performed.";
      diagnosisText = "Antral Gastric Ulcer (Forrest Class III)";
      recommendationsText = "Follow-up on biopsy results. Initiate Omeprazole 40mg PO daily for 8 weeks. Avoid NSAIDs. Helicobacter pylori eradication therapy if biopsy confirmed positive. Repeat EGD in 8 weeks to confirm ulcer healing.";
      icd = "K25.9";
      cpt = "43239";
      instrumentsText = "Olympus GIF-H190";
    } else if (type === 'duodenal_ulcer_egd') {
      name = 'EGD - Duodenal Ulcer';
      procedureName = "Esophagogastroduodenoscopy (EGD)";
      indicationsText = "Melena, epigastric pain radiating to the back.";
      esophagusText = "Normal esophageal mucosa. No varices.";
      stomachText = "Normal gastric mucosa. Mild antral erythema.";
      antrumText = "Normal gastric antrum. Pylorus is patent.";
      duodenumBulbText = "An active 10mm ulcer noted on the anterior wall of the duodenal bulb. The ulcer has an adherent clot (Forrest Class IIb). No active spurting. Clot left undisturbed. Biopsy taken for H. pylori.";
      duodenum2ndPartText = "Normal second part of duodenum (D2) mucosa.";
      colonText = "";
      generalFindings = "EGD showed an active duodenal bulb ulcer with an adherent clot (Forrest Class IIb).";
      diagnosisText = "Duodenal Bulb Ulcer (Forrest Class IIb), Mild Antral Gastritis";
      recommendationsText = "Admit to HDU. High-dose IV PPI bolus and continuous infusion (Omeprazole 80mg bolus then 8mg/hr). NPO for 24 hours. Monitor hemoglobin. H. pylori eradication therapy if confirmed.";
      icd = "K26.4";
      cpt = "43239";
      instrumentsText = "Olympus GIF-H190";
    } else if (type === 'reflux_egd') {
      name = 'EGD - Severe Reflux Esophagitis';
      procedureName = "Esophagogastroduodenoscopy (EGD)";
      indicationsText = "Chronic severe heartburn, regurgitation, dysphagia.";
      esophagusText = "Severe distal esophagitis with mucosal breaks confluent around the entire circumference of the lower esophagus (Los Angeles Class D). A mild, easily traversable peptic stricture noted at 38cm. Z-line is irregular and obscured. Biopsies obtained from distal esophagus to rule out Barrett's esophagus and malignancy.";
      stomachText = "Normal stomach. Moderate bile reflux noted in the gastric pool.";
      antrumText = "Normal antrum. Pylorus is patent.";
      duodenumBulbText = "Normal duodenal bulb.";
      duodenum2ndPartText = "Normal second part of duodenum (D2).";
      colonText = "";
      generalFindings = "EGD showed severe circumferential distal reflux esophagitis (LA Class D) with a mild peptic stricture. Biopsies performed.";
      diagnosisText = "Severe Reflux Esophagitis (LA Class D), Mild Peptic Stricture";
      recommendationsText = "Omeprazole 40mg PO twice daily. Elevate head of bed, avoid meals 3 hours before sleep, avoid carbonated drinks and caffeine. Follow up on biopsy for Barrett's esophagus. Consider esophageal dilatation if dysphagia worsens.";
      icd = "K21.01, K22.2";
      cpt = "43239";
      instrumentsText = "Olympus GIF-HQ190";
    } else if (type === 'candidiasis_egd') {
      name = 'EGD - Esophageal Candidiasis';
      procedureName = "Esophagogastroduodenoscopy (EGD)";
      indicationsText = "Odynophagia, dysphagia in immunocompromised patient.";
      esophagusText = "Multiple, diffuse, raised white plaques/exudates noted along the entire length of the esophagus. The plaques are adherent but can be scraped off, leaving a friable, erythematous mucosa underneath (Kodsi Grade III severity). Biopsies and brushings obtained.";
      stomachText = "Normal gastric mucosa. Clear pool of secretions.";
      antrumText = "Normal antrum and pylorus.";
      duodenumBulbText = "Normal duodenal bulb.";
      duodenum2ndPartText = "Normal second part of duodenum (D2) mucosa.";
      colonText = "";
      generalFindings = "EGD showed severe esophageal candidiasis (Kodsi Grade III). Biopsies and brushings performed.";
      diagnosisText = "Esophageal Candidiasis (Kodsi Grade III)";
      recommendationsText = "Start oral Fluconazole 200mg daily for 14-21 days. Follow up on biopsy and brush cytology. Review immunosuppressive regimen.";
      icd = "B37.81";
      cpt = "43239";
      instrumentsText = "Olympus GIF-H190";
    } else if (type === 'normal_colonoscopy') {
      name = 'Normal Colonoscopy';
      procedureName = "Colonoscopy";
      indicationsText = "Routine screening colonoscopy, family history of colorectal cancer.";
      esophagusText = "N/A (Lower Gastrointestinal Endoscopy)";
      stomachText = "N/A (Lower Gastrointestinal Endoscopy)";
      duodenumText = "N/A (Lower Gastrointestinal Endoscopy)";
      colonText = "The colon was successfully visualized up to the cecum under good bowel preparation (Boston Bowel Prep Score 9). Colonic mucosa is normal throughout with regular mucosal vascular patterns. Terminal ileum was intubated and found normal. No polyps, inflammation, ulcers, or diverticula identified.";
      rectumText = "Normal Mucosa";
      sigmoidColonText = "Normal Mucosa";
      transverseColonText = "Normal Mucosa";
      descendingColonText = "Normal Mucosa";
      ascendingColonText = "Normal Mucosa";
      caecumText = "Normal Mucosa";
      generalFindings = "Uncomplicated complete colonoscopy. Clear preparation and normal mucosa.";
      diagnosisText = "Normal Colonoscopy";
      recommendationsText = "Routine colonoscopy screening repeat in 10 years or as clinically indicated.";
      icd = "Z12.11";
      cpt = "45378";
      instrumentsText = "Olympus CF-H190L";
    } else if (type === 'divertic_colonoscopy') {
      name = 'Colonoscopy - Diverticulosis';
      procedureName = "Colonoscopy";
      indicationsText = "Chronic constipation, lower abdominal pain.";
      esophagusText = "N/A (Lower Gastrointestinal Endoscopy)";
      stomachText = "N/A (Lower Gastrointestinal Endoscopy)";
      duodenumText = "N/A (Lower Gastrointestinal Endoscopy)";
      colonText = "The colon was visualized up to the cecum. Multiple wide-mouthed diverticula noted in the sigmoid and descending colon without signs of active inflammation, bleeding, or purulent discharge. On retroflexion in the rectum, congested, non-bleeding internal hemorrhoids were noted.";
      rectumText = "On retroflexion, congested, non-bleeding internal hemorrhoids were noted.";
      sigmoidColonText = "Multiple wide-mouthed diverticula noted without signs of active inflammation or bleeding.";
      transverseColonText = "Normal mucosa, patent lumen.";
      descendingColonText = "Multiple wide-mouthed diverticula noted without signs of active inflammation, bleeding, or purulent discharge.";
      ascendingColonText = "Normal mucosa.";
      caecumText = "Cecum visualized, normal mucosa.";
      generalFindings = "Colonoscopy revealed uncomplicated diverticulosis of the left colon and moderate internal hemorrhoids.";
      diagnosisText = "Left-sided Colonic Diverticulosis, Internal Hemorrhoids";
      recommendationsText = "High-fiber diet, adequate hydration, avoid constipation. Stool softeners as needed. Seek urgent care if severe abdominal pain, fever, or hematochezia occurs.";
      icd = "K57.30, I84.2";
      cpt = "45378";
      instrumentsText = "Olympus CF-HQ190L";
    } else if (type === 'polypectomy_colonoscopy') {
      name = 'Colonoscopy - Polypectomy';
      procedureName = "Colonoscopy";
      indicationsText = "Positive fecal occult blood test (FOBT), screening.";
      esophagusText = "N/A (Lower Gastrointestinal Endoscopy)";
      stomachText = "N/A (Lower Gastrointestinal Endoscopy)";
      duodenumText = "N/A (Lower Gastrointestinal Endoscopy)";
      colonText = "Successful complete colonoscopy to the cecum. A single, 12mm pedunculated polyp was identified in the transverse colon. Polypectomy was successfully performed using a hot snare with electrocautery (Coagulation mode). The polyp was retrieved using a Roth net for histopathology. No post-polypectomy bleeding or perforation. A 5mm sessile polyp was also noted in the sigmoid colon and removed via cold forceps biopsy. Good bowel preparation.";
      rectumText = "Normal rectal mucosa. Retroflexion showed no abnormalities.";
      sigmoidColonText = "5mm sessile polyp, completely removed via cold forceps biopsy.";
      transverseColonText = "12mm pedunculated polyp, completely removed via hot snare polypectomy and retrieved.";
      descendingColonText = "Normal mucosa.";
      ascendingColonText = "Normal mucosa.";
      caecumText = "Cecum reached, patent appendiceal orifice, normal ileocecal valve.";
      generalFindings = "Complete colonoscopy with successful hot snare polypectomy of a 12mm transverse colon polyp and cold biopsy polypectomy of a 5mm sigmoid colon polyp. No complications.";
      diagnosisText = "Transverse Colon Polyp, Sigmoid Colon Polyp. Status Post Polypectomy.";
      recommendationsText = "Await histopathology results of the retrieved polyps. Resume regular diet. Avoid heavy lifting or strenuous activity for 48 hours. Clinical follow-up in 1 week. Surveillance colonoscopy interval to be determined by histopathology.";
      icd = "K63.5, Z86.010";
      cpt = "45385";
      instrumentsText = "Olympus CF-H190L";
    } else if (type === 'colitis_colonoscopy') {
      name = 'Colonoscopy - Active Colitis (UC)';
      procedureName = "Colonoscopy";
      indicationsText = "Chronic bloody diarrhea, tenesmus, elevated fecal calprotectin.";
      esophagusText = "N/A (Lower Gastrointestinal Endoscopy)";
      stomachText = "N/A (Lower Gastrointestinal Endoscopy)";
      duodenumText = "N/A (Lower Gastrointestinal Endoscopy)";
      colonText = "The colonoscope was advanced to the cecum. The mucosa of the rectum, sigmoid colon, and descending colon showed continuous, diffuse erythema, loss of normal vascular pattern, granular texture, and severe friability with contact bleeding and multiple small superficial ulcerations covered with mucopurulent exudate (Mayo Endoscopic Score 2/3, consistent with Ulcerative Colitis). The proximal colon (transverse, ascending, and cecum) showed normal mucosa with normal vascular patterns. Multiple biopsies taken from affected and unaffected areas.";
      rectumText = "Continuous, diffuse mucosal erythema, granular mucosa with contact bleeding.";
      sigmoidColonText = "Continuous mucosal erythema, loss of vascular pattern, friable mucosa.";
      transverseColonText = "Normal mucosa with regular vascular pattern.";
      descendingColonText = "Diffuse granularity, friability, contact bleeding, superficial ulcerations.";
      ascendingColonText = "Normal mucosa.";
      caecumText = "Normal mucosa.";
      generalFindings = "Colonoscopy revealed active left-sided colitis with continuous mucosal inflammation, granularity, friability, and superficial ulceration from rectum up to the splenic flexure. Findings highly suggestive of Ulcerative Colitis.";
      diagnosisText = "Active Left-Sided Colitis (Mayo Grade 2), consistent with Ulcerative Colitis.";
      recommendationsText = "Start oral Mesalamine (5-ASA) 4.8g daily and Mesalamine rectal suppositories/enema 1g nightly. Await biopsy histopathology results to confirm diagnosis and rule out CMV. Check routine inflammatory markers and monitor stool frequency.";
      icd = "K51.912";
      cpt = "45380";
      instrumentsText = "Olympus CF-H190L";
    } else if (type === 'normal_sigmoidoscopy') {
      name = 'Normal Flexible Sigmoidoscopy';
      procedureName = "Flexible Sigmoidoscopy";
      indicationsText = "Routine screening, mild hematochezia, surveillance.";
      esophagusText = "N/A (Lower Gastrointestinal Endoscopy)";
      stomachText = "N/A (Lower Gastrointestinal Endoscopy)";
      duodenumText = "N/A (Lower Gastrointestinal Endoscopy)";
      colonText = "Flexible sigmoidoscope advanced under direct visualization to the distal descending colon (~60cm from anal verge). Adequate bowel preparation. Mucosa of the rectum and sigmoid colon appears normal with smooth surface and preserved vascular pattern. No inflammation, polyps, ulcers, strictures, or vascular malformations noted.";
      rectumText = "Normal rectal mucosa. Preserved vascular network. Anorectal junction intact.";
      sigmoidColonText = "Normal sigmoid colon mucosa. Patent lumen, regular haustral folds.";
      descendingColonText = "Visualized up to distal descending colon (~60cm). Normal mucosa.";
      transverseColonText = "N/A (Exam limited to Rectum & Sigmoid Colon)";
      ascendingColonText = "N/A (Exam limited to Rectum & Sigmoid Colon)";
      caecumText = "N/A (Exam limited to Rectum & Sigmoid Colon)";
      generalFindings = "Uncomplicated flexible sigmoidoscopy to 60cm. Normal rectal and sigmoid colonic mucosa.";
      diagnosisText = "Normal Flexible Sigmoidoscopy (to 60cm)";
      recommendationsText = "No active endoscopic intervention required. Routine follow-up as clinically indicated.";
      icd = "Z12.12";
      cpt = "45330";
      instrumentsText = "Olympus OSF-3 / CF-HQ190L";
    } else if (type === 'proctitis_sigmoidoscopy') {
      name = 'Sigmoidoscopy - Active Proctosigmoiditis';
      procedureName = "Flexible Sigmoidoscopy";
      indicationsText = "Fresh rectal bleeding, tenesmus, increased stool frequency, mucus discharge.";
      esophagusText = "N/A (Lower Gastrointestinal Endoscopy)";
      stomachText = "N/A (Lower Gastrointestinal Endoscopy)";
      duodenumText = "N/A (Lower Gastrointestinal Endoscopy)";
      colonText = "Flexible sigmoidoscope inserted up to 50cm into the mid-sigmoid colon. The mucosa from the anorectal junction through the rectum and distal sigmoid colon demonstrates continuous diffuse erythema, loss of normal vascular pattern, granular texture, friability with contact bleeding, and superficial erosions (Mayo Score 2). Proximal mucosa at 50-60cm transitions to normal mucosa. Cold forcep biopsies obtained.";
      rectumText = "Diffuse erythema, loss of vascular pattern, granular mucosa with contact bleeding.";
      sigmoidColonText = "Erythematous, friable mucosa with superficial erosions transitioning to normal at 50cm.";
      descendingColonText = "Visualized distal descending colon shows normal mucosa.";
      transverseColonText = "N/A (Exam limited to Rectum & Sigmoid Colon)";
      ascendingColonText = "N/A (Exam limited to Rectum & Sigmoid Colon)";
      caecumText = "N/A (Exam limited to Rectum & Sigmoid Colon)";
      generalFindings = "Flexible sigmoidoscopy showed active proctosigmoiditis extending from rectum to mid-sigmoid colon (Mayo Grade 2). Biopsies performed.";
      diagnosisText = "Active Proctosigmoiditis (Mayo Grade 2), consistent with Ulcerative Proctosigmoiditis.";
      recommendationsText = "Await biopsy results. Initiate 5-ASA (Mesalamine) rectal suppository/enema 1g nightly and oral Mesalamine 2.4g daily. Follow up in gastroenterology clinic.";
      icd = "K51.20";
      cpt = "45331";
      instrumentsText = "Olympus OSF-3 / CF-HQ190L";
    } else if (type === 'polyp_sigmoidoscopy') {
      name = 'Sigmoidoscopy - Sigmoid Polyp & Hemorrhoids';
      procedureName = "Flexible Sigmoidoscopy";
      indicationsText = "Intermittent painless bright red blood per rectum (BRBPR).";
      esophagusText = "N/A (Lower Gastrointestinal Endoscopy)";
      stomachText = "N/A (Lower Gastrointestinal Endoscopy)";
      duodenumText = "N/A (Lower Gastrointestinal Endoscopy)";
      colonText = "Flexible sigmoidoscope advanced to 60cm. A 6mm sessile polyp was identified in the mid-sigmoid colon at 35cm from anal verge. Complete cold snare polypectomy was performed and specimen retrieved with net for histopathology. No post-polypectomy bleeding or perforation. Retroflexion in the rectum revealed prominent, non-bleeding Grade II internal hemorrhoids.";
      rectumText = "Normal rectal mucosa. Retroflexion demonstrates Grade II internal hemorrhoids.";
      sigmoidColonText = "6mm sessile polyp at 35cm, completely resected via cold snare polypectomy.";
      descendingColonText = "Normal mucosa visualized up to distal descending colon.";
      transverseColonText = "N/A (Exam limited to Rectum & Sigmoid Colon)";
      ascendingColonText = "N/A (Exam limited to Rectum & Sigmoid Colon)";
      caecumText = "N/A (Exam limited to Rectum & Sigmoid Colon)";
      generalFindings = "Flexible sigmoidoscopy to 60cm. Successful cold snare polypectomy of 6mm sigmoid polyp. Grade II internal hemorrhoids.";
      diagnosisText = "Sigmoid Colon Polyp (S/P Cold Snare Polypectomy), Grade II Internal Hemorrhoids.";
      recommendationsText = "Await histopathology of retrieved polyp. High fiber diet and stool softeners for hemorrhoids. Schedule full screening colonoscopy if histology reveals adenoma.";
      icd = "K63.5, I84.2";
      cpt = "45338";
      instrumentsText = "Olympus OSF-3 / CF-HQ190L";
    } else if (type === 'normal_bronchoscopy') {
      name = 'Normal Flexible Bronchoscopy';
      procedureName = "Flexible Bronchoscopy";
      indicationsText = "Unexplained cough, fever of unknown origin in immunocompromised patient, clearance of secretions.";
      esophagusText = "Normal vocal cords with preserved bilateral mobility. Laryngeal anatomy is intact and normal. No mass or erythema.";
      stomachText = "Trachea is patent without stenosis, compression, or tracheomalacia. Tracheal rings are well-defined. Main Carina is sharp, mobile, and normal.";
      duodenumText = "Left and right bronchial trees visualized up to subsegmental levels. Mucosa is normal. No endobronchial lesions, active bleeding, or purulent secretions noted.";
      colonText = "Bronchoalveolar lavage (BAL) performed in Right Middle Lobe (RML) for microbiology and cytology. Sent for analysis.";
      generalFindings = "Uncomplicated flexible bronchoscopy. Normal laryngeal, tracheal, and bronchial anatomy.";
      diagnosisText = "Normal Flexible Bronchoscopy. BAL obtained.";
      recommendationsText = "Await BAL culture and cytology results. Resume diet when gag reflex returns. Follow-up as clinically indicated.";
      icd = "Z11.59, R05";
      cpt = "31624";
      instrumentsText = "Olympus BF-H190";
    } else if (type === 'hemorrhage_bronchoscopy') {
      name = 'Flexible Bronchoscopy - Hemorrhage & BAL';
      procedureName = "Flexible Bronchoscopy";
      indicationsText = "Hemoptysis, diffuse alveolar infiltrates on chest CT, suspected Diffuse Alveolar Hemorrhage (DAH).";
      esophagusText = "Normal laryngeal mucosa, vocal cords are mobile.";
      stomachText = "Trachea is normal. Carina is mildly congested but sharp.";
      duodenumText = "Bilateral bronchial trees show diffuse mucosal erythema and active bloody secretions originating from the Right Lower Lobe (RLL). No obstructing mass or foreign body seen.";
      colonText = "Serial Bronchoalveolar lavage (BAL) performed in RLL showing progressive bloodier return across three sequential aliquots, confirming diffuse alveolar hemorrhage.";
      generalFindings = "Flexible bronchoscopy showed diffuse mucosal erythema with active bleeding in RLL and progressive bloodier return on serial BAL.";
      diagnosisText = "Diffuse Alveolar Hemorrhage (suspected), Mucosal Erythema.";
      recommendationsText = "Admit/continue HDU monitoring. Await BAL cultures, cytology, and autoimmune panel. Hold anticoagulation. Methylprednisolone therapy as clinically indicated.";
      icd = "R04.8, J94.8";
      cpt = "31624";
      instrumentsText = "Olympus BF-1TH190";
    } else if (type === 'mass_bronchoscopy') {
      name = 'Flexible Bronchoscopy - Obstructing Mass & Biopsy';
      procedureName = "Flexible Bronchoscopy";
      indicationsText = "Persistent right upper lobe atelectasis on chest X-ray, weight loss, chronic cough in a heavy smoker.";
      esophagusText = "Normal larynx. Vocal cords are normal with symmetric respiratory movement.";
      stomachText = "Trachea is patent. Main carina is widened and fixed, suggesting subcarinal adenopathy.";
      duodenumText = "The left bronchial tree is completely clear and normal to the subsegmental level. In the right bronchial tree, there is an exophytic, irregular, friable, highly vascular mass partially obstructing (~80% luminal occlusion) the orifice of the Right Upper Lobe (RUL) bronchus. Endobronchial forcep biopsies (4 pieces) and bronchial brushings were performed. Mild post-biopsy bleeding controlled with local instillation of 1:20,000 cold adrenaline.";
      colonText = "Bronchial washings were obtained from the right upper lobe for cytology and microbiology (acid-fast bacilli, cultures).";
      generalFindings = "Flexible bronchoscopy revealed an exophytic, partially obstructing mass at the right upper lobe bronchus orifice. Successful endobronchial biopsy, brushings, and washings performed with adequate hemostasis.";
      diagnosisText = "Right Upper Lobe Bronchus Mass, partial luminal obstruction, widened main carina.";
      recommendationsText = "Await histopathology, cytology, and brush results. Monitor for post-procedure hemoptysis or respiratory distress. Obtain chest CT with contrast if not already done. Referral to thoracic oncology/surgery pending pathology.";
      icd = "C34.11, R91.8";
      cpt = "31625";
      instrumentsText = "Olympus BF-1TH190";
    }

    if (procedureName) {
      setFormProcedure(procedureName);
      setProcedureSearch(procedureName);
      setFormIndications(indicationsText);
      setFormEsophagusFindings(esophagusText);
      setFormStomachFindings(stomachText);
      setFormAntrumFindings(antrumText);
      setFormDuodenumFindings(duodenumBulbText || duodenumText);
      setFormDuodenum2ndPartFindings(duodenum2ndPartText);
      setFormColonFindings(colonText);
      setFormRectumFindings(rectumText);
      setFormSigmoidColonFindings(sigmoidColonText);
      setFormTransverseColonFindings(transverseColonText);
      setFormDescendingColonFindings(descendingColonText);
      setFormAscendingColonFindings(ascendingColonText);
      setFormCaecumFindings(caecumText);
      setFormFindings(generalFindings);
      setFormDiagnosis(diagnosisText);
      setFormRecommendations(recommendationsText);
      setFormIcdCodes(icd);
      setFormCptCodes(cpt);
      setFormInstruments(instrumentsText);
      setActiveTemplateId(type);

      setTemplateSuccessMsg(`"${name}" template applied successfully!`);
      setTimeout(() => {
        setTemplateSuccessMsg('');
      }, 4000);
    }
  };

  const autoSerialNo = useMemo(() => {
    const unitRecords = records.filter(r => r.referringUnit === activeUnit);
    if (unitRecords.length === 0) return '001';
    const nums = unitRecords.map(r => parseInt(r.serialNo || '0', 10)).filter(n => !isNaN(n));
    if (nums.length === 0) return '001';
    const max = Math.max(...nums);
    return (max + 1).toString().padStart(3, '0');
  }, [records, activeUnit]);

  const duplicateSerialNumbers = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach(r => {
      if (r.referringUnit === activeUnit && r.serialNo) {
        const key = r.serialNo.trim().padStart(3, '0');
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return new Set(Object.keys(counts).filter(k => counts[k] > 1));
  }, [records, activeUnit]);

  useEffect(() => {
    if (editingRecord) {
      const editDraftKey = `hdu_draft_endoscopy_${activeUnit}_edit_${editingRecord.id}`;
      const savedEditDraft = localStorage.getItem(editDraftKey);
      let draft: any = null;
      if (savedEditDraft) {
        try {
          draft = JSON.parse(savedEditDraft);
        } catch (e) {
          console.error("Failed to parse endoscopy edit draft", e);
        }
      }

      setFormName(draft?.name ?? editingRecord.name);
      setFormRegNo(draft?.regNo ?? editingRecord.regNo);
      setFormDoctor(draft?.doctor ?? editingRecord.doctor);
      setFormProcedure(draft?.procedure ?? editingRecord.procedure);
      setProcedureSearch(draft?.procedure ?? editingRecord.procedure);
      setFormDate(draft?.date ?? editingRecord.date);
      setFormTime(draft?.time ?? (editingRecord.time || ''));
      setFormAge(draft?.age ?? (editingRecord.age || ''));
      setFormGender(draft?.gender ?? (editingRecord.gender || 'Male'));
      setFormDob(draft?.dob ?? (editingRecord.dob || ''));
      setFormReferringPhysician(draft?.referringPhysician ?? (editingRecord.referringPhysician || ''));
      setFormIndications(draft?.indications ?? (editingRecord.indications || ''));
      setFormInstruments(draft?.instruments ?? (editingRecord.instruments || ''));
      setFormMedications(draft?.medications ?? (editingRecord.medications || ''));
      setFormVisualization(draft?.visualization ?? (editingRecord.visualization || 'Clear / Excellent'));
      setFormTolerance(draft?.tolerance ?? (editingRecord.tolerance || 'Well Tolerated'));
      setFormComplications(draft?.complications ?? (editingRecord.complications || 'None'));
      setFormLimitations(draft?.limitations ?? (editingRecord.limitations || 'None'));
      setFormProcedureTechnique(draft?.procedureTechnique ?? (editingRecord.procedureTechnique || ''));
      setFormFindings(draft?.findings ?? (editingRecord.findings || ''));
      setFormEsophagusFindings(draft?.esophagusFindings ?? (editingRecord.esophagusFindings || ''));
      setFormStomachFindings(draft?.stomachFindings ?? (editingRecord.stomachFindings || ''));
      setFormAntrumFindings(draft?.antrumFindings ?? (editingRecord.antrumFindings || ''));
      setFormDuodenumFindings(draft?.duodenumFindings ?? (editingRecord.duodenumFindings || ''));
      setFormDuodenum2ndPartFindings(draft?.duodenum2ndPartFindings ?? (editingRecord.duodenum2ndPartFindings || ''));
      setFormColonFindings(draft?.colonFindings ?? (editingRecord.colonFindings || ''));
      setFormRectumFindings(draft?.rectumFindings ?? (editingRecord.rectumFindings || ''));
      setFormSigmoidColonFindings(draft?.sigmoidColonFindings ?? (editingRecord.sigmoidColonFindings || ''));
      setFormTransverseColonFindings(draft?.transverseColonFindings ?? (editingRecord.transverseColonFindings || ''));
      setFormDescendingColonFindings(draft?.descendingColonFindings ?? (editingRecord.descendingColonFindings || ''));
      setFormAscendingColonFindings(draft?.ascendingColonFindings ?? (editingRecord.ascendingColonFindings || ''));
      setFormCaecumFindings(draft?.caecumFindings ?? (editingRecord.caecumFindings || ''));
      setFormDiagnosis(draft?.diagnosis ?? (editingRecord.diagnosis || ''));
      setFormRecommendations(draft?.recommendations ?? (editingRecord.recommendations || ''));
      setFormIcdCodes(draft?.icdCodes ?? (editingRecord.icdCodes || ''));
      setFormCptCodes(draft?.cptCodes ?? (editingRecord.cptCodes || ''));
      setFormImages(draft?.images ?? (editingRecord.images || []));
      setFormSerialNo(draft?.serialNo ?? editingRecord.serialNo);
      setActiveTemplateId(draft?.activeTemplateId ?? null);
      setActiveFormTab('demographics');
    } else {
      // For a new record, reset form fields to empty first
      setFormName('');
      setFormRegNo('');
      setFormSerialNo('');
      setFormDoctor('');
      setFormProcedure('');
      setProcedureSearch('');
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormTime(new Date().toTimeString().split(' ')[0].substring(0, 5));
      setFormAge('');
      setFormGender('Male');
      setFormDob('');
      setFormReferringPhysician('');
      setFormIndications('');
      setFormInstruments('');
      setFormMedications('');
      setFormVisualization('Clear / Excellent');
      setFormTolerance('Well Tolerated');
      setFormComplications('None');
      setFormLimitations('None');
      setFormProcedureTechnique('');
      setFormFindings('');
      setFormEsophagusFindings('');
      setFormStomachFindings('');
      setFormAntrumFindings('');
      setFormDuodenumFindings('');
      setFormDuodenum2ndPartFindings('');
      setFormColonFindings('');
      setFormDiagnosis('');
      setFormRecommendations('');
      setFormIcdCodes('');
      setFormCptCodes('');
      setFormImages([]);
      setActiveTemplateId(null);
      setActiveFormTab('demographics');

      // Check if we have a draft in LocalStorage for new endoscopy records
      const savedDraft = localStorage.getItem(`hdu_draft_endoscopy_${activeUnit}`);
      if (savedDraft && isWorkspaceOpen) {
        try {
          const draft = JSON.parse(savedDraft);
          // Check if there is actual content in the draft before offering to restore
          if (draft.name || draft.regNo || draft.procedure || draft.findings || draft.diagnosis) {
            setDraftToRestore(draft);
          }
        } catch (e) {
          console.error("Failed to parse endoscopy draft", e);
        }
      }
    }
  }, [editingRecord, isWorkspaceOpen, activeUnit]);

  // Auto-save fields to LocalStorage for endoscopy record draft (new or edit) with debounce
  useEffect(() => {
    if (!isWorkspaceOpen) return;

    const hasContent = !!(
      formName || formRegNo || formDoctor || formProcedure || 
      formFindings || formEsophagusFindings || formStomachFindings || formAntrumFindings || 
      formDuodenumFindings || formDuodenum2ndPartFindings || formColonFindings || formDiagnosis || 
      formIndications || formRecommendations || formProcedureTechnique ||
      formMedications || formInstruments ||
      formRectumFindings || formSigmoidColonFindings || formTransverseColonFindings ||
      formDescendingColonFindings || formAscendingColonFindings || formCaecumFindings
    );

    // If we're not editing and there's no content, don't trigger auto-save (avoids saving empty states)
    if (!editingRecord && !hasContent) {
      return;
    }

    setIsDraftSaving(true);

    const timer = setTimeout(() => {
      try {
        const data = {
          name: formName,
          regNo: formRegNo,
          doctor: formDoctor,
          procedure: formatProcedureDisplay(formProcedure),
          date: formDate,
          time: formTime,
          age: formAge,
          gender: formGender,
          dob: formDob,
          referringPhysician: formReferringPhysician,
          indications: formIndications,
          instruments: formInstruments,
          medications: formMedications,
          visualization: formVisualization,
          tolerance: formTolerance,
          complications: formComplications,
          limitations: formLimitations,
          procedureTechnique: formProcedureTechnique,
          findings: formFindings,
          esophagusFindings: formEsophagusFindings,
          stomachFindings: formStomachFindings,
          antrumFindings: formAntrumFindings,
          duodenumFindings: formDuodenumFindings,
          duodenum2ndPartFindings: formDuodenum2ndPartFindings,
          colonFindings: formColonFindings,
          rectumFindings: formRectumFindings,
          sigmoidColonFindings: formSigmoidColonFindings,
          transverseColonFindings: formTransverseColonFindings,
          descendingColonFindings: formDescendingColonFindings,
          ascendingColonFindings: formAscendingColonFindings,
          caecumFindings: formCaecumFindings,
          diagnosis: formDiagnosis,
          recommendations: formRecommendations,
          icdCodes: formIcdCodes,
          cptCodes: formCptCodes,
          images: formImages,
          activeTemplateId: activeTemplateId
        };

        if (editingRecord) {
          localStorage.setItem(`hdu_draft_endoscopy_${activeUnit}_edit_${editingRecord.id}`, JSON.stringify(data));
        } else {
          localStorage.setItem(`hdu_draft_endoscopy_${activeUnit}`, JSON.stringify(data));
        }
        
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (err) {
        console.error("Failed to auto-save endoscopy draft:", err);
      } finally {
        setIsDraftSaving(false);
      }
    }, 1000); // 1000ms debounce

    return () => clearTimeout(timer);
  }, [
    formName, formRegNo, formDoctor, formProcedure, formDate, formTime, formAge, formGender, formDob, 
    formReferringPhysician, formIndications, formInstruments, formMedications, formVisualization, 
    formTolerance, formComplications, formLimitations, formProcedureTechnique, 
    formFindings, formEsophagusFindings, formStomachFindings, formAntrumFindings, formDuodenumFindings, formDuodenum2ndPartFindings, formColonFindings,
    formRectumFindings, formSigmoidColonFindings, formTransverseColonFindings,
    formDescendingColonFindings, formAscendingColonFindings, formCaecumFindings,
    formDiagnosis, formRecommendations, formIcdCodes, formCptCodes, formImages, editingRecord, 
    isWorkspaceOpen, activeUnit, activeTemplateId
  ]);

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
    
    // Get year, month, day of today in local time
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    const localToday = new Date(todayYear, todayMonth, todayDay);
    
    // Parse formDate (YYYY-MM-DD) as local time
    const [year, month, day] = formDate.split('-').map(Number);
    const localSelectedDate = new Date(year, month - 1, day);
    
    return localSelectedDate > localToday;
  }, [formDate]);

  const isFormValid = useMemo(() => {
    return Boolean(formName.trim() && formRegNo.trim() && formDoctor && formProcedure && formDate && !isDateInFuture);
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
    const combinedQuery = [searchTerm, advSearchQuery].filter(Boolean).join(' ').toLowerCase().trim();
    const effectiveStart = appliedStartDate || advStartDate;
    const effectiveEnd = appliedEndDate || advEndDate;

    const filtered = records.filter(r => {
      const matchesSearch = !combinedQuery || 
        r.name.toLowerCase().includes(combinedQuery) || 
        r.regNo.toLowerCase().includes(combinedQuery) ||
        r.doctor.toLowerCase().includes(combinedQuery) ||
        r.procedure.toLowerCase().includes(combinedQuery) ||
        (r.findings && r.findings.toLowerCase().includes(combinedQuery)) ||
        (r.diagnosis && r.diagnosis.toLowerCase().includes(combinedQuery));
      
      const recordDate = r.date; 
      const isAfterStart = !effectiveStart || recordDate >= effectiveStart;
      const isBeforeEnd = !effectiveEnd || recordDate <= effectiveEnd;

      let matchesSeverity = true;
      if (advSeverity !== 'ALL') {
        const text = `${r.findings || ''} ${r.diagnosis || ''} ${r.complications || ''} ${r.indications || ''}`.toLowerCase();
        if (advSeverity === 'CRITICAL') {
          matchesSeverity = text.includes('bleed') || text.includes('severe') || text.includes('complication') || text.includes('emergency') || text.includes('perforation');
        } else if (advSeverity === 'URGENT') {
          matchesSeverity = text.includes('urgent') || text.includes('biopsy') || text.includes('polyp') || text.includes('ulcer');
        } else if (advSeverity === 'STABLE') {
          matchesSeverity = !text.includes('bleed') && !text.includes('severe') && !text.includes('emergency');
        }
      }

      return matchesSearch && isAfterStart && isBeforeEnd && matchesSeverity;
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
  }, [records, activeUnit, searchTerm, advSearchQuery, appliedStartDate, advStartDate, appliedEndDate, advEndDate, advSeverity, sortConfig]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, advSearchQuery, appliedStartDate, advStartDate, appliedEndDate, advEndDate, advSeverity, activeUnit]);

  const totalPages = Math.ceil(sortedAndFiltered.length / itemsPerPage);
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAndFiltered.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAndFiltered, currentPage, itemsPerPage]);

  const procedureSuggestions = useMemo(() => {
    return ENDOSCOPY_PROCEDURES.filter(p => 
      p.toLowerCase().includes(procedureSearch.toLowerCase())
    );
  }, [procedureSearch]);

  const selectProcedure = (p: string) => {
    setFormProcedure(p);
    setProcedureSearch(p);
    setIsProcedureListOpen(false);
    setHighlightedIndex(-1);
    // Move focus to the next field (Procedure Date)
    setTimeout(() => {
      const nextField = document.getElementById('endoscopy-field-date');
      if (nextField) nextField.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isProcedureListOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsProcedureListOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % procedureSuggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + procedureSuggestions.length) % procedureSuggestions.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < procedureSuggestions.length) {
          selectProcedure(procedureSuggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsProcedureListOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        setIsProcedureListOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleProcedureSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProcedureSearch(e.target.value);
    setFormProcedure(e.target.value);
    setHighlightedIndex(-1);
  };

  const handlePrintReport = async (rec?: EndoscopyRecord) => {
    const recordToPrint: EndoscopyRecord = rec || {
      id: editingRecord?.id || 'TEMP_ID',
      referringUnit: activeUnit,
      serialNo: formSerialNo.trim() || (editingRecord?.serialNo || autoSerialNo),
      regNo: formRegNo,
      name: formName,
      doctor: formDoctor,
      procedure: formatProcedureDisplay(formProcedure),
      date: formDate,
      time: formTime,
      age: formAge,
      gender: formGender,
      dob: formDob,
      referringPhysician: formReferringPhysician,
      indications: formIndications,
      instruments: formInstruments,
      medications: formMedications,
      visualization: formVisualization,
      tolerance: formTolerance,
      complications: formComplications,
      limitations: formLimitations,
      procedureTechnique: formProcedureTechnique,
      findings: formFindings,
      esophagusFindings: formEsophagusFindings,
      stomachFindings: formStomachFindings,
      antrumFindings: formAntrumFindings,
      duodenumFindings: formDuodenumFindings,
      duodenum2ndPartFindings: formDuodenum2ndPartFindings,
      colonFindings: formColonFindings,
      diagnosis: formDiagnosis,
      recommendations: formRecommendations,
      icdCodes: formIcdCodes,
      cptCodes: formCptCodes,
      images: formImages
    };
    const currentDisplayName = currentUser?.displayName || currentUser?.email || 'Attending Physician';
    await exportSingleEndoscopyReportPDF(recordToPrint, currentDisplayName, isCompactView);
  };

  const compressImage = (base64Str: string, maxWidth = 500, maxHeight = 375): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      const timeoutId = setTimeout(() => {
        console.warn("compressImage timed out, resolving with original base64Str");
        resolve(base64Str);
      }, 3000);

      img.onload = () => {
        clearTimeout(timeoutId);
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.65));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => {
        clearTimeout(timeoutId);
        resolve(base64Str);
      };
      img.src = base64Str;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    showToast(`Reading ${files.length} file(s)...`, "info");
    
    const pending: { base64: string; title: string }[] = [];
    const currentCount = (formImages || []).length + (cropQueue || []).length;
    
    for (const file of files) {
      if (currentCount + pending.length >= 4) {
        showToast("Maximum 4 clinical images can be attached per report.", "warning");
        break;
      }
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error("File result is not a string"));
            }
          };
          reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });
        pending.push({ base64, title: file.name });
      } catch (err) {
        console.error("Failed to read image file", err);
        showToast(`Failed to read file ${file.name}: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    }
    
    if (pending.length > 0) {
      showToast("Opening crop editor tool...", "info");
      setCropQueue(prev => [...prev, ...pending]);
    }
    e.target.value = '';
  };

  const handleSaveCroppedImage = async (croppedBase64: string, title: string, id?: string) => {
    setUploadingImage(true);
    try {
      // Compress image using JPEG compression at 0.70 quality to preserve endoscopy diagnostic details
      const compressed = await compressImage(croppedBase64, 800, 600);
      
      const imageId = id || Math.random().toString(36).substr(2, 9);
      let finalUrl = compressed;

      try {
        // Upload compressed image to Firebase Storage with a 2.5 second timeout to prevent hanging
        let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
        const uploadPromise = (async () => {
          const fileName = `endoscopy_images/${Date.now()}_${imageId}.jpg`;
          // @ts-ignore
          const storageRef = ref(storage, fileName);
          // @ts-ignore
          await uploadString(storageRef, compressed, 'data_url');
          // @ts-ignore
          return await getDownloadURL(storageRef);
        })();

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutTimer = setTimeout(() => reject(new Error("Firebase Storage upload timed out")), 2500);
        });
        timeoutPromise.catch(() => {});

        try {
          finalUrl = await Promise.race([uploadPromise, timeoutPromise]);
        } finally {
          if (timeoutTimer) clearTimeout(timeoutTimer);
        }
      } catch (storageErr) {
        console.warn("Firebase Storage upload failed or timed out, using local compressed base64 instead:", storageErr);
      }

      if (id) {
        // Existing image updated
        setFormImages(prev => prev.map(img => img.id === id ? { ...img, url: finalUrl, title } : img));
        setImageBase64Cache(prev => ({ ...prev, [id]: croppedBase64 }));
        showToast("Clinical image updated with new crop.", "success");
      } else {
        // New image added
        setFormImages(prev => {
          const titleToUse = title.replace(/\.[^/.]+$/, ""); // strip extension
          return [...prev, {
            id: imageId,
            url: finalUrl,
            title: `Image ${prev.length + 1} (${titleToUse})`
          }];
        });
        setImageBase64Cache(prev => ({ ...prev, [imageId]: croppedBase64 }));
        showToast("Clinical image successfully cropped and added.", "success");
      }
    } catch (err) {
      console.error("Failed to process cropped image", err);
      showToast("Failed to process cropped image: " + (err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpdateImageTitle = (id: string, newTitle: string) => {
    setFormImages(prev => prev.map(img => img.id === id ? { ...img, title: newTitle } : img));
  };

  const handleDeleteImage = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Remove Captured Image",
      message: "Are you sure you want to remove this image from the endoscopy report?",
      confirmLabel: "Yes, Remove",
      cancelLabel: "Cancel",
      variant: "danger"
    });
    if (isConfirmed) {
      setFormImages(prev => prev.filter(img => img.id !== id));
    }
  };

  const handleFormValidationFailure = () => {
    setShowValidationErrors(true);
    
    const errors: string[] = [];
    if (!formRegNo.trim()) {
      errors.push("MR Number");
    }
    
    if (!formName.trim()) {
      errors.push("Patient Name");
    }
    
    if (!formDate) {
      errors.push("Procedure Date");
    } else if (isDateInFuture) {
      errors.push("Date cannot be in future");
    }
    
    if (!formProcedure) {
      errors.push("Procedure Performed");
    }
    
    if (!formDoctor) {
      errors.push("Performing Endoscopist");
    }

    if (errors.length > 0) {
      setActiveFormTab('demographics');
      
      const missingList = errors.join(', ');
      showToast(
        `Please complete the following required fields: ${missingList}`,
        'warning',
        'Incomplete Form Details'
      );
    }
  };

  const handleSubmit = async (e?: React.FormEvent, shouldPrint = false) => {
    if (e) e.preventDefault();
    if (!isFormValid) {
      handleFormValidationFailure();
      return;
    }

    const hasInvalidImageTitles = formImages.some(img => isImageTitleInvalid(img.title));
    if (hasInvalidImageTitles) {
      setShowValidationErrors(true);
      setActiveFormTab('narrative');
      showToast(
        "Bhai clinical image ka name (label) zaroor daalein ya niche suggestion se select karein! Default template name save nahi kiya ja sakta.",
        "warning",
        "Image Name Required"
      );
      return;
    }

    if (isSaving) return;
    setIsSaving(true);
    try {
      const recordRef = editingRecord ? doc(db, 'endoscopy_records', editingRecord.id) : doc(collection(db, 'endoscopy_records'));
      
      // Dynamic S.No calculation to prevent duplicate collisions on concurrent entries
      let finalSerialNo = formSerialNo.trim();
      if (!finalSerialNo) {
        if (editingRecord) {
          finalSerialNo = editingRecord.serialNo;
        } else {
          // Dynamic calculation of the latest unique S.No on the fly
          const unitRecords = records.filter(r => r.referringUnit === activeUnit);
          const nums = unitRecords.map(r => parseInt(r.serialNo || '0')).filter(n => !isNaN(n));
          const max = nums.length > 0 ? Math.max(...nums) : 0;
          finalSerialNo = (max + 1).toString().padStart(3, '0');
        }
      } else {
        // Pad with zeros if it is a number (e.g. "27" -> "027") to match style
        if (/^\d+$/.test(finalSerialNo)) {
          finalSerialNo = finalSerialNo.padStart(3, '0');
        }
      }

      // Live Firestore and local state pre-check validation for S.No uniqueness inside this activeUnit
      const normFinal = finalSerialNo.padStart(3, '0');
      const targetNum = parseInt(finalSerialNo, 10);

      // Check local state first
      let isDuplicate = records.some(r => 
        r.referringUnit === activeUnit &&
        r.id !== recordRef.id &&
        (
          r.serialNo?.trim().padStart(3, '0') === normFinal ||
          (targetNum > 0 && parseInt(r.serialNo || '0', 10) === targetNum)
        )
      );

      // Check live Firestore if not already found in local state
      if (!isDuplicate) {
        try {
          const qDup = query(
            collection(db, 'endoscopy_records'),
            where('referringUnit', '==', activeUnit),
            where('serialNo', '==', finalSerialNo)
          );
          const snapshotDup = await getDocs(qDup);
          isDuplicate = snapshotDup.docs.some(d => d.id !== recordRef.id);

          if (!isDuplicate && finalSerialNo !== normFinal) {
            const qDupPadded = query(
              collection(db, 'endoscopy_records'),
              where('referringUnit', '==', activeUnit),
              where('serialNo', '==', normFinal)
            );
            const snapshotDupPadded = await getDocs(qDupPadded);
            isDuplicate = snapshotDupPadded.docs.some(d => d.id !== recordRef.id);
          }
        } catch (e) {
          console.warn("Firestore duplicate S.No check warning:", e);
        }
      }
      
      if (isDuplicate) {
        // Query local and live records to find the absolute latest non-conflicting S.No
        const unitRecords = records.filter(r => r.referringUnit === activeUnit);
        let max = 0;
        try {
          const allRecordsQuery = query(
            collection(db, 'endoscopy_records'),
            where('referringUnit', '==', activeUnit)
          );
          const allRecordsSnapshot = await getDocs(allRecordsQuery);
          const liveRecords = allRecordsSnapshot.docs.map(doc => doc.data() as EndoscopyRecord);
          const allComb = [...unitRecords, ...liveRecords];
          const nums = allComb.map(r => parseInt(r.serialNo || '0', 10)).filter(n => !isNaN(n));
          max = nums.length > 0 ? Math.max(...nums) : 0;
        } catch (e) {
          const nums = unitRecords.map(r => parseInt(r.serialNo || '0', 10)).filter(n => !isNaN(n));
          max = nums.length > 0 ? Math.max(...nums) : 0;
        }

        const suggestedSerialNo = (max + 1).toString().padStart(3, '0');

        // Set the form state so the UI displays the corrected value
        setFormSerialNo(suggestedSerialNo);
        setIsSaving(false);
        
        showToast(
          `S.No "${finalSerialNo}" pehle se maujood hai! Duplicate entry se bachne ke liye Serial Number ko auto-update karke "${suggestedSerialNo}" kar diya gaya hai. Kripya review karke dobara Save par click karein.`,
          'warning',
          'Duplicate S.No Detected'
        );
        return;
      }

      const recordData: EndoscopyRecord = {
        id: recordRef.id,
        referringUnit: activeUnit,
        serialNo: finalSerialNo,
        regNo: formRegNo.trim().toUpperCase(),
        name: formName.trim().toUpperCase(),
        doctor: formDoctor,
        procedure: formatProcedureDisplay(formProcedure),
        date: formDate,
        time: formTime,
        age: formAge,
        gender: formGender,
        dob: formDob,
        referringPhysician: formReferringPhysician,
        indications: formIndications,
        instruments: formInstruments,
        medications: formMedications,
        visualization: formVisualization,
        tolerance: formTolerance,
        complications: formComplications,
        limitations: formLimitations,
        procedureTechnique: formProcedureTechnique,
        findings: formFindings,
        esophagusFindings: formEsophagusFindings,
        stomachFindings: formStomachFindings,
        antrumFindings: formAntrumFindings,
        duodenumFindings: formDuodenumFindings,
        duodenum2ndPartFindings: formDuodenum2ndPartFindings,
        colonFindings: formColonFindings,
        rectumFindings: formRectumFindings,
        sigmoidColonFindings: formSigmoidColonFindings,
        transverseColonFindings: formTransverseColonFindings,
        descendingColonFindings: formDescendingColonFindings,
        ascendingColonFindings: formAscendingColonFindings,
        caecumFindings: formCaecumFindings,
        diagnosis: formDiagnosis,
        recommendations: formRecommendations,
        icdCodes: formIcdCodes,
        cptCodes: formCptCodes,
        whatsappNumber: formWhatsappNumber,
        images: formImages
      };

      // 1. Double Save: Always save to local storage backup first to guarantee data persistence
      const localDataKey = `hdu_local_endoscopy_records_${activeUnit}`;
      const localData = localStorage.getItem(localDataKey);
      let localRecords: EndoscopyRecord[] = [];
      if (localData) {
        try {
          localRecords = JSON.parse(localData);
        } catch (errParse) {
          console.error("Failed to parse local endoscopy records", errParse);
        }
      }

      const existingIndex = localRecords.findIndex(r => r.id === recordRef.id);
      if (existingIndex > -1) {
        localRecords[existingIndex] = recordData;
      } else {
        localRecords.push(recordData);
      }
      localStorage.setItem(localDataKey, JSON.stringify(localRecords));

      // 2. Try Firestore save
      try {
        await setDoc(recordRef, recordData);
      } catch (firestoreErr) {
        console.warn("Firestore save failed (might be offline or permission restricted), backed up locally:", firestoreErr);
      }
      
      const actionType = editingRecord ? 'MODIFY' : 'CREATE';
      const actionLabel = editingRecord ? 'Modified' : 'Created';
      try {
        await activityService.logActivity(
          actionType,
          'Endoscopy Record',
          `${actionLabel} endoscopy report for patient ${recordData.name} (Reg No: ${recordData.regNo}) - Procedure: ${recordData.procedure}`,
          currentUser?.displayName || currentUser?.email || 'Anonymous User',
          activeUnit
        );
      } catch (activityErr) {
        console.warn("Activity logging failed", activityErr);
      }
      
      if (shouldPrint) {
        const currentDisplayName = currentUser?.displayName || currentUser?.email || 'Attending Physician';
        await exportSingleEndoscopyReportPDF(recordData, currentDisplayName, isCompactView);
      }

      // 3. Remove draft from LocalStorage on successful submit
      localStorage.removeItem(`hdu_draft_endoscopy_${activeUnit}`);
      if (editingRecord) {
        localStorage.removeItem(`hdu_draft_endoscopy_${activeUnit}_edit_${editingRecord.id}`);
      }

      // 4. Show temporary visual success toast
      showToast(`Report for "${recordData.name}" saved successfully to ${activeUnit} archives!`, 'success');

      // 5. Reset the form back to blank so the user can enter another patient
      resetForm();

      // 6. Smart closing: only exit workspace completely if it's the log list modal.
      // If it's the fullscreen report creator, keep them on the screen with a clean blank form and the table below!
      if (!initialWorkspaceOpen) {
        setIsWorkspaceOpen(false);
        if (onExit) onExit();
      } else {
        setEditingRecord(null);
      }
    } catch (err) {
      console.error("Save Error:", err);
      alert("Failed to save report. Please check the fields and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!idToDelete) return;

    const targetId = idToDelete;
    const rec = records.find(r => r.id === targetId);
    if (!rec) {
      setIdToDelete(null);
      return;
    }

    const patientName = rec.name || 'Unknown';
    const regNo = rec.regNo || 'Unknown';
    const recordBackup = { ...rec };
    const originalIndex = records.findIndex(r => r.id === targetId);

    // Close confirmation modal immediately & remove from UI list for instant visual feedback
    setIdToDelete(null);
    setRecords(prev => prev.filter(r => r.id !== targetId));

    let isUndone = false;

    // Deferred commit function runs after 5-second countdown if not undone
    const commitPermanentDelete = async () => {
      if (isUndone) return;

      // 1. Delete from local backup
      const localDataKey = `hdu_local_endoscopy_records_${activeUnit}`;
      const localData = localStorage.getItem(localDataKey);
      if (localData) {
        try {
          let localRecords = JSON.parse(localData) as EndoscopyRecord[];
          localRecords = localRecords.filter(r => r.id !== targetId);
          localStorage.setItem(localDataKey, JSON.stringify(localRecords));
        } catch (e) {
          console.error("Failed to update local backup on delete", e);
        }
      }

      // 2. Attempt Firestore delete
      try {
        await deleteDoc(doc(db, 'endoscopy_records', targetId));
      } catch (firestoreError) {
        console.warn("Firestore delete failed, but deleted from local backup:", firestoreError);
      }

      // 3. Log activity
      try {
        await activityService.logActivity(
          'DELETE',
          'Endoscopy Record',
          `Deleted endoscopy report for patient ${patientName} (Reg No: ${regNo})`,
          currentUser?.displayName || currentUser?.email || 'Anonymous User',
          activeUnit
        );
      } catch (actErr) {
        console.warn("Failed to log deletion activity", actErr);
      }
    };

    const deleteTimer = setTimeout(() => {
      commitPermanentDelete();
    }, 5000);

    // Callback when user clicks 'Undo' in the toast notification
    const handleUndo = () => {
      isUndone = true;
      clearTimeout(deleteTimer);

      // Re-insert record into state list at original index or top
      setRecords(prev => {
        if (prev.some(r => r.id === targetId)) return prev;
        const newArr = [...prev];
        if (originalIndex >= 0 && originalIndex <= newArr.length) {
          newArr.splice(originalIndex, 0, recordBackup);
        } else {
          newArr.unshift(recordBackup);
        }
        return newArr;
      });

      showToast(
        `Report for patient "${patientName}" restored successfully.`,
        'success',
        'Record Restored'
      );
    };

    // Show Toast with Undo button for 5 seconds (5000ms)
    showToast(
      `Report for patient "${patientName}" deleted.`,
      'error',
      'Record Deleted',
      {
        label: 'Undo',
        onClick: handleUndo
      },
      5000
    );
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

  const isFilterActive = !!(appliedStartDate || appliedEndDate || searchTerm);

  if (isWorkspaceOpen && initialWorkspaceOpen) {
    const isFormValid = !!(formRegNo.trim() && formName.trim() && formDoctor && formProcedure);
    
    return (
      <>
        <div className="bg-[#f1f5f9] min-h-screen text-slate-800 p-6 flex flex-col space-y-6 select-none rounded-2xl border border-slate-300 shadow-2xl relative overflow-hidden">
          {/* Subtle Ambient Decorative Glows with very low opacity */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-br from-indigo-500/5 to-purple-500/0 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-teal-500/5 to-emerald-500/0 rounded-full blur-3xl pointer-events-none" />

          {/* Workspace Top Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-300 pb-4 gap-4 relative z-10">
            <div className="flex flex-col gap-2.5">
              {/* TOP: Headings & Icon */}
              <div className="flex items-center space-x-3 shrink-0">
                <div className="p-2.5 bg-gradient-to-br from-red-600 via-rose-600 to-pink-600 text-white rounded-xl shadow-md shadow-red-500/20 ring-2 ring-red-100 flex items-center justify-center shrink-0">
                  <GastroScopeIcon className="w-5 h-5 text-white" glow />
                </div>
                <div className="whitespace-nowrap">
                  <h2 className="text-sm font-black tracking-tight text-slate-900 flex items-center space-x-2 whitespace-nowrap">
                    <span className="whitespace-nowrap">Endoscopy Report Studio</span>
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse shrink-0" />
                  </h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider whitespace-nowrap">
                    Clinical Procedure Reports
                  </p>
                </div>
              </div>

              {/* BOTTOM: Exit Workspace Button */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    if (!isSaving) {
                      const hasContent = !!(
                        formName || formRegNo || formDoctor || formProcedure || 
                        formFindings || formEsophagusFindings || formStomachFindings || formAntrumFindings || 
                        formDuodenumFindings || formDuodenum2ndPartFindings || formColonFindings || formDiagnosis || 
                        formIndications || formRecommendations
                      );
                      if (hasContent) {
                        setIsExitConfirmOpen(true);
                      } else {
                        setIsWorkspaceOpen(false);
                        setEditingRecord(null);
                        if (onExit) onExit();
                      }
                    }
                  }}
                  className="flex items-center space-x-2 text-slate-600 hover:text-rose-600 transition-all bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-400 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer active:scale-95 shadow-sm shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span className="whitespace-nowrap">Exit Workspace</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
              {/* Procedure Template Selection */}
              <div className="flex items-center space-x-2">
                <span className="hidden sm:inline text-[9px] font-bold text-slate-500 uppercase tracking-wider">PREFILL TEMPLATE:</span>
                <select
                  value={activeTemplateId || ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      applyMasterTemplate(e.target.value);
                    }
                  }}
                  className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-teal-500/40 cursor-pointer transition-all shadow-sm"
                >
                  <option value="" disabled className="bg-white text-slate-800">-- SELECT PROCEDURE TEMPLATE --</option>
                  <optgroup label="Upper GI Endoscopy (EGD)" className="font-bold text-slate-900 bg-slate-100">
                    <option value="normal_egd" className="bg-white text-slate-800 font-medium">Normal EGD (Upper Endoscopy)</option>
                    <option value="varices_egd" className="bg-white text-slate-800 font-medium">EGD - Bleeding Esophageal Varices</option>
                    <option value="ulcer_egd" className="bg-white text-slate-800 font-medium">EGD - Gastric Ulcer</option>
                    <option value="duodenal_ulcer_egd" className="bg-white text-slate-800 font-medium">EGD - Duodenal Ulcer</option>
                    <option value="reflux_egd" className="bg-white text-slate-800 font-medium">EGD - Severe Reflux Esophagitis</option>
                    <option value="candidiasis_egd" className="bg-white text-slate-800 font-medium">EGD - Esophageal Candidiasis</option>
                  </optgroup>
                  <optgroup label="Lower GI Endoscopy (Colonoscopy)" className="font-bold text-slate-900 bg-slate-100">
                    <option value="normal_colonoscopy" className="bg-white text-slate-800 font-medium">Normal Screening Colonoscopy</option>
                    <option value="divertic_colonoscopy" className="bg-white text-slate-800 font-medium">Colonoscopy - Diverticulosis</option>
                    <option value="polypectomy_colonoscopy" className="bg-white text-slate-800 font-medium">Colonoscopy - Polypectomy</option>
                    <option value="colitis_colonoscopy" className="bg-white text-slate-800 font-medium">Colonoscopy - Active Colitis (UC)</option>
                  </optgroup>
                  <optgroup label="Flexible Sigmoidoscopy" className="font-bold text-slate-900 bg-slate-100">
                    <option value="normal_sigmoidoscopy" className="bg-white text-slate-800 font-medium">Normal Flexible Sigmoidoscopy</option>
                    <option value="proctitis_sigmoidoscopy" className="bg-white text-slate-800 font-medium">Sigmoidoscopy - Active Proctosigmoiditis</option>
                    <option value="polyp_sigmoidoscopy" className="bg-white text-slate-800 font-medium">Sigmoidoscopy - Sigmoid Polyp & Hemorrhoids</option>
                  </optgroup>
                  <optgroup label="Pulmonary Bronchoscopy" className="font-bold text-slate-900 bg-slate-100">
                    <option value="normal_bronchoscopy" className="bg-white text-slate-800 font-medium">Normal Flexible Bronchoscopy</option>
                    <option value="hemorrhage_bronchoscopy" className="bg-white text-slate-800 font-medium">Flexible Bronchoscopy - Hemorrhage & BAL</option>
                    <option value="mass_bronchoscopy" className="bg-white text-slate-800 font-medium">Flexible Bronchoscopy - Obstructing Mass & Biopsy</option>
                  </optgroup>
                </select>
              </div>

              {templateSuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center space-x-1 animate-pulse shadow-sm">
                  <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Applied</span>
                </div>
              )}

              <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1 bg-white rounded-full border border-slate-300 text-[9px] font-medium text-slate-500 shadow-sm">
                <span className={`w-1.5 h-1.5 rounded-full ${isDraftSaving ? 'bg-amber-400 animate-pulse' : lastSavedTime ? 'bg-teal-500' : 'bg-teal-500/80'}`} />
                <span className="tracking-wider uppercase">{isDraftSaving ? 'SAVING DRAFT...' : lastSavedTime ? `SAVED AT ${lastSavedTime}` : 'AUTO-SAVE ACTIVE'}</span>
              </div>
              
              <button
                onClick={() => {
                  if (!isSaving) {
                    const hasContent = !!(
                      formName || formRegNo || formDoctor || formProcedure || 
                      formFindings || formEsophagusFindings || formStomachFindings || formAntrumFindings || 
                      formDuodenumFindings || formDuodenum2ndPartFindings || formColonFindings || formDiagnosis || 
                      formIndications || formRecommendations
                    );
                    if (hasContent) {
                      setIsExitConfirmOpen(true);
                    } else {
                      setIsWorkspaceOpen(false);
                      setEditingRecord(null);
                      if (onExit) onExit();
                    }
                  }
                }}
                className="px-3 py-1.5 text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-rose-300 hover:border-rose-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95 shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Discard Changes</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const isConfirmed = await confirm({
                    title: "Reset Report Form",
                    message: "Are you sure you want to reset all form fields? Any unsaved findings and procedure data entered will be lost.",
                    confirmLabel: "Yes, Reset Form",
                    cancelLabel: "Keep Data",
                    variant: "warning"
                  });
                  if (isConfirmed) {
                    resetForm();
                    showToast("Form cleared successfully.", "info");
                  }
                }}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 border border-amber-300 hover:border-amber-400 cursor-pointer active:scale-95 shadow-sm"
                title="Reset Form"
              >
                <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                <span>Reset Form</span>
              </button>

              <button
                onClick={() => {
                  if (!isFormValid) {
                    handleFormValidationFailure();
                  } else {
                    setIsPreviewOpen(true);
                  }
                }}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95 ${
                  isFormValid 
                    ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-300 hover:border-indigo-400 shadow-sm' 
                    : 'bg-slate-50 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60'
                }`}
                title="Preview Medical Print Report (Click to validate)"
              >
                <svg className={`w-3.5 h-3.5 ${isFormValid ? 'text-indigo-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Report Preview</span>
              </button>

              <button
                onClick={(e) => {
                  if (!isFormValid) {
                    e.preventDefault();
                    handleFormValidationFailure();
                  } else {
                    handleSubmit(e, false);
                  }
                }}
                disabled={isSaving || !isFormValid}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all ${
                  isFormValid && !isSaving
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-300 hover:border-emerald-400 shadow-sm animate-green-gentle-pulse cursor-pointer active:scale-95' 
                    : 'bg-slate-50 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60'
                }`}
                title={!formDate ? "Please select a Procedure Date" : isDateInFuture ? "Procedure Date cannot be in the future" : !isFormValid ? "Please fill all required fields" : "Save Records"}
              >
                <svg className={`w-3.5 h-3.5 ${isFormValid ? 'text-emerald-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>{isSaving ? 'Saving...' : 'Save Records'}</span>
              </button>

              <button
                onClick={(e) => {
                  if (!isFormValid) {
                    e.preventDefault();
                    handleFormValidationFailure();
                  } else {
                    handleSubmit(e, true);
                  }
                }}
                disabled={isSaving || !isFormValid}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all ${
                  isFormValid && !isSaving 
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-md shadow-indigo-600/15 hover:shadow-lg hover:shadow-indigo-600/20 border border-indigo-700/50 animate-gentle-pulse cursor-pointer active:scale-95' 
                    : 'bg-slate-100 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60'
                }`}
                title={!formDate ? "Please select a Procedure Date" : isDateInFuture ? "Procedure Date cannot be in the future" : !isFormValid ? "Please fill all required fields" : "Save and Download"}
              >
                <svg className={`w-3.5 h-3.5 ${isFormValid ? 'text-white' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>{isSaving ? 'Saving...' : 'Save and Download'}</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const currentRec: EndoscopyRecord = {
                    id: editingRecord?.id || `temp_${Date.now()}`,
                    referringUnit: activeUnit,
                    regNo: formRegNo || 'NEW-REG',
                    name: formName || 'Patient',
                    doctor: formDoctor || 'Doctor',
                    procedure: formProcedure || 'Endoscopy Procedure',
                    date: formDate,
                    time: formTime,
                    diagnosis: formDiagnosis,
                    recommendations: formRecommendations,
                    whatsappNumber: formWhatsappNumber
                  };
                  setSelectedDispatchRecord(currentRec);
                  setIsDispatchModalOpen(true);
                  showToast("Opening WhatsApp Dispatch Center...", "info", "Dispatch Gateway");
                }}
                className="px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-md border border-emerald-700/50 cursor-pointer active:scale-95"
                title="Dispatch report directly via WhatsApp or Email Cloud Function"
              >
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
                <span>Dispatch WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Unsaved Draft Restore Banner */}
          {draftToRestore && (
            <div className="bg-slate-900/60 border border-indigo-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top duration-300 relative z-10">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-950/40 rounded-lg text-indigo-400 border border-indigo-500/10">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-indigo-400 tracking-wider">Unsaved Draft Findings Detected</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    We found an auto-saved draft for a patient in this unit. Would you like to restore the draft findings?
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={loadDraft}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95"
                >
                  Restore Draft
                </button>
                <button
                  type="button"
                  onClick={discardDraft}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border border-slate-800"
                >
                  Discard Draft
                </button>
              </div>
            </div>
          )}

          {/* Workspace Body Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 relative z-10">
            {/* LEFT COLUMN: Clinical Workspace (Col-Span-8) */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col space-y-6 shadow-sm">
              {/* Beautiful Capsule Tab Selector */}
              <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200 space-x-1">
                {[
                  { id: 'demographics', label: '1. Patient & Procedure Details' },
                  { id: 'narrative', label: '2. Endoscopy Findings & Coding' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFormTab(tab.id as any)}
                    className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wider text-center rounded-lg transition-all cursor-pointer ${
                      activeFormTab === tab.id 
                        ? 'bg-white text-red-600 shadow-sm border border-slate-250/50' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

            {/* TAB CONTENT panels */}
            <div className="flex-1 overflow-y-auto pr-1 max-h-[60vh] space-y-6 text-slate-700">
              {activeFormTab === 'demographics' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Medical Record Number (MRN/Reg No) *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={formRegNo}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (val.length <= 8) {
                          setFormRegNo(val);
                        }
                      }}
                      placeholder="Enter MRN/Reg No (Max 8 digits)"
                      className={`w-full px-4 py-3 bg-white border rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:border-indigo-500/50 hover:border-slate-350 transition-all ${
                        showValidationErrors && !formRegNo.trim()
                          ? 'border-rose-500 ring-2 ring-rose-500/10 shadow-[0_0_8px_rgba(244,63,94,0.15)]' 
                          : 'border-slate-200 focus:ring-indigo-500/10'
                      }`}
                    />
                    {showValidationErrors && !formRegNo.trim() && (
                      <p className="text-[8px] font-black text-red-500 uppercase tracking-wider mt-1 animate-pulse">
                        ⚠️ MRN/Reg No is required
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Patient Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value.toUpperCase())}
                      placeholder="Enter patient complete name"
                      className={`w-full px-4 py-3 bg-white border rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:ring-2 focus:border-indigo-500/50 hover:border-slate-350 transition-all ${
                        showValidationErrors && !formName.trim()
                          ? 'border-rose-500 ring-2 ring-rose-500/10 shadow-[0_0_8px_rgba(244,63,94,0.15)]' 
                          : 'border-slate-200 focus:ring-indigo-500/10'
                      }`}
                    />
                    {showValidationErrors && !formName.trim() && (
                      <p className="text-[8px] font-black text-red-500 uppercase tracking-wider mt-1 animate-pulse">
                        ⚠️ Patient Full Name is required
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Age (In Years)</label>
                    <input
                      type="number"
                      value={formAge}
                      onChange={(e) => setFormAge(e.target.value)}
                      placeholder="e.g. 52"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gender</label>
                    <select
                      value={formGender}
                      onChange={(e) => setFormGender(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition-all cursor-pointer"
                    >
                      <option value="Male" className="bg-white text-slate-800">Male</option>
                      <option value="Female" className="bg-white text-slate-800">Female</option>
                      <option value="Other" className="bg-white text-slate-800">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Referring Physician / Consultant</label>
                    <input
                      type="text"
                      value={formReferringPhysician}
                      onChange={(e) => setFormReferringPhysician(e.target.value.toUpperCase())}
                      placeholder="Referrer clinician name"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Procedure Date *</label>
                      <input
                        id="endoscopy-field-date"
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className={`w-full px-4 py-3 bg-white border rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:border-indigo-500/50 hover:border-slate-350 transition-all ${
                          showValidationErrors && (!formDate || isDateInFuture)
                            ? 'border-rose-500 ring-2 ring-rose-500/10 shadow-[0_0_8px_rgba(244,63,94,0.15)]' 
                            : 'border-slate-200 focus:ring-indigo-500/10'
                        }`}
                      />
                      {showValidationErrors && !formDate && (
                        <p className="text-[8px] font-black text-rose-500 uppercase tracking-wider mt-1 animate-pulse">
                          ⚠️ Date is required
                        </p>
                      )}
                      {isDateInFuture && (
                        <p className="text-[8px] font-black text-rose-500 uppercase tracking-wider mt-1 animate-pulse">
                          ⚠️ Future date is not allowed
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Procedure Time</label>
                      <input
                        type="time"
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition-all"
                      />
                    </div>
                  </div>

                  {/* Patient Digital Contact (Optional WhatsApp Integration) */}
                  <div className="col-span-1 md:col-span-2 pt-4 border-t border-slate-200 mt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
                        Patient WhatsApp Contact (Optional)
                      </h4>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Serverless Cloud Function Ready</span>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Patient WhatsApp Mobile Number</label>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Country Code + Mobile No. (Without leading 0)</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch gap-2">
                      {/* Country Code Dropdown */}
                      <select
                        value={formWhatsappCountryCode}
                        onChange={(e) => setFormWhatsappCountryCode(e.target.value)}
                        className="sm:w-48 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 hover:border-slate-300 transition-all cursor-pointer shadow-2xs"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code !== 'custom' ? `${c.code} (${c.country})` : c.country}
                          </option>
                        ))}
                      </select>

                      {/* Custom Code Input if custom selected */}
                      {formWhatsappCountryCode === 'custom' && (
                        <input
                          type="text"
                          placeholder="+91"
                          value={formWhatsappCustomCode}
                          onChange={(e) => setFormWhatsappCustomCode(e.target.value)}
                          className="w-24 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 shadow-2xs"
                        />
                      )}

                      {/* Numeric Only Phone Input */}
                      <div className="relative flex-1">
                        <input
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={formWhatsappLocalNumber}
                          onChange={(e) => {
                            const cleanNum = sanitizeLocalNumber(e.target.value, activeWhatsappPrefix);
                            setFormWhatsappLocalNumber(cleanNum);
                          }}
                          placeholder="e.g. 3001234567 or 9876543210 (exclude initial 0)"
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 hover:border-slate-300 transition-all font-mono tracking-wide"
                        />
                        {formWhatsappLocalNumber && (
                          <button
                            type="button"
                            onClick={() => setFormWhatsappLocalNumber('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 text-xs font-bold p-1 cursor-pointer"
                            title="Clear"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 font-medium pt-0.5">
                      <span>Formatted Number: <strong className="text-emerald-600 font-mono font-bold">{formWhatsappNumber || 'None'}</strong></span>
                      <span>Numeric digits only • Auto-strips leading 0</span>
                    </div>
                  </div>

                  {/* Procedure Details Divider & Section */}
                  <div className="col-span-1 md:col-span-2 pt-4 border-t border-slate-200 mt-2">
                    <h4 className="text-[10px] font-bold uppercase text-red-600 tracking-wider mb-2">
                      Procedure & Clinician Assignment
                    </h4>
                  </div>

                  <div className="space-y-2 relative" ref={dropdownRef}>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Procedure Performed *</label>
                    <input
                      type="text"
                      required
                      value={procedureSearch}
                      onChange={handleProcedureSearchChange}
                      onKeyDown={handleKeyDown}
                      onFocus={() => {
                        if (procedureSuggestions.length > 0) setIsProcedureListOpen(true);
                      }}
                      placeholder="Type to search e.g. Colonoscopy..."
                      className={`w-full px-4 py-3 bg-white border rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:border-indigo-500/50 hover:border-slate-350 transition-all ${
                        showValidationErrors && !formProcedure
                          ? 'border-rose-500 ring-2 ring-rose-500/10 shadow-[0_0_8px_rgba(244,63,94,0.15)]' 
                          : 'border-slate-200 focus:ring-indigo-500/10'
                      }`}
                    />
                    {showValidationErrors && !formProcedure && (
                      <p className="text-[8px] font-black text-rose-500 uppercase tracking-wider mt-1 animate-pulse">
                        ⚠️ Procedure Performed is required
                      </p>
                    )}
                    {isProcedureListOpen && procedureSuggestions.length > 0 && (
                      <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl mt-1 max-h-48 overflow-y-auto shadow-2xl divide-y divide-slate-100 text-[10px] font-bold text-slate-700">
                        {procedureSuggestions.map((p, idx) => (
                          <li
                            key={p}
                            onClick={() => selectProcedure(p)}
                            className={`px-4 py-3 cursor-pointer transition-colors ${
                              idx === highlightedIndex 
                                ? 'bg-indigo-50 text-indigo-600 font-bold' 
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            {p}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Performing Endoscopist *</label>
                    <select
                      required
                      value={formDoctor}
                      onChange={(e) => setFormDoctor(e.target.value)}
                      className={`w-full px-4 py-3 bg-white border rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:border-indigo-500/50 hover:border-slate-350 transition-all cursor-pointer ${
                        showValidationErrors && !formDoctor
                          ? 'border-rose-500 ring-2 ring-rose-500/10 shadow-[0_0_8px_rgba(244,63,94,0.15)]' 
                          : 'border-slate-200 focus:ring-indigo-500/10'
                      }`}
                    >
                      <option value="" className="bg-white text-slate-800">Select Doctor</option>
                      {ENDOSCOPY_DOCTORS.map(doc => (
                        <option key={doc} value={doc} className="bg-white text-slate-800">{doc}</option>
                      ))}
                    </select>
                    {showValidationErrors && !formDoctor && (
                      <p className="text-[8px] font-black text-rose-500 uppercase tracking-wider mt-1 animate-pulse">
                        ⚠️ Doctor is required
                      </p>
                    )}
                  </div>

                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">MEDICATIONS GIVEN / SEDATION</label>
                    <input
                      type="text"
                      value={formMedications}
                      onChange={(e) => setFormMedications(e.target.value.toUpperCase())}
                      placeholder="E.G. MIDAZOLAM 2MG, PROPOFOL 50MG, BUSCOPAN 20MG OR N/A"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition-all uppercase"
                    />
                  </div>
                </div>
              )}

              {activeFormTab === 'narrative' && (
                <div className="space-y-6">
                  {/* Indications */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Clinical Indications for Examination</label>
                      <VoiceDictationButton context="dictation" onTranscript={(text) => setFormIndications(prev => prev ? `${prev} ${text}` : text)} />
                    </div>
                    <textarea
                      rows={2}
                      value={formIndications}
                      onChange={(e) => setFormIndications(e.target.value)}
                      placeholder="e.g. Dysphagia, dyspepsia, screening for esophageal varices..."
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition-all"
                    />
                  </div>



                  {/* ANATOMICAL FINDINGS BLOCK - HIGHLIGHTED CLINICAL FIELDS */}
                  {isColonoscopy ? (
                    <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-6 animate-fadeIn">
                      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                        <svg className="w-5 h-5 text-red-500 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Colonoscopy Anatomical Findings</h3>
                      </div>

                      {[
                        { label: "1. Rectum Findings", value: formRectumFindings, setter: setFormRectumFindings, placeholder: "Describe rectum mucosa, hemorrhoids, masses, vascularity..." },
                        { label: "2. Sigmoid Colon Findings", value: formSigmoidColonFindings, setter: setFormSigmoidColonFindings, placeholder: "Describe sigmoid colon, diverticula, spasm, polyps..." },
                        { label: "3. Transverse Colon Findings", value: formTransverseColonFindings, setter: setFormTransverseColonFindings, placeholder: "Describe transverse colon, mucosa, vascular pattern..." },
                        { label: "4. Descending Colon Findings", value: formDescendingColonFindings, setter: setFormDescendingColonFindings, placeholder: "Describe descending colon, diverticulosis, mucosa..." },
                        { label: "5. Ascending Colon Findings", value: formAscendingColonFindings, setter: setFormAscendingColonFindings, placeholder: "Describe ascending colon, mucosa, prep quality..." },
                        { label: "6. Caecum Findings", value: formCaecumFindings, setter: setFormCaecumFindings, placeholder: "Describe caecum, appendiceal orifice, ileocecal valve..." },
                      ].map((field, idx) => (
                        <div key={idx} className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">
                              {field.label}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => field.setter("Normal Mucosa")}
                                className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                              >
                                ✓ Normal Mucosa
                              </button>
                              <button
                                type="button"
                                onClick={() => field.setter("Not Examined")}
                                className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                              >
                                ⚠ Not Examined
                              </button>
                              <button
                                type="button"
                                onClick={() => field.setter("")}
                                className="text-[8px] bg-rose-50 text-rose-600 px-2.5 py-1 rounded font-bold uppercase tracking-wider hover:bg-rose-100 transition-all border border-rose-200 shadow-sm cursor-pointer"
                              >
                                × Clear
                              </button>
                              <VoiceDictationButton context="dictation" onTranscript={(text) => field.setter(prev => prev ? `${prev} ${text}` : text)} />
                            </div>
                          </div>
                          <textarea
                            rows={2}
                            value={field.value}
                            onChange={(e) => field.setter(e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition-all"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-6 animate-fadeIn">
                      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                        <svg className="w-5 h-5 text-red-500 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Structured Anatomical Findings & Templates</h3>
                      </div>



                      {/* 1. Esophagus / Vocal Cords */}
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">
                            {isBronchoscopy ? "1. Vocal Cords & Larynx Findings" : "1. Esophagus Findings"}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {isBronchoscopy ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setFormEsophagusFindings("Normal vocal cords with preserved bilateral mobility. Laryngeal anatomy is intact and normal. No mass or erythema.")}
                                  className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                >
                                  ✓ Normal Cords
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormEsophagusFindings("Laryngeal mucosa is mildly hyperemic. Vocal cords are symmetric but show mildly restricted abduction on the left side. No vocal cord lesions.")}
                                  className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                >
                                  ⚠ Restricted Mobility
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setFormEsophagusFindings("Normal esophageal mucosa. Z-line is distinct and at normal level (~40cm). No varices, ulceration, stricture, or masses seen.")}
                                  className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                >
                                  ✓ Normal Template
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormEsophagusFindings("Grade I esophageal varices noted in lower third of esophagus without red color signs. Rest of esophageal mucosa normal.")}
                                  className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                >
                                  ⚠ Varices Template
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setFormEsophagusFindings("")}
                              className="text-[8px] bg-rose-50 text-rose-600 px-2.5 py-1 rounded font-bold uppercase tracking-wider hover:bg-rose-100 transition-all border border-rose-200 shadow-sm cursor-pointer"
                            >
                              × Clear
                            </button>
                            <VoiceDictationButton context="dictation" onTranscript={(text) => setFormEsophagusFindings(prev => prev ? `${prev} ${text}` : text)} />
                          </div>
                        </div>
                        <textarea
                          rows={3}
                          value={formEsophagusFindings}
                          onChange={(e) => setFormEsophagusFindings(e.target.value)}
                          placeholder={isBronchoscopy ? "Describe laryngeal mucosa, vocal cord appearance, mobility..." : "Describe Esophagus mucosa, varices, Z-line, lumen, motility..."}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition-all"
                        />
                      </div>

                      {/* 2. Stomach / Trachea & Carina */}
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">
                            {isBronchoscopy ? "2. Trachea & Carina Findings" : "2. Stomach Findings"}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {isBronchoscopy ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setFormStomachFindings("Trachea is patent without stenosis, compression, or tracheomalacia. Tracheal rings are well-defined. Main Carina is sharp, mobile, and normal.")}
                                  className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                >
                                  ✓ Normal Trachea
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormStomachFindings("Tracheal mucosa is mildly congested with secretions. Main Carina is blunted and widened, suggesting extrinsic subcarinal adenopathy/compression.")}
                                  className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                >
                                  ⚠ Blunted Carina
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setFormStomachFindings("Normal gastric mucosa with regular rugal folds. Body and fundus clear.")}
                                  className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                >
                                  ✓ Normal Stomach
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormStomachFindings("Moderate mucosal erythema, congestion, and subepithelial petechial hemorrhages seen in the gastric body and fundus.")}
                                  className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                >
                                  Gastritis Template
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setFormStomachFindings("")}
                              className="text-[8px] bg-rose-50 text-rose-600 px-2.5 py-1 rounded font-bold uppercase tracking-wider hover:bg-rose-100 transition-all border border-rose-200 shadow-sm cursor-pointer"
                            >
                              × Clear
                            </button>
                            <VoiceDictationButton context="dictation" onTranscript={(text) => setFormStomachFindings(prev => prev ? `${prev} ${text}` : text)} />
                          </div>
                        </div>
                        <textarea
                          rows={3}
                          value={formStomachFindings}
                          onChange={(e) => setFormStomachFindings(e.target.value)}
                          placeholder={isBronchoscopy ? "Describe tracheal patency, rings, stenosis, and carinal sharpness/mobility..." : "Describe Gastric Fundus, Body, mucosal congestion, ulcers..."}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition-all"
                        />
                      </div>

                      {/* 3. Antrum Findings (Only for EGD / Upper Endoscopy) */}
                      {!isBronchoscopy && (
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">
                              3. Antrum Findings
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => setFormAntrumFindings("Normal gastric antrum. Pylorus is patent and easily traversed. No ulcerations, erosions, or masses noted.")}
                                className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                              >
                                ✓ Normal Antrum
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormAntrumFindings("Moderate mucosal erythema, congestion, and subepithelial petechial hemorrhages seen in the gastric antrum. Biopsies taken for H. Pylori.")}
                                className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                              >
                                Antritis Template
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormAntrumFindings("A clean-based, punched-out ulcer of approximately 8mm size noted on the lesser curvature of the gastric antrum. No active bleeding (Forrest Class III). Biopsies obtained from ulcer margin to rule out malignancy.")}
                                className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                              >
                                Antral Ulcer
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormAntrumFindings("")}
                                className="text-[8px] bg-rose-50 text-rose-600 px-2.5 py-1 rounded font-bold uppercase tracking-wider hover:bg-rose-100 transition-all border border-rose-200 shadow-sm cursor-pointer"
                              >
                                × Clear
                              </button>
                              <VoiceDictationButton context="dictation" onTranscript={(text) => setFormAntrumFindings(prev => prev ? `${prev} ${text}` : text)} />
                            </div>
                          </div>
                          <textarea
                            rows={3}
                            value={formAntrumFindings}
                            onChange={(e) => setFormAntrumFindings(e.target.value)}
                            placeholder="Describe gastric antrum, pylorus, mucosal congestion, ulcers, biopsies taken..."
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition-all"
                          />
                        </div>
                      )}

                      {/* 4. Duodenum / Bronchial Tree */}
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">
                            {isBronchoscopy ? "3. Bronchial Tree (Lobar & Segmental)" : "4. Duodenum Bulb Findings"}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {isBronchoscopy ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setFormDuodenumFindings("Left and right bronchial trees visualized up to subsegmental levels. Mucosa is normal. No endobronchial lesions, active bleeding, or purulent secretions noted.")}
                                  className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                >
                                  ✓ Normal Bronchi
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormDuodenumFindings("Bilateral bronchial trees show diffuse mucosal erythema with thick mucopurulent secretions originating from the right middle and lower lobes. Cleared with suction.")}
                                  className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                >
                                  ⚠ Secretions Template
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setFormDuodenumFindings("Duodenal bulb visualized. Mucosa is normal throughout. No active bleeding, ulceration, or duodenitis seen.")}
                                  className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                >
                                  ✓ Normal Bulb
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormDuodenumFindings("An active, well-circumscribed ulcer (~6mm) with a clean base (Forrest Class III) seen on the anterior wall of the duodenal bulb with surrounding mucosal congestion.")}
                                  className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                >
                                  Bulb Ulcer
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setFormDuodenumFindings("")}
                              className="text-[8px] bg-rose-50 text-rose-600 px-2.5 py-1 rounded font-bold uppercase tracking-wider hover:bg-rose-100 transition-all border border-rose-200 shadow-sm cursor-pointer"
                            >
                              × Clear
                            </button>
                            <VoiceDictationButton context="dictation" onTranscript={(text) => setFormDuodenumFindings(prev => prev ? `${prev} ${text}` : text)} />
                          </div>
                        </div>
                        <textarea
                          rows={3}
                          value={formDuodenumFindings}
                          onChange={(e) => setFormDuodenumFindings(e.target.value)}
                          placeholder={isBronchoscopy ? "Describe left and right main bronchi, lobar divisions, segmental openings, secretions..." : "Describe duodenal bulb mucosa, ulcers, bleeding, deformity..."}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition-all"
                        />
                      </div>

                      {/* 5. Duodenum 2nd Part Findings (Only for EGD / Upper Endoscopy) */}
                      {!isBronchoscopy && (
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">
                              5. Duodenum 2nd Part Findings
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => setFormDuodenum2ndPartFindings("Second part of duodenum (D2) visualized. Mucosa is normal with regular villous patterns. No ulcerations, erosions, or masses noted.")}
                                className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                              >
                                ✓ Normal D2
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormDuodenum2ndPartFindings("Moderate mucosal erythema, congestion, and fine granular appearance in the second part of duodenum (D2) suggesting mild duodenitis. Biopsies taken.")}
                                className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                              >
                                Duodenitis
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormDuodenum2ndPartFindings("")}
                                className="text-[8px] bg-rose-50 text-rose-600 px-2.5 py-1 rounded font-bold uppercase tracking-wider hover:bg-rose-100 transition-all border border-rose-200 shadow-sm cursor-pointer"
                              >
                                × Clear
                              </button>
                              <VoiceDictationButton context="dictation" onTranscript={(text) => setFormDuodenum2ndPartFindings(prev => prev ? `${prev} ${text}` : text)} />
                            </div>
                          </div>
                          <textarea
                            rows={3}
                            value={formDuodenum2ndPartFindings}
                            onChange={(e) => setFormDuodenum2ndPartFindings(e.target.value)}
                            placeholder="Describe D2 mucosa, villous patterns, ulcers, bleeding, duodenitis, biopsies..."
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition-all"
                          />
                        </div>
                      )}

                      {/* 4. BAL & Biopsy Findings for Bronchoscopy */}
                      {isBronchoscopy && (
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-[11px] font-bold uppercase text-red-600 tracking-wider">
                              4. BAL & Biopsy Findings
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => setFormColonFindings("Bronchoalveolar lavage (BAL) performed in the Right Middle Lobe (RML) using 100ml of sterile saline. Return was cloudy but clear of gross blood, with ~60% recovery. Sent for analysis.")}
                                className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                              >
                                ✓ BAL RML Normal
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormColonFindings("Serial Bronchoalveolar lavage (BAL) performed in the Right Lower Lobe (RLL). Return was progressively more bloody across three sequential aliquots, consistent with Diffuse Alveolar Hemorrhage.")}
                                className="text-[8px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                              >
                                ⚠ Alveolar Hemorrhage
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormColonFindings("")}
                                className="text-[8px] bg-rose-50 text-rose-600 px-2.5 py-1 rounded font-bold uppercase tracking-wider hover:bg-rose-100 transition-all border border-rose-200 shadow-sm cursor-pointer"
                              >
                                × Clear
                              </button>
                              <VoiceDictationButton context="dictation" onTranscript={(text) => setFormColonFindings(prev => prev ? `${prev} ${text}` : text)} />
                            </div>
                          </div>
                          <textarea
                            rows={3}
                            value={formColonFindings}
                            onChange={(e) => setFormColonFindings(e.target.value)}
                            placeholder="Describe BAL location, volume, appearance of return, or any endobronchial biopsy sites..."
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition-all"
                          />
                        </div>
                      )}
                    </div>
                  )}



                  {/* Diagnosis, Recommendations and Billing Codes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ASSESSMENT *</label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setFormDiagnosis("")}
                            className="text-[8px] bg-rose-50 text-rose-600 px-2.5 py-1 rounded font-bold uppercase tracking-wider hover:bg-rose-100 transition-all border border-rose-200 shadow-sm cursor-pointer"
                          >
                            × Clear
                          </button>
                          <VoiceDictationButton context="dictation" onTranscript={(text) => setFormDiagnosis(prev => prev ? `${prev} ${text}` : text)} />
                        </div>
                      </div>
                      <textarea
                        rows={3}
                        required
                        value={formDiagnosis}
                        onChange={(e) => setFormDiagnosis(e.target.value)}
                        placeholder="e.g. Mild Antral Gastritis, LA Grade A Reflux Esophagitis"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">RECOMMENDATIONS / PLAN</label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setFormRecommendations("")}
                            className="text-[8px] bg-rose-50 text-rose-600 px-2.5 py-1 rounded font-bold uppercase tracking-wider hover:bg-rose-100 transition-all border border-rose-200 shadow-sm cursor-pointer"
                          >
                            × Clear
                          </button>
                          <VoiceDictationButton context="dictation" onTranscript={(text) => setFormRecommendations(prev => prev ? `${prev} ${text}` : text)} />
                        </div>
                      </div>
                      <textarea
                        rows={3}
                        value={formRecommendations}
                        onChange={(e) => setFormRecommendations(e.target.value)}
                        placeholder="e.g. PPI 40mg daily, avoid triggers. Histopathology report follow-up."
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition-all"
                      />
                    </div>
                  </div>


                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Media Panel & Camera Captures (Col-Span-4) */}
          <div className="lg:col-span-4 flex flex-col space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col space-y-4 flex-1 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">Endoscope Camera Images</h4>
                </div>
                <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider">
                  {formImages.length} / 4 Captured
                </span>
              </div>

              {/* Upload Dropzone */}
              <div className="relative border border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-2">
                  <svg className="w-8 h-8 text-slate-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    {uploadingImage ? 'COMPRESSING CLINICAL PHOTOS...' : 'ADD CAMERA CAPTURE'}
                  </p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                    Drag & Drop or click to import files
                  </p>
                </div>
              </div>

              {/* Photos List */}
              <div className="space-y-3 overflow-y-auto max-h-[30vh] pr-1 flex-1">
                {formImages.map((img) => (
                  <div key={img.id} className="flex items-center space-x-3 bg-slate-50 p-2.5 border border-slate-200 rounded-xl shadow-sm">
                    <img
                      src={img.url}
                      alt={img.title}
                      className="w-14 h-11 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 flex flex-col space-y-1.5">
                      <input
                        type="text"
                        value={img.title}
                        onChange={(e) => handleUpdateImageTitle(img.id, e.target.value)}
                        placeholder="e.g. Duodenal active bleeding"
                        className={`w-full px-2 py-1 bg-white border rounded text-[9px] font-bold text-slate-800 outline-none focus:ring-1 transition-all ${
                          showValidationErrors && isImageTitleInvalid(img.title)
                            ? 'border-rose-500 ring-1 ring-rose-500 focus:ring-rose-500 bg-rose-50'
                            : 'border-slate-200 focus:ring-indigo-500 hover:border-slate-350'
                        }`}
                      />
                      {showValidationErrors && isImageTitleInvalid(img.title) && (
                        <span className="text-[8px] text-rose-500 font-bold flex items-center space-x-1 animate-pulse">
                          <svg className="w-2.5 h-2.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span>Bhai image ka sahi name daalein (suggestion se select karein ya khud likhein)</span>
                        </span>
                      )}
                      {/* Horizontally scrollable suggestions */}
                      <div className="flex items-center space-x-1 overflow-x-auto pb-0.5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                        {getSuggestionsForProcedure(formProcedure).map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => handleUpdateImageTitle(img.id, sug)}
                            className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider transition-all border ${
                              img.title === sug
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
                            }`}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setImageToCrop({ id: img.id, base64: imageBase64Cache[img.id] || img.url, title: img.title })}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                        title="Adjust Crop"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v14a2 2 0 002 2h14M2 8h14a2 2 0 012 2v14" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remove image"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                {formImages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <svg className="w-6 h-6 text-slate-400 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <p className="text-[9px] font-bold uppercase tracking-widest italic text-center">
                      No Clinical Photos Captured
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Saved Endoscopy Reports Archive Table Section */}
        <div className="mt-8 border-t border-slate-200 pt-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Click any row to load into the editor, or use actions to download PDF or print.
              </p>
            </div>
            {/* Quick search input */}
            <input
              type="text"
              placeholder="Search saved logs..."
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-500 text-slate-800 placeholder-slate-400 w-full sm:w-64 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="p-1 bg-red-600 text-white rounded shadow-xs">
                  <GastroScopeIcon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-100">
                  Saved Endoscopy Clinical Log Archives
                </span>
              </div>
              <span className="text-[8px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-bold">
                {paginatedRecords.length} Entries
              </span>
            </div>
            <div className="overflow-x-auto whitespace-nowrap max-h-96 overflow-y-auto">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 shadow-sm border-b border-slate-200">
                  <tr className="text-[9px] font-black uppercase tracking-widest select-none">
                    <th className="px-4 py-3.5 border-b border-slate-200">S.No</th>
                    <th className="px-4 py-3.5 border-b border-slate-200">Reg No</th>
                    <th className="px-4 py-3.5 border-b border-slate-200">Patient Name</th>
                    <th className="px-4 py-3.5 border-b border-slate-200">Physician</th>
                    <th className="px-4 py-3.5 border-b border-slate-200 bg-red-50/60">
                      <div className="flex items-center space-x-1.5 text-red-700 font-black">
                        <GastroScopeIcon className="w-3.5 h-3.5 text-red-600" />
                        <span>Scope Procedure</span>
                      </div>
                    </th>
                    <th className="px-4 py-3.5 border-b border-slate-200">Date</th>
                    <th className="px-4 py-3.5 text-right border-b border-slate-200">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[10px] font-bold text-slate-700 uppercase">
                  <AnimatePresence initial={false}>
                    {paginatedRecords.map((record) => (
                      <motion.tr 
                        key={record.id} 
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -50, backgroundColor: "rgba(239, 68, 68, 0.05)", transition: { duration: 0.3 } }}
                        className={`transition-all group hover:bg-slate-50 cursor-pointer ${
                          editingRecord?.id === record.id ? 'bg-slate-50/80 border-l-2 border-l-red-500 text-slate-900 font-extrabold' : ''
                        }`}
                        onClick={() => {
                          // Load record to edit in workspace
                          setEditingRecord(record);
                          setFormName(record.name);
                          setFormRegNo(record.regNo);
                          setFormDoctor(record.doctor);
                          setFormProcedure(record.procedure);
                          setProcedureSearch(record.procedure);
                          setFormDate(record.date);
                          setFormTime(record.time || '');
                          setFormAge(record.age || '');
                          setFormGender(record.gender || 'Male');
                          setFormDob(record.dob || '');
                          setFormReferringPhysician(record.referringPhysician || '');
                          setFormIndications(record.indications || '');
                          setFormInstruments(record.instruments || '');
                          setFormMedications(record.medications || '');
                          setFormVisualization(record.visualization || 'Clear / Excellent');
                          setFormTolerance(record.tolerance || 'Well Tolerated');
                          setFormComplications(record.complications || 'None');
                          setFormLimitations(record.limitations || 'None');
                          setFormProcedureTechnique(record.procedureTechnique || '');
                          setFormFindings(record.findings || '');
                          setFormEsophagusFindings(record.esophagusFindings || '');
                          setFormStomachFindings(record.stomachFindings || '');
                          setFormDuodenumFindings(record.duodenumFindings || '');
                          setFormColonFindings(record.colonFindings || '');
                          setFormDiagnosis(record.diagnosis || '');
                          setFormRecommendations(record.recommendations || '');
                          setFormIcdCodes(record.icdCodes || '');
                          setFormCptCodes(record.cptCodes || '');
                          setFormImages(record.images || []);
                          
                          // Scroll to top of the page so they can edit the loaded form
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          showToast(`Loaded ${record.name}'s report for editing.`, "info");
                        }}
                      >
                        <td className="px-4 py-3 text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <span>{record.serialNo}</span>
                            {duplicateSerialNumbers.has(record.serialNo?.trim().padStart(3, '0')) && (
                              <span className="bg-amber-100 text-amber-800 text-[8px] font-black px-1.5 py-0.5 rounded border border-amber-300 inline-flex items-center gap-0.5" title="Duplicate Serial Number! Click row to edit S.No">
                                ⚠️ Duplicate
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">{record.regNo}</td>
                        <td className="px-4 py-3 text-slate-800 font-bold">{record.name}</td>
                        <td className="px-4 py-3 text-slate-600">{record.doctor}</td>
                        <td className="px-4 py-3">
                          <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[8px] font-black">
                            {formatProcedureDisplay(record.procedure)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono">{record.date}</td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-1">
                            <button 
                              onClick={() => handlePrintReport(record)} 
                              className="p-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-300 transition-all cursor-pointer shadow-2xs"
                              title="Print / Download PDF"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                              </svg>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedDispatchRecord(record);
                                setIsDispatchModalOpen(true);
                                showToast(`Opening WhatsApp Dispatch Center for ${record.name}...`, "info", "Dispatch Gateway");
                              }}
                              className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-800 border border-emerald-300 hover:border-emerald-400 transition-all cursor-pointer flex items-center justify-center shadow-2xs"
                              title="Dispatch via WhatsApp"
                            >
                              <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                              </svg>
                            </button>
                            <button 
                              onClick={() => {
                                setEditingRecord(record);
                                setFormName(record.name);
                                setFormRegNo(record.regNo);
                                setFormDoctor(record.doctor);
                                setFormProcedure(record.procedure);
                                setProcedureSearch(record.procedure);
                                setFormDate(record.date);
                                setFormTime(record.time || '');
                                setFormAge(record.age || '');
                                setFormGender(record.gender || 'Male');
                                setFormDob(record.dob || '');
                                setFormReferringPhysician(record.referringPhysician || '');
                                setWhatsappFromFullString(record.whatsappNumber || '');
                                setFormIndications(record.indications || '');
                                setFormInstruments(record.instruments || '');
                                setFormMedications(record.medications || '');
                                setFormVisualization(record.visualization || 'Clear / Excellent');
                                setFormTolerance(record.tolerance || 'Well Tolerated');
                                setFormComplications(record.complications || 'None');
                                setFormLimitations(record.limitations || 'None');
                                setFormProcedureTechnique(record.procedureTechnique || '');
                                setFormFindings(record.findings || '');
                                setFormEsophagusFindings(record.esophagusFindings || '');
                                setFormStomachFindings(record.stomachFindings || '');
                                setFormDuodenumFindings(record.duodenumFindings || '');
                                setFormColonFindings(record.colonFindings || '');
                                setFormDiagnosis(record.diagnosis || '');
                                setFormRecommendations(record.recommendations || '');
                                setFormIcdCodes(record.icdCodes || '');
                                setFormCptCodes(record.cptCodes || '');
                                setFormImages(record.images || []);
                                
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                showToast(`Loaded ${record.name}'s report for editing.`, "info");
                              }} 
                              className="p-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-300 transition-all cursor-pointer shadow-2xs"
                              title="Edit Report"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {isAdmin && (
                              <button 
                                onClick={() => { setIdToDelete(record.id); setIsConfirmOpen(true); }} 
                                className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 border border-rose-200 hover:border-rose-300 transition-all cursor-pointer shadow-2xs"
                                title="Delete Report"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {sortedAndFiltered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400 italic uppercase tracking-wider font-mono bg-white">
                        No saved endoscopy reports found for this unit.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls & Records Summary */}
            {!loading && sortedAndFiltered.length > 0 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Showing <span className="text-slate-900">{Math.min(sortedAndFiltered.length, (currentPage - 1) * itemsPerPage + 1)}</span> to <span className="text-slate-900">{Math.min(sortedAndFiltered.length, currentPage * itemsPerPage)}</span> of <span className="text-slate-900">{sortedAndFiltered.length}</span> Records
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`p-1.5 rounded-lg border transition-all ${currentPage === 1 ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:scale-95 cursor-pointer'}`}
                    title="Previous Page"
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
                          className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all cursor-pointer ${currentPage === pageNum ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className={`p-1.5 rounded-lg border transition-all ${currentPage === totalPages || totalPages === 0 ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:scale-95 cursor-pointer'}`}
                    title="Next Page"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Patient Selector / Entry Modal */}
      <Modal
        isOpen={isPatientSelectorOpen}
        onClose={() => {
          setIsPatientSelectorOpen(false);
          setIsSelectorQuickAdmission(false);
        }}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-red-600 via-rose-600 to-pink-600 text-white rounded-xl shadow-md shadow-red-500/20">
              <GastroScopeIcon className="w-4 h-4 text-white" glow />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                Select or Register Patient for Endoscopy Report
              </h3>
              <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">
                Gastro / Endoscopy Clinical Report Creation
              </p>
            </div>
          </div>
        }
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
          {/* Modal Header Tab Options */}
          <div className="flex border-b border-slate-100">
            <button
              type="button"
              onClick={() => setIsSelectorQuickAdmission(false)}
              className={`flex-1 pb-3 text-[11px] font-black uppercase tracking-wider text-center border-b-2 transition-all ${
                !isSelectorQuickAdmission 
                  ? 'border-red-600 text-red-600 font-black' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              1. Choose Admitted Patient
            </button>
            <button
              type="button"
              onClick={() => setIsSelectorQuickAdmission(true)}
              className={`flex-1 pb-3 text-[11px] font-black uppercase tracking-wider text-center border-b-2 transition-all ${
                isSelectorQuickAdmission 
                  ? 'border-red-600 text-red-600 font-black' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              2. Register & Admit New Patient
            </button>
          </div>

          {!isSelectorQuickAdmission ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Select a patient currently admitted in <span className="text-slate-700 font-black">{UNIT_DETAILS[activeUnit]?.label || activeUnit}</span>:
                </p>
                <button
                  type="button"
                  onClick={() => {
                    // Outpatient / Skip prefill
                    setFormRegNo('');
                    setFormName('');
                    setFormGender('Male');
                    setFormDoctor('');
                    setProcedureSearch('');
                    setFormProcedure('');
                    setIsPatientSelectorOpen(false);
                  }}
                  className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-black uppercase tracking-wider transition-colors active:scale-95 cursor-pointer"
                >
                  Skip & Use Blank Form
                </button>
              </div>

              {/* Search Box */}
              <input
                type="text"
                placeholder="Search admitted patients by Name, MR Number, or Consultant..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-red-200 bg-slate-50 text-slate-700"
                value={selectorSearch}
                onChange={(e) => setSelectorSearch(e.target.value)}
              />

              {/* Active Census List */}
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto bg-white">
                {activePatients
                  .filter(p => {
                    const term = selectorSearch.toLowerCase();
                    return (
                      p.name.toLowerCase().includes(term) ||
                      p.regNo.toLowerCase().includes(term) ||
                      p.consultant.toLowerCase().includes(term)
                    );
                  })
                  .map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectActivePatient(p)}
                      className="p-3 bg-white hover:bg-slate-50/50 cursor-pointer flex items-center justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border-b border-slate-100 last:border-b-0 group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-900 font-black text-xs group-hover:text-red-600 transition-colors">
                            {p.name.toUpperCase()}
                          </span>
                          <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-slate-200">
                            {p.regNo}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-[10px] text-slate-500 font-medium">
                          <span>Gender: <strong className="text-slate-700">{p.gender}</strong></span>
                          <span>•</span>
                          <span>Bed: <strong className="text-slate-700">{p.location || 'N/A'}</strong></span>
                          <span>•</span>
                          <span>Consultant: <strong className="text-slate-700">{p.consultant}</strong></span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="bg-red-50 border border-red-100 text-red-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider group-hover:bg-red-600 group-hover:text-white transition-all active:scale-95 cursor-pointer"
                      >
                        Select
                      </button>
                    </div>
                  ))}
                {activePatients.filter(p => {
                  const term = selectorSearch.toLowerCase();
                  return (
                    p.name.toLowerCase().includes(term) ||
                    p.regNo.toLowerCase().includes(term) ||
                    p.consultant.toLowerCase().includes(term)
                  );
                }).length === 0 && (
                  <div className="p-8 text-center text-slate-400 italic text-[10px] uppercase font-black tracking-widest bg-slate-50">
                    No matching admitted patients found
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Quick Patient Entry / Admission Form */
            <form onSubmit={handleQuickAdmitPatient} className="space-y-4 text-slate-700">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start space-x-2">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-[9px] text-amber-800 uppercase font-bold tracking-wider leading-relaxed">
                  Note: Registering a patient here will save their clinical entry to the active <span className="font-black">{activeUnit} Census</span> database and then immediately proceed to prefill their endoscopy report.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Patient Name *</label>
                  <input
                    required
                    type="text"
                    value={admName}
                    onChange={(e) => setAdmName(e.target.value)}
                    placeholder="e.g. JOHN DOE"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">MR Number *</label>
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={admRegNo}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setAdmRegNo(val);
                    }}
                    placeholder="Reg No 0347652"
                    maxLength={8}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gender *</label>
                  <select
                    required
                    value={admGender}
                    onChange={(e) => setAdmGender(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bed/Location *</label>
                  <input
                    required
                    type="text"
                    value={admLocation}
                    onChange={(e) => setAdmLocation(e.target.value)}
                    placeholder="e.g. BED 04"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Consultant *</label>
                  <select
                    required
                    value={admConsultant}
                    onChange={(e) => setAdmConsultant(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
                  >
                    <option value="" disabled>Select Consultant</option>
                    {CONSULTANTS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Category *</label>
                  <select
                    required
                    value={admCategory}
                    onChange={(e) => setAdmCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Code Status *</label>
                  <select
                    required
                    value={admCodeStatus}
                    onChange={(e) => setAdmCodeStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
                  >
                    {CODE_STATUSES.map(cs => (
                      <option key={cs} value={cs}>{cs}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Triage Priority</label>
                  <select
                    required
                    value={admTriage}
                    onChange={(e) => setAdmTriage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
                  >
                    {TRIAGE_PRIORITIES.map(tp => (
                      <option key={tp} value={tp}>{tp}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Admission Date *</label>
                  <input
                    required
                    type="date"
                    value={admDate}
                    onChange={(e) => setAdmDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSelectorQuickAdmission(false)}
                  className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={admIsSaving}
                  className="bg-red-600 text-white hover:bg-red-700 px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center space-x-1 cursor-pointer"
                >
                  {admIsSaving ? 'Admitting...' : 'Admit & Start Report'}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={isExitConfirmOpen} 
        onClose={() => setIsExitConfirmOpen(false)} 
        onConfirm={() => {
          setIsExitConfirmOpen(false);
          setIsWorkspaceOpen(false);
          setEditingRecord(null);
          if (onExit) onExit();
        }} 
        title="Unsaved Report Findings" 
        message="Are you sure you want to exit the workspace? Your auto-saved draft will be preserved in Local Storage, but you will leave the editor." 
        confirmLabel="Yes, Exit"
        variant="warning"
      />

      {/* Live Report Print Preview Modal Workspace */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex flex-col overflow-hidden">
          {/* Top sticky control bar */}
          <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
              <div>
                <h3 className="text-xs font-black uppercase text-slate-100 tracking-wider">Live Report Print Preview</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">A4 Medical Standard • Exact PDF Simulation</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Segmented compact/detailed toggle */}
              <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-1 mr-2">
                <button
                  type="button"
                  onClick={() => setIsCompactView(false)}
                  className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    !isCompactView
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Detailed View
                </button>
                <button
                  type="button"
                  onClick={() => setIsCompactView(true)}
                  className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    isCompactView
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Compact View
                </button>
              </div>

              <button
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-700/80 transition-all cursor-pointer active:scale-95"
              >
                Back To Edit
              </button>

              <button
                onClick={async (e) => {
                  await handleSubmit(e, false);
                  setIsPreviewOpen(false);
                }}
                disabled={isSaving || !isFormValid}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all flex items-center space-x-1.5 ${
                  isFormValid && !isSaving
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 cursor-pointer active:scale-95 animate-pulse'
                    : 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-not-allowed opacity-50'
                }`}
                title={!formDate ? "Please select a Procedure Date" : isDateInFuture ? "Procedure Date cannot be in the future" : !isFormValid ? "Please fill all required fields" : "Save Report"}
              >
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>Save Report</span>
              </button>

              <button
                onClick={async (e) => {
                  await handleSubmit(e, true);
                  setIsPreviewOpen(false);
                }}
                disabled={isSaving || !isFormValid}
                className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-1.5 border ${
                  isFormValid && !isSaving
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950/40 border-red-500/50 cursor-pointer active:scale-95 animate-pulse'
                    : 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-not-allowed opacity-50'
                }`}
                title={!formDate ? "Please select a Procedure Date" : isDateInFuture ? "Procedure Date cannot be in the future" : !isFormValid ? "Please fill all required fields" : "Save & Print PDF"}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Save & Print PDF</span>
              </button>
            </div>
          </div>

          {/* Interactive Page Container Workspace */}
          <div className="flex-1 overflow-y-auto bg-slate-900/90 p-3 sm:p-8 md:p-12 flex justify-center custom-scrollbar pb-24 sm:pb-32">
            {/* The physical-looking A4 medical sheet Workspace */}
            <EndoscopyReportPreviewSheet
              formName={formName}
              formRegNo={formRegNo}
              formAge={formAge}
              formGender={formGender}
              formDate={formDate}
              formTime={formTime}
              formDoctor={formDoctor}
              formReferringPhysician={formReferringPhysician}
              formProcedure={formProcedure}
              formMedications={formMedications}
              formInstruments={formInstruments}
              formVisualization={formVisualization}
              formTolerance={formTolerance}
              formComplications={formComplications}
              formIndications={formIndications}
              formProcedureTechnique={formProcedureTechnique}
              formEsophagusFindings={formEsophagusFindings}
              formStomachFindings={formStomachFindings}
              formAntrumFindings={formAntrumFindings}
              formDuodenumFindings={formDuodenumFindings}
              formDuodenum2ndPartFindings={formDuodenum2ndPartFindings}
              formColonFindings={formColonFindings}
              formFindings={formFindings}
              formRectumFindings={formRectumFindings}
              formSigmoidColonFindings={formSigmoidColonFindings}
              formTransverseColonFindings={formTransverseColonFindings}
              formDescendingColonFindings={formDescendingColonFindings}
              formAscendingColonFindings={formAscendingColonFindings}
              formCaecumFindings={formCaecumFindings}
              formDiagnosis={formDiagnosis}
              formRecommendations={formRecommendations}
              formImages={formImages}
              isBronchoscopy={isBronchoscopy}
              isColonoscopy={isColonoscopy}
              isCompactView={isCompactView}
              currentUser={currentUser}
            />
          </div>
        </div>
      )}

      {/* Floating Toast Notification Container */}
      {renderToastContainer()}

      {imageToCrop && (
        <ImageCropperModal
          isOpen={true}
          imageUrl={imageToCrop.base64}
          imageTitle={imageToCrop.title}
          onClose={() => setImageToCrop(null)}
          onCropSave={(croppedBase64) => handleSaveCroppedImage(croppedBase64, imageToCrop.title, imageToCrop.id)}
        />
      )}
    </>
  );
}

  return (
    <div className="space-y-6">
      {/* Top View Selector Tabs */}
      <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setMainTab('analytics')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              mainTab === 'analytics'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <span>Analytics Dashboard</span>
          </button>
          <button
            onClick={() => setMainTab('logs')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              mainTab === 'logs'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm0 5.25h.007v.008H3.75V12zm0 5.25h.007v.008H3.75v-.008z" />
            </svg>
            <span>Procedure Logs ({records.length})</span>
          </button>
        </div>
      </div>

      {mainTab === 'analytics' ? (
        <EndoscopyAnalyticsDashboard
          records={records}
          activeUnit={activeUnit}
        />
      ) : (
        <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 gap-2">
            <div className="relative flex-1 max-w-md" title="Search Endoscopy logs (Alt+S)">
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Search endoscopy logs..."
                className="pl-4 pr-24 py-2 border border-slate-200 rounded-lg w-full text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 shadow-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:focus:ring-red-950"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button
                type="button"
                onClick={openAdvancedSearch}
                className="absolute right-2 top-1.5 flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[8px] font-black text-slate-700 shadow-sm hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                title="Open Advanced Filter (Alt+S)"
              >
                <span>Filter</span>
                <kbd className="opacity-70 bg-slate-200 dark:bg-slate-700 px-0.5 rounded">Alt+S</kbd>
              </button>
            </div>
            {canManageRecords && (
              <button 
                onClick={() => {
                  setEditingRecord(null);
                  setIsWorkspaceOpen(true);
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg active:scale-95"
              >
                + Add Patient Log
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
          <button 
            onClick={handleApplyDateFilter}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-md active:scale-95 flex items-center gap-2"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            Fetch Data
          </button>
          {isFilterActive && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
               <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
               <span className="text-[8px] font-black uppercase tracking-widest">Active Filters ({sortedAndFiltered.length} of {records.length})</span>
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

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-100 text-slate-800 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 bg-gradient-to-br from-red-600 via-rose-600 to-pink-600 text-white rounded-lg shadow-sm flex items-center justify-center">
                <GastroScopeIcon className="w-3.5 h-3.5 text-white" glow />
              </div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center space-x-2">
                  <span>Endoscopy & Gastro Procedure Register</span>
                </h3>
                <p className="text-[8.5px] text-slate-500 font-medium">Recorded clinical procedures, endoscopic findings & report archives</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[8.5px] font-mono text-slate-600 font-bold bg-slate-200/70 px-2.5 py-0.5 rounded-md border border-slate-300 shadow-xs">
                Active View: <strong className="text-red-600 font-extrabold">{sortedAndFiltered.length}</strong> Records
              </span>
            </div>
          </div>
          <div className="overflow-x-auto whitespace-nowrap max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3 animate-pulse min-w-[1000px]">
                <div className="h-8 bg-slate-100 rounded-lg w-full flex items-center px-4 justify-between">
                  <div className="h-3 w-12 bg-slate-200 rounded" />
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                  <div className="h-3 w-36 bg-slate-200 rounded" />
                  <div className="h-3 w-28 bg-slate-200 rounded" />
                  <div className="h-3 w-24 bg-slate-200 rounded" />
                  <div className="h-3 w-28 bg-slate-200 rounded" />
                </div>
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="h-10 bg-slate-50 rounded-lg w-full flex items-center px-4 justify-between border border-slate-100">
                    <div className="h-3 w-10 bg-slate-200 rounded" />
                    <div className="h-3 w-20 bg-slate-200 rounded" />
                    <div className="h-3 w-36 bg-slate-200 rounded" />
                    <div className="h-3 w-28 bg-slate-200 rounded" />
                    <div className="h-3 w-24 bg-slate-200 rounded" />
                    <div className="h-3 w-28 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <table className="w-full text-left border-separate border-spacing-0">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 shadow-xs border-b border-slate-200">
                  <tr className="text-[9.5px] font-black uppercase tracking-widest select-none border-b border-slate-200">
                    <th className="px-5 py-2.5 cursor-pointer hover:bg-slate-200/80 transition-colors group border-b border-slate-200" onClick={() => handleSort('serialNo')}>
                      <div className="flex items-center space-x-1.5"><span>S.No</span> <SortIndicator column="serialNo" /></div>
                    </th>
                    <th className="px-5 py-2.5 cursor-pointer hover:bg-slate-200/80 transition-colors group border-b border-slate-200" onClick={() => handleSort('regNo')}>
                      <div className="flex items-center space-x-1.5"><span>Reg No</span> <SortIndicator column="regNo" /></div>
                    </th>
                    <th className="px-5 py-2.5 cursor-pointer hover:bg-slate-200/80 transition-colors group border-b border-slate-200" onClick={() => handleSort('name')}>
                      <div className="flex items-center space-x-1.5"><span>Patient Name</span> <SortIndicator column="name" /></div>
                    </th>
                    <th className="px-5 py-2.5 cursor-pointer hover:bg-slate-200/80 transition-colors group border-b border-slate-200" onClick={() => handleSort('doctor')}>
                      <div className="flex items-center space-x-1.5"><span>Physician</span> <SortIndicator column="doctor" /></div>
                    </th>
                    <th className="px-5 py-2.5 cursor-pointer hover:bg-slate-200/80 transition-colors group border-b border-slate-200" onClick={() => handleSort('procedure')}>
                      <div className="flex items-center space-x-1.5"><span>Procedure</span> <SortIndicator column="procedure" /></div>
                    </th>
                    <th className="px-5 py-2.5 cursor-pointer hover:bg-slate-200/80 transition-colors group border-b border-slate-200" onClick={() => handleSort('date')}>
                      <div className="flex items-center space-x-1.5"><span>Date</span> <SortIndicator column="date" /></div>
                    </th>
                    <th className="px-5 py-2.5 text-right bg-slate-100 border-b border-slate-200">Action</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-slate-100 text-[10px] font-bold text-slate-700 uppercase">
                <AnimatePresence initial={false}>
                  {paginatedRecords.map((record) => (
                    <motion.tr 
                      key={record.id} 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -50, backgroundColor: "rgba(239, 68, 68, 0.15)", transition: { duration: 0.3 } }}
                      className={`transition-all group cursor-pointer ${
                        newlyAddedId === record.id 
                          ? 'bg-blue-50/70 border-l-4 border-l-blue-500' 
                          : 'hover:bg-slate-50'
                      }`}
                      onClick={() => { setEditingRecord(record); setIsWorkspaceOpen(true); }}
                    >
                      <td className="px-6 py-4 text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span>{record.serialNo}</span>
                          {duplicateSerialNumbers.has(record.serialNo?.trim().padStart(3, '0')) && (
                            <span className="bg-amber-100 text-amber-800 text-[8px] font-black px-1.5 py-0.5 rounded border border-amber-300 inline-flex items-center gap-0.5" title="Duplicate Serial Number! Click row to edit S.No">
                              ⚠️ Duplicate
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-900">{record.regNo}</td>
                      <td className="px-6 py-4 text-slate-900">{record.name}</td>
                      <td className="px-6 py-4">{record.doctor}</td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[8px] border border-slate-200 font-black">
                          {formatProcedureDisplay(record.procedure)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-mono">{record.date}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handlePrintReport(record); }} 
                            className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-all"
                            title="Print Procedure Report"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handlePrintReport(record); }} 
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                            title="Download Report as PDF"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          {canManageRecords && (
                            <button onClick={(e) => { e.stopPropagation(); setEditingRecord(record); setIsWorkspaceOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Edit Entry">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={(e) => { e.stopPropagation(); setIdToDelete(record.id); setIsConfirmOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all" title="Delete Entry">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {sortedAndFiltered.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic font-medium uppercase tracking-widest">NO ENDOSCOPY RECORDS FOUND FOR THIS CRITERIA</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls & Records Summary */}
        {!loading && sortedAndFiltered.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Showing <span className="text-slate-900">{Math.min(sortedAndFiltered.length, (currentPage - 1) * itemsPerPage + 1)}</span> to <span className="text-slate-900">{Math.min(sortedAndFiltered.length, currentPage * itemsPerPage)}</span> of <span className="text-slate-900">{sortedAndFiltered.length}</span> Records
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-2 rounded-xl border transition-all ${currentPage === 1 ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 active:scale-95 cursor-pointer shadow-2xs'}`}
                title="Previous Page"
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
                      className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all cursor-pointer ${currentPage === pageNum ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 shadow-2xs'}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className={`p-2 rounded-xl border transition-all ${currentPage === totalPages || totalPages === 0 ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 active:scale-95 cursor-pointer shadow-2xs'}`}
                title="Next Page"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
      )}

      <Modal 
        isOpen={isWorkspaceOpen} 
        onClose={() => { if(!isSaving) { setIsWorkspaceOpen(false); setEditingRecord(null); } }} 
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-red-600 via-rose-600 to-pink-600 text-white rounded-xl shadow-md shadow-red-500/20">
              <GastroScopeIcon className="w-4 h-4 text-white" glow />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                {editingRecord ? `Edit Endoscopy Log Entry` : `Add Patient Endoscopy Log`}
              </h3>
              <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">
                Gastroenterology & Endoscopy Clinical Entry
              </p>
            </div>
          </div>
        }
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 text-slate-700">
          <div className="bg-gradient-to-r from-red-50 via-rose-50/50 to-slate-50 border border-red-200/80 rounded-xl p-3 flex items-start space-x-3 shadow-xs">
            <div className="p-1.5 bg-red-600 text-white rounded-lg shadow-xs shrink-0 mt-0.5">
              <GastroScopeIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="text-[10px] text-slate-700 uppercase font-bold tracking-wider leading-relaxed">
              <span className="text-red-700 font-black block text-[11px] mb-0.5">ENDOSCOPY CLINICAL REPORT FORM</span>
              Fill in patient identification, physician details, and procedure findings to record an endoscopy log entry for the monthly archives.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Serial No (S.No)</label>
              <input 
                type="text" 
                value={formSerialNo} 
                onChange={(e) => setFormSerialNo(e.target.value)} 
                placeholder={editingRecord ? editingRecord.serialNo : autoSerialNo} 
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-red-200" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">MR Number *</label>
              <input 
                required 
                type="text" 
                inputMode="numeric"
                pattern="[0-9]*"
                value={formRegNo} 
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 8) {
                    setFormRegNo(val);
                  }
                }} 
                className={`w-full px-3 py-2 border rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white ${
                  showValidationErrors && !formRegNo.trim()
                    ? 'border-red-500 ring-1 ring-red-200 bg-red-50/20' 
                    : 'border-slate-200'
                }`}
                placeholder="Enter MRN/Reg No (Max 8 digits)" 
              />
              {showValidationErrors && !formRegNo.trim() && (
                <p className="text-[8px] font-black text-red-500 uppercase tracking-wider mt-0.5 animate-pulse">
                  ⚠️ Required
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Patient Full Name *</label>
              <input 
                required 
                type="text" 
                value={formName} 
                onChange={(e) => setFormName(e.target.value.toUpperCase())} 
                className={`w-full px-3 py-2 border rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white ${
                  showValidationErrors && !formName.trim()
                    ? 'border-red-500 ring-1 ring-red-200 bg-red-50/20' 
                    : 'border-slate-200'
                }`}
                placeholder="e.g. JOHN DOE" 
              />
              {showValidationErrors && !formName.trim() && (
                <p className="text-[8px] font-black text-red-500 uppercase tracking-wider mt-0.5 animate-pulse">
                  ⚠️ Required
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Age</label>
                <input type="text" value={formAge} onChange={(e) => setFormAge(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white" placeholder="e.g. 45" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gender</label>
                <select value={formGender} onChange={(e) => setFormGender(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Operating Physician *</label>
              <select 
                required 
                value={formDoctor} 
                onChange={(e) => setFormDoctor(e.target.value)} 
                className={`w-full px-3 py-2 border rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white cursor-pointer ${
                  showValidationErrors && !formDoctor
                    ? 'border-red-500 ring-1 ring-red-200 bg-red-50/20' 
                    : 'border-slate-200'
                }`}
              >
                <option value="">Select Doctor</option>
                {ENDOSCOPY_DOCTORS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {showValidationErrors && !formDoctor && (
                <p className="text-[8px] font-black text-red-500 uppercase tracking-wider mt-0.5 animate-pulse">
                  ⚠️ Required
                </p>
              )}
            </div>
            <div className="relative" ref={dropdownRef}>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Procedure Type *</label>
                <input 
                  required 
                  ref={procedureInputRef}
                  id="endoscopy-field-procedure"
                  value={procedureSearch} 
                  onFocus={() => setIsProcedureListOpen(true)}
                  onChange={(e) => {
                    setProcedureSearch(e.target.value);
                    setFormProcedure(e.target.value);
                    setHighlightedIndex(-1);
                  }} 
                  onKeyDown={handleKeyDown}
                  className={`w-full px-3 py-2 border rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white ${
                    showValidationErrors && !formProcedure
                      ? 'border-red-500 ring-1 ring-red-200 bg-red-50/20' 
                      : 'border-slate-200'
                  }`}
                  placeholder="Search Procedure..."
                />
                {showValidationErrors && !formProcedure && (
                  <p className="text-[8px] font-black text-red-500 uppercase tracking-wider mt-0.5 animate-pulse">
                    ⚠️ Required
                  </p>
                )}
              </div>
              {isProcedureListOpen && procedureSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-40 overflow-y-auto">
                  {procedureSuggestions.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectProcedure(p)}
                      className={`w-full text-left px-4 py-2 text-[10px] font-bold transition-colors uppercase ${
                        idx === highlightedIndex ? 'bg-red-100 text-red-700' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Procedure Date *</label>
              <input 
                type="date" 
                required 
                id="endoscopy-field-date" 
                value={formDate} 
                onChange={(e) => setFormDate(e.target.value)} 
                className={`w-full px-3 py-2 border rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white ${
                  showValidationErrors && (!formDate || isDateInFuture)
                    ? 'border-red-500 ring-1 ring-red-200 bg-red-50/20' 
                    : 'border-slate-200'
                }`}
              />
              {showValidationErrors && !formDate && (
                <p className="text-[8px] font-black text-red-500 uppercase tracking-wider mt-0.5 animate-pulse">
                  ⚠️ Required
                </p>
              )}
              {isDateInFuture && <p className="text-[9px] font-bold text-red-600 uppercase tracking-wider">Date cannot be in the future</p>}
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Procedure Time</label>
              <input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Key Findings / Diagnosis Details</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFormDiagnosis("")}
                  className="text-[8px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider hover:bg-rose-100 transition-all border border-rose-200 shadow-sm cursor-pointer"
                >
                  × Clear
                </button>
                <VoiceDictationButton context="dictation" onTranscript={(text) => setFormDiagnosis(prev => prev ? `${prev} ${text}` : text)} lightTheme />
              </div>
            </div>
            <textarea 
              value={formDiagnosis} 
              onChange={(e) => setFormDiagnosis(e.target.value)} 
              rows={3} 
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white" 
              placeholder="Enter diagnoses, key findings or procedure details..."
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                setIsWorkspaceOpen(false);
                setEditingRecord(null);
              }}
              className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !isFormValid}
              className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-md flex items-center space-x-1 ${
                isFormValid && !isSaving 
                  ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer active:scale-95' 
                  : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60'
              }`}
              title={
                !formDate 
                  ? "Please select a Procedure Date" 
                  : isDateInFuture 
                  ? "Procedure Date cannot be in the future" 
                  : !isFormValid 
                  ? "Please complete all required fields" 
                  : "Save Log Entry"
              }
            >
              {isSaving ? 'Saving...' : 'Save Log Entry'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Patient Selector / Entry Modal */}
      <Modal
        isOpen={isPatientSelectorOpen}
        onClose={() => {
          setIsPatientSelectorOpen(false);
          setIsSelectorQuickAdmission(false);
        }}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-red-600 via-rose-600 to-pink-600 text-white rounded-xl shadow-md shadow-red-500/20">
              <GastroScopeIcon className="w-4 h-4 text-white" glow />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                Select or Register Patient for Endoscopy Report
              </h3>
              <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">
                Gastro / Endoscopy Clinical Report Creation
              </p>
            </div>
          </div>
        }
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
          {/* Modal Header Tab Options */}
          <div className="flex border-b border-slate-100">
            <button
              type="button"
              onClick={() => setIsSelectorQuickAdmission(false)}
              className={`flex-1 pb-3 text-[11px] font-black uppercase tracking-wider text-center border-b-2 transition-all ${
                !isSelectorQuickAdmission 
                  ? 'border-red-600 text-red-600 font-black' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              1. Choose Admitted Patient
            </button>
            <button
              type="button"
              onClick={() => setIsSelectorQuickAdmission(true)}
              className={`flex-1 pb-3 text-[11px] font-black uppercase tracking-wider text-center border-b-2 transition-all ${
                isSelectorQuickAdmission 
                  ? 'border-red-600 text-red-600 font-black' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              2. Register & Admit New Patient
            </button>
          </div>

          {!isSelectorQuickAdmission ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Select a patient currently admitted in <span className="text-slate-700 font-black">{UNIT_DETAILS[activeUnit]?.label || activeUnit}</span>:
                </p>
                <button
                  type="button"
                  onClick={() => {
                    // Outpatient / Skip prefill
                    setFormRegNo('');
                    setFormName('');
                    setFormGender('Male');
                    setFormDoctor('');
                    setProcedureSearch('');
                    setFormProcedure('');
                    setIsPatientSelectorOpen(false);
                    setIsWorkspaceOpen(true);
                  }}
                  className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-black uppercase tracking-wider transition-colors active:scale-95"
                >
                  Skip & Use Blank Form
                </button>
              </div>

              {/* Search Box */}
              <input
                type="text"
                placeholder="Search admitted patients by Name, MR Number, or Consultant..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-red-200 bg-slate-50"
                value={selectorSearch}
                onChange={(e) => setSelectorSearch(e.target.value)}
              />

              {/* Active Census List */}
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto bg-white">
                {activePatients
                  .filter(p => {
                    const term = selectorSearch.toLowerCase();
                    return (
                      p.name.toLowerCase().includes(term) ||
                      p.regNo.toLowerCase().includes(term) ||
                      p.consultant.toLowerCase().includes(term)
                    );
                  })
                  .map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectActivePatient(p)}
                      className="p-3 bg-white hover:bg-slate-50/50 cursor-pointer flex items-center justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border-b border-slate-100 last:border-b-0 group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-900 font-black text-xs group-hover:text-red-600 transition-colors">
                            {p.name.toUpperCase()}
                          </span>
                          <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-slate-200">
                            {p.regNo}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-[10px] text-slate-500 font-medium">
                          <span>Gender: <strong className="text-slate-700">{p.gender}</strong></span>
                          <span>•</span>
                          <span>Bed: <strong className="text-slate-700">{p.location || 'N/A'}</strong></span>
                          <span>•</span>
                          <span>Consultant: <strong className="text-slate-700">{p.consultant}</strong></span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="bg-red-50 border border-red-100 text-red-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider group-hover:bg-red-600 group-hover:text-white transition-all active:scale-95"
                      >
                        Select
                      </button>
                    </div>
                  ))}
                {activePatients.filter(p => {
                  const term = selectorSearch.toLowerCase();
                  return (
                    p.name.toLowerCase().includes(term) ||
                    p.regNo.toLowerCase().includes(term) ||
                    p.consultant.toLowerCase().includes(term)
                  );
                }).length === 0 && (
                  <div className="p-8 text-center text-slate-400 italic text-[10px] uppercase font-black tracking-widest bg-slate-50">
                    No matching admitted patients found
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Quick Patient Entry / Admission Form */
            <form onSubmit={handleQuickAdmitPatient} className="space-y-4 text-slate-700">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start space-x-2">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-[9px] text-amber-800 uppercase font-bold tracking-wider leading-relaxed">
                  Note: Registering a patient here will save their clinical entry to the active <span className="font-black">{activeUnit} Census</span> database and then immediately proceed to prefill their endoscopy report.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Patient Name *</label>
                  <input
                    required
                    type="text"
                    value={admName}
                    onChange={(e) => setAdmName(e.target.value)}
                    placeholder="e.g. JOHN DOE"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">MR Number *</label>
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={admRegNo}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setAdmRegNo(val);
                    }}
                    placeholder="Reg No 0347652"
                    maxLength={8}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gender *</label>
                  <select
                    required
                    value={admGender}
                    onChange={(e) => setAdmGender(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bed/Location *</label>
                  <input
                    required
                    type="text"
                    value={admLocation}
                    onChange={(e) => setAdmLocation(e.target.value)}
                    placeholder="e.g. BED 04"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Consultant *</label>
                  <select
                    required
                    value={admConsultant}
                    onChange={(e) => setAdmConsultant(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
                  >
                    <option value="" disabled>Select Consultant</option>
                    {CONSULTANTS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Category *</label>
                  <select
                    required
                    value={admCategory}
                    onChange={(e) => setAdmCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Code Status *</label>
                  <select
                    required
                    value={admCodeStatus}
                    onChange={(e) => setAdmCodeStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
                  >
                    {CODE_STATUSES.map(cs => (
                      <option key={cs} value={cs}>{cs}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Triage Priority</label>
                  <select
                    required
                    value={admTriage}
                    onChange={(e) => setAdmTriage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
                  >
                    {TRIAGE_PRIORITIES.map(tp => (
                      <option key={tp} value={tp}>{tp}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Admission Date *</label>
                  <input
                    required
                    type="date"
                    value={admDate}
                    onChange={(e) => setAdmDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-red-200 bg-white"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSelectorQuickAdmission(false)}
                  className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={admIsSaving}
                  className="bg-red-600 text-white hover:bg-red-700 px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center space-x-1"
                >
                  {admIsSaving ? 'Admitting...' : 'Admit & Start Report'}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      <ConfirmModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={handleDelete} title="Purge Record" message="Permanently delete this procedure log entry?" />
      <ConfirmModal 
        isOpen={isExitConfirmOpen} 
        onClose={() => setIsExitConfirmOpen(false)} 
        onConfirm={() => {
          setIsExitConfirmOpen(false);
          setIsWorkspaceOpen(false);
          setEditingRecord(null);
          if (onExit) onExit();
        }} 
        title="Unsaved Report Findings" 
        message="Are you sure you want to exit the workspace? Your auto-saved draft will be preserved in Local Storage, but you will leave the editor." 
        confirmLabel="Yes, Exit"
        variant="warning"
      />
      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        onExport={(opts) => {
          const filterDetails = [
            appliedStartDate && appliedEndDate ? `Date Range: ${appliedStartDate} to ${appliedEndDate}` : 'All Dates',
            searchTerm ? `Search: "${searchTerm}"` : null,
            'Unit: Endoscopy Unit'
          ].filter(Boolean).join(' | ');

          exportEndoscopyPDF(sortedAndFiltered, { 
            generatedBy: opts.generatedBy, 
            filters: filterDetails 
          });
        }} 
        title="Endoscopy Audit Export" 
      />

      {/* Live Report Print Preview Modal Dashboard */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex flex-col overflow-hidden">
          {/* Top sticky control bar */}
          <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
              <div>
                <h3 className="text-xs font-black uppercase text-slate-100 tracking-wider">Live Report Print Preview</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">A4 Medical Standard • Exact PDF Simulation</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Segmented compact/detailed toggle */}
              <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-1 mr-2">
                <button
                  type="button"
                  onClick={() => setIsCompactView(false)}
                  className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    !isCompactView
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Detailed View
                </button>
                <button
                  type="button"
                  onClick={() => setIsCompactView(true)}
                  className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    isCompactView
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Compact View
                </button>
              </div>

              <button
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-700/80 transition-all cursor-pointer active:scale-95"
              >
                Back To Edit
              </button>

              <button
                onClick={async (e) => {
                  await handleSubmit(e, false);
                  setIsPreviewOpen(false);
                }}
                disabled={isSaving || !isFormValid}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all flex items-center space-x-1.5 ${
                  isFormValid && !isSaving
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 cursor-pointer active:scale-95 animate-pulse'
                    : 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-not-allowed opacity-50'
                }`}
                title={!formDate ? "Please select a Procedure Date" : isDateInFuture ? "Procedure Date cannot be in the future" : !isFormValid ? "Please fill all required fields" : "Save Report"}
              >
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>Save Report</span>
              </button>

              <button
                onClick={async (e) => {
                  await handleSubmit(e, true);
                  setIsPreviewOpen(false);
                }}
                disabled={isSaving || !isFormValid}
                className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-1.5 border ${
                  isFormValid && !isSaving
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950/40 border-red-500/50 cursor-pointer active:scale-95 animate-pulse'
                    : 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-not-allowed opacity-50'
                }`}
                title={!formDate ? "Please select a Procedure Date" : isDateInFuture ? "Procedure Date cannot be in the future" : !isFormValid ? "Please fill all required fields" : "Save & Print PDF"}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Save & Print PDF</span>
              </button>
            </div>
          </div>

          {/* Interactive Page Container Dashboard */}
          <div className="flex-1 overflow-y-auto bg-slate-900/90 p-3 sm:p-8 md:p-12 flex justify-center custom-scrollbar pb-24 sm:pb-32">
            {/* The physical-looking A4 medical sheet Dashboard */}
            <EndoscopyReportPreviewSheet
              formName={formName}
              formRegNo={formRegNo}
              formAge={formAge}
              formGender={formGender}
              formDate={formDate}
              formTime={formTime}
              formDoctor={formDoctor}
              formReferringPhysician={formReferringPhysician}
              formProcedure={formProcedure}
              formMedications={formMedications}
              formInstruments={formInstruments}
              formVisualization={formVisualization}
              formTolerance={formTolerance}
              formComplications={formComplications}
              formIndications={formIndications}
              formProcedureTechnique={formProcedureTechnique}
              formEsophagusFindings={formEsophagusFindings}
              formStomachFindings={formStomachFindings}
              formAntrumFindings={formAntrumFindings}
              formDuodenumFindings={formDuodenumFindings}
              formDuodenum2ndPartFindings={formDuodenum2ndPartFindings}
              formColonFindings={formColonFindings}
              formFindings={formFindings}
              formRectumFindings={formRectumFindings}
              formSigmoidColonFindings={formSigmoidColonFindings}
              formTransverseColonFindings={formTransverseColonFindings}
              formDescendingColonFindings={formDescendingColonFindings}
              formAscendingColonFindings={formAscendingColonFindings}
              formCaecumFindings={formCaecumFindings}
              formDiagnosis={formDiagnosis}
              formRecommendations={formRecommendations}
              formImages={formImages}
              isBronchoscopy={isBronchoscopy}
              isColonoscopy={isColonoscopy}
              isCompactView={isCompactView}
              currentUser={currentUser}
            />
          </div>
        </div>
      )}

      {/* Floating Toast Notification Container */}
      {renderToastContainer()}

      {imageToCrop && (
        <ImageCropperModal
          isOpen={true}
          imageUrl={imageToCrop.base64}
          imageTitle={imageToCrop.title}
          onClose={() => setImageToCrop(null)}
          onCropSave={(croppedBase64) => handleSaveCroppedImage(croppedBase64, imageToCrop.title, imageToCrop.id)}
        />
      )}

      {/* WhatsApp & Email Cloud Function Dispatch Modal */}
      {selectedDispatchRecord && (
        <WhatsAppDispatchModal
          isOpen={isDispatchModalOpen}
          onClose={() => {
            setIsDispatchModalOpen(false);
            setSelectedDispatchRecord(null);
          }}
          record={selectedDispatchRecord}
          onDispatchSuccess={(log) => {
            showToast(
              `Report successfully dispatched via ${log.channel.toUpperCase()} (${log.recipient})`,
              'success',
              'Dispatch Successful'
            );
            if (selectedDispatchRecord) {
              const updatedHistory = [log, ...(selectedDispatchRecord.dispatchHistory || [])];
              const updatedRecord = { ...selectedDispatchRecord, dispatchHistory: updatedHistory };
              setSelectedDispatchRecord(updatedRecord);
              setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
            }
          }}
          onDispatchError={(errorMsg) => {
            showToast(
              errorMsg || 'Failed to dispatch report. Please check details and retry.',
              'error',
              'Dispatch Failed'
            );
          }}
        />
      )}
    </div>
  );
};

export default EndoscopyPage;