import { DailyEmailReportSettings, DailyReportLog, Patient, InventoryItem, ClinicalUnit } from '../types';

export const dailyReportService = {
  // Fetch current schedule settings & SMTP configuration status
  getSettings: async (): Promise<{
    settings: DailyEmailReportSettings;
    smtpConfig: {
      host: string;
      port: number;
      user: string;
      senderEmail: string;
      isConfigured: boolean;
    };
  }> => {
    try {
      const res = await fetch('/api/reports/daily-email/settings');
      if (!res.ok) throw new Error('Failed to fetch daily report settings');
      return await res.json();
    } catch (err) {
      console.warn('Error fetching settings, falling back to defaults:', err);
      return {
        settings: {
          enabled: true,
          scheduleTime: '08:00',
          recipients: ['authorized.personnel@kidneycentre.org'],
          unitScope: 'ALL',
          includeCensus: true,
          includeInventory: true,
          includeMortality: true,
          includeIncidents: true,
          lastSentAt: null,
          lastStatus: null
        },
        smtpConfig: {
          host: 'smtp.gmail.com',
          port: 587,
          user: 'Not Configured',
          senderEmail: 'reports@kidneycentre.org',
          isConfigured: false
        }
      };
    }
  },

  // Save schedule & recipient configuration
  updateSettings: async (settings: Partial<DailyEmailReportSettings>): Promise<DailyEmailReportSettings> => {
    const res = await fetch('/api/reports/daily-email/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update daily email report settings');
    }
    const data = await res.json();
    return data.settings;
  },

  // Fetch execution audit logs
  getLogs: async (): Promise<DailyReportLog[]> => {
    try {
      const res = await fetch('/api/reports/daily-email/logs');
      if (!res.ok) throw new Error('Failed to fetch report audit logs');
      const data = await res.json();
      return data.logs || [];
    } catch (err) {
      console.warn('Error fetching report logs:', err);
      return [];
    }
  },

  // Trigger immediate dispatch (or manual test send)
  dispatchReport: async (params: {
    recipients?: string[];
    unitScope?: ClinicalUnit | 'ALL';
    patients?: Array<{
      name: string;
      regNo: string;
      unit: string;
      category: string;
      triagePriority?: string;
      codeStatus?: string;
      location?: string;
    }>;
    inventoryAlerts?: Array<{
      name: string;
      unit: string;
      category: string;
      quantity: number;
      minThreshold: number;
      measurementUnit: string;
    }>;
    mortalityCount?: number;
    totalInventoryCount?: number;
    triggerType?: 'AUTOMATED_SCHEDULE' | 'MANUAL_TEST' | 'ON_DEMAND';
    generatedBy?: string;
  }): Promise<{
    success: boolean;
    id: string;
    status: 'DELIVERED' | 'SIMULATED' | 'FAILED';
    recipients: string[];
    activeCensusCount: number;
    lowStockAlertCount: number;
    timestamp: string;
    details: string;
    reportHtmlPreview?: string;
  }> => {
    const res = await fetch('/api/reports/daily-email/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to dispatch daily email report');
    }

    return await res.json();
  },

  // Get current SMTP server config
  getSmtpConfig: async (): Promise<{
    host: string;
    port: number;
    user: string;
    hasPassword: boolean;
    senderEmail: string;
    isConfigured: boolean;
  }> => {
    try {
      const res = await fetch('/api/smtp/config');
      if (!res.ok) throw new Error('Failed to fetch SMTP configuration');
      return await res.json();
    } catch (err) {
      console.warn('Error fetching SMTP config, falling back to default:', err);
      return {
        host: 'smtp.gmail.com',
        port: 587,
        user: '',
        hasPassword: false,
        senderEmail: 'reports@kidneycentre.org',
        isConfigured: false
      };
    }
  },

  // Save SMTP server config
  saveSmtpConfig: async (params: {
    host: string;
    port: number;
    user: string;
    pass?: string;
    senderEmail?: string;
  }) => {
    const res = await fetch('/api/smtp/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to save SMTP configuration');
    }
    return await res.json();
  },

  // Test SMTP Connection & Send Test Email
  testSmtpConnection: async (params: {
    testEmail: string;
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    senderEmail?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const res = await fetch('/api/smtp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'SMTP Connection Test failed');
    }
    return data;
  }
};
