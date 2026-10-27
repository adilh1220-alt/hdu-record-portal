import { db } from './firebaseConfig';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { Patient, PatientStatus } from '../types';
import { activityService } from './activityService';

export interface AutoArchiveSettings {
  enabled: boolean;
  inactivityThresholdDays: number; // e.g. 3, 7, 14, 30
  lastRunAt: string | null;
  lastStatus: string | null;
  totalArchivedCount: number;
}

export interface AutoArchiveLogItem {
  id: string;
  timestamp: string;
  triggerType: 'AUTOMATED_SCHEDULE' | 'MANUAL_TRIGGER' | 'CLIENT_SYNC';
  archivedCount: number;
  details: string;
  archivedPatients: Array<{
    id: string;
    regNo: string;
    name: string;
    unit: string;
    inactivityDays: number;
  }>;
}

const LOCAL_SETTINGS_KEY = 'medilog_auto_archive_settings_v1';
const LOCAL_LOGS_KEY = 'medilog_auto_archive_logs_v1';

const DEFAULT_SETTINGS: AutoArchiveSettings = {
  enabled: true,
  inactivityThresholdDays: 7,
  lastRunAt: null,
  lastStatus: null,
  totalArchivedCount: 0
};

export class AutoArchiveService {
  /**
   * Helper to determine if a patient record is currently in active census state.
   */
  public isPatientActive(p: Patient): boolean {
    const isDischarged = Boolean(
      p.dischargeDate ||
      p.transferStatus === 'DC' ||
      p.transferStatus === 'Discharged (DC)' ||
      p.transferStatus === 'Discharge Home' ||
      p.shiftTo === 'DC' ||
      p.shiftTo === 'Discharged (DC)' ||
      p.shiftTo === 'Discharge Home' ||
      p.status === PatientStatus.DISCHARGED ||
      (p.status as string) === 'Discharged' ||
      p.status === PatientStatus.DECEASED ||
      (p.status as string) === 'Deceased'
    );
    return !isDischarged;
  }

