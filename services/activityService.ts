import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { db, safeFirestoreWrite } from './firebaseConfig';

export type ActivityAction = 
  | 'CREATE' 
  | 'MODIFY' 
  | 'DELETE' 
  | 'AUTH_LOGIN' 
  | 'AUTH_LOGOUT' 
  | 'AUTH_SIGNUP' 
  | 'AUTH_FAILED' 
  | 'SESSION_RESTORE' 
  | 'PASSWORD_CHANGE'
  | 'BIOMETRIC_ENROLLED'
  | 'BIOMETRIC_FAILED'
  | 'BIOMETRIC_REVOKED'
  | 'CONFIG_PERSIST' 
  | 'CONFIG_FAIL'
  | 'STORAGE_SYNC';

export type ActivityCategory = 'CLINICAL' | 'AUTH_SESSION' | 'CONFIG_PERSISTENCE' | 'SECURITY';

export interface UserActivity {
  id?: string;
  action: ActivityAction | string;
  recordType: string;
  details: string;
  performedBy: string;
  timestamp: string;
  unit?: string;
  category?: ActivityCategory;
  status?: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';
  sessionId?: string;
  metadata?: {
    email?: string;
    role?: string;
    uid?: string;
    configKey?: string;
    persistenceLayer?: 'FIRESTORE' | 'LOCAL_STORAGE' | 'HYBRID' | 'SERVER';
    failureReason?: string;
    suggestedFix?: string;
    errorCode?: string;
    durationMs?: number;
    [key: string]: any;
  };
}

const LOCAL_ACTIVITY_BUFFER_KEY = 'medilog_activity_buffer_v2';
const MAX_LOCAL_BUFFER_SIZE = 150;

function getLocalBuffer(): UserActivity[] {
  try {
    const raw = localStorage.getItem(LOCAL_ACTIVITY_BUFFER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalBuffer(activities: UserActivity[]): void {
  try {
    const trimmed = activities.slice(0, MAX_LOCAL_BUFFER_SIZE);
    localStorage.setItem(LOCAL_ACTIVITY_BUFFER_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn("Could not save to local activity buffer:", e);
  }
}

export const activityService = {
  // Standard Clinical Activity Logging
  logActivity: async (
    action: 'CREATE' | 'MODIFY' | 'DELETE' | string, 
    recordType: string, 
    details: string, 
    performedBy: string, 
    unit?: string,
    category: ActivityCategory = 'CLINICAL',
    status: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO' = 'SUCCESS',
    metadata?: Record<string, any>
  ) => {
    const activityItem: UserActivity = {
      action,
      recordType,
      details,
      performedBy: performedBy || 'System/Anonymous',
      timestamp: new Date().toISOString(),
      unit: unit || 'Global',
      category,
      status,
      metadata: metadata || {}
    };

    // 1. Immediately store in Local Buffer for zero-latency & offline resilience
    const currentBuffer = getLocalBuffer();
    saveLocalBuffer([activityItem, ...currentBuffer]);

    // 2. Persist to Firestore
    try {
      await safeFirestoreWrite(async () => {
        await addDoc(collection(db, 'user_activities'), activityItem);
      }, 5000);
    } catch (error: any) {
      console.warn("Could not persist user activity log to Firestore (Offline buffer active):", error?.message);
    }
  },

  // Dedicated Auth & Session Event Logger
  logAuthEvent: async (
    action: 'AUTH_LOGIN' | 'AUTH_LOGOUT' | 'AUTH_SIGNUP' | 'AUTH_FAILED' | 'SESSION_RESTORE' | 'PASSWORD_CHANGE' | 'BIOMETRIC_ENROLLED' | 'BIOMETRIC_FAILED' | 'BIOMETRIC_REVOKED',
    details: string,
    email: string,
    role?: string,
    status: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO' = 'SUCCESS',
    metadata?: Record<string, any>
  ) => {
    const recordTypeMap: Record<string, string> = {
      AUTH_LOGIN: 'Auth Session',
      AUTH_LOGOUT: 'Session Termination',
      AUTH_SIGNUP: 'User Registration',
      AUTH_FAILED: 'Auth Security Challenge',
      SESSION_RESTORE: 'Session Recovery',
      PASSWORD_CHANGE: 'Security Credential',
      BIOMETRIC_ENROLLED: 'Passkey Registration',
      BIOMETRIC_FAILED: 'Passkey Challenge Failed',
      BIOMETRIC_REVOKED: 'Passkey Revocation'
    };

    const combinedMetadata = {
      email,
      role: role || 'Unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
      persistenceLayer: 'HYBRID',
      ...(metadata || {})
    };

    await activityService.logActivity(
      action,
      recordTypeMap[action] || 'Auth Event',
      details,
      email || 'System Session Manager',
      'Security',
      'AUTH_SESSION',
      status,
      combinedMetadata
    );
  },

  // Dedicated Configuration Persistence Event Logger
  logConfigPersistenceEvent: async (
    action: 'CONFIG_PERSIST' | 'CONFIG_FAIL' | 'STORAGE_SYNC',
    configKey: string,
    details: string,
    performedBy: string,
    layer: 'FIRESTORE' | 'LOCAL_STORAGE' | 'HYBRID' | 'SERVER' = 'HYBRID',
    status: 'SUCCESS' | 'WARNING' | 'ERROR' = 'SUCCESS',
    metadata?: Record<string, any>
  ) => {
    await activityService.logActivity(
      action,
      `Config: ${configKey}`,
      details,
      performedBy,
      'Global',
      'CONFIG_PERSISTENCE',
      status,
      {
        configKey,
        persistenceLayer: layer,
        ...(metadata || {})
      }
    );
  },

  // Fetch Activities combining Firestore + Local Buffer
  getActivities: async (maxCount: number = 100): Promise<UserActivity[]> => {
    let firestoreActivities: UserActivity[] = [];
    try {
      const q = query(collection(db, 'user_activities'), orderBy('timestamp', 'desc'), limit(maxCount));
      const querySnapshot = await getDocs(q);
      firestoreActivities = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as any)
      })) as UserActivity[];
    } catch (error) {
      console.warn("Error fetching user activities from Firestore, falling back to local session buffer:", error);
    }

    // Merge with local buffer to guarantee no dropped auth/config events
    const localBuffer = getLocalBuffer();
    const seenMap = new Set<string>();
    const merged: UserActivity[] = [];

    // Prioritize firestore records
    firestoreActivities.forEach(item => {
      const key = `${item.timestamp}_${item.action}_${item.details.slice(0, 30)}`;
      seenMap.add(key);
      merged.push(item);
    });

    // Add unique local buffer records
    localBuffer.forEach((item, index) => {
      const key = `${item.timestamp}_${item.action}_${item.details.slice(0, 30)}`;
      if (!seenMap.has(key)) {
        seenMap.add(key);
        merged.push({ id: `local_${index}_${Date.now()}`, ...item });
      }
    });

    // Sort descending by timestamp
    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return merged.slice(0, maxCount);
  },

  clearActivity: async (id: string): Promise<void> => {
    try {
      if (!id.startsWith('local_')) {
        await deleteDoc(doc(db, 'user_activities', id));
      }
      // Also remove from local buffer if present
      const buffer = getLocalBuffer();
      const updated = buffer.filter(b => b.id !== id);
      saveLocalBuffer(updated);
    } catch (error) {
      console.error("Error deleting activity:", error);
    }
  },

  clearAllLocalBuffer: (): void => {
    try {
      localStorage.removeItem(LOCAL_ACTIVITY_BUFFER_KEY);
    } catch (e) {}
  }
};

