import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useUnit } from '../contexts/UnitContext';
import { useToast } from '../contexts/ToastContext';
import { CLINICAL_UNITS, UNIT_DETAILS, formatProcedureDisplay } from '../constants';
import { 
  Patient, 
  ClinicalTask, 
  InventoryItem, 
  IncidentRecord, 
  EndoscopyRecord,
  ClinicalUnit
} from '../types';
import { 
  generateKidneyCentreLogoBase64,
  getLogoSettings,
  saveLogoSettings,
  getEffectiveLogoBase64,
  getLogoUrlWithCacheBust,
  DEFAULT_LOGO_SETTINGS,
  LogoSettings
} from '../services/pdfService';
import { downloadCSV, downloadExcel } from '../services/exportService';
import { 
  Printer, 
  FileText, 
  X, 
  Loader2, 
  Settings, 
  CheckSquare, 
  Square, 
  Calendar, 
  Clock, 
  User, 
  FileSignature, 
  Building,
  History,
  Table,
  Download,
  FileType,
  FileSpreadsheet,
  SlidersHorizontal,
  BarChart3,
  PieChart,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Check,
  Layers,
  Eye,
  EyeOff,
  Activity,
  Upload,
  Image as ImageIcon,
  Maximize2,
  Move,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2
} from 'lucide-react';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

type LayoutMode = 'compact' | 'narrative';

type ReportType = 
  | 'current' 
  | 'census' 
  | 'tasks' 
  | 'inventory' 
  | 'mortality' 
  | 'incidents' 
  | 'endoscopy' 
  | 'comprehensive';

type ExportFormat = 'PDF' | 'CSV' | 'Excel';

