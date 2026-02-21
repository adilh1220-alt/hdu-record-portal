// @ts-ignore
import { initializeApp, getApps, getApp } from 'firebase/app';
// Fix: Added @ts-ignore to suppress 'no exported member' error for modular auth in this environment
// @ts-ignore
import { getAuth } from 'firebase/auth';
// @ts-ignore
import { getFirestore } from 'firebase/firestore';

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
const db = getFirestore(app);

export { auth, db, firebaseConfig };

