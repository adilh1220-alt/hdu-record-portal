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
  setLogLevel('error');
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

// Singleton initialization pattern
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Use initializeFirestore with experimentalAutoDetectLongPolling to handle both WebSocket and long-polling environments smoothly
let db;
try {
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true
  });
} catch (e) {
  db = getFirestore(app);
}

const storage = getStorage(app);

export { auth, db, storage, firebaseConfig };