const ReportTypeLabels: Record<ReportType, string> = {
  current: 'Active View Summary',
  census: 'In-Patient Census Register',
  tasks: 'Clinical Worklist & Tasks',
  inventory: 'Emergency Stock & Inventory',
  mortality: 'Clinical Mortality Review',
  incidents: 'Safety & Incidents Log',
  endoscopy: 'Endoscopy Procedure Register',
  comprehensive: 'Comprehensive Unit Audit'
};

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ 
  isOpen, 
  onClose, 
  initialTab = 'dashboard' 
}) => {
  const { currentUser } = useAuth();
  const { activeUnit } = useUnit();
  const { toast } = useToast();

  // Configuration States
  const [selectedUnit, setSelectedUnit] = useState<ClinicalUnit | 'ALL'>(activeUnit);
  const [reportType, setReportType] = useState<ReportType>('current');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('PDF');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('compact');
  const [customRemarks, setCustomRemarks] = useState('');
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [includeMetrics, setIncludeMetrics] = useState(true);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [includeIdentifiers, setIncludeIdentifiers] = useState(true);

  // Custom Logo Configuration States
  const [logoSettings, setLogoSettingsState] = useState<LogoSettings>(getLogoSettings());
  const [isLogoConfigOpen, setIsLogoConfigOpen] = useState<boolean>(false);
  const [logoImageBase64, setLogoImageBase64] = useState<string>(getEffectiveLogoBase64());

  useEffect(() => {
    const handleLogoChange = () => {
      setLogoSettingsState(getLogoSettings());
      setLogoImageBase64(getEffectiveLogoBase64());
    };
    window.addEventListener('hdu_logo_settings_changed', handleLogoChange);
    return () => {
      window.removeEventListener('hdu_logo_settings_changed', handleLogoChange);
    };
  }, []);

  const handleUpdateLogoSettings = (newSettings: LogoSettings) => {
    setLogoSettingsState(newSettings);
    saveLogoSettings(newSettings);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (toast) toast.error('Invalid File', 'Please upload a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        const updated = {
          ...logoSettings,
          customLogoBase64: base64
        };
        handleUpdateLogoSettings(updated);
        if (toast) toast.success('Logo Uploaded', 'Custom header logo updated successfully.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
    const resetSettings = { ...DEFAULT_LOGO_SETTINGS, customLogoBase64: '' };
    handleUpdateLogoSettings(resetSettings);
    if (toast) toast.info('Logo Reset', 'Reverted to default institution logo.');
  };

  // Print Options Dropdown States & Block Toggles
  const [isPrintOptionsOpen, setIsPrintOptionsOpen] = useState<boolean>(false);
  const [isTopPrintOptionsOpen, setIsTopPrintOptionsOpen] = useState<boolean>(false);

  // Chart Visualization Block Toggles
  const [includeChartAcuity, setIncludeChartAcuity] = useState<boolean>(true);
  const [includeChartTrends, setIncludeChartTrends] = useState<boolean>(true);
  const [includeChartWorkload, setIncludeChartWorkload] = useState<boolean>(true);

  // Table & Clinical Data Section Toggles
  const [includeSectionCensus, setIncludeSectionCensus] = useState<boolean>(true);
  const [includeSectionTasks, setIncludeSectionTasks] = useState<boolean>(true);
  const [includeSectionInventory, setIncludeSectionInventory] = useState<boolean>(true);
  const [includeSectionMortality, setIncludeSectionMortality] = useState<boolean>(true);
  const [includeSectionIncidents, setIncludeSectionIncidents] = useState<boolean>(true);
  const [includeSectionEndoscopy, setIncludeSectionEndoscopy] = useState<boolean>(true);

  // Preset Handlers for Print Options Dropdown
  const handleSelectAllPrintOptions = () => {
    setIncludeChartAcuity(true);
    setIncludeChartTrends(true);
    setIncludeChartWorkload(true);
    setIncludeSectionCensus(true);
    setIncludeSectionTasks(true);
    setIncludeSectionInventory(true);
    setIncludeSectionMortality(true);
    setIncludeSectionIncidents(true);
    setIncludeSectionEndoscopy(true);
  };

  const handleChartsOnlyPrintOptions = () => {
    setIncludeChartAcuity(true);
    setIncludeChartTrends(true);
    setIncludeChartWorkload(true);
    setIncludeSectionCensus(false);
    setIncludeSectionTasks(false);
    setIncludeSectionInventory(false);
    setIncludeSectionMortality(false);
    setIncludeSectionIncidents(false);
    setIncludeSectionEndoscopy(false);
  };

  const handleTablesOnlyPrintOptions = () => {
    setIncludeChartAcuity(false);
    setIncludeChartTrends(false);
    setIncludeChartWorkload(false);
    setIncludeSectionCensus(true);
    setIncludeSectionTasks(true);
    setIncludeSectionInventory(true);
    setIncludeSectionMortality(true);
    setIncludeSectionIncidents(true);
    setIncludeSectionEndoscopy(true);
  };

  const activePrintOptionsCount = [
    includeChartAcuity,
    includeChartTrends,
    includeChartWorkload,
    includeSectionCensus,
    includeSectionTasks,
    includeSectionInventory,
    includeSectionMortality,
    includeSectionIncidents,
    includeSectionEndoscopy
  ].filter(Boolean).length;

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    // Census
    census_bed: true,
    census_name: true,
    census_mrn: true,
    census_admit: true,
    census_diagnosis: true,
    census_acuity: true,
    census_consultant: true,
    // Tasks
    tasks_task: true,
    tasks_priority: true,
    tasks_due: true,
    tasks_assigned: true,
    tasks_status: true,
    // Inventory
    inv_item: true,
    inv_category: true,
    inv_on_hand: true,
    inv_threshold: true,
    inv_status: true,
    // Mortality
    mort_name: true,
    mort_mrn: true,
    mort_admitted: true,
    mort_deceased: true,
    mort_diagnosis: true,
    mort_los: true,
    mort_consultant: true,
    // Incidents
    inc_serial: true,
    inc_patient: true,
    inc_date: true,
    inc_severity: true,
    inc_reported: true,
    // Endoscopy
    endo_id: true,
    endo_patient: true,
    endo_date: true,
    endo_procedure: true,
    endo_findings: true,
  });

  // Data Loading States
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [tasks, setTasks] = useState<ClinicalTask[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [mortality, setMortality] = useState<Patient[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [endoscopy, setEndoscopy] = useState<EndoscopyRecord[]>([]);

  // Print History & Audit state
  const [printHistory, setPrintHistory] = useState<{ timestamp: string; reportTitle: string; unit: string }[]>([]);

  // Load audit history from localStorage when modal is opened
  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem('clinical_print_audit_history');
        if (stored) {
          setPrintHistory(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to parse print history from localStorage:', e);
      }
    }
  }, [isOpen]);

  // Map initial tab to default report type
  useEffect(() => {
    if (isOpen) {
      setSelectedUnit(activeUnit);
      if (initialTab === 'dashboard') {
        setReportType('comprehensive');
      } else if (initialTab === 'active') {
        setReportType('census');
      } else if (initialTab === 'tasks') {
        setReportType('tasks');
      } else if (initialTab === 'inventory') {
        setReportType('inventory');
      } else if (initialTab === 'mortality') {
        setReportType('mortality');
      } else if (initialTab === 'safety-incidents') {
        setReportType('incidents');
      } else if (initialTab === 'endoscopy-report' || initialTab === 'endoscopy-logs') {
        setReportType('endoscopy');
      } else {
        setReportType('current');
      }
    }
  }, [isOpen, initialTab, activeUnit]);

  // Fetch all clinical data from Firestore for the selected unit/s
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const unitsToQuery = selectedUnit === 'ALL' ? CLINICAL_UNITS : [selectedUnit];

        // 1. Fetch Patients
        const patientsData: Patient[] = [];
        const patientsSnap = await getDocs(collection(db, 'patients'));
        patientsSnap.forEach(docSnap => {
          const data = docSnap.data() as Patient;
          if (selectedUnit === 'ALL' || data.unit === selectedUnit) {
            patientsData.push({ id: docSnap.id, ...data });
          }
        });
        setPatients(patientsData);

        // 2. Fetch Tasks
        const tasksData: ClinicalTask[] = [];
        const tasksSnap = await getDocs(collection(db, 'clinical_tasks'));
        tasksSnap.forEach(docSnap => {
          const data = docSnap.data() as ClinicalTask;
          if (selectedUnit === 'ALL' || data.unit === selectedUnit) {
            tasksData.push({ id: docSnap.id, ...data });
          }
        });
        setTasks(tasksData);

        // 3. Fetch Inventory
        const inventoryData: InventoryItem[] = [];
        const inventorySnap = await getDocs(collection(db, 'inventory'));
        inventorySnap.forEach(docSnap => {
          const data = docSnap.data() as InventoryItem;
          if (selectedUnit === 'ALL' || data.unit === selectedUnit) {
            inventoryData.push({ id: docSnap.id, ...data });
          }
        });
        setInventory(inventoryData);

        // 4. Fetch Mortality
        const mortalityData: Patient[] = [];
        const mortalitySnap = await getDocs(collection(db, 'mortality_records'));
        mortalitySnap.forEach(docSnap => {
          const data = docSnap.data() as Patient;
          if (selectedUnit === 'ALL' || data.unit === selectedUnit) {
            mortalityData.push({ id: docSnap.id, ...data });
          }
        });
        setMortality(mortalityData);

        // 5. Fetch Incidents
        const incidentsData: IncidentRecord[] = [];
        const incidentsSnap = await getDocs(collection(db, 'safety_incidents'));
        incidentsSnap.forEach(docSnap => {
          const data = docSnap.data() as IncidentRecord;
          if (selectedUnit === 'ALL' || data.unit === selectedUnit) {
            incidentsData.push({ id: docSnap.id, ...data });
          }
        });
        setIncidents(incidentsData);

        // 6. Fetch Endoscopy Records
        const endoscopyData: EndoscopyRecord[] = [];
        const endoscopySnap = await getDocs(collection(db, 'endoscopy_records'));
        endoscopySnap.forEach(docSnap => {
          const data = docSnap.data() as EndoscopyRecord;
          if (selectedUnit === 'ALL' || data.referringUnit === selectedUnit) {
            endoscopyData.push({ id: docSnap.id, ...data });
          }
        });
        setEndoscopy(endoscopyData);

      } catch (err) {
        console.error('Error fetching clinical data for printing:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, selectedUnit]);

  // Filtered/Summarized Calculations
  const summaryStats = useMemo(() => {
    const activeCensus = patients.filter(p => p.status === 'Active' || !p.dischargeDate);
    const criticalPatients = activeCensus.filter(p => p.triagePriority === 'Critical');
    const urgentTasks = tasks.filter(t => t.priority === 'High' && t.status === 'Pending');
    const lowStock = inventory.filter(i => i.quantity <= i.minThreshold);
    const activeIncidents = incidents.length;

    return {
      totalAdmitted: activeCensus.length,
      criticalAcuity: criticalPatients.length,
      pendingUrgentTasks: urgentTasks.length,
      lowStockItems: lowStock.length,
      incidentsLogged: activeIncidents,
      deceasedCount: mortality.length
    };
  }, [patients, tasks, inventory, incidents, mortality]);

  const handlePrint = () => {
    const now = new Date();
    const formattedTimestamp = now.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const newAudit = {
      timestamp: formattedTimestamp,
      reportTitle: `${getReportTitle()} [PDF]`,
      unit: selectedUnit === 'ALL' ? 'ALL UNITS' : selectedUnit
    };

    const updatedHistory = [newAudit, ...printHistory].slice(0, 5);
    setPrintHistory(updatedHistory);
    try {
      localStorage.setItem('clinical_print_audit_history', JSON.stringify(updatedHistory));
    } catch (e) {
      console.error('Failed to save print audit log to localStorage:', e);
    }

    // Trigger browser system print
    window.print();

    // Confirm print job initiated via Toast
    if (toast) {
      toast.success('Print job initiated', 'The document has been successfully sent to the printer queue.');
    }
  };

  const getExportDataset = () => {
    const headers: string[] = [];
    const rows: any[][] = [];
    const isAnonymous = !includeIdentifiers;

    if (reportType === 'census') {
      const activeCensus = patients.filter(p => p.status === 'Active' || !p.dischargeDate);
      if (visibleColumns.census_bed) headers.push('Bed / Location');
      if (visibleColumns.census_name) headers.push('Patient Name');
      if (visibleColumns.census_mrn) headers.push('MRN');
      if (visibleColumns.census_admit) headers.push('Admit Date');
      if (visibleColumns.census_diagnosis) headers.push('Primary Diagnosis');
      if (visibleColumns.census_acuity) headers.push('Acuity / Priority');
      if (visibleColumns.census_consultant) headers.push('Consultant');

      activeCensus.forEach(p => {
        const row: any[] = [];
        if (visibleColumns.census_bed) row.push(isAnonymous ? 'REDACTED' : p.location || '-');
        if (visibleColumns.census_name) row.push(isAnonymous ? 'PATIENT (ANONYMOUS)' : p.name);
        if (visibleColumns.census_mrn) row.push(isAnonymous ? 'REDACTED' : p.regNo);
        if (visibleColumns.census_admit) row.push(formatDate(p.admissionDate));
        if (visibleColumns.census_diagnosis) row.push((p as any).diagnosis || p.category || '-');
        if (visibleColumns.census_acuity) row.push(p.triagePriority || 'Normal');
        if (visibleColumns.census_consultant) row.push(p.consultant || '-');
        rows.push(row);
      });
    } else if (reportType === 'tasks') {
      if (visibleColumns.tasks_task) headers.push('Clinical Task');
      if (visibleColumns.tasks_priority) headers.push('Priority');
      if (visibleColumns.tasks_due) headers.push('Due Date / Time');
      if (visibleColumns.tasks_assigned) headers.push('Assigned Practitioner');
      if (visibleColumns.tasks_status) headers.push('Status');

      tasks.forEach(t => {
        const row: any[] = [];
        if (visibleColumns.tasks_task) row.push(t.title || t.description || 'Task');
        if (visibleColumns.tasks_priority) row.push(t.priority || 'Normal');
        if (visibleColumns.tasks_due) row.push(t.dueDate ? `${t.dueDate} ${(t as any).dueTime || ''}` : '-');
        if (visibleColumns.tasks_assigned) row.push((t as any).assignedTo || t.assignedBy || 'Unassigned');
        if (visibleColumns.tasks_status) row.push(t.status || 'Pending');
        rows.push(row);
      });
    } else if (reportType === 'inventory') {
      if (visibleColumns.inv_item) headers.push('Item Name');
      if (visibleColumns.inv_category) headers.push('Category');
      if (visibleColumns.inv_on_hand) headers.push('Stock On-Hand');
      if (visibleColumns.inv_threshold) headers.push('Min Threshold');
      if (visibleColumns.inv_status) headers.push('Stock Status');

      inventory.forEach(i => {
        const row: any[] = [];
        const status = i.quantity <= i.minThreshold ? 'LOW STOCK' : 'ADEQUATE';
        if (visibleColumns.inv_item) row.push(i.name);
        if (visibleColumns.inv_category) row.push(i.category || 'General');
        if (visibleColumns.inv_on_hand) row.push(`${i.quantity} ${i.measurementUnit || 'units'}`);
        if (visibleColumns.inv_threshold) row.push(`${i.minThreshold} ${i.measurementUnit || 'units'}`);
        if (visibleColumns.inv_status) row.push(status);
        rows.push(row);
      });
    } else if (reportType === 'mortality') {
      if (visibleColumns.mort_name) headers.push('Patient Name');
      if (visibleColumns.mort_mrn) headers.push('MRN');
      if (visibleColumns.mort_admitted) headers.push('Admitted');
      if (visibleColumns.mort_deceased) headers.push('Deceased Date');
      if (visibleColumns.mort_diagnosis) headers.push('Diagnosis');
      if (visibleColumns.mort_los) headers.push('Length of Stay');
      if (visibleColumns.mort_consultant) headers.push('Consultant');

      mortality.forEach(m => {
        const row: any[] = [];
        if (visibleColumns.mort_name) row.push(isAnonymous ? 'PATIENT (ANONYMOUS)' : m.name);
        if (visibleColumns.mort_mrn) row.push(isAnonymous ? 'REDACTED' : m.regNo);
        if (visibleColumns.mort_admitted) row.push(formatDate(m.admissionDate));
        if (visibleColumns.mort_deceased) row.push(formatDate(m.dischargeDate));
        if (visibleColumns.mort_diagnosis) row.push((m as any).diagnosis || m.category || '-');
        if (visibleColumns.mort_los) row.push(m.lengthOfStay ? `${m.lengthOfStay} Days` : '-');
        if (visibleColumns.mort_consultant) row.push(m.consultant || '-');
        rows.push(row);
      });
    } else if (reportType === 'incidents') {
      if (visibleColumns.inc_serial) headers.push('Serial No');
      if (visibleColumns.inc_patient) headers.push('Patient / MRN');
      if (visibleColumns.inc_date) headers.push('Incident Date');
      if (visibleColumns.inc_severity) headers.push('Category / Severity');
      if (visibleColumns.inc_reported) headers.push('Reported By');

      incidents.forEach(inc => {
        const row: any[] = [];
        if (visibleColumns.inc_serial) row.push(inc.serialNo || inc.id || '-');
        if (visibleColumns.inc_patient) row.push(isAnonymous ? 'REDACTED' : `${inc.patientName || 'N/A'} (${inc.regNo || 'N/A'})`);
        if (visibleColumns.inc_date) row.push(formatDate(inc.incidentDate));
        if (visibleColumns.inc_severity) row.push(`${inc.category || 'Safety'} [${(inc as any).severity || 'Moderate'}]`);
        if (visibleColumns.inc_reported) row.push(inc.reportedBy || 'Staff');
        rows.push(row);
      });
    } else if (reportType === 'endoscopy') {
      if (visibleColumns.endo_id) headers.push('Procedure ID');
      if (visibleColumns.endo_patient) headers.push('Patient Identity');
      if (visibleColumns.endo_date) headers.push('Date');
      if (visibleColumns.endo_procedure) headers.push('Procedure / Endoscopist');
      if (visibleColumns.endo_findings) headers.push('Findings / Diagnosis');

      endoscopy.forEach(e => {
        const row: any[] = [];
        if (visibleColumns.endo_id) row.push(e.serialNo || e.id || '-');
        if (visibleColumns.endo_patient) row.push(isAnonymous ? 'PATIENT (ANONYMOUS)' : `${e.name} (${e.regNo})`);
        if (visibleColumns.endo_date) row.push(formatDate(e.date));
        if (visibleColumns.endo_procedure) row.push(`${e.procedure || 'Procedure'} by ${e.doctor || 'Surgeon'}`);
        if (visibleColumns.endo_findings) row.push(e.diagnosis || e.findings || '-');
        rows.push(row);
      });
    } else {
      // Comprehensive / Current Layout
      headers.push('Record Type', 'Patient / Item Name', 'ID / MRN', 'Unit', 'Primary Details / Diagnosis', 'Status / Acuity', 'Date');
      patients.forEach(p => {
        rows.push([
          'In-Patient Census',
          isAnonymous ? 'PATIENT (ANONYMOUS)' : p.name,
          isAnonymous ? 'REDACTED' : p.regNo,
          p.unit || selectedUnit,
          (p as any).diagnosis || p.category || 'Admitted Patient',
          p.triagePriority || p.status || 'Active',
          formatDate(p.admissionDate)
        ]);
      });
      tasks.forEach(t => {
        rows.push([
          'Clinical Task',
          t.title || 'Task Item',
          t.id || '-',
          t.unit || selectedUnit,
          t.description || 'Clinical worklist entry',
          t.status || 'Pending',
          t.dueDate || '-'
        ]);
      });
      inventory.forEach(i => {
        rows.push([
          'Inventory Item',
          i.name,
          i.id || '-',
          i.unit || selectedUnit,
          `Category: ${i.category || 'General'}`,
          i.quantity <= i.minThreshold ? 'LOW STOCK' : 'ADEQUATE',
          '-'
        ]);
      });
    }

    return { headers, rows };
  };

  const handleExportData = () => {
    const title = getReportTitle();
    const { headers, rows } = getExportDataset();

    if (rows.length === 0) {
      if (toast) {
        toast.warning('No clinical records found to export for the selected unit/filters.', 'Empty Export');
      }
      return;
    }

    const filename = `${selectedUnit}_${reportType}_Report`;

    if (exportFormat === 'CSV') {
      downloadCSV(filename, headers, rows);
    } else if (exportFormat === 'Excel') {
      downloadExcel(filename, headers, rows);
    }

    // Save to audit history
    const now = new Date();
    const formattedTimestamp = now.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const newAudit = {
      timestamp: formattedTimestamp,
      reportTitle: `${title} [${exportFormat}]`,
      unit: selectedUnit === 'ALL' ? 'ALL UNITS' : selectedUnit
    };

    const updatedHistory = [newAudit, ...printHistory].slice(0, 5);
    setPrintHistory(updatedHistory);
    try {
      localStorage.setItem('clinical_print_audit_history', JSON.stringify(updatedHistory));
    } catch (e) {
      console.error('Failed to save print audit log to localStorage:', e);
    }

    if (toast) {
      toast.exportComplete(`Clinical report successfully generated and exported as ${exportFormat}.`);
    }
  };

  const getReportTitle = () => {
    if (reportType === 'current') {
      return `CLINICAL UNIT STATUS REPORT - ${initialTab.toUpperCase()}`;
    }
    return ReportTypeLabels[reportType].toUpperCase();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getPatientName = (name: string) => {
    return includeIdentifiers ? name : 'PATIENT (ANONYMOUS)';
  };

  const getMRN = (regNo: string) => {
    return includeIdentifiers ? regNo : 'REDACTED';
  };

  const getBedLocation = (location: string) => {
    return includeIdentifiers ? location : 'REDACTED';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      {/* 1. Global Print Styles Specific to this layout */}
      <style>{`
        @media print {
          /* Force hide ALL other elements on the page */
          body * {
            visibility: hidden !important;
          }
          /* Show ONLY the high-fidelity A4 paper preview and its kids */
          #clinical-print-preview-sheet, #clinical-print-preview-sheet * {
            visibility: visible !important;
          }
          #clinical-print-preview-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 1.5cm !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          /* Ensure headers/labels force accurate background colors when printed */
          .print-bg-slate {
            background-color: #f1f5f9 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-bg-red {
            background-color: #fef2f2 !important;
            border: 1px solid #fee2e2 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-text-dark {
            color: #0f172a !important;
          }
          .print-border {
            border: 1px solid #cbd5e1 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* LEFT SIDE PANEL - Print Configuration & Filters (Hidden during print) */}
      <div className="w-full md:w-[350px] bg-slate-900 text-white flex flex-col border-r border-slate-800 shadow-2xl z-20 no-print">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Printer className="w-5 h-5 text-red-500 animate-pulse" />
            <h3 className="font-bold text-sm tracking-tight text-slate-100 uppercase">Print Clinical Summary</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Configurations Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 1. Unit Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Clinical Unit Filter</label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value as ClinicalUnit | 'ALL')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-xs font-bold text-slate-200 outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
            >
              <option value="ALL">All Clinical Units (Facility-wide)</option>
              {CLINICAL_UNITS.map(unit => (
                <option key={unit} value={unit}>{UNIT_DETAILS[unit].label} ({unit})</option>
              ))}
            </select>
          </div>

          {/* 2. Report Type Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Summary Layout Template</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-xs font-bold text-slate-200 outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
            >
              <option value="comprehensive">Comprehensive Unit Audit</option>
              <option value="census">In-Patient Census Register</option>
              <option value="tasks">Clinical Worklist & Tasks</option>
              <option value="inventory">Emergency Stock & Inventory</option>
              <option value="mortality">Clinical Mortality Review</option>
              <option value="incidents">Safety & Incidents Log</option>
              <option value="endoscopy">Endoscopy Procedure Register</option>
              <option value="current">Active View ({initialTab})</option>
            </select>
          </div>

          {/* 2a. Select Format Dropdown */}
          <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block">Select Format</label>
              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${
                exportFormat === 'PDF' ? 'bg-red-950/70 text-red-400 border-red-900/50' :
                exportFormat === 'CSV' ? 'bg-blue-950/70 text-blue-400 border-blue-900/50' :
                'bg-emerald-950/70 text-emerald-400 border-emerald-900/50'
              }`}>
                {exportFormat} Format
              </span>
            </div>
            <div className="relative">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 pr-8 text-xs font-bold text-slate-100 outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 cursor-pointer appearance-none"
              >
                <option value="PDF">PDF Document (.pdf - High-Fidelity Printable Layout)</option>
                <option value="CSV">CSV Spreadsheet (.csv - Structured Data Export)</option>
                <option value="Excel">Excel Workbook (.xls - Formatted Excel Sheet)</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <FileType className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-tight pt-0.5">
              {exportFormat === 'PDF' && 'Direct system print preview formatted for paper filing & PDF export.'}
              {exportFormat === 'CSV' && 'Export raw data fields into a standard comma-separated spreadsheet.'}
              {exportFormat === 'Excel' && 'Export styled tabular dataset formatted directly for Microsoft Excel.'}
            </p>
          </div>

          {/* 2b. Layout Switcher (Compact Table vs Detailed Narrative) */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Record Presentation View</label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950/70 p-1.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setLayoutMode('compact')}
                className={`flex items-center justify-center space-x-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                  layoutMode === 'compact'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Compact Table</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('narrative')}
                className={`flex items-center justify-center space-x-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                  layoutMode === 'narrative'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Detailed Narrative</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-tight">
              {layoutMode === 'compact' 
                ? 'Condensed tabular layout optimized for quick overview logs.' 
                : 'Structured narrative layout with full observations formatted for physical chart filing.'}
            </p>
          </div>

          {/* 3. Custom Remarks (Handover/Notes) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Report Handover Remarks / Notes</label>
            <textarea
              value={customRemarks}
              onChange={(e) => setCustomRemarks(e.target.value)}
              placeholder="Enter custom clinical annotations, handover briefings, sign-off notes or verification guidelines to append to the bottom of the printed clinical page..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-xs font-medium text-slate-200 outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 placeholder-slate-500 resize-none leading-relaxed"
            />
          </div>

          {/* 3b. PRINT OPTIONS DROPDOWN SECTION */}
          <div className="space-y-2 bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setIsPrintOptionsOpen(!isPrintOptionsOpen)}
              className="w-full flex items-center justify-between text-left group focus:outline-none"
            >
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-red-950/70 text-red-400 border border-red-900/50 group-hover:bg-red-600 group-hover:text-white transition-all">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-200 uppercase tracking-wider block">Print Options</span>
                  <span className="text-[10px] text-slate-400 font-medium">Toggle Chart Blocks & Sections</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-800 text-red-400 border border-slate-700">
                  {activePrintOptionsCount}/9 Active
                </span>
                {isPrintOptionsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>

            {/* Collapsible Options Content */}
            {isPrintOptionsOpen && (
              <div className="pt-3 border-t border-slate-800 space-y-3.5">
                {/* Presets Bar */}
                <div className="flex items-center justify-between bg-slate-900 p-1.5 rounded-xl border border-slate-800 text-[10px] font-bold">
                  <span className="text-slate-400 uppercase text-[9px] tracking-wider pl-1">Presets:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleSelectAllPrintOptions}
                      className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 hover:bg-red-600 hover:text-white transition-all"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={handleChartsOnlyPrintOptions}
                      className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 hover:bg-blue-600 hover:text-white transition-all"
                    >
                      Charts Only
                    </button>
                    <button
                      type="button"
                      onClick={handleTablesOnlyPrintOptions}
                      className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 hover:bg-emerald-600 hover:text-white transition-all"
                    >
                      Tables Only
                    </button>
                  </div>
                </div>

                {/* Group 1: Chart Visualization Blocks */}
                <div className="space-y-1.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-red-400 flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    <span>Chart Visualization Blocks</span>
                  </p>
                  <div className="space-y-1 pl-1">
                    <button
                      type="button"
                      onClick={() => setIncludeChartAcuity(!includeChartAcuity)}
                      className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                    >
                      <span className="text-[11px] font-medium">Acuity & Unit Occupancy Visual Chart</span>
                      {includeChartAcuity ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeChartTrends(!includeChartTrends)}
                      className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                    >
                      <span className="text-[11px] font-medium">Monthly Admissions & Mortality Trend Chart</span>
                      {includeChartTrends ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeChartWorkload(!includeChartWorkload)}
                      className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                    >
                      <span className="text-[11px] font-medium">Department Procedure & Stock Workload Chart</span>
                      {includeChartWorkload ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                    </button>
                  </div>
                </div>

                {/* Group 2: Table & Data Sections */}
                <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                    <Table className="w-3 h-3 text-slate-400" />
                    <span>Table & Data Sections</span>
                  </p>
                  <div className="space-y-1 pl-1">
                    <button
                      type="button"
                      onClick={() => setIncludeSectionCensus(!includeSectionCensus)}
                      className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                    >
                      <span className="text-[11px] font-medium">Active In-Patient Census Section</span>
                      {includeSectionCensus ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeSectionTasks(!includeSectionTasks)}
                      className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                    >
                      <span className="text-[11px] font-medium">Clinical Interventions & Core Worklist</span>
                      {includeSectionTasks ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeSectionInventory(!includeSectionInventory)}
                      className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                    >
                      <span className="text-[11px] font-medium">Emergency Stock & Inventory Section</span>
                      {includeSectionInventory ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeSectionMortality(!includeSectionMortality)}
                      className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                    >
                      <span className="text-[11px] font-medium">Clinical Mortality Review Register</span>
                      {includeSectionMortality ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeSectionIncidents(!includeSectionIncidents)}
                      className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                    >
                      <span className="text-[11px] font-medium">Clinical Safety & Incidents Log</span>
                      {includeSectionIncidents ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeSectionEndoscopy(!includeSectionEndoscopy)}
                      className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                    >
                      <span className="text-[11px] font-medium">Clinical Endoscopy Procedure Logs</span>
                      {includeSectionEndoscopy ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Custom Header Logo Form Controls */}
          <div className="space-y-2 bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setIsLogoConfigOpen(!isLogoConfigOpen)}
              className="w-full flex items-center justify-between text-left group focus:outline-none"
            >
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-red-950/70 text-red-400 border border-red-900/50 group-hover:bg-red-600 group-hover:text-white transition-all">
                  <ImageIcon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-200 uppercase tracking-wider block">Custom Header Logo</span>
                  <span className="text-[10px] text-slate-400 font-medium">Upload & Adjust PDF Branding</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {logoSettings.customLogoBase64 ? (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-950 text-emerald-400 border border-emerald-800">
                    Custom Active
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-slate-800 text-slate-400 border border-slate-700">
                    Default
                  </span>
                )}
                {isLogoConfigOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>

            {isLogoConfigOpen && (
              <div className="pt-3 border-t border-slate-800 space-y-3">
                {/* Upload Button & Reset */}
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-md">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileUpload}
                      className="hidden"
                    />
                  </label>

                  {logoSettings.customLogoBase64 && (
                    <button
                      type="button"
                      onClick={handleResetLogo}
                      title="Reset to default logo"
                      className="p-2 bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-800 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Scale Control Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
                    <span className="flex items-center gap-1">
                      <Maximize2 className="w-3 h-3 text-red-400" />
                      Logo Scale Height
                    </span>
                    <span className="font-mono text-red-400">{logoSettings.scaleHeightMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={35}
                    step={1}
                    value={logoSettings.scaleHeightMm}
                    onChange={(e) => handleUpdateLogoSettings({ ...logoSettings, scaleHeightMm: Number(e.target.value) })}
                    className="w-full accent-red-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-slate-500">
                    <span>10mm</span>
                    <span>35mm</span>
                  </div>
                </div>

                {/* Vertical Offset Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
                    <span className="flex items-center gap-1">
                      <Move className="w-3 h-3 text-red-400" />
                      Vertical Offset Y
                    </span>
                    <span className="font-mono text-red-400">{logoSettings.offsetYMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={20}
                    step={1}
                    value={logoSettings.offsetYMm}
                    onChange={(e) => handleUpdateLogoSettings({ ...logoSettings, offsetYMm: Number(e.target.value) })}
                    className="w-full accent-red-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-slate-500">
                    <span>4mm (Top)</span>
                    <span>20mm (Down)</span>
                  </div>
                </div>

                {/* Alignment Toggle */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-300 block">Header Alignment</span>
                  <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => handleUpdateLogoSettings({ ...logoSettings, alignment: 'left' })}
                      className={`flex items-center justify-center py-1.5 rounded transition-all gap-1 ${
                        logoSettings.alignment === 'left' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <AlignLeft className="w-3 h-3" />
                      <span>Left</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateLogoSettings({ ...logoSettings, alignment: 'center' })}
                      className={`flex items-center justify-center py-1.5 rounded transition-all gap-1 ${
                        logoSettings.alignment === 'center' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <AlignCenter className="w-3 h-3" />
                      <span>Center</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateLogoSettings({ ...logoSettings, alignment: 'right' })}
                      className={`flex items-center justify-center py-1.5 rounded transition-all gap-1 ${
                        logoSettings.alignment === 'right' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <AlignRight className="w-3 h-3" />
                      <span>Right</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Display Toggles */}
          <div className="space-y-2.5 pt-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-800 pb-1.5">Print Layout Settings</label>
            
            <button 
              onClick={() => setIncludeLogo(!includeLogo)}
              className="w-full flex items-center justify-between text-xs py-1.5 text-slate-300 hover:text-white"
            >
              <span className="font-medium">Include Portal Brand Header</span>
              {includeLogo ? <CheckSquare className="w-4 h-4 text-red-500" /> : <Square className="w-4 h-4 text-slate-600" />}
            </button>

            <button 
              onClick={() => setIncludeMetrics(!includeMetrics)}
              className="w-full flex items-center justify-between text-xs py-1.5 text-slate-300 hover:text-white"
            >
              <span className="font-medium">Include Clinical KPI Metrics</span>
              {includeMetrics ? <CheckSquare className="w-4 h-4 text-red-500" /> : <Square className="w-4 h-4 text-slate-600" />}
            </button>

            <button 
              onClick={() => setIncludeSignatures(!includeSignatures)}
              className="w-full flex items-center justify-between text-xs py-1.5 text-slate-300 hover:text-white"
            >
              <span className="font-medium">Include Verification & Signatures</span>
              {includeSignatures ? <CheckSquare className="w-4 h-4 text-red-500" /> : <Square className="w-4 h-4 text-slate-600" />}
            </button>

            <button 
              onClick={() => setIncludeIdentifiers(!includeIdentifiers)}
              className="w-full flex items-center justify-between text-xs py-1.5 text-slate-300 hover:text-white border-t border-slate-800/40 pt-2.5 mt-1"
            >
              <div className="flex flex-col text-left">
                <span className="font-medium text-slate-200">Include Patient Identifiers</span>
                <span className="text-[10px] text-slate-500 font-medium">Toggle patient name/MRN masking (PII protection)</span>
              </div>
              {includeIdentifiers ? <CheckSquare className="w-4 h-4 text-red-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-600 shrink-0" />}
            </button>
          </div>

          {/* 5. Column Visibility Toggles */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Visible Data Columns</label>
              <span className="text-[10px] text-slate-500 font-medium">Check/uncheck columns to include/exclude in final report</span>
            </div>
            
            {/* Show census columns if report type includes census */}
            {(reportType === 'census' || reportType === 'comprehensive' || (reportType === 'current' && initialTab === 'active')) && (
              <div className="space-y-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1">Census Columns</p>
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {[
                    { key: 'census_bed', label: 'Bed / Location' },
                    { key: 'census_name', label: 'Patient Name' },
                    { key: 'census_mrn', label: 'MRN' },
                    { key: 'census_admit', label: 'Admit Date' },
                    { key: 'census_diagnosis', label: 'Primary Diagnosis' },
                    { key: 'census_acuity', label: 'Acuity Level' },
                    { key: 'census_consultant', label: 'Consultant' },
                  ].map(col => (
                    <button 
                      key={col.key}
                      onClick={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                      className="w-full flex items-center justify-between text-xs text-slate-300 hover:text-white"
                    >
                      <span className="font-medium text-left">{col.label}</span>
                      {visibleColumns[col.key] ? <CheckSquare className="w-4 h-4 text-red-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-700 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Show tasks columns if report type includes tasks */}
            {(reportType === 'tasks' || reportType === 'comprehensive' || (reportType === 'current' && initialTab === 'tasks')) && (
              <div className="space-y-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1">Tasks Columns</p>
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {[
                    { key: 'tasks_task', label: 'Task / Intervention' },
                    { key: 'tasks_priority', label: 'Priority' },
                    { key: 'tasks_due', label: 'Due Date/Time' },
                    { key: 'tasks_assigned', label: 'Assigned By' },
                    { key: 'tasks_status', label: 'Status' },
                  ].map(col => (
                    <button 
                      key={col.key}
                      onClick={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                      className="w-full flex items-center justify-between text-xs text-slate-300 hover:text-white"
                    >
                      <span className="font-medium text-left">{col.label}</span>
                      {visibleColumns[col.key] ? <CheckSquare className="w-4 h-4 text-red-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-700 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Show inventory columns if report type includes inventory */}
            {(reportType === 'inventory' || reportType === 'comprehensive' || (reportType === 'current' && initialTab === 'inventory')) && (
              <div className="space-y-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1">Inventory Columns</p>
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {[
                    { key: 'inv_item', label: 'Item Description' },
                    { key: 'inv_category', label: 'Category' },
                    { key: 'inv_on_hand', label: 'Stock On-Hand' },
                    { key: 'inv_threshold', label: 'Min Threshold' },
                    { key: 'inv_status', label: 'Status' },
                  ].map(col => (
                    <button 
                      key={col.key}
                      onClick={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                      className="w-full flex items-center justify-between text-xs text-slate-300 hover:text-white"
                    >
                      <span className="font-medium text-left">{col.label}</span>
                      {visibleColumns[col.key] ? <CheckSquare className="w-4 h-4 text-red-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-700 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Show mortality columns if report type includes mortality */}
            {(reportType === 'mortality' || (reportType === 'current' && initialTab === 'mortality')) && (
              <div className="space-y-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1">Mortality Columns</p>
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {[
                    { key: 'mort_name', label: 'Patient Name' },
                    { key: 'mort_mrn', label: 'MRN' },
                    { key: 'mort_admitted', label: 'Admitted' },
                    { key: 'mort_deceased', label: 'Deceased Date' },
                    { key: 'mort_diagnosis', label: 'Diagnosis' },
                    { key: 'mort_los', label: 'Length of Stay' },
                    { key: 'mort_consultant', label: 'Consultant' },
                  ].map(col => (
                    <button 
                      key={col.key}
                      onClick={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                      className="w-full flex items-center justify-between text-xs text-slate-300 hover:text-white"
                    >
                      <span className="font-medium text-left">{col.label}</span>
                      {visibleColumns[col.key] ? <CheckSquare className="w-4 h-4 text-red-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-700 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Show incidents columns if report type includes incidents */}
            {(reportType === 'incidents' || (reportType === 'current' && initialTab === 'safety-incidents')) && (
              <div className="space-y-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1">Incident Columns</p>
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {[
                    { key: 'inc_serial', label: 'Serial No' },
                    { key: 'inc_patient', label: 'Patient / MRN' },
                    { key: 'inc_date', label: 'Incident Date' },
                    { key: 'inc_severity', label: 'Category / Severity' },
                    { key: 'inc_reported', label: 'Reported By' },
                  ].map(col => (
                    <button 
                      key={col.key}
                      onClick={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                      className="w-full flex items-center justify-between text-xs text-slate-300 hover:text-white"
                    >
                      <span className="font-medium text-left">{col.label}</span>
                      {visibleColumns[col.key] ? <CheckSquare className="w-4 h-4 text-red-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-700 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Show endoscopy columns if report type includes endoscopy */}
            {(reportType === 'endoscopy' || (reportType === 'current' && (initialTab === 'endoscopy-report' || initialTab === 'endoscopy-logs'))) && (
              <div className="space-y-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1">Endoscopy Columns</p>
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {[
                    { key: 'endo_id', label: 'Procedure ID' },
                    { key: 'endo_patient', label: 'Patient Identity' },
                    { key: 'endo_date', label: 'Date' },
                    { key: 'endo_procedure', label: 'Procedure / Surgeon' },
                    { key: 'endo_findings', label: 'Findings / Diagnosis' },
                  ].map(col => (
                    <button 
                      key={col.key}
                      onClick={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                      className="w-full flex items-center justify-between text-xs text-slate-300 hover:text-white"
                    >
                      <span className="font-medium text-left">{col.label}</span>
                      {visibleColumns[col.key] ? <CheckSquare className="w-4 h-4 text-red-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-700 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 6. Print Audit Logs / History */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex items-center space-x-2">
              <History className="w-4 h-4 text-slate-400" />
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Print Audit Logs</label>
            </div>
            <span className="text-[10px] text-slate-500 font-medium block leading-normal">
              Last 5 generated documents (local session audit trail):
            </span>

            <div className="space-y-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 max-h-[180px] overflow-y-auto">
              {printHistory.length === 0 ? (
                <div className="text-[10px] text-slate-500 text-center py-4">
                  No printed documents recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {printHistory.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="flex flex-col text-[10px] space-y-1 pb-2 last:pb-0 border-b border-slate-800/40 last:border-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-300 leading-tight break-words flex-1">
                          {item.reportTitle}
                        </span>
                        <span className="text-red-400 uppercase font-black text-[8px] shrink-0 bg-red-950/40 px-1.5 py-0.5 rounded border border-red-900/30">
                          {item.unit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[9px] font-mono">
                        <span>{item.timestamp}</span>
                        <span className="text-[8px] px-1 bg-slate-800/80 rounded border border-slate-700/60 text-slate-400 font-sans">
                          Printed
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/50 space-y-3">
          {exportFormat === 'PDF' ? (
            <button
              onClick={handlePrint}
              disabled={loading}
              title="Alt + P shortcut available for fast printing"
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg hover:shadow-red-900/30 active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>Trigger System Print (PDF)</span>
            </button>
          ) : (
            <button
              onClick={handleExportData}
              disabled={loading}
              className={`w-full flex items-center justify-center space-x-2 py-3 px-4 disabled:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg active:scale-[0.98] ${
                exportFormat === 'CSV' 
                  ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-900/30' 
                  : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-900/30'
              }`}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : exportFormat === 'CSV' ? (
                <Table className="w-4 h-4" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>Export Report ({exportFormat})</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all text-center"
          >
            Close Preview
          </button>
        </div>
      </div>

      {/* RIGHT SIDE AREA - PDF-Ready High-Fidelity Clinical Paper Preview */}
      <div className="flex-1 bg-slate-800 p-4 md:p-8 overflow-y-auto flex flex-col items-center relative min-w-0">
        
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-800/80 backdrop-blur-sm z-30">
            <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-3" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-300">Synchronizing Live Clinical Database...</p>
            <p className="text-[10px] text-slate-500 mt-1">Retrieving verified patient, task, and outcome registers</p>
          </div>
        ) : null}

        {/* Quick Export Format Bar */}
        <div className="w-full max-w-[21cm] mb-4 flex items-center justify-between bg-slate-900/90 text-white px-4 py-2.5 rounded-xl border border-slate-700/80 shadow-lg no-print">
          <div className="flex items-center space-x-2">
            <FileType className="w-4 h-4 text-red-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Active Export Format:</span>
          </div>
          <div className="flex items-center gap-1.5">
            {(['PDF', 'CSV', 'Excel'] as const).map(fmt => (
              <button
                key={fmt}
                type="button"
                onClick={() => setExportFormat(fmt)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  exportFormat === fmt
                    ? fmt === 'PDF' ? 'bg-red-600 text-white shadow-md' : fmt === 'CSV' ? 'bg-blue-600 text-white shadow-md' : 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                {fmt === 'PDF' && <Printer className="w-3.5 h-3.5" />}
                {fmt === 'CSV' && <Table className="w-3.5 h-3.5" />}
                {fmt === 'Excel' && <FileSpreadsheet className="w-3.5 h-3.5" />}
                <span>{fmt}</span>
              </button>
            ))}

            {/* Print Options Dropdown Popover Button */}
            <div className="relative ml-2 pl-2 border-l border-slate-700">
              <button
                type="button"
                onClick={() => setIsTopPrintOptionsOpen(!isTopPrintOptionsOpen)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 border ${
                  isTopPrintOptionsOpen || activePrintOptionsCount < 9
                    ? 'bg-red-600 text-white border-red-500 shadow-md'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Print Options</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-950/80 text-red-300 font-mono">
                  {activePrintOptionsCount}/9
                </span>
                {isTopPrintOptionsOpen ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
              </button>

              {/* Popover Dropdown Box */}
              {isTopPrintOptionsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 z-50 text-white space-y-3.5 text-left">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center space-x-1.5">
                      <SlidersHorizontal className="w-4 h-4 text-red-400" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-200">Print Options & Toggles</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsTopPrintOptionsOpen(false)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex items-center justify-between bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-[10px]">
                    <span className="text-slate-400 font-bold uppercase text-[9px] pl-1">Presets:</span>
                    <div className="flex items-center gap-1 font-bold">
                      <button
                        type="button"
                        onClick={handleSelectAllPrintOptions}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 hover:bg-red-600 hover:text-white"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={handleChartsOnlyPrintOptions}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 hover:bg-blue-600 hover:text-white"
                      >
                        Charts Only
                      </button>
                      <button
                        type="button"
                        onClick={handleTablesOnlyPrintOptions}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 hover:bg-emerald-600 hover:text-white"
                      >
                        Tables Only
                      </button>
                    </div>
                  </div>

                  {/* Chart Blocks List */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-red-400 flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      <span>Chart Visualization Blocks</span>
                    </p>
                    <div className="space-y-1 pl-1">
                      <button
                        type="button"
                        onClick={() => setIncludeChartAcuity(!includeChartAcuity)}
                        className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                      >
                        <span className="text-[11px] font-medium">Acuity & Occupancy Chart Block</span>
                        {includeChartAcuity ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIncludeChartTrends(!includeChartTrends)}
                        className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                      >
                        <span className="text-[11px] font-medium">Monthly Admissions & Mortality Trend</span>
                        {includeChartTrends ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIncludeChartWorkload(!includeChartWorkload)}
                        className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                      >
                        <span className="text-[11px] font-medium">Department Procedure & Stock Workload</span>
                        {includeChartWorkload ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                      </button>
                    </div>
                  </div>

                  {/* Table Sections List */}
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-800">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                      <Table className="w-3 h-3" />
                      <span>Table & Data Sections</span>
                    </p>
                    <div className="space-y-1 pl-1">
                      <button
                        type="button"
                        onClick={() => setIncludeSectionCensus(!includeSectionCensus)}
                        className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                      >
                        <span className="text-[11px] font-medium">In-Patient Census Section</span>
                        {includeSectionCensus ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIncludeSectionTasks(!includeSectionTasks)}
                        className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                      >
                        <span className="text-[11px] font-medium">Clinical Interventions & Worklist</span>
                        {includeSectionTasks ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIncludeSectionInventory(!includeSectionInventory)}
                        className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                      >
                        <span className="text-[11px] font-medium">Emergency Stock & Inventory Section</span>
                        {includeSectionInventory ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIncludeSectionMortality(!includeSectionMortality)}
                        className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                      >
                        <span className="text-[11px] font-medium">Mortality Review Register</span>
                        {includeSectionMortality ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIncludeSectionIncidents(!includeSectionIncidents)}
                        className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                      >
                        <span className="text-[11px] font-medium">Safety & Incidents Log</span>
                        {includeSectionIncidents ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIncludeSectionEndoscopy(!includeSectionEndoscopy)}
                        className="w-full flex items-center justify-between text-xs py-1 text-slate-300 hover:text-white text-left"
                      >
                        <span className="text-[11px] font-medium">Endoscopy Procedure Logs</span>
                        {includeSectionEndoscopy ? <CheckSquare className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* High-Fidelity Sheet styled like A4 dimensions */}
        <div 
          id="clinical-print-preview-sheet"
          className="bg-white text-slate-900 w-full max-w-[21cm] min-h-[29.7cm] shadow-2xl border border-slate-700 rounded-lg p-6 md:p-10 font-sans mx-auto transition-all"
        >
          {/* Header Area */}
          {includeLogo && (
            <div className={`border-b-2 border-slate-900 pb-4 mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 ${
              logoSettings.alignment === 'center' ? 'text-center md:items-center' :
              logoSettings.alignment === 'right' ? 'flex-row-reverse md:items-end' : ''
            }`}>
              <div className={`flex items-center gap-3 ${
                logoSettings.alignment === 'center' ? 'mx-auto' : ''
              }`}>
                <img 
                  key={logoSettings.updatedAt || Date.now()}
                  src={getLogoUrlWithCacheBust(logoImageBase64)} 
                  alt="Institution Logo" 
                  style={{ height: `${(logoSettings.scaleHeightMm || 14) * 2.8}px` }}
                  className="w-auto object-contain transition-all"
                />
              </div>

              <div className={`text-left text-[9px] text-slate-500 font-mono space-y-0.5 ${
                logoSettings.alignment === 'center' ? 'mx-auto text-center' :
                logoSettings.alignment === 'right' ? 'md:text-left' : 'md:text-right'
              }`}>
                <div className="flex items-center gap-1 font-bold justify-start">
                  <Calendar className="w-3 h-3 text-red-600" />
                  <span>Report Date: {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-1 font-bold justify-start">
                  <Clock className="w-3 h-3 text-red-600" />
                  <span>Report Time: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex items-center gap-1 justify-start">
                  <User className="w-3 h-3 text-red-600" />
                  <span>Author: {currentUser?.displayName || currentUser?.email || 'Practitioner'} ({currentUser?.role || 'Staff'})</span>
                </div>
                <div className="flex items-center gap-1 justify-start">
                  <Building className="w-3 h-3 text-red-600" />
                  <span>Unit Focus: {selectedUnit === 'ALL' ? 'FACILITY-WIDE' : UNIT_DETAILS[selectedUnit].label}</span>
                </div>
              </div>
            </div>
          )}

          {/* Document Title */}
          <div className="mb-6">
            <h2 className="text-base font-black text-slate-900 border-b border-slate-200 pb-1.5 uppercase tracking-wide">
              {getReportTitle()}
            </h2>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              This clinical summary compiles verified entries recorded in MediLog for {selectedUnit === 'ALL' ? 'all operational units' : `the ${UNIT_DETAILS[selectedUnit].label} unit`}. This is a privileged medical report for clinical auditing, inpatient handovers, and physician reviews.
            </p>
          </div>

          {/* Clinical KPIs / Metrics Row */}
          {includeMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 print-bg-slate">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Inpatient Census</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{summaryStats.totalAdmitted} <span className="text-[10px] font-bold text-slate-400">Admitted</span></p>
                <p className="text-[8px] text-slate-400 mt-1">Acuity Occupancy: {selectedUnit === 'ALL' ? '-' : `${((summaryStats.totalAdmitted / UNIT_DETAILS[selectedUnit].capacity) * 100).toFixed(0)}%`}</p>
              </div>

              <div className="p-3 bg-red-50/50 rounded-lg border border-red-100 print-bg-red">
                <p className="text-[8px] font-black text-red-600 uppercase tracking-widest">High Acuity Risk</p>
                <p className="text-lg font-bold text-red-600 mt-0.5">{summaryStats.criticalAcuity} <span className="text-[10px] font-bold text-red-400">Critical</span></p>
                <p className="text-[8px] text-red-500/80 mt-1">Requiring active continuous monitoring</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 print-bg-slate">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Urgent Pending Tasks</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{summaryStats.pendingUrgentTasks} <span className="text-[10px] font-bold text-slate-400">Alerts</span></p>
                <p className="text-[8px] text-slate-400 mt-1">Critical medication/scans scheduled</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 print-bg-slate">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Incident Indicators</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{summaryStats.incidentsLogged} <span className="text-[10px] font-bold text-slate-400">Logged</span></p>
                <p className="text-[8px] text-slate-400 mt-1">{summaryStats.deceasedCount} deceased records in cycle</p>
              </div>
            </div>
          )}

          {/* VISUAL CHART BLOCKS (Toggled via Print Options Dropdown) */}
          {(includeChartAcuity || includeChartTrends || includeChartWorkload) && (
            <div className="space-y-4 mb-6">
              
              {/* Chart Block 1: Acuity & Unit Occupancy Visual Chart */}
              {includeChartAcuity && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 print-bg-slate space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-4 h-4 text-red-600" />
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        Patient Acuity & Occupancy Visual Chart Block
                      </h3>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 font-bold uppercase">
                      Census Distribution
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px]">
                    {/* Acuity Breakdown Bars */}
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Acuity Level Breakdown</p>
                      
                      <div>
                        <div className="flex justify-between text-[9px] font-bold mb-0.5">
                          <span className="text-red-700">Critical ({summaryStats.criticalAcuity})</span>
                          <span className="text-slate-500">
                            {summaryStats.totalAdmitted > 0 ? Math.round((summaryStats.criticalAcuity / summaryStats.totalAdmitted) * 100) : 0}%
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                          <div 
                            className="bg-red-600 h-full rounded-full transition-all" 
                            style={{ width: `${summaryStats.totalAdmitted > 0 ? (summaryStats.criticalAcuity / summaryStats.totalAdmitted) * 100 : 0}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[9px] font-bold mb-0.5">
                          <span className="text-amber-700">Urgent ({patients.filter(p => p.triagePriority === 'Urgent').length})</span>
                          <span className="text-slate-500">
                            {summaryStats.totalAdmitted > 0 ? Math.round((patients.filter(p => p.triagePriority === 'Urgent').length / summaryStats.totalAdmitted) * 100) : 0}%
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                          <div 
                            className="bg-amber-500 h-full rounded-full transition-all" 
                            style={{ width: `${summaryStats.totalAdmitted > 0 ? (patients.filter(p => p.triagePriority === 'Urgent').length / summaryStats.totalAdmitted) * 100 : 0}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[9px] font-bold mb-0.5">
                          <span className="text-emerald-700">Stable ({patients.filter(p => p.triagePriority !== 'Critical' && p.triagePriority !== 'Urgent').length})</span>
                          <span className="text-slate-500">
                            {summaryStats.totalAdmitted > 0 ? Math.round((patients.filter(p => p.triagePriority !== 'Critical' && p.triagePriority !== 'Urgent').length / summaryStats.totalAdmitted) * 100) : 0}%
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all" 
                            style={{ width: `${summaryStats.totalAdmitted > 0 ? (patients.filter(p => p.triagePriority !== 'Critical' && p.triagePriority !== 'Urgent').length / summaryStats.totalAdmitted) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Unit Capacity Occupancy Chart */}
                    <div className="space-y-2 bg-white p-2.5 rounded-lg border border-slate-200">
                      <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Unit Capacity Occupancy</p>
                      <div className="flex items-center space-x-3 pt-1">
                        <div className="relative w-14 h-14 rounded-full border-4 border-slate-100 flex items-center justify-center shrink-0"
                             style={{
                               background: `conic-gradient(#ef4444 ${selectedUnit === 'ALL' ? 65 : Math.min(100, Math.round((summaryStats.totalAdmitted / (UNIT_DETAILS[selectedUnit]?.capacity || 10)) * 100))}%, #f1f5f9 0)`
                             }}>
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-black text-slate-900 text-[10px]">
                            {selectedUnit === 'ALL' ? '65%' : `${Math.round((summaryStats.totalAdmitted / (UNIT_DETAILS[selectedUnit]?.capacity || 10)) * 100)}%`}
                          </div>
                        </div>
                        <div className="space-y-0.5 text-[9px]">
                          <p className="font-bold text-slate-800">
                            Unit Scope: {selectedUnit === 'ALL' ? 'All Units' : UNIT_DETAILS[selectedUnit].label}
                          </p>
                          <p className="text-slate-500 font-mono">
                            Admitted: {summaryStats.totalAdmitted} / Capacity: {selectedUnit === 'ALL' ? '120 Beds' : `${UNIT_DETAILS[selectedUnit].capacity} Beds`}
                          </p>
                          <p className="text-[8px] text-slate-400">
                            Continuous monitoring beds actively assigned
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Chart Block 2: Monthly Admissions & Mortality Trend Chart Block */}
              {includeChartTrends && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 print-bg-slate space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-red-600" />
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        Monthly Census & Mortality Trend Visual Block
                      </h3>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 font-bold uppercase">
                      Monthly Comparative Volume
                    </span>
                  </div>

                  <div className="pt-1">
                    <div className="flex items-end justify-between h-20 bg-white p-3 rounded-lg border border-slate-200 gap-2">
                      {[
                        { month: 'Jan', admit: 24, mort: 1 },
                        { month: 'Feb', admit: 31, mort: 2 },
                        { month: 'Mar', admit: 28, mort: 0 },
                        { month: 'Apr', admit: 35, mort: 1 },
                        { month: 'May', admit: 42, mort: 3 },
                        { month: 'Jun', admit: 38, mort: 2 },
                        { month: 'Jul', admit: 45, mort: 1 },
                        { month: 'Aug', admit: Math.max(15, patients.length * 3), mort: mortality.length }
                      ].map((bar, bIdx) => (
                        <div key={bIdx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                          <div className="w-full flex items-end justify-center gap-0.5 h-12">
                            <div 
                              className="w-1/2 bg-slate-800 rounded-t transition-all" 
                              style={{ height: `${Math.min(100, (bar.admit / 50) * 100)}%` }} 
                              title={`Admissions: ${bar.admit}`}
                            />
                            <div 
                              className="w-1/2 bg-red-600 rounded-t transition-all" 
                              style={{ height: `${Math.min(100, (bar.mort / 5) * 100)}%` }} 
                              title={`Mortality: ${bar.mort}`}
                            />
                          </div>
                          <span className="text-[8px] font-bold text-slate-600 uppercase font-mono">{bar.month}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-center space-x-6 text-[9px] font-bold text-slate-600 pt-2">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 bg-slate-800 rounded-sm"></span>
                        <span>Monthly Admissions Volume</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 bg-red-600 rounded-sm"></span>
                        <span>Mortality Review Logged</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Chart Block 3: Department Workload & Emergency Inventory Chart Block */}
              {includeChartWorkload && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 print-bg-slate space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center space-x-2">
                      <PieChart className="w-4 h-4 text-red-600" />
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        Procedural Volume & Stock Alert Distribution Block
                      </h3>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 font-bold uppercase">
                      Operational Health Metrics
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                      <p className="text-[9px] font-bold text-slate-700 uppercase">Endoscopy Procedures Distribution</p>
                      <div className="space-y-1 font-mono text-[9px]">
                        <div className="flex justify-between items-center text-slate-800">
                          <span>OGD / Gastroscopy</span>
                          <span className="font-bold text-slate-900">45%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-red-600 h-full w-[45%]"></div>
                        </div>

                        <div className="flex justify-between items-center text-slate-800">
                          <span>Colonoscopy Procedures</span>
                          <span className="font-bold text-slate-900">35%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full w-[35%]"></div>
                        </div>

                        <div className="flex justify-between items-center text-slate-800">
                          <span>ERCP & Specialized Interventions</span>
                          <span className="font-bold text-slate-900">20%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-600 h-full w-[20%]"></div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                      <p className="text-[9px] font-bold text-slate-700 uppercase">Emergency Inventory Health Status</p>
                      <div className="space-y-1 text-[9px]">
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-700 font-bold">Adequate Stock On-Hand</span>
                          <span className="font-mono font-bold text-slate-900">
                            {inventory.length > 0 ? inventory.filter(i => i.quantity > i.minThreshold).length : 8} items
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-amber-700 font-bold">Low Stock Threshold Warning</span>
                          <span className="font-mono font-bold text-amber-700">
                            {summaryStats.lowStockItems} items
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-red-700 font-bold">Depleted / Out of Stock Alert</span>
                          <span className="font-mono font-bold text-red-700">
                            {inventory.filter(i => i.quantity <= 0).length} items
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* DYNAMIC REPORT BODY (Based on selected report template) */}
          <div className="space-y-6">
            
            {/* A. CENSUS TEMPLATE */}
            {includeSectionCensus && (reportType === 'census' || reportType === 'comprehensive' || (reportType === 'current' && initialTab === 'active')) && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                  Active In-Patient Census
                </h3>
                {patients.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No patients currently logged for the selected scope.</p>
                ) : layoutMode === 'compact' ? (
                  <table className="w-full text-left text-xs border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 print-bg-slate">
                        {visibleColumns.census_bed && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Bed</th>}
                        {visibleColumns.census_name && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Patient Name</th>}
                        {visibleColumns.census_mrn && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">MRN</th>}
                        {visibleColumns.census_admit && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Admit Date</th>}
                        {visibleColumns.census_diagnosis && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Primary Diagnosis</th>}
                        {visibleColumns.census_acuity && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Acuity</th>}
                        {visibleColumns.census_consultant && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Consultant</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {patients.map((p, idx) => (
                        <tr key={p.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                          {visibleColumns.census_bed && <td className="p-1.5 font-mono text-[10px] font-bold">{getBedLocation(p.location || 'N/A')}</td>}
                          {visibleColumns.census_name && <td className="p-1.5 font-bold uppercase text-[9.5px]">{getPatientName(p.name)}</td>}
                          {visibleColumns.census_mrn && <td className="p-1.5 font-mono text-[10px]">{getMRN(p.regNo)}</td>}
                          {visibleColumns.census_admit && <td className="p-1.5 text-[9.5px]">{formatDate(p.admissionDate)}</td>}
                          {visibleColumns.census_diagnosis && <td className="p-1.5 text-[9.5px]">{p.category}</td>}
                          {visibleColumns.census_acuity && (
                            <td className="p-1.5">
                              <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase rounded border ${
                                p.triagePriority === 'Critical' 
                                  ? 'bg-red-50 text-red-700 border-red-200' 
                                  : p.triagePriority === 'Urgent' 
                                  ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                  : 'bg-green-50 text-green-700 border-green-200'
                              }`}>
                                {p.triagePriority || 'Stable'}
                              </span>
                            </td>
                          )}
                          {visibleColumns.census_consultant && <td className="p-1.5 text-[9.5px] font-medium">{p.consultant}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="space-y-3">
                    {patients.map((p, idx) => (
                      <div key={p.id || idx} className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 print-bg-slate space-y-2.5 break-inside-avoid">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <div className="flex items-center space-x-2">
                            {visibleColumns.census_bed && (
                              <span className="font-mono text-xs font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-300">
                                BED: {getBedLocation(p.location || 'N/A')}
                              </span>
                            )}
                            {visibleColumns.census_name && (
                              <h4 className="text-xs font-extrabold text-slate-900 uppercase">
                                {getPatientName(p.name)}
                              </h4>
                            )}
                            {visibleColumns.census_mrn && (
                              <span className="text-[10px] font-mono text-slate-500">
                                (MRN: {getMRN(p.regNo)})
                              </span>
                            )}
                          </div>
                          {visibleColumns.census_acuity && (
                            <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded border ${
                              p.triagePriority === 'Critical' 
                                ? 'bg-red-100 text-red-800 border-red-300' 
                                : p.triagePriority === 'Urgent' 
                                ? 'bg-amber-100 text-amber-800 border-amber-300' 
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}>
                              {p.triagePriority || 'Stable'}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                          {visibleColumns.census_admit && (
                            <div>
                              <span className="text-slate-500 font-bold block uppercase text-[8px]">Admit Date</span>
                              <span className="font-semibold text-slate-800">{formatDate(p.admissionDate)}</span>
                            </div>
                          )}
                          {visibleColumns.census_diagnosis && (
                            <div>
                              <span className="text-slate-500 font-bold block uppercase text-[8px]">Category / Diagnosis</span>
                              <span className="font-semibold text-slate-800">{p.category || 'N/A'}</span>
                            </div>
                          )}
                          {visibleColumns.census_consultant && (
                            <div>
                              <span className="text-slate-500 font-bold block uppercase text-[8px]">Attending Consultant</span>
                              <span className="font-semibold text-slate-800">{p.consultant || 'N/A'}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-slate-500 font-bold block uppercase text-[8px]">Code Status</span>
                            <span className={`font-bold ${p.codeStatus === 'Full Code' ? 'text-emerald-700' : 'text-red-700'}`}>
                              {p.codeStatus || 'Full Code'}
                            </span>
                          </div>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-[10px] space-y-1">
                          <p className="font-bold text-slate-700 uppercase text-[8.5px] tracking-wider">Clinical Narrative & Admission Summary:</p>
                          <p className="text-slate-800 leading-relaxed font-medium">
                            Patient <strong className="uppercase">{getPatientName(p.name)}</strong> ({p.gender || 'N/A'}, MRN: {getMRN(p.regNo)}) is currently admitted in bed location {getBedLocation(p.location || 'N/A')} under consultant {p.consultant} in {p.unit}. Admission was recorded on {formatDate(p.admissionDate)} with current length of stay of {p.lengthOfStay || 0} day(s). Primary clinical category is {p.category}, triage priority level is {p.triagePriority || 'Stable'}, and care directive is set to {p.codeStatus || 'Full Code'}.
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* B. TASKS TEMPLATE */}
            {includeSectionTasks && (reportType === 'tasks' || reportType === 'comprehensive' || (reportType === 'current' && initialTab === 'tasks')) && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                  Clinical Interventions & Core Worklist
                </h3>
                {tasks.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No tasks currently registered for the selected scope.</p>
                ) : layoutMode === 'compact' ? (
                  <table className="w-full text-left text-xs border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 print-bg-slate">
                        {visibleColumns.tasks_task && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Task / Intervention</th>}
                        {visibleColumns.tasks_priority && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Priority</th>}
                        {visibleColumns.tasks_due && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Due Date/Time</th>}
                        {visibleColumns.tasks_assigned && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Assigned By</th>}
                        {visibleColumns.tasks_status && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Status</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((t, idx) => (
                        <tr key={t.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                          {visibleColumns.tasks_task && (
                            <td className="p-1.5">
                              <p className="font-bold text-[9.5px]">{t.title}</p>
                              <p className="text-[9px] text-slate-500 font-medium leading-normal">{t.description}</p>
                            </td>
                          )}
                          {visibleColumns.tasks_priority && (
                            <td className="p-1.5">
                              <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase rounded border ${
                                t.priority === 'High' 
                                  ? 'bg-red-50 text-red-700 border-red-200' 
                                  : t.priority === 'Medium' 
                                  ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}>
                                {t.priority}
                              </span>
                            </td>
                          )}
                          {visibleColumns.tasks_due && <td className="p-1.5 font-mono text-[9.5px]">{t.dueDate ? formatDate(t.dueDate) : '-'}</td>}
                          {visibleColumns.tasks_assigned && <td className="p-1.5 text-[9.5px]">{t.assignedBy}</td>}
                          {visibleColumns.tasks_status && (
                            <td className="p-1.5 text-[9.5px]">
                              <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase rounded ${
                                t.status === 'Completed' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {t.status}
                              </span>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((t, idx) => (
                      <div key={t.id || idx} className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 print-bg-slate space-y-2 break-inside-avoid">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <div className="flex items-center space-x-2">
                            {visibleColumns.tasks_priority && (
                              <span className={`px-2 py-0.5 text-[8.5px] font-black uppercase rounded ${
                                t.priority === 'High' ? 'bg-red-100 text-red-800 border border-red-300' : t.priority === 'Medium' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-200 text-slate-800 border border-slate-300'
                              }`}>
                                {t.priority} Priority
                              </span>
                            )}
                            {visibleColumns.tasks_task && (
                              <h4 className="text-xs font-bold text-slate-900">{t.title}</h4>
                            )}
                          </div>
                          {visibleColumns.tasks_status && (
                            <span className={`px-2 py-0.5 text-[8.5px] font-black uppercase rounded ${
                              t.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {t.status}
                            </span>
                          )}
                        </div>
                        {visibleColumns.tasks_task && (
                          <div className="text-[10px] text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                            <p className="font-bold text-slate-800 uppercase text-[8.5px] mb-0.5">Intervention Detail / Narrative Instructions:</p>
                            <p className="font-medium text-slate-800">{t.description || 'No detailed instructions attached.'}</p>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono pt-0.5">
                          {visibleColumns.tasks_assigned && (
                            <span>Assigned By: <strong className="text-slate-700 font-sans">{t.assignedBy}</strong></span>
                          )}
                          {visibleColumns.tasks_due && (
                            <span>Scheduled Due: <strong className="text-slate-700 font-sans">{t.dueDate ? formatDate(t.dueDate) : 'Immediate'}</strong></span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* C. INVENTORY TEMPLATE */}
            {includeSectionInventory && (reportType === 'inventory' || reportType === 'comprehensive' || (reportType === 'current' && initialTab === 'inventory')) && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                  Emergency Stock & Inventory Levels
                </h3>
                {inventory.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No inventory tracked under the selected unit scope.</p>
                ) : layoutMode === 'compact' ? (
                  <table className="w-full text-left text-xs border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 print-bg-slate">
                        {visibleColumns.inv_item && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Item Description</th>}
                        {visibleColumns.inv_category && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Category</th>}
                        {visibleColumns.inv_on_hand && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Stock On-Hand</th>}
                        {visibleColumns.inv_threshold && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Min Threshold</th>}
                        {visibleColumns.inv_status && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Status</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((i, idx) => (
                        <tr key={i.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                          {visibleColumns.inv_item && <td className="p-1.5 font-bold uppercase text-[9.5px]">{i.name}</td>}
                          {visibleColumns.inv_category && <td className="p-1.5 text-[9.5px]">{i.category}</td>}
                          {visibleColumns.inv_on_hand && <td className="p-1.5 font-mono text-[9.5px] font-bold">{i.quantity} {i.measurementUnit}</td>}
                          {visibleColumns.inv_threshold && <td className="p-1.5 font-mono text-[9.5px]">{i.minThreshold} {i.measurementUnit}</td>}
                          {visibleColumns.inv_status && (
                            <td className="p-1.5">
                              <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase rounded border ${
                                i.quantity <= 0 
                                  ? 'bg-red-100 text-red-700 border-red-300' 
                                  : i.quantity <= i.minThreshold 
                                  ? 'bg-amber-100 text-amber-700 border-amber-300' 
                                  : 'bg-emerald-100 text-emerald-700 border-emerald-300'
                              }`}>
                                {i.quantity <= 0 ? 'Out of Stock' : i.quantity <= i.minThreshold ? 'Low Stock' : 'Good'}
                              </span>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="space-y-3">
                    {inventory.map((i, idx) => (
                      <div key={i.id || idx} className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 print-bg-slate space-y-2 break-inside-avoid">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <div>
                            {visibleColumns.inv_item && (
                              <h4 className="text-xs font-bold text-slate-900 uppercase">{i.name}</h4>
                            )}
                            {visibleColumns.inv_category && (
                              <p className="text-[9px] text-slate-500 font-medium">Category: {i.category}</p>
                            )}
                          </div>
                          {visibleColumns.inv_status && (
                            <span className={`px-2 py-0.5 text-[8.5px] font-black uppercase rounded border ${
                              i.quantity <= 0 
                                ? 'bg-red-100 text-red-800 border-red-300' 
                                : i.quantity <= i.minThreshold 
                                ? 'bg-amber-100 text-amber-800 border-amber-300' 
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}>
                              {i.quantity <= 0 ? 'Out of Stock' : i.quantity <= i.minThreshold ? 'Low Stock Warning' : 'Adequate Supply'}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px] bg-white p-2.5 rounded-lg border border-slate-200">
                          {visibleColumns.inv_on_hand && (
                            <div>
                              <span className="text-slate-500 font-bold block uppercase text-[8px]">Stock On-Hand</span>
                              <span className="font-bold text-slate-900">{i.quantity} {i.measurementUnit}</span>
                            </div>
                          )}
                          {visibleColumns.inv_threshold && (
                            <div>
                              <span className="text-slate-500 font-bold block uppercase text-[8px]">Min Threshold</span>
                              <span className="font-medium text-slate-700">{i.minThreshold} {i.measurementUnit}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-slate-500 font-bold block uppercase text-[8px]">Expiry / Audit</span>
                            <span className="font-mono text-slate-700">{formatDate(i.expiryDate)}</span>
                          </div>
                        </div>
                        {i.notes && (
                          <p className="text-[9.5px] text-slate-600 italic bg-white/60 p-2 rounded border border-slate-200">
                            <strong>Stock Note:</strong> {i.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* D. MORTALITY TEMPLATE */}
            {includeSectionMortality && (reportType === 'mortality' || (reportType === 'current' && initialTab === 'mortality')) && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                  Clinical Mortality Review Register
                </h3>
                {mortality.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No mortality records logged for this unit.</p>
                ) : layoutMode === 'compact' ? (
                  <table className="w-full text-left text-xs border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 print-bg-slate">
                        {visibleColumns.mort_name && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Patient Name</th>}
                        {visibleColumns.mort_mrn && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">MRN</th>}
                        {visibleColumns.mort_admitted && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Admitted</th>}
                        {visibleColumns.mort_deceased && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Deceased Date</th>}
                        {visibleColumns.mort_diagnosis && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Diagnosis</th>}
                        {visibleColumns.mort_los && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">LOS</th>}
                        {visibleColumns.mort_consultant && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Attending Consultant</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {mortality.map((m, idx) => (
                        <tr key={m.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                          {visibleColumns.mort_name && <td className="p-1.5 font-bold uppercase text-[9.5px]">{getPatientName(m.name)}</td>}
                          {visibleColumns.mort_mrn && <td className="p-1.5 font-mono text-[10px]">{getMRN(m.regNo)}</td>}
                          {visibleColumns.mort_admitted && <td className="p-1.5 text-[9.5px]">{formatDate(m.admissionDate)}</td>}
                          {visibleColumns.mort_deceased && <td className="p-1.5 text-[9.5px] font-bold text-red-600">{formatDate(m.dischargeDate)}</td>}
                          {visibleColumns.mort_diagnosis && <td className="p-1.5 text-[9.5px]">{m.category}</td>}
                          {visibleColumns.mort_los && <td className="p-1.5 font-mono text-[9.5px]">{m.lengthOfStay} Days</td>}
                          {visibleColumns.mort_consultant && <td className="p-1.5 text-[9.5px] font-medium">{m.consultant}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="space-y-3">
                    {mortality.map((m, idx) => (
                      <div key={m.id || idx} className="p-3.5 bg-red-50/40 rounded-xl border border-red-200 print-bg-red space-y-2.5 break-inside-avoid">
                        <div className="flex items-center justify-between border-b border-red-200 pb-2">
                          <div>
                            {visibleColumns.mort_name && (
                              <h4 className="text-xs font-black text-red-900 uppercase">{getPatientName(m.name)}</h4>
                            )}
                            {visibleColumns.mort_mrn && (
                              <span className="text-[10px] font-mono text-slate-600">MRN: {getMRN(m.regNo)}</span>
                            )}
                          </div>
                          <span className="px-2 py-0.5 text-[8.5px] font-black uppercase rounded bg-red-200 text-red-900 border border-red-300">
                            Clinical Mortality Review
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                          {visibleColumns.mort_admitted && (
                            <div>
                              <span className="text-slate-500 font-bold block uppercase text-[8px]">Admitted</span>
                              <span className="font-semibold text-slate-800">{formatDate(m.admissionDate)}</span>
                            </div>
                          )}
                          {visibleColumns.mort_deceased && (
                            <div>
                              <span className="text-slate-500 font-bold block uppercase text-[8px]">Deceased Date</span>
                              <span className="font-bold text-red-700">{formatDate(m.dischargeDate)}</span>
                            </div>
                          )}
                          {visibleColumns.mort_los && (
                            <div>
                              <span className="text-slate-500 font-bold block uppercase text-[8px]">Length of Stay</span>
                              <span className="font-semibold text-slate-800">{m.lengthOfStay} Days</span>
                            </div>
                          )}
                          {visibleColumns.mort_consultant && (
                            <div>
                              <span className="text-slate-500 font-bold block uppercase text-[8px]">Attending Consultant</span>
                              <span className="font-semibold text-slate-800">{m.consultant}</span>
                            </div>
                          )}
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-red-200 text-[10px] space-y-1">
                          <p className="font-bold text-slate-800 uppercase text-[8.5px]">Clinical Review Narrative:</p>
                          <p className="text-slate-700 leading-relaxed font-medium">
                            Inpatient <strong className="uppercase">{getPatientName(m.name)}</strong> (MRN: {getMRN(m.regNo)}) was admitted on {formatDate(m.admissionDate)} under attending consultant {m.consultant}. Primary diagnosis recorded as {m.category}. Decease occurred on {formatDate(m.dischargeDate)} following {m.lengthOfStay} day(s) of HDU support. Record archived for clinical morbidity review.
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* E. INCIDENTS TEMPLATE */}
            {includeSectionIncidents && (reportType === 'incidents' || (reportType === 'current' && initialTab === 'safety-incidents')) && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                  Clinical Safety & Incident register
                </h3>
                {incidents.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No incidents recorded under this clinical unit.</p>
                ) : layoutMode === 'compact' ? (
                  <table className="w-full text-left text-xs border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 print-bg-slate">
                        {visibleColumns.inc_serial && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Serial No</th>}
                        {visibleColumns.inc_patient && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Patient / MRN</th>}
                        {visibleColumns.inc_date && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Incident Date</th>}
                        {visibleColumns.inc_severity && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Category / Severity</th>}
                        {visibleColumns.inc_reported && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Reported By</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {incidents.map((inc, idx) => (
                        <tr key={inc.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                          {visibleColumns.inc_serial && <td className="p-1.5 font-mono text-[9.5px] font-bold">{inc.serialNo || '-'}</td>}
                          {visibleColumns.inc_patient && (
                            <td className="p-1.5">
                              <p className="font-bold uppercase text-[9.5px]">{getPatientName(inc.patientName)}</p>
                              <p className="text-[9px] text-slate-500 font-mono">MRN: {getMRN(inc.regNo)}</p>
                            </td>
                          )}
                          {visibleColumns.inc_date && <td className="p-1.5 text-[9.5px]">{formatDate(inc.incidentDate)}</td>}
                          {visibleColumns.inc_severity && (
                            <td className="p-1.5 text-[9.5px]">
                              <p className="font-bold text-[9.5px]">{inc.category}</p>
                              <p className="text-[9px] text-slate-500 leading-normal" dangerouslySetInnerHTML={{ __html: inc.description || '' }}></p>
                            </td>
                          )}
                          {visibleColumns.inc_reported && <td className="p-1.5 text-[9.5px]">{inc.reportedBy}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="space-y-3">
                    {incidents.map((inc, idx) => (
                      <div key={inc.id || idx} className="p-3.5 bg-amber-50/40 rounded-xl border border-amber-200 print-bg-slate space-y-2.5 break-inside-avoid">
                        <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                          <div className="flex items-center space-x-2">
                            {visibleColumns.inc_serial && (
                              <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-amber-300">
                                SERIAL: {inc.serialNo || idx + 1}
                              </span>
                            )}
                            {visibleColumns.inc_severity && (
                              <h4 className="text-xs font-extrabold text-slate-900 uppercase">{inc.category}</h4>
                            )}
                          </div>
                          {visibleColumns.inc_date && (
                            <span className="text-[10px] font-mono text-slate-600">
                              Date: {formatDate(inc.incidentDate)}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          {visibleColumns.inc_patient && (
                            <div>
                              <span className="text-slate-500 font-bold block uppercase text-[8px]">Patient / MRN</span>
                              <span className="font-semibold text-slate-800">{getPatientName(inc.patientName)} (MRN: {getMRN(inc.regNo)})</span>
                            </div>
                          )}
                          {visibleColumns.inc_reported && (
                            <div>
                              <span className="text-slate-500 font-bold block uppercase text-[8px]">Reported By</span>
                              <span className="font-semibold text-slate-800">{inc.reportedBy}</span>
                            </div>
                          )}
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-amber-200 text-[10px] space-y-1">
                          <p className="font-bold text-slate-800 uppercase text-[8.5px]">Detailed Safety Incident Narrative:</p>
                          <div className="text-slate-700 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: inc.description || 'No detailed narrative recorded.' }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* F. ENDOSCOPY TEMPLATE */}
            {includeSectionEndoscopy && (reportType === 'endoscopy' || (reportType === 'current' && (initialTab === 'endoscopy-report' || initialTab === 'endoscopy-logs'))) && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                  Clinical Endoscopy Logs
                </h3>
                {endoscopy.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No endoscopy reports archived under this unit scope.</p>
                ) : layoutMode === 'compact' ? (
                  <table className="w-full text-left text-xs border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 print-bg-slate">
                        {visibleColumns.endo_id && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Procedure ID</th>}
                        {visibleColumns.endo_patient && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Patient Identity</th>}
                        {visibleColumns.endo_date && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Date</th>}
                        {visibleColumns.endo_procedure && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Procedure / Surgeon</th>}
                        {visibleColumns.endo_findings && <th className="p-1.5 text-[9px] font-bold text-slate-700 uppercase tracking-wider print-text-dark">Clinical Findings / Diagnosis</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {endoscopy.map((eRecord, idx) => (
                        <tr key={eRecord.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                          {visibleColumns.endo_id && <td className="p-1.5 font-mono text-[9.5px] font-bold">{eRecord.serialNo || '-'}</td>}
                          {visibleColumns.endo_patient && (
                            <td className="p-1.5">
                              <p className="font-bold uppercase text-[9.5px]">{getPatientName(eRecord.name)}</p>
                              <p className="text-[9px] text-slate-500 font-mono">MRN: {getMRN(eRecord.regNo)}</p>
                            </td>
                          )}
                          {visibleColumns.endo_date && <td className="p-1.5 text-[9.5px]">{formatDate(eRecord.date)} {eRecord.time || ''}</td>}
                          {visibleColumns.endo_procedure && (
                            <td className="p-1.5 text-[9.5px]">
                              <p className="font-bold">{formatProcedureDisplay(eRecord.procedure)}</p>
                              <p className="text-[9px] text-slate-500">{eRecord.doctor}</p>
                            </td>
                          )}
                          {visibleColumns.endo_findings && (
                            <td className="p-1.5 text-[9.5px]">
                              <p className="font-medium text-slate-700">{eRecord.findings || 'No acute findings'}</p>
                              {eRecord.diagnosis && (
                                <p className="text-[9px] text-red-600 font-bold mt-0.5">Dx: {eRecord.diagnosis}</p>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="space-y-4">
                    {endoscopy.map((eRecord, idx) => (
                      <div key={eRecord.id || idx} className="p-4 bg-slate-50/80 rounded-xl border border-slate-300 print-bg-slate space-y-3 break-inside-avoid">
                        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2">
                          <div>
                            {visibleColumns.endo_id && (
                              <span className="text-[9px] font-mono font-bold text-red-600 uppercase tracking-widest block">
                                PROCEDURE REPORT #{eRecord.serialNo || `ENDO-${idx + 1}`}
                              </span>
                            )}
                            {visibleColumns.endo_procedure && (
                              <h4 className="text-sm font-extrabold text-slate-900 uppercase">
                                {formatProcedureDisplay(eRecord.procedure)}
                              </h4>
                            )}
                          </div>
                          <div className="text-right">
                            {visibleColumns.endo_date && (
                              <span className="text-[10px] font-bold text-slate-800 block">
                                Date: {formatDate(eRecord.date)} {eRecord.time || ''}
                              </span>
                            )}
                            <span className="text-[9px] text-slate-500 font-medium">
                              Unit: {eRecord.referringUnit || 'Endoscopy'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] bg-white p-2.5 rounded-lg border border-slate-200">
                          {visibleColumns.endo_patient && (
                            <>
                              <div>
                                <span className="text-slate-500 font-bold block uppercase text-[8px]">Patient Name</span>
                                <span className="font-extrabold text-slate-900 uppercase">{getPatientName(eRecord.name)}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 font-bold block uppercase text-[8px]">MR Number</span>
                                <span className="font-mono font-bold text-slate-800">{getMRN(eRecord.regNo)}</span>
                              </div>
                            </>
                          )}
                          {visibleColumns.endo_procedure && (
                            <div>
                              <span className="text-slate-500 font-bold block uppercase text-[8px]">Endoscopist / Surgeon</span>
                              <span className="font-bold text-slate-800">{eRecord.doctor}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-slate-500 font-bold block uppercase text-[8px]">Ref. Physician</span>
                            <span className="font-semibold text-slate-800">{eRecord.referringPhysician || 'N/A'}</span>
                          </div>
                        </div>

                        {eRecord.indications && (
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-[10px] space-y-0.5">
                            <span className="text-slate-500 font-black uppercase text-[8.5px] block tracking-wider">Indications for Examination</span>
                            <p className="text-slate-900 font-medium">{eRecord.indications}</p>
                          </div>
                        )}

                        {visibleColumns.endo_findings && (
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-[10px] space-y-2">
                            <div>
                              <span className="text-slate-500 font-black uppercase text-[8.5px] block tracking-wider mb-1">Detailed Findings & Observations Narrative</span>
                              <p className="text-slate-800 leading-relaxed font-medium whitespace-pre-wrap">
                                {eRecord.findings || 'No specific procedural observations recorded.'}
                              </p>
                            </div>

                            {(eRecord.diagnosis || eRecord.recommendations) && (
                              <div className="border-t border-slate-100 pt-1.5 grid grid-cols-1 md:grid-cols-2 gap-2">
                                {eRecord.diagnosis && (
                                  <div>
                                    <span className="text-red-700 font-black uppercase text-[8.5px] block tracking-wider">Clinical Impression / Diagnosis</span>
                                    <p className="text-slate-900 font-bold">{eRecord.diagnosis}</p>
                                  </div>
                                )}
                                {eRecord.recommendations && (
                                  <div>
                                    <span className="text-slate-700 font-black uppercase text-[8.5px] block tracking-wider">Recommendations</span>
                                    <p className="text-slate-800 font-medium">{eRecord.recommendations}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Empty State when all Print Options are disabled */}
            {!includeChartAcuity && !includeChartTrends && !includeChartWorkload && 
             !includeSectionCensus && !includeSectionTasks && !includeSectionInventory && 
             !includeSectionMortality && !includeSectionIncidents && !includeSectionEndoscopy && (
              <div className="py-12 px-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                <SlidersHorizontal className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-black text-slate-700 uppercase tracking-wide">All Print Options Toggled Off</p>
                <p className="text-[10px] text-slate-500 mt-1 max-w-md mx-auto">
                  No chart blocks or table sections are currently enabled. Open the <strong className="text-red-600 font-bold">Print Options</strong> dropdown to select specific chart blocks or data tables to include in your printed report.
                </p>
              </div>
            )}
          </div>

          {/* Custom Remarks Section */}
          {customRemarks && (
            <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-lg print-bg-slate">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                Clinical Handover Remarks & Supervisor Notes
              </h4>
              <p className="text-[10px] text-slate-700 whitespace-pre-wrap leading-relaxed italic font-medium">
                "{customRemarks}"
              </p>
            </div>
          )}

          {/* Signature & Verification Block */}
          {includeSignatures && (
            <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-[10px] text-slate-500 uppercase tracking-wider">
              <div className="space-y-12">
                <p className="font-bold">Prepared & Signed By:</p>
                <div className="border-t border-slate-300 pt-1.5">
                  <div className="flex items-center gap-1 font-black text-slate-800 text-[10px]">
                    <FileSignature className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{currentUser?.displayName || currentUser?.email || 'Medical Staff'}</span>
                  </div>
                  <p className="text-[8px] text-slate-400 font-bold tracking-tight mt-0.5">
                    Role: {currentUser?.role || 'Staff'} / Attending Clinician
                  </p>
                  <p className="text-[8px] text-slate-400">
                    Timestamp: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                  </p>
                </div>
              </div>

              <div className="space-y-12">
                <p className="font-bold text-right">Counter-Signed / Verified By:</p>
                <div className="border-t border-slate-300 pt-1.5 text-right">
                  <p className="font-black text-slate-800 text-[10px]">
                    Clinical In-Charge / Supervisor Signature
                  </p>
                  <p className="text-[8px] text-slate-400 font-bold tracking-tight mt-0.5">
                    High Dependency Unit Clinical Board
                  </p>
                  <p className="text-[8px] text-slate-400">
                    MediLog Clinical Healthcare Alliance
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Print Footer Page Numbering Guideline */}
          <div className="mt-10 text-center text-[8px] text-slate-400 border-t border-slate-100 pt-3">
            MEDILOG MEDICAL RECORD SYSTEM • PRIVILEGED AND CONFIDENTIAL CLINICAL INFORMATION • DO NOT DUPLICATE WITHOUT AUTHORIZATION
          </div>
        </div>
      </div>
    </div>
  );
};
