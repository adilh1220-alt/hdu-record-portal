// MediLog Clinical Systems - Offline Sync & Service Worker Bridge
import { db, safeFirestoreWrite } from './firebaseConfig';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';

export type NetworkStatus = 'online' | 'unstable' | 'offline';

export type DraftType = 'endoscopy' | 'patient' | 'mortality' | 'incident' | 'task' | 'inventory';

export interface OfflineDraft {
  id: string;
  unit: string;
  type: DraftType;
  title: string;
  patientName?: string;
  regNo?: string;
  data: any;
  savedAt: string;
  updatedAt: string;
  syncStatus: 'DRAFT' | 'PENDING_SYNC' | 'SYNCED' | 'FAILED';
  errorMessage?: string;
}

const STORAGE_KEYS = {
  DRAFTS: 'medilog_offline_drafts_v1',
  CACHED_PATIENTS: 'medilog_cached_patients_',
  CACHED_ENDOSCOPY: 'medilog_cached_endoscopy_',
  CACHED_MORTALITY: 'medilog_cached_mortality_',
  CACHED_INCIDENTS: 'medilog_cached_incidents_',
  CACHED_TASKS: 'medilog_cached_tasks_',
  CACHED_INVENTORY: 'medilog_cached_inventory_',
  NETWORK_STATUS: 'medilog_network_status'
};

type StatusChangeListener = (status: NetworkStatus, info?: string) => void;
type DraftChangeListener = (drafts: OfflineDraft[]) => void;

