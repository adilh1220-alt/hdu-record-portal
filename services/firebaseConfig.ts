// @ts-ignore
import { initializeApp, getApps, getApp } from 'firebase/app';
// Fix: Added @ts-ignore to suppress 'no exported member' error for modular auth in this environment
// @ts-ignore
import { getAuth } from 'firebase/auth';
// @ts-ignore
import { getFirestore, initializeFirestore } from 'firebase/firestore';
// @ts-ignore
import { getStorage } from 'firebase/storage';

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

// Singleton initialization pattern
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
// Fix: Access getAuth directly through named import
const auth = getAuth(app);

// Use initializeFirestore with experimentalForceLongPolling to ensure reliable connectivity in containerized/sandboxed environments
let db;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true
  });
} catch (e) {
  db = getFirestore(app);
}

const storage = getStorage(app);

export { auth, db, storage, firebaseConfig };

