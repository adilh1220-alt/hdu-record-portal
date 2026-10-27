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

export interface NetworkSample {
  timestamp: number;
  latencyMs: number;
  success: boolean;
  httpStatus?: number;
}

export interface NetworkQualityMetrics {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | '5g' | 'unknown';
  downlinkMbps?: number;
  rttMs?: number;
  connectionType?: string; // 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'other' | 'unknown'
  isHighSpeed: boolean;
  packetLossRate: number; // 0.0 to 1.0 (0% to 100%)
  jitterMs: number; // Mean absolute difference between consecutive latencies
  averageLatencyMs: number;
  consecutiveFailures: number;
  samplesCount: number;
  lastTestedAt: string;
  unstableReason?: string;
}

interface NetworkInformationLike {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  type?: string;
  addEventListener?(type: string, listener: (event: any) => void): void;
  removeEventListener?(type: string, listener: (event: any) => void): void;
}

function getNavigatorConnection(): NetworkInformationLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as any;
  return nav.connection || nav.mozConnection || nav.webkitConnection || null;
}

/**
 * Dedicated Network Quality Observer:
 * Monitors navigator.connection (effectiveType, downlink, rtt) and tracks a sliding
 * window of ping probes to calculate true packet loss rate, RFC 3550 jitter, and average latency.
 * Suppresses false "Connection Unstable" warnings for high-speed (5G, 4G, Fast Wi-Fi) links.
 */
export class NetworkQualityObserver {
  private readonly MAX_SAMPLES = 6;
  private samples: NetworkSample[] = [];
  private lastMetrics: NetworkQualityMetrics;
  private qualityListeners: Set<(metrics: NetworkQualityMetrics) => void> = new Set();

  constructor() {
    this.lastMetrics = this.computeMetrics();
    this.initHardwareListener();
  }

  private initHardwareListener(): void {
    if (typeof window === 'undefined') return;
    const conn = getNavigatorConnection();
    if (conn && typeof conn.addEventListener === 'function') {
      try {
        conn.addEventListener('change', () => {
          this.computeMetrics();
        });
      } catch (err) {
        // Fallback for non-standard implementations
      }
    }
  }

  public recordProbe(latencyMs: number, success: boolean, httpStatus?: number): NetworkQualityMetrics {
    this.samples.push({
      timestamp: Date.now(),
      latencyMs,
      success,
      httpStatus
    });

    if (this.samples.length > this.MAX_SAMPLES) {
      this.samples.shift();
    }

    return this.computeMetrics();
  }

  public computeMetrics(): NetworkQualityMetrics {
    const conn = getNavigatorConnection();
    const effectiveTypeRaw = conn?.effectiveType || 'unknown';
    const downlink = conn?.downlink;
    const rtt = conn?.rtt;
    const connectionType = conn?.type || 'unknown';

    const totalSamples = this.samples.length;
    let failedCount = 0;
    let consecutiveFailures = 0;

    // Count consecutive failures from most recent backward
    for (let i = this.samples.length - 1; i >= 0; i--) {
      if (!this.samples[i].success) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    for (const s of this.samples) {
      if (!s.success) failedCount++;
    }

    const packetLossRate = totalSamples > 0 ? (failedCount / totalSamples) : 0;
    const successful = this.samples.filter(s => s.success);

    const averageLatencyMs = successful.length > 0
      ? Math.round(successful.reduce((acc, s) => acc + s.latencyMs, 0) / successful.length)
      : (totalSamples > 0 ? 5000 : 0);

    // Calculate Jitter (Mean Absolute Difference between successive successful samples)
    let jitterMs = 0;
    if (successful.length >= 2) {
      let sumDiff = 0;
      for (let i = 1; i < successful.length; i++) {
        sumDiff += Math.abs(successful[i].latencyMs - successful[i - 1].latencyMs);
      }
      jitterMs = Math.round(sumDiff / (successful.length - 1));
    }

    // Modern 5G / High-Speed detection:
    // Chromium / Android Network Information API reports 5G as '4g' with high downlink (>= 20-50 Mbps) and low rtt (<= 100ms)
    const is5G = (effectiveTypeRaw === '4g' && typeof downlink === 'number' && downlink >= 25);
    const resolvedType: 'slow-2g' | '2g' | '3g' | '4g' | '5g' | 'unknown' = is5G
      ? '5g'
      : (effectiveTypeRaw as any);

    const isHighSpeed = is5G
      || effectiveTypeRaw === '4g'
      || connectionType === 'wifi'
      || connectionType === 'ethernet'
      || (typeof downlink === 'number' && downlink >= 4)
      || (typeof rtt === 'number' && rtt <= 200 && rtt > 0)
      || (!conn && averageLatencyMs > 0 && averageLatencyMs <= 400 && packetLossRate === 0);

    this.lastMetrics = {
      effectiveType: resolvedType,
      downlinkMbps: downlink,
      rttMs: rtt,
      connectionType,
      isHighSpeed: Boolean(isHighSpeed),
      packetLossRate: Math.round(packetLossRate * 100) / 100,
      jitterMs,
      averageLatencyMs,
      consecutiveFailures,
      samplesCount: totalSamples,
      lastTestedAt: new Date().toISOString()
    };

    this.qualityListeners.forEach(listener => {
      try { listener(this.lastMetrics); } catch (e) {}
    });

    return this.lastMetrics;
  }

  public getMetrics(): NetworkQualityMetrics {
    return this.lastMetrics;
  }

  public onQualityChange(listener: (metrics: NetworkQualityMetrics) => void): () => void {
    this.qualityListeners.add(listener);
    listener(this.lastMetrics);
    return () => this.qualityListeners.delete(listener);
  }
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
  private qualityObserver = new NetworkQualityObserver();

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
      // Ensure mobile devices immediately pull latest SW v2 without waiting for browser restart
      this.swRegistration.update().catch(() => {});
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

    // Listen to network hardware changes (e.g. 5G/Wi-Fi switch) to immediately re-evaluate
    this.qualityObserver.onQualityChange((metrics) => {
      if (navigator.onLine && metrics.isHighSpeed && metrics.consecutiveFailures === 0 && metrics.packetLossRate === 0) {
        if (this.networkStatus === 'unstable') {
          this.setNetworkStatus('online', 'High-speed connection active. Connection stable.');
        }
      }
    });

    // Periodically probe connection quality / latency
    this.checkRealConnectionStatus();
    this.pingInterval = setInterval(() => {
      this.checkRealConnectionStatus();
    }, 18000);
  }

