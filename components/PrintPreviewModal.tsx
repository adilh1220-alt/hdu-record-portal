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
import { CLINICAL_UNITS, UNIT_DETAILS } from '../constants';
import { 
  Patient, 
  ClinicalTask, 
  InventoryItem, 
  IncidentRecord, 
  EndoscopyRecord,
  ClinicalUnit
} from '../types';
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
  History
} from 'lucide-react';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

type ReportType = 
  | 'current' 
  | 'census' 
  | 'tasks' 
  | 'inventory' 
  | 'mortality' 
  | 'incidents' 
  | 'endoscopy' 
  | 'comprehensive';

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

  // Configuration States
  const [selectedUnit, setSelectedUnit] = useState<ClinicalUnit | 'ALL'>(activeUnit);
  const [reportType, setReportType] = useState<ReportType>('current');
  const [customRemarks, setCustomRemarks] = useState('');
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [includeMetrics, setIncludeMetrics] = useState(true);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [includeIdentifiers, setIncludeIdentifiers] = useState(true);

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
      reportTitle: getReportTitle(),
      unit: selectedUnit === 'ALL' ? 'ALL UNITS' : selectedUnit
    };

    const updatedHistory = [newAudit, ...printHistory].slice(0, 5);
    setPrintHistory(updatedHistory);
    try {
      localStorage.setItem('clinical_print_audit_history', JSON.stringify(updatedHistory));
    } catch (e) {
      console.error('Failed to save print audit log to localStorage:', e);
    }

    window.print();
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

          {/* 3. Custom Remarks (Handover/Notes) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Report Handover Remarks / Notes</label>
            <textarea
              value={customRemarks}
              onChange={(e) => setCustomRemarks(e.target.value)}
              placeholder="Enter custom clinical annotations, handover briefings, sign-off notes or verification guidelines to append to the bottom of the printed clinical page..."
              rows={4}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-xs font-medium text-slate-200 outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 placeholder-slate-500 resize-none leading-relaxed"
            />
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
          <button
            onClick={handlePrint}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg hover:shadow-red-900/30 active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            <span>Trigger System Print</span>
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all text-center"
          >
            Close Preview
          </button>
        </div>
      </div>

      {/* RIGHT SIDE AREA - PDF-Ready High-Fidelity Clinical Paper Preview */}
      <div className="flex-1 bg-slate-800 p-4 md:p-8 overflow-y-auto flex items-start justify-center relative min-w-0">
        
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-800/80 backdrop-blur-sm z-30">
            <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-3" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-300">Synchronizing Live Clinical Database...</p>
            <p className="text-[10px] text-slate-500 mt-1">Retrieving verified patient, task, and outcome registers</p>
          </div>
        ) : null}

        {/* High-Fidelity Sheet styled like A4 dimensions */}
        <div 
          id="clinical-print-preview-sheet"
          className="bg-white text-slate-900 w-full max-w-[21cm] min-h-[29.7cm] shadow-2xl border border-slate-700 rounded-lg p-6 md:p-10 font-sans mx-auto transition-all"
        >
          {/* Header Area */}
          {includeLogo && (
            <div className="border-b-2 border-red-600 pb-4 mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center text-white font-black text-sm">
                    +
                  </div>
                  <h1 className="text-xl font-black text-red-600 uppercase tracking-tight leading-none">The Kidney Centre</h1>
                </div>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">
                  High Dependency Unit & Clinical Intake Portal
                </p>
                <p className="text-[8px] text-slate-400 font-medium">
                  24-Hour Clinical Monitoring & Organ Dysfunction Support
                </p>
              </div>

              <div className="text-left md:text-right text-[9px] text-slate-500 font-mono space-y-0.5">
                <div className="flex items-center md:justify-end gap-1 font-bold">
                  <Calendar className="w-3 h-3 text-red-600" />
                  <span>Report Date: {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center md:justify-end gap-1 font-bold">
                  <Clock className="w-3 h-3 text-red-600" />
                  <span>Report Time: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex items-center md:justify-end gap-1">
                  <User className="w-3 h-3 text-red-600" />
                  <span>Author: {currentUser?.displayName || currentUser?.email || 'Practitioner'} ({currentUser?.role || 'Staff'})</span>
                </div>
                <div className="flex items-center md:justify-end gap-1">
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
              This clinical summary compiles verified entries recorded in The Kidney Centre's HDU logs for {selectedUnit === 'ALL' ? 'all operational units' : `the ${UNIT_DETAILS[selectedUnit].label} unit`}. This is a privileged medical report for clinical auditing, inpatient handovers, and physician reviews.
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

          {/* DYNAMIC REPORT BODY (Based on selected report template) */}
          <div className="space-y-6">
            
            {/* A. CENSUS TEMPLATE */}
            {(reportType === 'census' || reportType === 'comprehensive' || (reportType === 'current' && initialTab === 'active')) && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                  Active In-Patient Census
                </h3>
                {patients.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No patients currently logged for the selected scope.</p>
                ) : (
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
                )}
              </div>
            )}

            {/* B. TASKS TEMPLATE */}
            {(reportType === 'tasks' || reportType === 'comprehensive' || (reportType === 'current' && initialTab === 'tasks')) && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                  Clinical Interventions & Core Worklist
                </h3>
                {tasks.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No tasks currently registered for the selected scope.</p>
                ) : (
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
                )}
              </div>
            )}

            {/* C. INVENTORY TEMPLATE */}
            {(reportType === 'inventory' || reportType === 'comprehensive' || (reportType === 'current' && initialTab === 'inventory')) && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                  Emergency Stock & Inventory Levels
                </h3>
                {inventory.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No inventory tracked under the selected unit scope.</p>
                ) : (
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
                )}
              </div>
            )}

            {/* D. MORTALITY TEMPLATE */}
            {(reportType === 'mortality' || (reportType === 'current' && initialTab === 'mortality')) && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                  Clinical Mortality Review Register
                </h3>
                {mortality.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No mortality records logged for this unit.</p>
                ) : (
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
                )}
              </div>
            )}

            {/* E. INCIDENTS TEMPLATE */}
            {(reportType === 'incidents' || (reportType === 'current' && initialTab === 'safety-incidents')) && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                  Clinical Safety & Incident register
                </h3>
                {incidents.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No incidents recorded under this clinical unit.</p>
                ) : (
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
                )}
              </div>
            )}

            {/* F. ENDOSCOPY TEMPLATE */}
            {(reportType === 'endoscopy' || (reportType === 'current' && (initialTab === 'endoscopy-report' || initialTab === 'endoscopy-logs'))) && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                  Clinical Endoscopy Logs
                </h3>
                {endoscopy.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No endoscopy reports archived under this unit scope.</p>
                ) : (
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
                              <p className="font-bold">{eRecord.procedure}</p>
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
                )}
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
                    The Kidney Centre Healthcare Alliance
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Print Footer Page Numbering Guideline */}
          <div className="mt-10 text-center text-[8px] text-slate-400 border-t border-slate-100 pt-3">
            THE KIDNEY CENTRE MEDICAL RECORD SYSTEM • PRIVILEGED AND CONFIDENTIAL CLINICAL INFORMATION • DO NOT DUPLICATE WITHOUT AUTHORIZATION
          </div>
        </div>
      </div>
    </div>
  );
};
