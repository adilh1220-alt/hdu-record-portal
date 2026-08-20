// @ts-ignore
import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore
import { getAuth } from 'firebase/auth';
// @ts-ignore
import { getFirestore, initializeFirestore, setLogLevel } from 'firebase/firestore';
// @ts-ignore
import { getStorage } from 'firebase/storage';

// Suppress non-fatal Firestore network timeout and offline warning logs in sandboxed environment
try {
  setLogLevel('silent');
} catch (e) {
  // ignore
}

// Production Firebase Configuration
const firebaseConfig = {
  apiKey: 'AIzaSyCvRLi0PAsgraIN8ohJeATcEPiythTwrC8',
  authDomain: 'high-dependency-unit.firebaseapp.com',
  projectId: 'high-dependency-unit',
  storageBucket: 'high-dependency-unit.firebasestorage.app',
  messagingSenderId: '142636370526',
  appId: '1:142636370526:web:a66cd36c44666468c482cf',
  measurementId: 'G-RFBHLRMCJ9'
};

// Singleton initialization pattern - ensure default app is always resolved
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : (getApps().find(a => a.name === '[DEFAULT]') || getApps()[0]);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

/**
 * Safely executes a Firestore write operation with a timeout promise to prevent
 * write stream exhaustion (code=resource-exhausted) during network instability.
 */
export async function safeFirestoreWrite<T>(writeFn: () => Promise<T>, timeoutMs = 8000): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Firestore write request timed out'));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([writeFn(), timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (err: any) {
    clearTimeout(timer);
    const errCode = err?.code || '';
    const errMessage = String(err?.message || '');
    if (
      errCode === 'resource-exhausted' || 
      errCode === 'unavailable' ||
      errMessage.includes('exhausted') || 
      errMessage.includes('backoff') ||
      errMessage.includes('offline')
    ) {
      console.warn('[Firestore] Stream write offline or circuit breaker engaged:', errMessage);
    }
    throw err;
  }
}

/**
 * Safely executes a Firestore read operation with a fallback value on timeout or offline failure.
 */
export async function safeFirestoreRead<T>(readFn: () => Promise<T>, fallbackValue: T, timeoutMs = 6000): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Firestore read request timed out'));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([readFn(), timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (err: any) {
    clearTimeout(timer);
    console.warn('[Firestore] Non-blocking read fallback triggered:', err?.message || err);
    return fallbackValue;
  }
}

export { auth, db, storage, firebaseConfig };