  /**
   * Calculates inactivity in days for a given patient based on activity timestamps or admission date.
   */
  public calculateInactivityDays(patient: Patient): number {
    const now = Date.now();
    let activityTime = 0;

    if (patient.lastActivityAt) {
      activityTime = new Date(patient.lastActivityAt).getTime();
    } else if (patient.updatedAt) {
      activityTime = new Date(patient.updatedAt).getTime();
    } else if (patient.createdAt) {
      activityTime = new Date(patient.createdAt).getTime();
    } else if (patient.admissionDate) {
      activityTime = new Date(patient.admissionDate).getTime();
    }

    if (!activityTime || isNaN(activityTime)) {
      return 0;
    }

    const diffMs = now - activityTime;
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  /**
   * Reads Auto-Archive configuration from API or local persistent cache.
   */
  public async getConfig(): Promise<{ settings: AutoArchiveSettings; logs: AutoArchiveLogItem[] }> {
    try {
      const res = await fetch('/api/auto-archive/config');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(data.settings));
          if (data.logs) {
            localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(data.logs));
          }
          return { settings: data.settings, logs: data.logs || [] };
        }
      }
    } catch (err) {
      // Fallback to local storage if API is offline
    }

    const cachedSettings = localStorage.getItem(LOCAL_SETTINGS_KEY);
    const cachedLogs = localStorage.getItem(LOCAL_LOGS_KEY);

    const settings: AutoArchiveSettings = cachedSettings
      ? { ...DEFAULT_SETTINGS, ...JSON.parse(cachedSettings) }
      : DEFAULT_SETTINGS;

    const logs: AutoArchiveLogItem[] = cachedLogs
      ? JSON.parse(cachedLogs)
      : [];

    return { settings, logs };
  }

  /**
   * Saves Auto-Archive configuration to API and local persistent cache.
   */
  public async saveConfig(newSettings: Partial<AutoArchiveSettings>): Promise<AutoArchiveSettings> {
    const current = (await this.getConfig()).settings;
    const updated: AutoArchiveSettings = { ...current, ...newSettings };

    try {
      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(updated));
      await fetch('/api/auto-archive/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (err) {
      console.warn('Could not post auto-archive settings to server:', err);
    }

    return updated;
  }

  /**
   * Runs the patient inactivity evaluation and auto-archives eligible patients.
   */
  public async runAutoArchive(
    triggerType: 'AUTOMATED_SCHEDULE' | 'MANUAL_TRIGGER' | 'CLIENT_SYNC' = 'MANUAL_TRIGGER',
    providedPatients?: Patient[],
    performedBy: string = 'System Auto-Archive Daemon'
  ): Promise<{
    success: boolean;
    archivedCount: number;
    archivedPatients: Array<{ id: string; regNo: string; name: string; unit: string; inactivityDays: number }>;
    details: string;
  }> {
    const { settings, logs } = await this.getConfig();
    const thresholdDays = settings.inactivityThresholdDays || 7;
    const nowIso = new Date().toISOString();
    const todayDateStr = nowIso.split('T')[0];

    // Try server endpoint first
    try {
      const serverRes = await fetch('/api/auto-archive/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerType, thresholdDays, performedBy })
      });
      if (serverRes.ok) {
        const result = await serverRes.json();
        // Update client settings
        await this.saveConfig({
          lastRunAt: nowIso,
          lastStatus: 'SUCCESS',
          totalArchivedCount: settings.totalArchivedCount + (result.archivedCount || 0)
        });
        return result;
      }
    } catch (err) {
      console.warn('[AutoArchive] Server auto-archive endpoint unreachable, executing direct Firestore client evaluation:', err);
    }

    // Direct Firestore / Local evaluation fallback
    let candidatePatients: Patient[] = [];

    if (providedPatients && providedPatients.length > 0) {
      candidatePatients = providedPatients;
    } else {
      try {
        const snap = await getDocs(collection(db, 'patients'));
        candidatePatients = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Patient[];
      } catch (err) {
        console.warn('[AutoArchive] Could not fetch Firestore patients directly:', err);
      }
    }

    const archivedPatients: Array<{ id: string; regNo: string; name: string; unit: string; inactivityDays: number }> = [];

    const activePatients = candidatePatients.filter(p => this.isPatientActive(p));

    for (const p of activePatients) {
      const inactivityDays = this.calculateInactivityDays(p);
      if (inactivityDays >= thresholdDays) {
        archivedPatients.push({
          id: p.id,
          regNo: p.regNo,
          name: p.name,
          unit: p.unit,
          inactivityDays
        });

        // Update record in Firestore
        try {
          const patientRef = doc(db, 'patients', p.id);
          await updateDoc(patientRef, {
            status: PatientStatus.DISCHARGED,
            transferStatus: 'Discharged (DC)',
            shiftTo: 'Discharged (DC)',
            dischargeDate: todayDateStr,
            autoArchived: true,
            autoArchivedAt: nowIso,
            lastActivityAt: nowIso,
            updatedAt: nowIso,
            notes: `Auto-archived due to ${inactivityDays} days of inactivity (Threshold: ${thresholdDays} days).`
          });

          await activityService.logActivity(
            'MODIFY',
            'Patient Record',
            `Auto-archived patient ${p.name} (MRN: ${p.regNo}) to 'Discharged' after ${inactivityDays} days of inactivity.`,
            performedBy,
            p.unit
          );
        } catch (updateErr) {
          console.warn(`[AutoArchive] Failed to archive patient ${p.id}:`, updateErr);
        }
      }
    }

    const archivedCount = archivedPatients.length;
    const details = archivedCount > 0
      ? `Successfully archived ${archivedCount} inactive patient record(s) surpassing ${thresholdDays} days of inactivity.`
      : `Scan completed. 0 active patients exceeded the ${thresholdDays}-day inactivity threshold.`;

    // Append to local audit logs
    const newLogItem: AutoArchiveLogItem = {
      id: `archive_log_${Date.now()}`,
      timestamp: nowIso,
      triggerType,
      archivedCount,
      details,
      archivedPatients
    };

    const updatedLogs = [newLogItem, ...logs].slice(0, 50);
    localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(updatedLogs));

    await this.saveConfig({
      lastRunAt: nowIso,
      lastStatus: 'SUCCESS',
      totalArchivedCount: settings.totalArchivedCount + archivedCount
    });

    return {
      success: true,
      archivedCount,
      archivedPatients,
      details
    };
  }
}

export const autoArchiveService = new AutoArchiveService();
