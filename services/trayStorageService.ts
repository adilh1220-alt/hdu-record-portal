/**
 * Persistent 24-Hour Tray Storage Service for Endoscopy Snapshots & Videos
 * Uses IndexedDB for high-capacity binary/base64 storage (bypassing localStorage 5MB limit).
 * Automatically purges media older than 24 hours while allowing manual clearing.
 */

export interface StoredSessionCapture {
  id: string;
  base64: string;
  title: string;
  timestamp: number; // epoch ms
  isAddedToReport?: boolean;
  unit?: string;
  patientRegNo?: string;
}

export interface StoredVideoRecord {
  id: string;
  blob: Blob;
  filename: string;
  durationSeconds: number;
  sizeBytes: number;
  timestamp: number; // epoch ms
  mimeType: string;
  title: string;
  unit?: string;
}

const DB_NAME = 'tkc_endoscopy_media_tray_db';
const DB_VERSION = 1;
const CAPTURES_STORE = 'tray_captures';
const VIDEOS_STORE = 'tray_videos';
const RETENTION_MS = 24 * 60 * 60 * 1000; // 24 Hours auto-retention policy

class TrayStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isSupported: boolean;

  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'indexedDB' in window;
    if (this.isSupported) {
      this.getDB().then(() => {
        this.purgeExpiredMedia();
      }).catch(err => {
        console.warn('[TrayStorageService] IndexedDB init warning:', err);
      });
    }
  }

  private getDB(): Promise<IDBDatabase> {
    if (!this.isSupported) {
      return Promise.reject(new Error('IndexedDB not supported in this environment'));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        try {
          const request = indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(CAPTURES_STORE)) {
              const capStore = db.createObjectStore(CAPTURES_STORE, { keyPath: 'id' });
              capStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            if (!db.objectStoreNames.contains(VIDEOS_STORE)) {
              const vidStore = db.createObjectStore(VIDEOS_STORE, { keyPath: 'id' });
              vidStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
          };

          request.onsuccess = () => {
            resolve(request.result);
          };

          request.onerror = () => {
            console.error('[TrayStorageService] IndexedDB open error:', request.error);
            reject(request.error);
          };
        } catch (err) {
          reject(err);
        }
      });
    }

    return this.dbPromise;
  }

  /**
   * Save a snapshot capture to persistent IndexedDB storage
   */
  public async saveCapture(capture: {
    id: string;
    base64: string;
    title: string;
    timestamp: Date | number;
    isAddedToReport?: boolean;
    unit?: string;
    patientRegNo?: string;
  }): Promise<void> {
    try {
      const db = await this.getDB();
      const record: StoredSessionCapture = {
        id: capture.id,
        base64: capture.base64,
        title: capture.title,
        timestamp: typeof capture.timestamp === 'number' ? capture.timestamp : new Date(capture.timestamp).getTime(),
        isAddedToReport: capture.isAddedToReport || false,
        unit: capture.unit,
        patientRegNo: capture.patientRegNo
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(CAPTURES_STORE, 'readwrite');
        const store = tx.objectStore(CAPTURES_STORE);
        const req = store.put(record);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[TrayStorageService] Error saving capture to IndexedDB:', err);
    }
  }

  /**
   * Load all valid captures (<= 24 hours old) sorted newest first
   */
  public async getValidCaptures(): Promise<StoredSessionCapture[]> {
    try {
      const db = await this.getDB();
      const cutoffTime = Date.now() - RETENTION_MS;

      const records: StoredSessionCapture[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(CAPTURES_STORE, 'readonly');
        const store = tx.objectStore(CAPTURES_STORE);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      // Filter within 24 hours and sort newest first
      const valid = records
        .filter(r => r && r.timestamp && r.timestamp >= cutoffTime)
        .sort((a, b) => b.timestamp - a.timestamp);

      return valid;
    } catch (err) {
      console.warn('[TrayStorageService] Error retrieving captures from IndexedDB:', err);
      return [];
    }
  }

  /**
   * Update an existing capture (e.g. isAddedToReport flag, edited title/markup)
   */
  public async updateCapture(captureId: string, updates: Partial<StoredSessionCapture>): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(CAPTURES_STORE, 'readwrite');
        const store = tx.objectStore(CAPTURES_STORE);
        const getReq = store.get(captureId);

        getReq.onsuccess = () => {
          const existing = getReq.result;
          if (existing) {
            const updated = { ...existing, ...updates };
            const putReq = store.put(updated);
            putReq.onsuccess = () => resolve();
            putReq.onerror = () => reject(putReq.error);
          } else {
            resolve();
          }
        };
        getReq.onerror = () => reject(getReq.error);
      });
    } catch (err) {
      console.warn('[TrayStorageService] Error updating capture:', err);
    }
  }

  /**
   * Remove a single capture by ID from storage
   */
  public async removeCapture(captureId: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(CAPTURES_STORE, 'readwrite');
        const store = tx.objectStore(CAPTURES_STORE);
        const req = store.delete(captureId);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[TrayStorageService] Error deleting capture from IndexedDB:', err);
    }
  }

  /**
   * Clear all captures (e.g. doctor clicks "Clear All" in Tray)
   */
  public async clearAllCaptures(): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(CAPTURES_STORE, 'readwrite');
        const store = tx.objectStore(CAPTURES_STORE);
        const req = store.clear();

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[TrayStorageService] Error clearing captures from IndexedDB:', err);
    }
  }

  /**
   * Save a clinical video record to IndexedDB
   */
  public async saveVideo(video: {
    id: string;
    blob: Blob;
    filename: string;
    durationSeconds: number;
    sizeBytes: number;
    timestamp: Date | number;
    mimeType: string;
    title: string;
    unit?: string;
  }): Promise<void> {
    try {
      const db = await this.getDB();
      const record: StoredVideoRecord = {
        id: video.id,
        blob: video.blob,
        filename: video.filename,
        durationSeconds: video.durationSeconds,
        sizeBytes: video.sizeBytes,
        timestamp: typeof video.timestamp === 'number' ? video.timestamp : new Date(video.timestamp).getTime(),
        mimeType: video.mimeType,
        title: video.title,
        unit: video.unit
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(VIDEOS_STORE, 'readwrite');
        const store = tx.objectStore(VIDEOS_STORE);
        const req = store.put(record);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[TrayStorageService] Error saving video to IndexedDB:', err);
    }
  }

  /**
   * Load valid videos (<= 24 hours old) sorted newest first
   */
  public async getValidVideos(): Promise<StoredVideoRecord[]> {
    try {
      const db = await this.getDB();
      const cutoffTime = Date.now() - RETENTION_MS;

      const records: StoredVideoRecord[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(VIDEOS_STORE, 'readonly');
        const store = tx.objectStore(VIDEOS_STORE);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      const valid = records
        .filter(r => r && r.timestamp && r.timestamp >= cutoffTime)
        .sort((a, b) => b.timestamp - a.timestamp);

      return valid;
    } catch (err) {
      console.warn('[TrayStorageService] Error retrieving videos from IndexedDB:', err);
      return [];
    }
  }

  /**
   * Remove a single video by ID
   */
  public async removeVideo(videoId: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(VIDEOS_STORE, 'readwrite');
        const store = tx.objectStore(VIDEOS_STORE);
        const req = store.delete(videoId);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[TrayStorageService] Error deleting video from IndexedDB:', err);
    }
  }

  /**
   * Clear all videos from storage
   */
  public async clearAllVideos(): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(VIDEOS_STORE, 'readwrite');
        const store = tx.objectStore(VIDEOS_STORE);
        const req = store.clear();

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[TrayStorageService] Error clearing videos from IndexedDB:', err);
    }
  }

  /**
   * Automatically purge media records older than 24 hours
   */
  public async purgeExpiredMedia(): Promise<{ purgedCaptures: number; purgedVideos: number }> {
    try {
      const db = await this.getDB();
      const cutoffTime = Date.now() - RETENTION_MS;
      let purgedCaptures = 0;
      let purgedVideos = 0;

      // Purge old captures
      await new Promise<void>((resolve) => {
        const tx = db.transaction(CAPTURES_STORE, 'readwrite');
        const store = tx.objectStore(CAPTURES_STORE);
        const req = store.openCursor();

        req.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            if (cursor.value.timestamp < cutoffTime) {
              cursor.delete();
              purgedCaptures++;
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => resolve();
      });

      // Purge old videos
      await new Promise<void>((resolve) => {
        const tx = db.transaction(VIDEOS_STORE, 'readwrite');
        const store = tx.objectStore(VIDEOS_STORE);
        const req = store.openCursor();

        req.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            if (cursor.value.timestamp < cutoffTime) {
              cursor.delete();
              purgedVideos++;
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => resolve();
      });

      if (purgedCaptures > 0 || purgedVideos > 0) {
        console.log(`[TrayStorageService] Auto-purged ${purgedCaptures} expired captures & ${purgedVideos} videos (>24h).`);
      }

      return { purgedCaptures, purgedVideos };
    } catch (err) {
      console.warn('[TrayStorageService] Purge error:', err);
      return { purgedCaptures: 0, purgedVideos: 0 };
    }
  }
}

export const trayStorageService = new TrayStorageService();