  public async checkRealConnectionStatus(): Promise<NetworkStatus> {
    if (typeof window === 'undefined') return 'online';

    if (!navigator.onLine) {
      this.setNetworkStatus('offline', 'Browser reports offline state');
      return 'offline';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    let probeSuccess = false;
    let latencyMs = 0;
    let httpStatus = 0;

    try {
      const startTime = Date.now();
      const response = await fetch(`/api/health?t=${Date.now()}`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);
      latencyMs = Date.now() - startTime;
      httpStatus = response.status;
      probeSuccess = response.ok;
    } catch (err: any) {
      clearTimeout(timeoutId);
      probeSuccess = false;
      latencyMs = 4500;
    }

    // Record probe into sliding window observer
    const metrics = this.qualityObserver.recordProbe(latencyMs, probeSuccess, httpStatus);

    // 1. Offline Verification: If browser reports offline or 4+ consecutive failed probes
    if (!navigator.onLine || metrics.consecutiveFailures >= 4) {
      this.setNetworkStatus('offline', 'Clinical server unreachable after multiple attempts.');
      return 'offline';
    }

    // 2. High-Speed Connections (5G, 4G LTE, High-Speed Wi-Fi):
    // SUPPRESS "Connection Unstable" false warnings for high-speed connections!
    // Only flag 'unstable' if genuine packet loss or extreme jitter is detected.
    if (metrics.isHighSpeed) {
      const hasPacketLoss = metrics.consecutiveFailures >= 2 || (metrics.samplesCount >= 4 && metrics.packetLossRate >= 0.4);
      const hasExtremeJitter = metrics.jitterMs > 1500 && latencyMs > 2500 && metrics.samplesCount >= 3;

      if (hasPacketLoss) {
        const info = `Packet loss detected (${Math.round(metrics.packetLossRate * 100)}% loss, ${metrics.consecutiveFailures} drops). Drafts saving locally.`;
        metrics.unstableReason = info;
        this.setNetworkStatus('unstable', info);
        return 'unstable';
      }

      if (hasExtremeJitter) {
        const info = `Extreme connection jitter (±${metrics.jitterMs}ms variation). Drafts saving locally.`;
        metrics.unstableReason = info;
        this.setNetworkStatus('unstable', info);
        return 'unstable';
      }

      // High-speed link is healthy and reliable
      metrics.unstableReason = undefined;
      if (this.networkStatus !== 'online') {
        this.setNetworkStatus('online', 'High-speed connection online & stable.');
        this.syncPendingDrafts();
      }
      return 'online';
    }

    // 3. Standard / Lower Speed / Unknown Connections (2G/3G or legacy):
    const hasPacketLoss = metrics.consecutiveFailures >= 2 || (metrics.samplesCount >= 3 && metrics.packetLossRate >= 0.33);
    const hasExtremeJitter = metrics.jitterMs > 1200 && latencyMs > 3000 && metrics.samplesCount >= 3;
    const hasSevereLatency = metrics.averageLatencyMs > 6000 && metrics.samplesCount >= 3;

    if (hasPacketLoss) {
      const info = `Packet loss detected (${Math.round(metrics.packetLossRate * 100)}% packet loss).`;
      metrics.unstableReason = info;
      this.setNetworkStatus('unstable', info);
      return 'unstable';
    }

    if (hasExtremeJitter) {
      const info = `Elevated network jitter (±${metrics.jitterMs}ms).`;
      metrics.unstableReason = info;
      this.setNetworkStatus('unstable', info);
      return 'unstable';
    }

    if (hasSevereLatency) {
      const info = `Sustained high network latency (avg ${metrics.averageLatencyMs}ms).`;
      metrics.unstableReason = info;
      this.setNetworkStatus('unstable', info);
      return 'unstable';
    }

    // Default: healthy online state
    metrics.unstableReason = undefined;
    if (this.networkStatus !== 'online') {
      this.setNetworkStatus('online', 'Connection online.');
      this.syncPendingDrafts();
    }
    return 'online';
  }

  public getNetworkQuality(): NetworkQualityMetrics {
    return this.qualityObserver.getMetrics();
  }

  public onQualityChange(listener: (metrics: NetworkQualityMetrics) => void): () => void {
    return this.qualityObserver.onQualityChange(listener);
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
