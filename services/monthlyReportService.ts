import { 
  MonthlyReportScheduleSettings, 
  MonthlyReportDispatchLog, 
  DepartmentMetricSummary, 
  ClinicalUnit,
  Patient,
  InventoryItem
} from '../types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, safeFirestoreWrite } from './firebaseConfig';
import { dailyReportService } from './dailyReportService';

const LOCAL_MONTHLY_KEY = 'medilog_monthly_report_settings_v2';

export interface MonthlyDispatchParams {
  recipients?: string[];
  departmentMetrics?: DepartmentMetricSummary[];
  departmentScopes?: (ClinicalUnit | 'ALL')[];
  totalHospitalCensus?: number;
  totalAdmissionsThisMonth?: number;
  totalDischargesThisMonth?: number;
  totalMortalityCount?: number;
  totalIncidentsCount?: number;
  lowStockItems?: Array<{
    name: string;
    unit: string;
    quantity: number;
    minThreshold: number;
    measurementUnit?: string;
  }>;
  monthName?: string;
  triggerType?: 'CRON_AUTOMATION' | 'MANUAL_RUN' | 'TEST_SIMULATION';
  generatedBy?: string;
}

async function safeFetchJson(url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: any; rawText: string }> {
  try {
    const res = await fetch(url, options);
    const rawText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, rawText };
  } catch (err: any) {
    return { ok: false, status: 0, data: null, rawText: err?.message || 'Network error' };
  }
}

export const monthlyReportService = {
  // 1. Fetch current monthly cron schedule settings & SMTP configuration
  getSettings: async (): Promise<{
    settings: MonthlyReportScheduleSettings;
    smtpConfig: {
      host: string;
      port: number;
      user: string;
      senderEmail: string;
      isConfigured: boolean;
    };
  }> => {
    let serverData: any = null;
    try {
      const resp = await safeFetchJson('/api/reports/monthly-scheduler/settings');
      if (resp.ok && resp.data) {
        serverData = resp.data;
      }
    } catch (err) {
      console.warn('Server fetch monthly settings failed:', err);
    }

    // Try loading local cached settings
    let localSaved: any = null;
    try {
      const cached = localStorage.getItem(LOCAL_MONTHLY_KEY);
      if (cached) localSaved = JSON.parse(cached);
    } catch (e) {}

    // Try loading Firestore settings
    let firestoreSaved: any = null;
    try {
      const snap = await getDoc(doc(db, 'system_config', 'monthly_report_settings'));
      if (snap.exists()) {
        firestoreSaved = snap.data();
      }
    } catch (e) {}

    const defaultSettings: MonthlyReportScheduleSettings = {
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
      nextScheduledRun: null,
      ...(serverData?.settings || {}),
      ...(firestoreSaved || {}),
      ...(localSaved || {})
    };

    const currentSmtp = await dailyReportService.getSmtpConfig();

    return {
      settings: defaultSettings,
      smtpConfig: currentSmtp
    };
  },

  // 2. Save monthly cron schedule settings
  updateSettings: async (settings: Partial<MonthlyReportScheduleSettings>): Promise<MonthlyReportScheduleSettings> => {
    // 1. Save to LocalStorage immediately
    try {
      const cached = localStorage.getItem(LOCAL_MONTHLY_KEY);
      const parsed = cached ? JSON.parse(cached) : {};
      const updated = { ...parsed, ...settings };
      localStorage.setItem(LOCAL_MONTHLY_KEY, JSON.stringify(updated));
    } catch (e) {}

    // 2. Save to Firestore
    try {
      await safeFirestoreWrite(() => 
        setDoc(doc(db, 'system_config', 'monthly_report_settings'), {
          ...settings,
          updatedAt: new Date().toISOString()
        }, { merge: true })
      );
    } catch (e) {
      console.warn('Firestore monthly settings write warning:', e);
    }

    // 3. Save to Server
    try {
      const resp = await safeFetchJson('/api/reports/monthly-scheduler/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (resp.ok && resp.data?.settings) {
        return resp.data.settings;
      }
    } catch (e) {
      console.warn('Server monthly settings update warning:', e);
    }

    return settings as MonthlyReportScheduleSettings;
  },

  // 3. Fetch monthly dispatch logs
  getLogs: async (): Promise<MonthlyReportDispatchLog[]> => {
    try {
      const resp = await safeFetchJson('/api/reports/monthly-scheduler/logs');
      if (resp.ok && resp.data?.logs) {
        return resp.data.logs;
      }
      return [];
    } catch (err) {
      console.warn('Error fetching monthly report logs:', err);
      return [];
    }
  },

  // 4. Trigger immediate dispatch or on-demand monthly report
  dispatchReport: async (params: MonthlyDispatchParams): Promise<{
    success: boolean;
    id: string;
    status: 'DELIVERED' | 'SIMULATED' | 'FAILED';
    recipients: string[];
    timestamp: string;
    details: string;
    reportHtmlPreview?: string;
  }> => {
    const resp = await safeFetchJson('/api/reports/monthly-scheduler/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    if (!resp.ok || !resp.data) {
      const errorMsg = resp.data?.error || (resp.rawText.includes('<html') ? 'Backend server is initializing. Please retry in a few seconds.' : resp.rawText) || 'Failed to dispatch monthly department report';
      throw new Error(errorMsg);
    }

    return resp.data;
  }
};
