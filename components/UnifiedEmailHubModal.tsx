import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { dailyReportService } from '../services/dailyReportService';
import { monthlyReportService, MonthlyDispatchParams } from '../services/monthlyReportService';
import { 
  DailyEmailReportSettings, 
  DailyReportLog, 
  MonthlyReportScheduleSettings, 
  MonthlyReportDispatchLog, 
  DepartmentMetricSummary, 
  ClinicalUnit, 
  Patient, 
  InventoryItem 
} from '../types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { 
  Mail, 
  Clock, 
  ShieldCheck, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff,
  History, 
  Server, 
  FileText, 
  Settings, 
  Activity,
  Calendar,
  Building2,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  HelpCircle,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { EmailConnectionDiagnostic } from './EmailConnectionDiagnostic';
import { MessageTemplateManagerModal } from './MessageTemplateManagerModal';

interface UnifiedEmailHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'daily' | 'monthly' | 'smtp' | 'diagnostics' | 'templates';
}

const CLINICAL_UNITS_DATA: { key: ClinicalUnit; name: string }[] = [
  { key: 'HDU', name: 'High Dependency Unit (HDU)' },
  { key: 'ICU', name: 'Intensive Care Unit (ICU)' },
  { key: 'TRANSPLANT', name: 'Renal Transplant Unit' },
  { key: '4th-WARD', name: '4th Floor Medical Ward' },
  { key: 'WARD5', name: '5th Floor Surgical Ward' },
  { key: 'ENDOSCOPY', name: 'Endoscopy & Day Care Unit' }
];