class OfflineService {
  private networkStatus: NetworkStatus = 'online';
  private statusListeners: Set<StatusChangeListener> = new Set();
  private draftListeners: Set<DraftChangeListener> = new Set();
  private pingInterval: any = null;
  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.initNetworkMonitoring();
  }

  // --- 1. Service Worker Initialization ---
  public async registerServiceWorker(): Promise<void> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[Service Worker] Registered successfully with scope:', this.swRegistration.scope);
    } catch (err) {
      console.warn('[Service Worker] Registration error / skipped:', err);
    }
  }

  // --- 2. Network Stability & Latency Monitoring ---
  private initNetworkMonitoring(): void {
    if (typeof window === 'undefined') return;

    this.networkStatus = navigator.onLine ? 'online' : 'offline';

    window.addEventListener('online', () => {
      this.checkRealConnectionStatus();
    });

    window.addEventListener('offline', () => {
      this.setNetworkStatus('offline', 'Network connection lost. Operating in Offline Mode.');
    });

    // Periodically test connection quality / latency to detect unstable link
    this.checkRealConnectionStatus();
    this.pingInterval = setInterval(() => {
      this.checkRealConnectionStatus();
    }, 15000);
  }

  public async checkRealConnectionStatus(): Promise<NetworkStatus> {
    if (typeof window === 'undefined') return 'online';

    if (!navigator.onLine) {
      this.setNetworkStatus('offline', 'Browser reports offline state');
      return 'offline';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const startTime = Date.now();
      const response = await fetch(`/api/health?t=${Date.now()}`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;

      if (response.ok) {
        if (latency > 2200) {
          this.setNetworkStatus('unstable', `High network latency (${latency}ms). Save actions routed to offline draft protection.`);
          return 'unstable';
        }
        
        // Connection is healthy
        if (this.networkStatus !== 'online') {
          this.setNetworkStatus('online', 'Connection restored to server & Firestore.');
          // Automatically trigger sync when coming back online
          this.syncPendingDrafts();
        }
        return 'online';
      } else {
        this.setNetworkStatus('unstable', 'Server health check returned error status');
        return 'unstable';
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        this.setNetworkStatus('unstable', 'Network ping timed out (>3.5s). Connection unstable.');
        return 'unstable';
      }
      this.setNetworkStatus('offline', 'Unable to reach clinical server.');
      return 'offline';
    }
  }

  private setNetworkStatus(status: NetworkStatus, info?: string): void {
    const prev = this.networkStatus;
    this.networkStatus = status;

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.NETWORK_STATUS, status);
      window.dispatchEvent(new CustomEvent('medilog_network_change', { detail: { status, info } }));
    }

    if (prev !== status) {
      this.statusListeners.forEach(listener => listener(status, info));
    }
  }

  public getNetworkStatus(): NetworkStatus {
    return this.networkStatus;
  }

  public isOfflineOrUnstable(): boolean {
    return this.networkStatus === 'offline' || this.networkStatus === 'unstable';
  }

  public onStatusChange(listener: StatusChangeListener): () => void {
    this.statusListeners.add(listener);
    // Initial emission
    listener(this.networkStatus);
    return () => this.statusListeners.delete(listener);
  }

  public onDraftsChange(listener: DraftChangeListener): () => void {
    this.draftListeners.add(listener);
    listener(this.getOfflineDrafts());
    return () => this.draftListeners.delete(listener);
  }

  private notifyDraftListeners(): void {
    const drafts = this.getOfflineDrafts();
    this.draftListeners.forEach(l => l(drafts));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('medilog_drafts_updated'));
    }
  }

  // --- 3. Offline Patient & Clinical Records Caching ---

  public cachePatientRecords<T>(unitId: string, records: T[]): void {
    if (typeof window === 'undefined' || !records) return;
    try {
      const key = `${STORAGE_KEYS.CACHED_PATIENTS}${unitId}`;
      const payload = {
        unitId,
        cachedAt: new Date().toISOString(),
        count: records.length,
        records
      };
      localStorage.setItem(key, JSON.stringify(payload));

      // Post message to SW for double redundancy
      this.sendToSW('CACHE_PATIENT_DATA', { key, data: payload });
    } catch (e) {
      console.error('[OfflineService] Failed to cache patient records locally:', e);
    }
  }

  public getCachedPatientRecords<T>(unitId: string): T[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`${STORAGE_KEYS.CACHED_PATIENTS}${unitId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return parsed.records || [];
    } catch (e) {
      return [];
    }
  }

  public cacheEndoscopyRecords<T>(unitId: string, records: T[]): void {
    if (typeof window === 'undefined' || !records) return;
    try {
      const key = `${STORAGE_KEYS.CACHED_ENDOSCOPY}${unitId}`;
      const payload = { unitId, cachedAt: new Date().toISOString(), records };
      localStorage.setItem(key, JSON.stringify(payload));
      this.sendToSW('CACHE_PATIENT_DATA', { key, data: payload });
    } catch (e) {
      console.error('[OfflineService] Failed to cache endoscopy records:', e);
    }
  }

  public getCachedEndoscopyRecords<T>(unitId: string): T[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`${STORAGE_KEYS.CACHED_ENDOSCOPY}${unitId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return parsed.records || [];
    } catch (e) {
      return [];
    }
  }

  public cacheMortalityRecords<T>(unitId: string, records: T[]): void {
    if (typeof window === 'undefined' || !records) return;
    try {
      const key = `${STORAGE_KEYS.CACHED_MORTALITY}${unitId}`;
      localStorage.setItem(key, JSON.stringify({ unitId, cachedAt: new Date().toISOString(), records }));
    } catch (e) {}
  }

  public getCachedMortalityRecords<T>(unitId: string): T[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`${STORAGE_KEYS.CACHED_MORTALITY}${unitId}`);
      return raw ? JSON.parse(raw).records || [] : [];
    } catch (e) {
      return [];
    }
  }

  public cacheSafetyIncidents<T>(unitId: string, records: T[]): void {
    if (typeof window === 'undefined' || !records) return;
    try {
      const key = `${STORAGE_KEYS.CACHED_INCIDENTS}${unitId}`;
      localStorage.setItem(key, JSON.stringify({ unitId, cachedAt: new Date().toISOString(), records }));
    } catch (e) {}
  }

  public getCachedSafetyIncidents<T>(unitId: string): T[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`${STORAGE_KEYS.CACHED_INCIDENTS}${unitId}`);
      return raw ? JSON.parse(raw).records || [] : [];
    } catch (e) {
      return [];
    }
  }

  public cacheClinicalTasks<T>(unitId: string, records: T[]): void {
    if (typeof window === 'undefined' || !records) return;
    try {
      const key = `${STORAGE_KEYS.CACHED_TASKS}${unitId}`;
      localStorage.setItem(key, JSON.stringify({ unitId, cachedAt: new Date().toISOString(), records }));
    } catch (e) {}
  }

  public getCachedClinicalTasks<T>(unitId: string): T[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`${STORAGE_KEYS.CACHED_TASKS}${unitId}`);
      return raw ? JSON.parse(raw).records || [] : [];
    } catch (e) {
      return [];
    }
  }

  public cacheInventoryItems<T>(unitId: string, records: T[]): void {
    if (typeof window === 'undefined' || !records) return;
    try {
      const key = `${STORAGE_KEYS.CACHED_INVENTORY}${unitId}`;
      localStorage.setItem(key, JSON.stringify({ unitId, cachedAt: new Date().toISOString(), records }));
    } catch (e) {}
  }

  public getCachedInventoryItems<T>(unitId: string): T[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`${STORAGE_KEYS.CACHED_INVENTORY}${unitId}`);
      return raw ? JSON.parse(raw).records || [] : [];
    } catch (e) {
      return [];
    }
  }

  // --- 4. Offline Draft Protection Engine ---

  public getOfflineDrafts(unitFilter?: string): OfflineDraft[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DRAFTS);
      if (!raw) return [];
      const drafts: OfflineDraft[] = JSON.parse(raw);
      if (unitFilter) {
        return drafts.filter(d => d.unit === unitFilter || d.unit === 'GLOBAL' || d.unit === 'ALL');
      }
      return drafts;
    } catch (e) {
      console.error('[OfflineService] Failed to load offline drafts:', e);
      return [];
    }
  }

  public saveOfflineDraft(draftInput: Omit<OfflineDraft, 'savedAt' | 'updatedAt'> & { savedAt?: string }): OfflineDraft {
    const drafts = this.getOfflineDrafts();
    const now = new Date().toISOString();

    const existingIndex = drafts.findIndex(d => d.id === draftInput.id);

    const fullDraft: OfflineDraft = {
      ...draftInput,
      savedAt: draftInput.savedAt || now,
      updatedAt: now,
      syncStatus: draftInput.syncStatus || 'PENDING_SYNC'
    };

    if (existingIndex > -1) {
      drafts[existingIndex] = fullDraft;
    } else {
      drafts.unshift(fullDraft);
    }

    try {
      localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(drafts));
      this.notifyDraftListeners();
    } catch (e) {
      console.error('[OfflineService] Error persisting offline draft:', e);
    }

    return fullDraft;
  }

  public deleteOfflineDraft(draftId: string): void {
    const drafts = this.getOfflineDrafts();
    const updated = drafts.filter(d => d.id !== draftId);
    try {
      localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(updated));
      this.notifyDraftListeners();
    } catch (e) {
      console.error('[OfflineService] Failed to delete draft:', e);
    }
  }

  public clearSyncedDrafts(): void {
    const drafts = this.getOfflineDrafts();
    const pendingOnly = drafts.filter(d => d.syncStatus !== 'SYNCED');
    try {
      localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(pendingOnly));
      this.notifyDraftListeners();
    } catch (e) {}
  }

  private isSyncingDrafts = false;

  // --- 5. Auto-Synchronization Engine ---

  public async syncPendingDrafts(): Promise<{ successCount: number; failCount: number }> {
    if (this.isSyncingDrafts) {
      return { successCount: 0, failCount: 0 };
    }

    // Only attempt sync if connection is online
    if (this.networkStatus === 'offline') {
      return { successCount: 0, failCount: 0 };
    }

    const drafts = this.getOfflineDrafts();
    const pending = drafts.filter(d => d.syncStatus === 'PENDING_SYNC' || d.syncStatus === 'DRAFT');

    if (pending.length === 0) {
      return { successCount: 0, failCount: 0 };
    }

    this.isSyncingDrafts = true;
    console.log(`[OfflineService] Synchronizing ${pending.length} pending offline drafts with Firestore...`);

    let successCount = 0;
    let failCount = 0;

    try {
      for (const draft of pending) {
        try {
          let collectionName = '';
          if (draft.type === 'endoscopy') collectionName = 'endoscopy_records';
          else if (draft.type === 'patient') collectionName = 'patients';
          else if (draft.type === 'mortality') collectionName = 'mortality_records';
          else if (draft.type === 'incident') collectionName = 'safety_incidents';
          else if (draft.type === 'task') collectionName = 'clinical_tasks';
          else if (draft.type === 'inventory') collectionName = 'inventory';

          if (collectionName && draft.data) {
            const docId = draft.data.id || draft.id;
            const ref = doc(db, collectionName, docId);

            await safeFirestoreWrite(async () => {
              await setDoc(ref, {
                ...draft.data,
                syncedFromOfflineAt: new Date().toISOString(),
                offlineDraftId: draft.id
              }, { merge: true });
            }, 6000);

            // Update status
            draft.syncStatus = 'SYNCED';
            draft.updatedAt = new Date().toISOString();
            successCount++;
          }
        } catch (err: any) {
          console.error(`[OfflineService] Failed to sync draft ${draft.id}:`, err);
          draft.syncStatus = 'FAILED';
          draft.errorMessage = err.message || 'Sync failed';
          failCount++;

          const errCode = err?.code || '';
          const errMsg = String(err?.message || '');
          // If write stream is exhausted or backoff active, halt remaining syncs in this batch
          if (errCode === 'resource-exhausted' || errMsg.includes('exhausted') || errMsg.includes('backoff')) {
            console.warn('[OfflineService] Firestore write stream exhausted. Pausing sync queue.');
            break;
          }
        }
      }

      // Update storage
      localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(drafts));
      this.notifyDraftListeners();

      if (successCount > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('medilog_drafts_synced', {
          detail: { successCount, failCount }
        }));
      }
    } finally {
      this.isSyncingDrafts = false;
    }

    return { successCount, failCount };
  }

  private sendToSW(type: string, payload: any): void {
    if (typeof window !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type, payload });
    }
  }
}

export const offlineService = new OfflineService();
