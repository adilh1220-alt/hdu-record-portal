/**
 * Web Authentication API (WebAuthn / Passkeys / Biometrics) Service
 * Supports Touch ID, Face ID, Windows Hello, Android Fingerprint, and FIDO2 Security Keys
 * for fast, passwordless, highly secure biometric login into The Kidney Centre medical portal.
 */

import { AuthUser } from '../types';
import { db, safeFirestoreWrite } from './firebaseConfig';
// @ts-ignore
import { collection, doc, getDocs, setDoc, deleteDoc, query, where, updateDoc, getDoc } from 'firebase/firestore';
import { activityService } from './activityService';

export interface BiometricCredential {
  id: string; // Base64URL encoded credential ID
  rawId: string;
  userUid: string;
  userEmail: string;
  displayName: string;
  deviceName: string;
  authenticatorType: 'platform' | 'cross-platform' | 'unknown';
  createdAt: string;
  lastUsedAt?: string;
  transports?: string[];
  counter?: number;
}

export interface WebAuthnSupport {
  isSupported: boolean;
  isPlatformAuthenticatorAvailable: boolean;
  deviceLabel: string;
  authenticatorIcon: 'fingerprint' | 'face' | 'key' | 'shield';
}

// Storage keys
const STORAGE_KEY_BIOMETRIC_CREDS = 'hdu_biometric_credentials_v1';
const STORAGE_KEY_LAST_BIOMETRIC_USER = 'hdu_last_biometric_user_v1';

