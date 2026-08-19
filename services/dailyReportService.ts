import { DailyEmailReportSettings, DailyReportLog, Patient, InventoryItem, ClinicalUnit } from '../types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, safeFirestoreWrite } from './firebaseConfig';

const LOCAL_SMTP_KEY = 'medilog_smtp_config_v2';
const LOCAL_SETTINGS_KEY = 'medilog_daily_report_settings_v2';

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
    let serverSettings: any = null;
    try {
      const res = await fetch('/api/reports/daily-email/settings');
      if (res.ok) {
        serverSettings = await res.json();
      }
    } catch (err) {
      console.warn('Server fetch settings failed:', err);
    }

    // Try loading local cached settings as fallback
    let localSavedSettings: any = null;
    try {
      const cached = localStorage.getItem(LOCAL_SETTINGS_KEY);
      if (cached) localSavedSettings = JSON.parse(cached);
    } catch (e) {}

    // Try loading Firestore settings
    let firestoreSettings: any = null;
    try {
      const snap = await getDoc(doc(db, 'system_config', 'daily_report_settings'));
      if (snap.exists()) {
        firestoreSettings = snap.data();
      }
    } catch (e) {}

    const mergedSettings: DailyEmailReportSettings = {
      enabled: true,
      scheduleTime: '08:00',
      recipients: ['adilh1220@gmail.com'],
      unitScope: 'ALL',
      includeCensus: true,
      includeInventory: true,
      includeMortality: true,
      includeIncidents: true,
      lastSentAt: null,
      lastStatus: null,
      ...(serverSettings?.settings || {}),
      ...(firestoreSettings || {}),
      ...(localSavedSettings || {})
    };

    return {
      settings: mergedSettings,
      smtpConfig: serverSettings?.smtpConfig || {
        host: 'smtp.gmail.com',
        port: 587,
        user: 'Not Configured',
        senderEmail: 'reports@kidneycentre.org',
        isConfigured: false
      }
    };
  },

  // Save schedule & recipient configuration
  updateSettings: async (settings: Partial<DailyEmailReportSettings>): Promise<DailyEmailReportSettings> => {
    // 1. Save to LocalStorage immediately
    try {
      const current = localStorage.getItem(LOCAL_SETTINGS_KEY);
      const parsed = current ? JSON.parse(current) : {};
      const updated = { ...parsed, ...settings };
      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {}

    // 2. Save to Firestore
    try {
      await safeFirestoreWrite(() => 
        setDoc(doc(db, 'system_config', 'daily_report_settings'), {
          ...settings,
          updatedAt: new Date().toISOString()
        }, { merge: true })
      );
    } catch (e) {
      console.warn('Firestore settings write warning:', e);
    }

    // 3. Save to Server
    try {
      const res = await fetch('/api/reports/daily-email/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        const data = await res.json();
        return data.settings;
      }
    } catch (e) {
      console.warn('Server settings update warning:', e);
    }

    return settings as DailyEmailReportSettings;
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
    let serverConfig: any = null;
    try {
      const res = await fetch('/api/smtp/config');
      if (res.ok) {
        serverConfig = await res.json();
      }
    } catch (err) {
      console.warn('Server fetch SMTP config failed:', err);
    }

    // Try loading local cached config
    let localConfig: any = null;
    try {
      const cached = localStorage.getItem(LOCAL_SMTP_KEY);
      if (cached) localConfig = JSON.parse(cached);
    } catch (e) {}

    // Try loading Firestore config
    let firestoreConfig: any = null;
    try {
      const snap = await getDoc(doc(db, 'system_config', 'smtp_settings'));
      if (snap.exists()) {
        firestoreConfig = snap.data();
      }
    } catch (e) {}

    const isServerActive = Boolean(serverConfig?.isConfigured);
    const hasLocalCreds = Boolean(localConfig?.user && localConfig?.pass);

    // If server is not active or restarted, but local cache has credentials, auto-resync to server
    if (!isServerActive && hasLocalCreds) {
      try {
        const syncRes = await fetch('/api/smtp/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: localConfig.host || 'smtp.gmail.com',
            port: Number(localConfig.port) || 587,
            user: localConfig.user,
            pass: localConfig.pass,
            senderEmail: localConfig.senderEmail || localConfig.user
          })
        });
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          return syncData.smtpConfig;
        }
      } catch (syncErr) {
        console.warn('Auto-resync to server failed:', syncErr);
      }
    }

    const host = serverConfig?.host || firestoreConfig?.host || localConfig?.host || 'smtp.gmail.com';
    const port = Number(serverConfig?.port || firestoreConfig?.port || localConfig?.port) || 587;
    const user = serverConfig?.user || firestoreConfig?.user || localConfig?.user || '';
    const hasPassword = Boolean(serverConfig?.hasPassword || (localConfig?.pass && localConfig?.pass.length > 0));
    const senderEmail = serverConfig?.senderEmail || firestoreConfig?.senderEmail || localConfig?.senderEmail || user || 'reports@kidneycentre.org';
    const isConfigured = Boolean(serverConfig?.isConfigured || (user && hasPassword));

    return {
      host,
      port,
      user,
      hasPassword,
      senderEmail,
      isConfigured
    };
  },

  // Save SMTP server config
  saveSmtpConfig: async (params: {
    host: string;
    port: number;
    user: string;
    pass?: string;
    senderEmail?: string;
  }) => {
    // 1. Save to LocalStorage immediately
    try {
      const existing = localStorage.getItem(LOCAL_SMTP_KEY);
      const parsed = existing ? JSON.parse(existing) : {};
      const updated = {
        host: params.host || parsed.host || 'smtp.gmail.com',
        port: params.port || parsed.port || 587,
        user: params.user || parsed.user || '',
        pass: params.pass !== undefined && params.pass !== '' ? params.pass : parsed.pass,
        senderEmail: params.senderEmail || parsed.senderEmail || params.user,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(LOCAL_SMTP_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage SMTP write warning:', e);
    }

    // 2. Save non-sensitive metadata to Firestore
    try {
      await safeFirestoreWrite(() => 
        setDoc(doc(db, 'system_config', 'smtp_settings'), {
          host: params.host,
          port: params.port,
          user: params.user,
          senderEmail: params.senderEmail || params.user,
          isConfigured: true,
          updatedAt: new Date().toISOString()
        }, { merge: true })
      );
    } catch (e) {
      console.warn('Firestore SMTP metadata write warning:', e);
    }

    // 3. Save to Server
    const res = await fetch('/api/smtp/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to save SMTP configuration on server');
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
  },

  // Run Real-Time Connection Diagnostic Probe
  runDiagnosticProbe: async (params?: {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    senderEmail?: string;
    testEmail?: string;
    sendTestMail?: boolean;
  }): Promise<import('../types').SmtpDiagnosticResult> => {
    const res = await fetch('/api/smtp/diagnostic/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {})
    });
    const data = await res.json();
    return data;
  },

  // Get Diagnostic Audit Logs
  getDiagnosticLogs: async (): Promise<import('../types').SmtpDiagnosticLog[]> => {
    try {
      const res = await fetch('/api/smtp/diagnostic/logs');
      if (!res.ok) throw new Error('Failed to fetch diagnostic logs');
      const data = await res.json();
      return data.logs || [];
    } catch (err) {
      console.warn('Error fetching diagnostic logs:', err);
      return [];
    }
  },

  // Clear Diagnostic Audit Logs
  clearDiagnosticLogs: async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/smtp/diagnostic/logs', { method: 'DELETE' });
      return res.ok;
    } catch (err) {
      console.warn('Error clearing diagnostic logs:', err);
      return false;
    }
  }
};
