// @ts-ignore
import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore
import { getAuth } from 'firebase/auth';
// @ts-ignore
import { getFirestore } from 'firebase/firestore';

/**
 * Robust environment variable accessor.
 * Checks both process.env and import.meta.env to handle various bundler environments.
 */
const env = (key: string): string => {
  // Check process.env (Node-style/Vite-shimmed)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch (e) {}

  // Check import.meta.env (Vite-style)
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
  } catch (e) {}

  return "";
};

// Production Firebase Configuration with fallbacks for non-VITE prefixed keys
const firebaseConfig = {
  apiKey: env('VITE_FIREBASE_API_KEY') || env('FIREBASE_API_KEY'),
  authDomain: env('VITE_FIREBASE_AUTH_DOMAIN') || env('FIREBASE_AUTH_DOMAIN'),
  projectId: env('VITE_FIREBASE_PROJECT_ID') || env('FIREBASE_PROJECT_ID'),
  storageBucket: env('VITE_FIREBASE_STORAGE_BUCKET') || env('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID') || env('FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('VITE_FIREBASE_APP_ID') || env('FIREBASE_APP_ID'),
  measurementId: "G-RFBHLRMGJ9"
};

// Singleton initialization pattern
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, firebaseConfig };