// Helper: Buffer to Base64URL
export function bufferToBase64URL(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper: Base64URL to Uint8Array
export function base64URLToBuffer(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Detect friendly device name based on User-Agent
export function detectDeviceBiometricName(): { label: string; icon: 'fingerprint' | 'face' | 'key' | 'shield' } {
  if (typeof window === 'undefined' || !navigator) {
    return { label: 'Biometric Authenticator', icon: 'fingerprint' };
  }

  const ua = navigator.userAgent;
  if (/Macintosh|Mac OS X/i.test(ua)) {
    return { label: 'Touch ID / Mac Passkey', icon: 'fingerprint' };
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return { label: 'Face ID / Touch ID (Apple)', icon: 'face' };
  }
  if (/Windows/i.test(ua)) {
    return { label: 'Windows Hello (Fingerprint / PIN / Face)', icon: 'fingerprint' };
  }
  if (/Android/i.test(ua)) {
    return { label: 'Android Biometrics (Fingerprint / Face)', icon: 'fingerprint' };
  }
  if (/Linux/i.test(ua)) {
    return { label: 'FIDO2 Security Key / Biometrics', icon: 'key' };
  }

  return { label: 'Device Biometric Authenticator', icon: 'shield' };
}

export const webAuthnService = {
  /**
   * Check if WebAuthn & Platform Biometrics (Touch ID, Windows Hello, Face ID) are supported
   */
  checkSupport: async (): Promise<WebAuthnSupport> => {
    const isSupported = typeof window !== 'undefined' && 
      !!window.PublicKeyCredential && 
      typeof navigator !== 'undefined' && 
      !!navigator.credentials;

    if (!isSupported) {
      return {
        isSupported: false,
        isPlatformAuthenticatorAvailable: false,
        deviceLabel: 'Not Supported on this Browser',
        authenticatorIcon: 'shield'
      };
    }

    let isPlatformAuthenticatorAvailable = false;
    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        isPlatformAuthenticatorAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }
    } catch (e) {
      console.warn('WebAuthn platform authenticator check error:', e);
    }

    const { label, icon } = detectDeviceBiometricName();

    return {
      isSupported,
      isPlatformAuthenticatorAvailable,
      deviceLabel: label,
      authenticatorIcon: icon
    };
  },

  /**
   * Get all registered biometric credentials stored locally and in Firestore
   */
  getCredentials: async (userUid?: string): Promise<BiometricCredential[]> => {
    let localCreds: BiometricCredential[] = [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY_BIOMETRIC_CREDS);
      if (stored) {
        localCreds = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse local biometric credentials:', e);
    }

    // If online & userUid given, sync from Firestore
    if (userUid) {
      try {
        const q = query(collection(db, 'biometric_credentials'), where('userUid', '==', userUid));
        const snapshot = await getDocs(q);
        const remoteCreds: BiometricCredential[] = snapshot.docs.map(doc => doc.data() as BiometricCredential);
        
        // Merge without duplicates
        const map = new Map<string, BiometricCredential>();
        [...localCreds, ...remoteCreds].forEach(c => {
          if (c && c.id) map.set(c.id, c);
        });
        const merged = Array.from(map.values());
        localStorage.setItem(STORAGE_KEY_BIOMETRIC_CREDS, JSON.stringify(merged));
        return userUid ? merged.filter(c => c.userUid === userUid) : merged;
      } catch (e) {
        console.warn('Offline mode: Using cached biometric credentials:', e);
      }
    }

    return userUid ? localCreds.filter(c => c.userUid === userUid) : localCreds;
  },

  /**
   * Get the last remembered user who enrolled biometrics on this device
   */
  getLastBiometricUser: (): { email: string; displayName: string; userUid: string; deviceName: string } | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LAST_BIOMETRIC_USER);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return null;
  },

  /**
   * Register a new Biometric Credential for the currently logged-in medical staff
   */
  registerBiometricCredential: async (
    user: AuthUser, 
    customDeviceName?: string
  ): Promise<BiometricCredential> => {
    const support = await webAuthnService.checkSupport();
    if (!support.isSupported) {
      throw new Error('WebAuthn / Biometrics is not supported in this browser environment.');
    }

    // Generate random 32-byte challenge & user ID buffer
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userIdBytes = new TextEncoder().encode(user.uid || user.email || 'user');
    const { label } = detectDeviceBiometricName();
    const finalDeviceName = customDeviceName || label;

    // Standard WebAuthn PublicKeyCreationOptions
    const creationOptions: CredentialCreationOptions = {
      publicKey: {
        rp: {
          name: 'The Kidney Centre - Clinical HDU Portal',
          id: window.location.hostname
        },
        user: {
          id: userIdBytes,
          name: user.email || 'staff@hospital.org',
          displayName: user.displayName || 'Medical Personnel'
        },
        challenge: challenge,
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },  // ES256 (WebAuthn / iOS / Mac / Android default)
          { alg: -257, type: 'public-key' } // RS256 (Windows Hello default)
        ],
        timeout: 60000,
        authenticatorSelection: {
          authenticatorAttachment: support.isPlatformAuthenticatorAvailable ? 'platform' : undefined,
          userVerification: 'preferred',
          requireResidentKey: false
        },
        attestation: 'none'
      }
    };

    try {
      const credential = await navigator.credentials.create(creationOptions) as PublicKeyCredential;
      if (!credential) {
        throw new Error('Biometric registration was cancelled or not completed.');
      }

      const rawId = bufferToBase64URL(credential.rawId);
      const id = credential.id;

      // Extract authenticator attachment
      let authType: 'platform' | 'cross-platform' | 'unknown' = 'unknown';
      if (credential.authenticatorAttachment) {
        authType = credential.authenticatorAttachment as any;
      } else if (support.isPlatformAuthenticatorAvailable) {
        authType = 'platform';
      }

      const newBiometricRecord: BiometricCredential = {
        id,
        rawId,
        userUid: user.uid,
        userEmail: user.email || '',
        displayName: user.displayName || 'Clinical Staff',
        deviceName: finalDeviceName,
        authenticatorType: authType,
        createdAt: new Date().toISOString(),
        transports: credential.response && 'getTransports' in credential.response 
          ? (credential.response as any).getTransports() 
          : ['internal']
      };

      // 1. Save locally
      const existing = await webAuthnService.getCredentials();
      const updated = [newBiometricRecord, ...existing.filter(c => c.id !== id)];
      localStorage.setItem(STORAGE_KEY_BIOMETRIC_CREDS, JSON.stringify(updated));
      localStorage.setItem(STORAGE_KEY_LAST_BIOMETRIC_USER, JSON.stringify({
        email: user.email,
        displayName: user.displayName,
        userUid: user.uid,
        deviceName: finalDeviceName
      }));

      // 2. Persist to Firestore
      try {
        await safeFirestoreWrite(async () => {
          await setDoc(doc(db, 'biometric_credentials', id), newBiometricRecord);
        });
      } catch (e) {
        console.warn('Firestore offline: Saved biometric credential locally:', e);
      }

      // 3. Log security event
      activityService.logAuthEvent(
        'SESSION_RESTORE',
        `Biometric authenticator enrolled successfully: [${finalDeviceName}] for ${user.displayName} (${user.email}).`,
        user.email || user.uid,
        user.role,
        'SUCCESS',
        {
          credentialId: id,
          deviceName: finalDeviceName,
          authenticatorType: authType
        }
      ).catch(() => {});

      return newBiometricRecord;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Biometric setup was cancelled or timed out. Please try again.');
      }
      if (err.name === 'InvalidStateError') {
        throw new Error('This biometric authenticator is already registered on this device.');
      }
      throw new Error(err.message || 'Failed to complete biometric device enrollment.');
    }
  },

  /**
   * Fast Biometric Login: Authenticates user using fingerprint / Face ID / Touch ID
   */
  loginWithBiometrics: async (specificEmail?: string): Promise<{
    userProfile: AuthUser;
    credentialInfo: BiometricCredential;
  }> => {
    const support = await webAuthnService.checkSupport();
    if (!support.isSupported) {
      throw new Error('WebAuthn / Biometric verification is not supported in this browser.');
    }

    // Retrieve available credentials
    let credentials = await webAuthnService.getCredentials();
    if (specificEmail) {
      credentials = credentials.filter(c => c.userEmail.toLowerCase() === specificEmail.toLowerCase());
    }

    if (credentials.length === 0) {
      throw new Error('No registered biometric credentials found for this device or account. Please sign in with password first and enable Biometrics in Settings.');
    }

    // Build allowCredentials list
    const allowCredentials: PublicKeyCredentialDescriptor[] = credentials.map(c => ({
      id: base64URLToBuffer(c.rawId || c.id),
      type: 'public-key',
      transports: (c.transports as AuthenticatorTransport[]) || ['internal', 'usb', 'nfc', 'ble']
    }));

    // Generate random authentication challenge
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const getOptions: CredentialRequestOptions = {
      publicKey: {
        challenge,
        timeout: 60000,
        rpId: window.location.hostname,
        allowCredentials,
        userVerification: 'preferred'
      }
    };

    try {
      const assertion = await navigator.credentials.get(getOptions) as PublicKeyCredential;
      if (!assertion) {
        throw new Error('Biometric authentication cancelled.');
      }

      // Match returned credential ID with registered credential
      const matchedCred = credentials.find(c => c.id === assertion.id || c.rawId === bufferToBase64URL(assertion.rawId));
      if (!matchedCred) {
        throw new Error('Biometric credential verification failed: Device mismatch.');
      }

      // Fetch the full authoritative user data from Firestore or local cache
      let userRole: 'Admin' | 'Consultant' | 'Staff' = 'Staff';
      let userStatus: 'Active' | 'Left' = 'Active';
      let assignedUnit: any = null;
      let displayName = matchedCred.displayName;

      try {
        const userDoc = await getDoc(doc(db, 'users', matchedCred.userUid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as any;
          userRole = userData.role || 'Staff';
          userStatus = userData.status || 'Active';
          assignedUnit = userData.assignedUnit;
          displayName = userData.displayName || displayName;
        }
      } catch (e) {
        console.warn('Firestore offline during biometric auth, using credential info:', e);
        const cachedRole = localStorage.getItem(`hdu_role_${matchedCred.userUid}`);
        if (cachedRole === 'Admin' || cachedRole === 'Consultant' || cachedRole === 'Staff') {
          userRole = cachedRole as any;
        }
      }

      // Master bypass for Superuser
      if (matchedCred.userEmail === 'adilh1220@gmail.com') {
        userRole = 'Admin';
        userStatus = 'Active';
      }

      if (userStatus === 'Left') {
        throw new Error('Access Denied: Your medical account has been deactivated. Please contact administrator.');
      }

      const authUser: AuthUser = {
        uid: matchedCred.userUid,
        email: matchedCred.userEmail,
        displayName: displayName,
        role: userRole,
        status: userStatus,
        assignedUnit: assignedUnit
      };

      // Update credential lastUsedAt timestamp
      matchedCred.lastUsedAt = new Date().toISOString();
      const updatedCreds = credentials.map(c => c.id === matchedCred.id ? matchedCred : c);
      localStorage.setItem(STORAGE_KEY_BIOMETRIC_CREDS, JSON.stringify(updatedCreds));
      localStorage.setItem(STORAGE_KEY_LAST_BIOMETRIC_USER, JSON.stringify({
        email: matchedCred.userEmail,
        displayName: matchedCred.displayName,
        userUid: matchedCred.userUid,
        deviceName: matchedCred.deviceName
      }));

      // Update Firestore if available
      try {
        await safeFirestoreWrite(async () => {
          await updateDoc(doc(db, 'biometric_credentials', matchedCred.id), {
            lastUsedAt: matchedCred.lastUsedAt
          });
        });
      } catch (e) {}

      // Log successful biometric sign-in
      activityService.logAuthEvent(
        'AUTH_LOGIN',
        `Biometric login verified successfully via [${matchedCred.deviceName}] for ${matchedCred.displayName} (${matchedCred.userEmail}). Role: [${userRole}].`,
        matchedCred.userEmail,
        userRole,
        'SUCCESS',
        {
          authMethod: 'WebAuthn_Biometrics',
          credentialId: matchedCred.id,
          deviceName: matchedCred.deviceName
        }
      ).catch(() => {});

      return {
        userProfile: authUser,
        credentialInfo: matchedCred
      };
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Biometric verification cancelled or timed out.');
      }
      throw err;
    }
  },

  /**
   * Delete an enrolled biometric credential
   */
  deleteCredential: async (credentialId: string): Promise<void> => {
    try {
      const existing = await webAuthnService.getCredentials();
      const filtered = existing.filter(c => c.id !== credentialId);
      localStorage.setItem(STORAGE_KEY_BIOMETRIC_CREDS, JSON.stringify(filtered));

      // Remove from Firestore
      try {
        await safeFirestoreWrite(async () => {
          await deleteDoc(doc(db, 'biometric_credentials', credentialId));
        });
      } catch (e) {
        console.warn('Firestore offline: Removed credential locally:', e);
      }
    } catch (e: any) {
      throw new Error(e.message || 'Failed to remove biometric credential.');
    }
  }
};
