// @ts-ignore
import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore
import { getAuth } from 'firebase/auth';
// @ts-ignore
import { getFirestore } from 'firebase/firestore';

/**
 * Robust environment variable accessor.
 * Checks import.meta.env (Vite), process.env (Node/Webpack), 
 * and handles both VITE_ prefixed and non-prefixed keys.
 */
const getEnv = (key: string): string => {
  const findValue = (k: string): string | undefined => {
    // Check import.meta.env
    try {
      if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[k]) {
        return (import.meta as any).env[k];
      }
    } catch (e) {}

    // Check process.env
    try {
      if (typeof process !== 'undefined' && (process as any).env && (process as any).env[k]) {
        return (process as any).env[k];
      }
    } catch (e) {}
    
    return undefined;
  };

  // 1. Try with the provided key (usually VITE_ prefixed)
  let val = findValue(key);
  if (val) return val;

  // 2. Try without VITE_ prefix if it was provided
  if (key.startsWith('VITE_')) {
    val = findValue(key.replace('VITE_', ''));
    if (val) return val;
  }

  return "";
};

// Hardcoded fallback values are kept for local redundancy if env vars are missing
export const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || 'AIzaSyCvRLi0PAsgraIN8ohJeATcEPiythTwrC8',
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || 'high-dependency-unit.firebaseapp.com',
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || 'high-dependency-unit',
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || 'high-dependency-unit.firebasestorage.app',
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || '142636370526',
  appId: getEnv('VITE_FIREBASE_APP_ID') || '1:142636370526:web:a66cd36c44666468c482cf',
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID') || 'G-RFBHLRMGJ9'
};

// Console mein check karne ke liye (Sirf testing ke liye)
if (!firebaseConfig.apiKey) {
  console.error("Bhai, API Key nahi mil rahi! Check Vercel Settings.");
}

// Singleton initialization pattern
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };