import { 
  MonthlyReportScheduleSettings, 
  MonthlyReportDispatchLog, 
  DepartmentMetricSummary, 
  ClinicalUnit,
  Patient,
  InventoryItem
} from '../types';

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
    try {
      const res = await fetch('/api/reports/monthly-scheduler/settings');
      if (!res.ok) throw new Error('Failed to fetch monthly report settings');
      return await res.json();
    } catch (err) {
      console.warn('Error fetching monthly report settings, using defaults:', err);
      return {
        settings: {
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
        },
        smtpConfig: {
          host: 'smtp.gmail.com',
          port: 587,
          user: '',
          senderEmail: 'reports@kidneycentre.org',
          isConfigured: false
        }
      };
    }
  },

  // 2. Save monthly cron schedule settings
  updateSettings: async (settings: Partial<MonthlyReportScheduleSettings>): Promise<MonthlyReportScheduleSettings> => {
    const res = await fetch('/api/reports/monthly-scheduler/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update monthly schedule settings');
    }
    const data = await res.json();
    return data.settings;
  },

  // 3. Fetch monthly dispatch logs
  getLogs: async (): Promise<MonthlyReportDispatchLog[]> => {
    try {
      const res = await fetch('/api/reports/monthly-scheduler/logs');
      if (!res.ok) throw new Error('Failed to fetch monthly report audit logs');
      const data = await res.json();
      return data.logs || [];
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
    const res = await fetch('/api/reports/monthly-scheduler/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to dispatch monthly department report');
    }

    return await res.json();
  }
};