export const UnifiedEmailHubModal: React.FC<UnifiedEmailHubModalProps> = ({ 
  isOpen, 
  onClose,
  initialTab = 'daily'
}) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'smtp' | 'diagnostics' | 'templates'>(initialTab);

  // Global SMTP Status
  const [smtpConfig, setSmtpConfig] = useState<{
    host: string;
    port: number;
    user: string;
    senderEmail: string;
    isConfigured: boolean;
    hasPassword?: boolean;
  }>({
    host: 'smtp.gmail.com',
    port: 587,
    user: '',
    senderEmail: 'reports@kidneycentre.org',
    isConfigured: false,
    hasPassword: false
  });

  // Global Form Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // ----------------------------------------------------
  // 1. DAILY REPORT STATE
  // ----------------------------------------------------
  const [dailySettings, setDailySettings] = useState<DailyEmailReportSettings>({
    enabled: true,
    scheduleTime: '08:00',
    recipients: ['adilh1220@gmail.com'],
    unitScope: 'ALL',
    includeCensus: true,
    includeInventory: true,
    includeMortality: true,
    includeIncidents: true
  });
  const [dailyLogs, setDailyLogs] = useState<DailyReportLog[]>([]);
  const [dailyNewRecipient, setDailyNewRecipient] = useState('');
  const [savingDaily, setSavingDaily] = useState(false);
  const [dispatchingDaily, setDispatchingDaily] = useState(false);
  const [dailyPreviewHtml, setDailyPreviewHtml] = useState<string>('');
  const [showDailyPreview, setShowDailyPreview] = useState(false);

  // Live Snapshot for Daily
  const [activePatients, setActivePatients] = useState<Patient[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [mortalityCount24h, setMortalityCount24h] = useState<number>(0);
  const [totalInventoryCount, setTotalInventoryCount] = useState<number>(0);

  // ----------------------------------------------------
  // 2. MONTHLY REPORT STATE
  // ----------------------------------------------------
  const [monthlySettings, setMonthlySettings] = useState<MonthlyReportScheduleSettings>({
    enabled: true,
    cronDefinition: {
      id: 'cron_monthly_dept_digest',
      name: 'End of Month Multi-Department Executive Digest',
      cronExpression: '0 8 L * *',
      frequency: 'MONTHLY',
      monthTriggerDay: 'LAST_DAY',
      customDayOfMonth: 28,
      time: '08:00',
      timezone: 'Asia/Karachi',
      enabled: true
    },
    recipients: ['adilh1220@gmail.com'],
    departmentScopes: ['ALL', 'HDU', 'ICU', 'TRANSPLANT', '4th-WARD', 'WARD5', 'ENDOSCOPY'],
    includeExecutiveSummary: true,
    includeDepartmentBreakdown: true,
    includeInventoryAlerts: true,
    includeMortalityRegistry: true,
    includeIncidentReports: true,
    lastSentAt: null,
    lastStatus: null,
    nextScheduledRun: null
  });
  const [monthlyLogs, setMonthlyLogs] = useState<MonthlyReportDispatchLog[]>([]);
  const [monthlyNewRecipient, setMonthlyNewRecipient] = useState('');
  const [savingMonthly, setSavingMonthly] = useState(false);
  const [dispatchingMonthly, setDispatchingMonthly] = useState(false);
  const [monthlyPreviewHtml, setMonthlyPreviewHtml] = useState<string>('');
  const [showMonthlyPreview, setShowMonthlyPreview] = useState(false);

  // Monthly aggregated metrics
  const [departmentMetrics, setDepartmentMetrics] = useState<DepartmentMetricSummary[]>([]);
  const [totalHospitalCensus, setTotalHospitalCensus] = useState(0);
  const [totalAdmissionsMonth, setTotalAdmissionsMonth] = useState(0);
  const [totalDischargesMonth, setTotalDischargesMonth] = useState(0);

  // ----------------------------------------------------
  // 3. SMTP SETTINGS STATE
  // ----------------------------------------------------
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSenderEmail, setSmtpSenderEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [smtpSavedSuccess, setSmtpSavedSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ user?: string; pass?: string }>({});

  // Sync tab on prop change
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Load all configurations on open
  const loadAllData = async () => {
    if (!isOpen) return;
    setLoading(true);
    setFeedback(null);

    try {
      // 1. Load Daily & SMTP configuration
      const dailyData = await dailyReportService.getSettings();
      if (dailyData.settings) setDailySettings(dailyData.settings);
      if (dailyData.smtpConfig) {
        setSmtpConfig(dailyData.smtpConfig);
        setSmtpHost(dailyData.smtpConfig.host || 'smtp.gmail.com');
        setSmtpPort(dailyData.smtpConfig.port || 587);
        
        const cleanUser = (dailyData.smtpConfig.user && !dailyData.smtpConfig.user.includes('Not Configured') && !dailyData.smtpConfig.user.includes('Simulation')) 
          ? dailyData.smtpConfig.user 
          : (currentUser?.email || 'adilh1220@gmail.com');
        setSmtpUser(cleanUser);

        const cleanSender = (dailyData.smtpConfig.senderEmail && !dailyData.smtpConfig.senderEmail.includes('kidneycentre.org') && !dailyData.smtpConfig.senderEmail.includes('medilog'))
          ? dailyData.smtpConfig.senderEmail
          : cleanUser;
        setSmtpSenderEmail(cleanSender);

        if (dailyData.smtpConfig.pass) {
          setSmtpPass(dailyData.smtpConfig.pass);
        }
        
        const defaultRecipient = currentUser?.email || cleanUser || 'adilh1220@gmail.com';
        setTestEmailAddress(defaultRecipient);
      }

      // 2. Load Daily Logs
      const dailyLogList = await dailyReportService.getLogs();
      setDailyLogs(dailyLogList);

      // 3. Load Monthly Configuration & Logs
      const monthlyData = await monthlyReportService.getSettings();
      if (monthlyData.settings) setMonthlySettings(monthlyData.settings);
      const monthlyLogList = await monthlyReportService.getLogs();
      setMonthlyLogs(monthlyLogList);

      // 4. Load Live Clinical Data from Firestore for census & metrics (Non-blocking & resilient)
      const activeList: Patient[] = [];
      let admissions = 0;
      let discharges = 0;
      const deptMap: Record<string, { census: number; admissions: number; discharges: number }> = {};

      CLINICAL_UNITS_DATA.forEach(u => {
        deptMap[u.key] = { census: 0, admissions: 0, discharges: 0 };
      });

      try {
        const patientsSnap = await getDocs(collection(db, 'patients'));
        patientsSnap.forEach(docSnap => {
          const p = docSnap.data() as Patient;
          const unit = p.unit || 'HDU';
          if (!p.status || p.status === 'Active') {
            activeList.push({ id: docSnap.id, ...p });
            if (deptMap[unit]) deptMap[unit].census += 1;
          } else if (p.status === 'Discharged') {
            discharges += 1;
            if (deptMap[unit]) deptMap[unit].discharges += 1;
          }
          admissions += 1;
        });
      } catch (pErr) {
        console.warn('Patients fetch warning (offline fallback active):', pErr);
      }

      setActivePatients(activeList);
      setTotalHospitalCensus(activeList.length);
      setTotalAdmissionsMonth(admissions || activeList.length);
      setTotalDischargesMonth(discharges);

      // Construct Department Metrics
      const metricsSummary: DepartmentMetricSummary[] = CLINICAL_UNITS_DATA.map(unit => ({
        unit: unit.key,
        unitName: unit.name,
        activeCensus: deptMap[unit.key]?.census || 0,
        totalAdmissionsThisMonth: deptMap[unit.key]?.admissions || deptMap[unit.key]?.census || 0,
        dischargesThisMonth: deptMap[unit.key]?.discharges || 0,
        mortalityCount: 0,
        criticalIncidentsCount: 0,
        lowStockItemCount: 0,
        totalInventoryItems: 0,
        criticalPatientsCount: 0
      }));
      setDepartmentMetrics(metricsSummary);

      // Inventory Alerts
      const lowStock: InventoryItem[] = [];
      let totalInv = 0;
      try {
        const inventorySnap = await getDocs(collection(db, 'inventory'));
        inventorySnap.forEach(docSnap => {
          totalInv++;
          const item = docSnap.data() as InventoryItem;
          if (item.quantity <= (item.minThreshold || 5)) {
            lowStock.push({ id: docSnap.id, ...item });
          }
        });
      } catch (invErr) {
        console.warn('Inventory fetch warning:', invErr);
      }
      setLowStockItems(lowStock);
      setTotalInventoryCount(totalInv);

      // Mortality Records
      try {
        const mortalitySnap = await getDocs(collection(db, 'mortality_records'));
        setMortalityCount24h(mortalitySnap.size);
      } catch (mortErr) {
        console.warn('Mortality fetch warning:', mortErr);
      }

    } catch (err: any) {
      console.warn("Notice: Loaded email configuration with fallback values:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [isOpen]);

  // Apply SMTP Presets
  const applyPreset = (preset: 'gmail' | 'outlook' | 'sendgrid') => {
    if (preset === 'gmail') {
      setSmtpHost('smtp.gmail.com');
      setSmtpPort(587);
    } else if (preset === 'outlook') {
      setSmtpHost('smtp.office365.com');
      setSmtpPort(587);
    } else if (preset === 'sendgrid') {
      setSmtpHost('smtp.sendgrid.net');
      setSmtpPort(587);
      if (!smtpUser) setSmtpUser('apikey');
    }
  };

  // ----------------------------------------------------
  // SAVE & ACTIVATE SMTP
  // ----------------------------------------------------
  const handleSaveSmtpConfig = async () => {
    const errors: { user?: string; pass?: string } = {};
    if (!smtpUser.trim()) {
      errors.user = 'SMTP Username / Email (e.g. adilh1220@gmail.com) is required';
    }
    if (!smtpPass.trim() && !smtpConfig.hasPassword) {
      errors.pass = '16-character Google App Password is required';
    }
    setValidationErrors(errors);

    if (errors.user || errors.pass) {
      setFeedback({
        type: 'error',
        message: 'Please provide both your Gmail address and 16-character App Password before saving.'
      });
      return;
    }

    setSavingSmtp(true);
    setFeedback(null);

    try {
      const result = await dailyReportService.saveSmtpConfig({
        host: smtpHost.trim() || 'smtp.gmail.com',
        port: Number(smtpPort) || 587,
        user: smtpUser.trim(),
        pass: smtpPass.trim(),
        senderEmail: smtpSenderEmail.trim() || smtpUser.trim()
      });

      setSmtpConfig({
        host: result.smtpConfig?.host || smtpHost,
        port: result.smtpConfig?.port || smtpPort,
        user: result.smtpConfig?.user || smtpUser,
        senderEmail: result.smtpConfig?.senderEmail || smtpSenderEmail || smtpUser,
        isConfigured: result.smtpConfig?.isConfigured ?? true,
        hasPassword: result.smtpConfig?.hasPassword ?? true
      });

      setSmtpSavedSuccess(true);
      setValidationErrors({});

      setFeedback({
        type: 'success',
        message: 'SMTP Credentials saved & activated successfully! Automated and on-demand emails will now dispatch directly to recipient inboxes.'
      });

      setTimeout(() => setSmtpSavedSuccess(false), 5000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to save SMTP configuration. Please check credentials or network connection.'
      });
    } finally {
      setSavingSmtp(false);
    }
  };

  // ----------------------------------------------------
  // TEST SMTP CONNECTION
  // ----------------------------------------------------
  const handleTestSmtpConnection = async () => {
    if (!smtpUser.trim()) {
      setFeedback({ type: 'error', message: 'SMTP Username is required to test connection.' });
      return;
    }
    if (!smtpPass.trim() && !smtpConfig.hasPassword) {
      setFeedback({ type: 'error', message: 'App Password is required to test connection.' });
      return;
    }
    if (!testEmailAddress.trim()) {
      setFeedback({ type: 'error', message: 'Specify recipient email for verification dispatch.' });
      return;
    }

    setTestingSmtp(true);
    setFeedback(null);

    try {
      const result = await dailyReportService.testSmtpConnection({
        testEmail: testEmailAddress.trim(),
        host: smtpHost.trim(),
        port: Number(smtpPort),
        user: smtpUser.trim(),
        pass: smtpPass.trim(),
        senderEmail: smtpSenderEmail.trim() || smtpUser.trim()
      });

      setFeedback({
        type: 'success',
        message: result.message || `SMTP Connection verified! Verification email sent to ${testEmailAddress}.`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'SMTP Connection Test failed. Check username, password, or security settings.'
      });
    } finally {
      setTestingSmtp(false);
    }
  };

  // ----------------------------------------------------
  // DISPATCH DAILY REPORT NOW
  // ----------------------------------------------------
  const handleDispatchDailyNow = async () => {
    if (dailySettings.recipients.length === 0) {
      setFeedback({ type: 'error', message: 'Please add at least one recipient email address.' });
      return;
    }

    setDispatchingDaily(true);
    setFeedback(null);

    try {
      const result = await dailyReportService.dispatchReport({
        recipients: dailySettings.recipients,
        unitScope: dailySettings.unitScope,
        patients: activePatients.map(p => ({
          name: p.name,
          regNo: p.regNo,
          unit: p.unit || 'HDU',
          category: p.category || 'General',
          triagePriority: p.triagePriority,
          codeStatus: p.codeStatus,
          location: p.location
        })),
        inventoryAlerts: lowStockItems.map(i => ({
          name: i.name,
          unit: i.unit,
          category: i.category || 'General Supplies',
          quantity: i.quantity,
          minThreshold: i.minThreshold || 5,
          measurementUnit: i.measurementUnit || 'Units'
        })),
        mortalityCount: mortalityCount24h,
        totalInventoryCount,
        triggerType: 'ON_DEMAND',
        generatedBy: currentUser?.email || 'Admin Portal'
      });

      if (result.reportHtmlPreview) {
        setDailyPreviewHtml(result.reportHtmlPreview);
      }

      setFeedback({
        type: 'success',
        message: `Daily Census Report successfully sent to: ${result.recipients.join(', ')} (${result.status})`
      });

      // Refresh Logs
      const updatedLogs = await dailyReportService.getLogs();
      setDailyLogs(updatedLogs);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to dispatch daily report.'
      });
    } finally {
      setDispatchingDaily(false);
    }
  };

  // ----------------------------------------------------
  // SAVE DAILY SCHEDULE
  // ----------------------------------------------------
  const handleSaveDailySchedule = async () => {
    if (dailySettings.recipients.length === 0) {
      setFeedback({ type: 'error', message: 'Please provide at least one recipient email address.' });
      return;
    }

    setSavingDaily(true);
    setFeedback(null);

    try {
      const updated = await dailyReportService.updateSettings(dailySettings);
      setDailySettings(updated);
      setFeedback({
        type: 'success',
        message: `Daily report schedule saved! Automatic dispatch scheduled for ${updated.scheduleTime} daily.`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to save daily schedule settings.'
      });
    } finally {
      setSavingDaily(false);
    }
  };

  // ----------------------------------------------------
  // DISPATCH MONTHLY REPORT NOW
  // ----------------------------------------------------
  const handleDispatchMonthlyNow = async () => {
    if (monthlySettings.recipients.length === 0) {
      setFeedback({ type: 'error', message: 'Please add at least one recipient email address.' });
      return;
    }

    setDispatchingMonthly(true);
    setFeedback(null);

    try {
      const now = new Date();
      const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

      const result = await monthlyReportService.dispatchReport({
        recipients: monthlySettings.recipients,
        departmentMetrics,
        departmentScopes: monthlySettings.departmentScopes,
        totalHospitalCensus,
        totalAdmissionsThisMonth: totalAdmissionsMonth,
        totalDischargesThisMonth: totalDischargesMonth,
        totalMortalityCount: mortalityCount24h,
        totalIncidentsCount: 0,
        lowStockItems: lowStockItems.map(i => ({
          name: i.name,
          unit: i.unit,
          quantity: i.quantity,
          minThreshold: i.minThreshold,
          measurementUnit: i.measurementUnit
        })),
        monthName,
        triggerType: 'MANUAL_RUN',
        generatedBy: currentUser?.email || 'Executive Central Hub'
      });

      if (result.reportHtmlPreview) {
        setMonthlyPreviewHtml(result.reportHtmlPreview);
      }

      setFeedback({
        type: 'success',
        message: `Monthly Executive Digest sent to: ${result.recipients.join(', ')} (${result.status})`
      });

      // Refresh logs
      const updatedLogs = await monthlyReportService.getLogs();
      setMonthlyLogs(updatedLogs);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to dispatch monthly report.'
      });
    } finally {
      setDispatchingMonthly(false);
    }
  };

  // ----------------------------------------------------
  // SAVE MONTHLY SCHEDULE
  // ----------------------------------------------------
  const handleSaveMonthlySchedule = async () => {
    if (monthlySettings.recipients.length === 0) {
      setFeedback({ type: 'error', message: 'Please provide at least one recipient email address.' });
      return;
    }

    setSavingMonthly(true);
    setFeedback(null);

    try {
      const updated = await monthlyReportService.updateSettings(monthlySettings);
      setMonthlySettings(updated);
      setFeedback({
        type: 'success',
        message: 'Monthly report schedule saved & registered with background cloud scheduler!'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to save monthly schedule settings.'
      });
    } finally {
      setSavingMonthly(false);
    }
  };

  // Recipient Management Helpers
  const addDailyRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    const email = dailyNewRecipient.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    if (!dailySettings.recipients.includes(email)) {
      setDailySettings(prev => ({ ...prev, recipients: [...prev.recipients, email] }));
    }
    setDailyNewRecipient('');
  };

  const removeDailyRecipient = (email: string) => {
    setDailySettings(prev => ({
      ...prev,
      recipients: prev.recipients.filter(r => r !== email)
    }));
  };

  const addMonthlyRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    const email = monthlyNewRecipient.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    if (!monthlySettings.recipients.includes(email)) {
      setMonthlySettings(prev => ({ ...prev, recipients: [...prev.recipients, email] }));
    }
    setMonthlyNewRecipient('');
  };

  const removeMonthlyRecipient = (email: string) => {
    setMonthlySettings(prev => ({
      ...prev,
      recipients: prev.recipients.filter(r => r !== email)
    }));
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Automated Email & Clinical Report Hub"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5">
        
        {/* Main Gateway Status Banner */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30 shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold tracking-tight">Central Email & Report Dispatch Hub</h3>
                <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border ${
                  smtpConfig.isConfigured 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {smtpConfig.isConfigured ? '✓ SMTP Active' : '⚠ SMTP Setup Needed'}
                </span>
                {smtpConfig.user && (
                  <span className="text-[10px] text-slate-400 font-mono">({smtpConfig.user})</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Manage Daily Census, Monthly Department Digests, Gmail Credentials & Connection Diagnostics all in one place.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('smtp')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'smtp'
                  ? 'bg-white text-slate-900 shadow'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-sky-400" /> Configure SMTP
            </button>
          </div>
        </div>

        {/* Top Master Tab Bar */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => { setActiveTab('daily'); setFeedback(null); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'daily'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" /> Daily Census & Stock
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('monthly'); setFeedback(null); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'monthly'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" /> Monthly Dept Digest
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('smtp'); setFeedback(null); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'smtp'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Server className="w-4 h-4" /> SMTP & Google Setup
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('diagnostics'); setFeedback(null); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'diagnostics'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" /> Live Diagnostics
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('templates'); setFeedback(null); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'templates'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Message Templates
          </button>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2 border ${
            feedback.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-xs' 
              : 'bg-red-50 text-red-900 border-red-300 shadow-xs'
          }`}>
            <div className="flex items-start gap-2.5">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: DAILY CENSUS & STOCK REPORT */}
        {/* ========================================================================= */}
        {activeTab === 'daily' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Quick Live Snapshot Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Active Census</span>
                <p className="text-lg font-black text-slate-900 dark:text-white">{activePatients.length} Patients</p>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Low Stock Items</span>
                <p className={`text-lg font-black ${lowStockItems.length > 0 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                  {lowStockItems.length} Alerts
                </p>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">24H Mortality</span>
                <p className="text-lg font-black text-slate-900 dark:text-white">{mortalityCount24h} Logged</p>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Schedule Time</span>
                <p className="text-lg font-black text-sky-600 dark:text-sky-400">{dailySettings.scheduleTime} Daily</p>
              </div>
            </div>

            {/* Daily Settings Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Left Column: Timing & Scope */}
              <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Daily Schedule Automation
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={dailySettings.enabled} 
                      onChange={(e) => setDailySettings(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Dispatch Time</label>
                    <input 
                      type="time" 
                      value={dailySettings.scheduleTime} 
                      onChange={(e) => setDailySettings(prev => ({ ...prev, scheduleTime: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Unit Scope</label>
                    <select
                      value={dailySettings.unitScope}
                      onChange={(e) => setDailySettings(prev => ({ ...prev, unitScope: e.target.value as any }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="ALL">All Hospital Units</option>
                      {CLINICAL_UNITS_DATA.map(u => (
                        <option key={u.key} value={u.key}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-2">Report Content Inclusions</label>
                  <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={dailySettings.includeCensus} 
                        onChange={(e) => setDailySettings(prev => ({ ...prev, includeCensus: e.target.checked }))}
                        className="rounded text-sky-600"
                      />
                      Patient Census
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={dailySettings.includeInventory} 
                        onChange={(e) => setDailySettings(prev => ({ ...prev, includeInventory: e.target.checked }))}
                        className="rounded text-sky-600"
                      />
                      Low Stock Alerts
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={dailySettings.includeMortality} 
                        onChange={(e) => setDailySettings(prev => ({ ...prev, includeMortality: e.target.checked }))}
                        className="rounded text-sky-600"
                      />
                      24h Mortality
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={dailySettings.includeIncidents} 
                        onChange={(e) => setDailySettings(prev => ({ ...prev, includeIncidents: e.target.checked }))}
                        className="rounded text-sky-600"
                      />
                      Clinical Incidents
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column: Recipients */}
              <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 flex flex-col justify-between">
                <div>
                  <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider block mb-2">
                    Daily Report Recipients
                  </label>
                  
                  <form onSubmit={addDailyRecipient} className="flex gap-2 mb-2">
                    <input 
                      type="email" 
                      placeholder="Add recipient (e.g. doctor@hospital.com)" 
                      value={dailyNewRecipient}
                      onChange={(e) => setDailyNewRecipient(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button 
                      type="submit" 
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </form>

                  {/* Quick Preset Chip */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-[10px] text-slate-500 font-semibold">Quick add:</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!dailySettings.recipients.includes('adilh1220@gmail.com')) {
                          setDailySettings(prev => ({ ...prev, recipients: [...prev.recipients, 'adilh1220@gmail.com'] }));
                        }
                      }}
                      className="px-2 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded text-[10px] font-bold hover:bg-slate-100"
                    >
                      + adilh1220@gmail.com
                    </button>
                  </div>

                  {/* Recipient Pills */}
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {dailySettings.recipients.map(email => (
                      <span key={email} className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium flex items-center gap-2">
                        {email}
                        <button 
                          type="button" 
                          onClick={() => removeDailyRecipient(email)}
                          className="text-slate-400 hover:text-red-500 font-bold"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    {dailySettings.recipients.length === 0 && (
                      <p className="text-xs text-amber-600 italic">No recipient added yet. Please add at least one email.</p>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowDailyPreview(!showDailyPreview)}
                    className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> {showDailyPreview ? 'Hide Preview' : 'Preview HTML Layout'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveDailySchedule}
                    disabled={savingDaily}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {savingDaily ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    Save Schedule
                  </button>
                </div>
              </div>
            </div>

            {/* Daily Action & Dispatch Bar */}
            <div className="p-4 bg-sky-50 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-800/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="text-xs font-extrabold text-sky-950 dark:text-sky-200 block">Instant On-Demand Dispatch</span>
                <p className="text-[11px] text-sky-800 dark:text-sky-300 font-medium">
                  Trigger and dispatch today's live patient census & inventory shortage alert to configured recipients right now.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDispatchDailyNow}
                disabled={dispatchingDaily || dailySettings.recipients.length === 0}
                className="w-full sm:w-auto px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {dispatchingDaily ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Sending Report...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send Daily Report Now
                  </>
                )}
              </button>
            </div>

            {/* Preview Section */}
            {showDailyPreview && (
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Live Formatted Email Template
                </span>
                <div 
                  className="bg-white p-4 rounded-lg shadow-inner max-h-72 overflow-y-auto text-xs text-slate-800 border border-slate-200"
                  dangerouslySetInnerHTML={{ 
                    __html: dailyPreviewHtml || `<div style="font-family: sans-serif; padding: 16px;">
                      <h3 style="color: #0369a1; margin-top: 0;">Daily Clinical Census Report</h3>
                      <p><strong>Total Active Patients:</strong> ${activePatients.length}</p>
                      <p><strong>Low Stock Alerts:</strong> ${lowStockItems.length} items</p>
                      <p><strong>Mortality (24h):</strong> ${mortalityCount24h}</p>
                      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 12px 0;" />
                      <p style="font-size: 11px; color: #64748b;">Dispatched securely via Kidney Centre Mail Transport</p>
                    </div>` 
                  }}
                />
              </div>
            )}

            {/* Recent Daily Dispatch Logs */}
            {dailyLogs.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> Recent Daily Dispatch History
                </label>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                  {dailyLogs.slice(0, 4).map(log => (
                    <div key={log.id} className="p-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            log.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {log.status}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{log.details}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {log.recipients.length} Recipient(s)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MONTHLY DEPARTMENT DIGEST */}
        {/* ========================================================================= */}
        {activeTab === 'monthly' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Monthly Key Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Monthly Census</span>
                <p className="text-lg font-black text-slate-900 dark:text-white">{totalHospitalCensus} Current</p>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Admissions / Month</span>
                <p className="text-lg font-black text-slate-900 dark:text-white">{totalAdmissionsMonth} Ingested</p>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Discharges / Month</span>
                <p className="text-lg font-black text-slate-900 dark:text-white">{totalDischargesMonth} Completed</p>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Scheduled Trigger</span>
                <p className="text-lg font-black text-red-600 dark:text-red-400">
                  {monthlySettings.cronDefinition?.monthTriggerDay === 'LAST_DAY' ? 'Last Day of Month' : '1st of Month'}
                </p>
              </div>
            </div>

            {/* Monthly Settings Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Left Column: Timing & Department Scopes */}
              <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Monthly Cloud Cron Automation
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={monthlySettings.enabled} 
                      onChange={(e) => setMonthlySettings(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Trigger Day</label>
                    <select
                      value={monthlySettings.cronDefinition?.monthTriggerDay || 'LAST_DAY'}
                      onChange={(e) => setMonthlySettings(prev => ({
                        ...prev,
                        cronDefinition: {
                          ...prev.cronDefinition,
                          monthTriggerDay: e.target.value as any
                        }
                      }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="LAST_DAY">End of Month (Last Day)</option>
                      <option value="FIRST_DAY">Start of Month (1st Day)</option>
                      <option value="CUSTOM_DAY">15th of Every Month</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Trigger Time</label>
                    <input 
                      type="time" 
                      value={monthlySettings.cronDefinition?.time || '08:00'} 
                      onChange={(e) => setMonthlySettings(prev => ({
                        ...prev,
                        cronDefinition: {
                          ...prev.cronDefinition,
                          time: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-2">Department Inclusions</label>
                  <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={monthlySettings.includeExecutiveSummary} 
                        onChange={(e) => setMonthlySettings(prev => ({ ...prev, includeExecutiveSummary: e.target.checked }))}
                        className="rounded text-red-600"
                      />
                      Executive Summary
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={monthlySettings.includeDepartmentBreakdown} 
                        onChange={(e) => setMonthlySettings(prev => ({ ...prev, includeDepartmentBreakdown: e.target.checked }))}
                        className="rounded text-red-600"
                      />
                      Unit Breakdown
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={monthlySettings.includeInventoryAlerts} 
                        onChange={(e) => setMonthlySettings(prev => ({ ...prev, includeInventoryAlerts: e.target.checked }))}
                        className="rounded text-red-600"
                      />
                      Inventory Shortages
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={monthlySettings.includeMortalityRegistry} 
                        onChange={(e) => setMonthlySettings(prev => ({ ...prev, includeMortalityRegistry: e.target.checked }))}
                        className="rounded text-red-600"
                      />
                      Mortality Registry
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column: Monthly Recipients */}
              <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 flex flex-col justify-between">
                <div>
                  <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider block mb-2">
                    Monthly Digest Recipients
                  </label>
                  
                  <form onSubmit={addMonthlyRecipient} className="flex gap-2 mb-2">
                    <input 
                      type="email" 
                      placeholder="Add recipient (e.g. director@hospital.com)" 
                      value={monthlyNewRecipient}
                      onChange={(e) => setMonthlyNewRecipient(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button 
                      type="submit" 
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </form>

                  {/* Quick Preset Chip */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-[10px] text-slate-500 font-semibold">Quick add:</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!monthlySettings.recipients.includes('adilh1220@gmail.com')) {
                          setMonthlySettings(prev => ({ ...prev, recipients: [...prev.recipients, 'adilh1220@gmail.com'] }));
                        }
                      }}
                      className="px-2 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded text-[10px] font-bold hover:bg-slate-100"
                    >
                      + adilh1220@gmail.com
                    </button>
                  </div>

                  {/* Recipient Pills */}
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {monthlySettings.recipients.map(email => (
                      <span key={email} className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium flex items-center gap-2">
                        {email}
                        <button 
                          type="button" 
                          onClick={() => removeMonthlyRecipient(email)}
                          className="text-slate-400 hover:text-red-500 font-bold"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    {monthlySettings.recipients.length === 0 && (
                      <p className="text-xs text-amber-600 italic">No recipient added yet. Please add at least one email.</p>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowMonthlyPreview(!showMonthlyPreview)}
                    className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> {showMonthlyPreview ? 'Hide Preview' : 'Preview HTML Layout'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveMonthlySchedule}
                    disabled={savingMonthly}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {savingMonthly ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    Save Schedule
                  </button>
                </div>
              </div>
            </div>

            {/* Monthly Action & Dispatch Bar */}
            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="text-xs font-extrabold text-red-950 dark:text-red-200 block">Instant Multi-Department Executive Dispatch</span>
                <p className="text-[11px] text-red-800 dark:text-red-300 font-medium">
                  Generate and email the full aggregated monthly performance digest for all units to directors immediately.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDispatchMonthlyNow}
                disabled={dispatchingMonthly || monthlySettings.recipients.length === 0}
                className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {dispatchingMonthly ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Dispatching Digest...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send Monthly Report Now
                  </>
                )}
              </button>
            </div>

            {/* Preview Section */}
            {showMonthlyPreview && (
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Monthly Multi-Department Email Preview
                </span>
                <div 
                  className="bg-white p-4 rounded-lg shadow-inner max-h-72 overflow-y-auto text-xs text-slate-800 border border-slate-200"
                  dangerouslySetInnerHTML={{ 
                    __html: monthlyPreviewHtml || `<div style="font-family: sans-serif; padding: 16px;">
                      <h3 style="color: #dc2626; margin-top: 0;">Monthly Multi-Department Executive Digest</h3>
                      <p><strong>Total Monthly Admissions:</strong> ${totalAdmissionsMonth}</p>
                      <p><strong>Total Monthly Discharges:</strong> ${totalDischargesMonth}</p>
                      <p><strong>Active Patients:</strong> ${totalHospitalCensus}</p>
                      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 12px 0;" />
                      <p style="font-size: 11px; color: #64748b;">Kidney Centre Multi-Department Clinical Ledger</p>
                    </div>` 
                  }}
                />
              </div>
            )}

            {/* Recent Monthly Logs */}
            {monthlyLogs.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> Recent Monthly Dispatch History
                </label>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                  {monthlyLogs.slice(0, 4).map(log => (
                    <div key={log.id} className="p-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            log.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {log.status}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{log.details}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {log.recipients.length} Recipient(s)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SMTP SERVER & GOOGLE CONFIG */}
        {/* ========================================================================= */}
        {activeTab === 'smtp' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Quick Provider Presets */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Quick Provider Presets
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('gmail')}
                  className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 hover:bg-slate-100"
                >
                  <Mail className="w-3.5 h-3.5 text-red-500" /> Gmail / Google Workspace (Port 587)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('outlook')}
                  className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 hover:bg-slate-100"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-500" /> Microsoft 365 / Outlook (Port 587)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('sendgrid')}
                  className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 hover:bg-slate-100"
                >
                  <Mail className="w-3.5 h-3.5 text-sky-500" /> SendGrid / Custom
                </button>
              </div>
            </div>

            {/* Server & Port */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  SMTP Host Server
                </label>
                <input
                  type="text"
                  placeholder="e.g. smtp.gmail.com"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Port
                </label>
                <select
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 bg-white dark:bg-slate-800"
                >
                  <option value={587}>587 (TLS/STARTTLS)</option>
                  <option value={465}>465 (SSL/TLS)</option>
                  <option value={25}>25 (Standard Unencrypted)</option>
                </select>
              </div>
            </div>

            {/* Username & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    SMTP Username / Email <span className="text-red-500">*</span>
                  </label>
                  {validationErrors.user && (
                    <span className="text-[10px] text-red-600 font-bold">Required</span>
                  )}
                </div>
                <input
                  type="email"
                  placeholder="e.g. adilh1220@gmail.com"
                  value={smtpUser}
                  onChange={(e) => {
                    setSmtpUser(e.target.value);
                    if (validationErrors.user) setValidationErrors(prev => ({ ...prev, user: undefined }));
                  }}
                  className={`w-full px-3 py-2 border rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-slate-900 bg-white dark:bg-slate-800 ${
                    validationErrors.user ? 'border-red-500 bg-red-50/20' : 'border-slate-300 dark:border-slate-600'
                  }`}
                />
                {/* 1-Click Quick Fill Button */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500 font-semibold">Quick fill:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSmtpUser('adilh1220@gmail.com');
                      if (!smtpSenderEmail) setSmtpSenderEmail('adilh1220@gmail.com');
                      if (validationErrors.user) setValidationErrors(prev => ({ ...prev, user: undefined }));
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-[10px] font-bold transition-colors"
                  >
                    adilh1220@gmail.com
                  </button>
                  {currentUser?.email && currentUser.email !== 'adilh1220@gmail.com' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSmtpUser(currentUser.email);
                        if (!smtpSenderEmail) setSmtpSenderEmail(currentUser.email);
                        if (validationErrors.user) setValidationErrors(prev => ({ ...prev, user: undefined }));
                      }}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-[10px] font-bold transition-colors"
                    >
                      {currentUser.email}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Password / App Password <span className="text-red-500">*</span>
                  </label>
                  {smtpConfig.hasPassword && !smtpPass ? (
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      ✓ Saved on Server
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-600 font-semibold">(16-char App Password)</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={smtpConfig.hasPassword ? '•••••••••••••••• (Leave unchanged to keep)' : 'Enter 16-character Google App Password'}
                    value={smtpPass}
                    onChange={(e) => {
                      setSmtpPass(e.target.value);
                      if (validationErrors.pass) setValidationErrors(prev => ({ ...prev, pass: undefined }));
                    }}
                    className={`w-full pl-3 pr-10 py-2 border rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-slate-900 bg-white dark:bg-slate-800 ${
                      validationErrors.pass
                        ? 'border-red-500 bg-red-50/20'
                        : !smtpPass && !smtpConfig.hasPassword
                        ? 'border-amber-300 focus:border-amber-500'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">
                  {smtpConfig.hasPassword && !smtpPass 
                    ? 'Active on server. Enter new App Password only if changing accounts.' 
                    : 'Requires Google 16-character App Password (not standard password).'}
                </p>
              </div>
            </div>

            {/* Sender Identity */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Sender Display Email (From Address)
              </label>
              <input
                type="email"
                placeholder="e.g. reports@kidneycentre.org"
                value={smtpSenderEmail}
                onChange={(e) => setSmtpSenderEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-slate-900 bg-white dark:bg-slate-800"
              />
              <p className="text-[10px] text-slate-500 font-medium">Leave empty to use SMTP Username as the sender address.</p>
            </div>

            {/* Gmail App Password Step-by-Step Guide */}
            <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-sky-950 dark:text-sky-200 p-3.5 rounded-xl text-xs flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">How to get a Google App Password (16 Letters):</span>
                <p className="text-[11px] leading-relaxed text-sky-900 dark:text-sky-300">
                  1. Visit <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="underline font-bold text-sky-950 dark:text-sky-100">Google Account Security</a> and turn ON <strong>2-Step Verification</strong>.<br/>
                  2. Search for <strong>App Passwords</strong> in the top settings bar.<br/>
                  3. Create an app password named <em>Clinical Portal</em>, then paste the 16 letters into the password field above.
                </p>
              </div>
            </div>

            {/* Verification Test Section */}
            <div className="p-4 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                Test Connection & Send Verification Mail
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  placeholder="Enter test recipient email (e.g. adilh1220@gmail.com)"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-slate-900 bg-white dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={handleTestSmtpConnection}
                  disabled={testingSmtp || loading}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {testingSmtp ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Send Test Verification Email
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Action Bar for SMTP Tab */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('diagnostics')}
                className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1.5 transition-colors"
              >
                <Activity className="w-3.5 h-3.5" /> Open Diagnostics Probe
              </button>

              <button
                type="button"
                onClick={handleSaveSmtpConfig}
                disabled={savingSmtp || loading}
                className={`px-6 py-2.5 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                  smtpSavedSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'
                }`}
              >
                {savingSmtp ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Saving Configuration...
                  </>
                ) : smtpSavedSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" /> Saved & Activated!
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Save & Activate SMTP
                  </>
                )}
              </button>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: CONNECTION DIAGNOSTICS */}
        {/* ========================================================================= */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <EmailConnectionDiagnostic 
              onOpenSmtpConfig={() => setActiveTab('smtp')}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: MESSAGE TEMPLATES */}
        {/* ========================================================================= */}
        {activeTab === 'templates' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Clinical Message & Dispatch Templates
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Pre-formatted templates for Patient Admission, Discharge, Endoscopy Reports, and Emergency Clinical Alerts.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5 shadow-xs">
                  <span className="text-[10px] font-black uppercase text-sky-600 block">Daily Census Snapshot</span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    "Today's Patient Census across HDU, ICU, and Renal Transplant: {activePatients.length} Active Patients, {lowStockItems.length} Low Stock Alerts."
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5 shadow-xs">
                  <span className="text-[10px] font-black uppercase text-red-600 block">Low Stock Critical Alert</span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    "URGENT: Stock levels depleted below threshold for critical clinical supplies. Immediate replenishment requested."
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-400 font-medium">
            Automated Kidney Centre Mail Gateway • Multi-Tier Sync (Server + Cloud Firestore)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            Close
          </button>
        </div>

      </div>
    </Modal>
  );
};

export default UnifiedEmailHubModal;
