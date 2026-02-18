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
      if (typeof process !== 'undefined' && process.env && process.env[k]) {
        return process.env[k];
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



// Diagnostic logging for development/troubleshooting
if (!firebaseConfig.apiKey) {
  console.error("Bhai, API Key nahi mil rahi! Check Vercel/Environment Settings.");
  console.warn("Looking for VITE_FIREBASE_API_KEY or FIREBASE_API_KEY");
}

// Singleton initialization pattern
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, firebaseConfig };