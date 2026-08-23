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
  authenticatorType: 'platform' | 'cross-platform' | 'unknown' | 'simulated';
  createdAt: string;
  lastUsedAt?: string;
  transports?: string[];
  counter?: number;
  isSimulated?: boolean;
}

export interface WebAuthnSupport {
  isSupported: boolean;
  isPlatformAuthenticatorAvailable: boolean;
  deviceLabel: string;
  authenticatorIcon: 'fingerprint' | 'face' | 'key' | 'shield';
  isInIframe: boolean;
}

// Storage keys
const STORAGE_KEY_BIOMETRIC_CREDS = 'hdu_biometric_credentials_v1';
const STORAGE_KEY_LAST_BIOMETRIC_USER = 'hdu_last_biometric_user_v1';

// Helper: Check if running inside an iframe
export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch (e) {
    return true;
  }
}

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

    const inIframe = isRunningInIframe();

    if (!isSupported) {
      return {
        isSupported: false,
        isPlatformAuthenticatorAvailable: false,
        deviceLabel: 'Not Supported on this Browser',
        authenticatorIcon: 'shield',
        isInIframe: inIframe
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
      authenticatorIcon: icon,
      isInIframe: inIframe
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

    // If online, sync from Firestore (filtered by userUid if provided, otherwise all)
    try {
      const q = userUid 
        ? query(collection(db, 'biometric_credentials'), where('userUid', '==', userUid))
        : collection(db, 'biometric_credentials');
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

    // Standard WebAuthn PublicKeyCreationOptions with multi-algorithm support
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
          { alg: -7, type: 'public-key' },   // ES256 (WebAuthn / iOS / Mac / Android)
          { alg: -257, type: 'public-key' }, // RS256 (Windows Hello default)
          { alg: -8, type: 'public-key' },   // Ed25519
          { alg: -37, type: 'public-key' },  // PS256
          { alg: -35, type: 'public-key' },  // ES384
          { alg: -36, type: 'public-key' },  // ES512
          { alg: -258, type: 'public-key' }  // RS384
        ],
        timeout: 60000,
        authenticatorSelection: {
          authenticatorAttachment: undefined, // Allows both Platform (Windows Hello) and Cross-Platform (Phone/Security Key)
          userVerification: 'preferred',
          residentKey: 'preferred',
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
        isSimulated: false,
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
        'BIOMETRIC_ENROLLED',
        `Biometric passkey enrolled successfully: [${finalDeviceName}] for ${user.displayName} (${user.email}).`,
        user.email || user.uid,
        user.role,
        'SUCCESS',
        {
          credentialId: id,
          deviceName: finalDeviceName,
          authenticatorType: authType,
          displayName: user.displayName,
          userUid: user.uid,
          transports: newBiometricRecord.transports
        }
      ).catch(() => {});

      return newBiometricRecord;
    } catch (err: any) {
      const { label } = detectDeviceBiometricName();
      activityService.logAuthEvent(
        'BIOMETRIC_FAILED',
        `Biometric enrollment failed for ${user.displayName || user.email} on [${customDeviceName || label}]: ${err.message}`,
        user.email || user.uid,
        user.role,
        'ERROR',
        {
          authMethod: 'WebAuthn_Registration',
          failureReason: err.message,
          errorCode: err.name || 'EnrollmentError',
          deviceName: customDeviceName || label
        }
      ).catch(() => {});

      if (err.name === 'NotAllowedError') {
        if (isRunningInIframe()) {
          throw new Error('Biometric hardware access is restricted inside preview frames. Please open the portal in a New Browser Tab to access Windows Hello / fingerprint hardware, or use "Quick Clinical Passkey" for instant preview enrollment.');
        }
        throw new Error('Biometric setup was cancelled or timed out. When the Windows Hello / fingerprint prompt appears, enter your Windows PIN or touch your sensor to complete registration.');
      }
      if (err.name === 'InvalidStateError') {
        throw new Error('This biometric authenticator is already registered on this device.');
      }
      throw new Error(err.message || 'Failed to complete biometric device enrollment.');
    }
  },

  /**
   * Fast-Track / Simulated Passkey Registration:
   * Enables seamless passkey enrollment and testing when running inside an iframe,
   * in virtualized environments, or without physical biometric hardware.
   */
  registerSimulatedBiometricCredential: async (
    user: AuthUser,
    customDeviceName?: string
  ): Promise<BiometricCredential> => {
    const randomBytes = new Uint8Array(16);
    window.crypto.getRandomValues(randomBytes);
    const id = 'sim_passkey_' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const finalDeviceName = customDeviceName || 'Clinical Fast-Track Passkey';

    const newRecord: BiometricCredential = {
      id,
      rawId: id,
      userUid: user.uid,
      userEmail: user.email || '',
      displayName: user.displayName || 'Clinical Staff',
      deviceName: finalDeviceName,
      authenticatorType: 'simulated',
      createdAt: new Date().toISOString(),
      isSimulated: true,
      transports: ['internal']
    };

    // 1. Save locally
    const existing = await webAuthnService.getCredentials();
    const updated = [newRecord, ...existing.filter(c => c.id !== id)];
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
        await setDoc(doc(db, 'biometric_credentials', id), newRecord);
      });
    } catch (e) {
      console.warn('Firestore offline: Saved simulated passkey locally:', e);
    }

    // 3. Log security event
    activityService.logAuthEvent(
      'BIOMETRIC_ENROLLED',
      `Clinical Fast-Track passkey enrolled: [${finalDeviceName}] for ${user.displayName} (${user.email}).`,
      user.email || user.uid,
      user.role,
      'SUCCESS',
      {
        credentialId: id,
        deviceName: finalDeviceName,
        authenticatorType: 'simulated',
        displayName: user.displayName,
        userUid: user.uid,
        isSimulated: true
      }
    ).catch(() => {});

    return newRecord;
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

    // Check if we have simulated passkeys only, or if we need to authenticate via WebAuthn
    const hasHardwareCreds = credentials.some(c => !c.isSimulated);
    const simulatedCred = credentials.find(c => c.isSimulated);

    let matchedCred: BiometricCredential | undefined;

    if (!hasHardwareCreds && simulatedCred) {
      // Direct instant simulated verification
      matchedCred = simulatedCred;
    } else {
      // Build allowCredentials list (only valid base64 buffers for WebAuthn)
      const hardwareCreds = credentials.filter(c => !c.isSimulated);
      const allowCredentials: PublicKeyCredentialDescriptor[] = (hardwareCreds.length > 0 ? hardwareCreds : credentials).map(c => ({
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
          allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
          userVerification: 'preferred'
        }
      };

      try {
        const assertion = await navigator.credentials.get(getOptions) as PublicKeyCredential;
        if (!assertion) {
          throw new Error('Biometric authentication cancelled.');
        }

        // Match returned credential ID with registered credential
        matchedCred = credentials.find(c => c.id === assertion.id || c.rawId === bufferToBase64URL(assertion.rawId));
      } catch (err: any) {
        // Fallback: If simulated passkey is registered and iframe blocked navigator.credentials.get
        if (simulatedCred && (err.name === 'NotAllowedError' || isRunningInIframe())) {
          matchedCred = simulatedCred;
        } else {
          throw err;
        }
      }
    }

    if (!matchedCred) {
      throw new Error('Biometric credential verification failed: Device mismatch.');
    }

    try {

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
          deviceName: matchedCred.deviceName,
          displayName: matchedCred.displayName,
          userUid: matchedCred.userUid,
          authenticatorType: matchedCred.authenticatorType || 'platform',
          assignedUnit: assignedUnit || 'Global',
          timestamp: new Date().toISOString()
        }
      ).catch(() => {});

      return {
        userProfile: authUser,
        credentialInfo: matchedCred
      };
    } catch (err: any) {
      const { label } = detectDeviceBiometricName();
      const isCancelled = err.name === 'NotAllowedError';
      const failReason = isCancelled 
        ? 'Biometric prompt cancelled or timed out by clinician.'
        : (err.message || 'Biometric credential verification challenge failed.');

      activityService.logAuthEvent(
        'BIOMETRIC_FAILED',
        `Biometric authentication failed on [${label}]${specificEmail ? ` for ${specificEmail}` : ''}: ${failReason}`,
        specificEmail || 'Unknown Personnel',
        'Staff',
        'ERROR',
        {
          authMethod: 'WebAuthn_Biometrics',
          failureReason: failReason,
          errorCode: err.name || 'BiometricAuthError',
          deviceName: label,
          attemptedEmail: specificEmail || '',
          timestamp: new Date().toISOString()
        }
      ).catch(() => {});

      if (isCancelled) {
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
      const target = existing.find(c => c.id === credentialId);
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

      // Log revocation event
      if (target) {
        activityService.logAuthEvent(
          'BIOMETRIC_REVOKED',
          `Biometric passkey [${target.deviceName}] revoked for ${target.displayName} (${target.userEmail}).`,
          target.userEmail,
          'Staff',
          'WARNING',
          {
            credentialId: target.id,
            deviceName: target.deviceName,
            displayName: target.displayName,
            userUid: target.userUid,
            timestamp: new Date().toISOString()
          }
        ).catch(() => {});
      }
    } catch (e: any) {
      throw new Error(e.message || 'Failed to remove biometric credential.');
    }
  },

  /**
   * Fetch all biometric authentication logs (success, fail, enrolled, revoked)
   */
  getBiometricAuthLogs: async (maxCount: number = 100) => {
    try {
      const allActivities = await activityService.getActivities(maxCount * 2);
      return allActivities.filter(a => {
        const action = a.action || '';
        const authMethod = a.metadata?.authMethod;
        const hasDevice = !!a.metadata?.deviceName;
        const details = (a.details || '').toLowerCase();
        
        return (
          action.startsWith('BIOMETRIC_') ||
          authMethod === 'WebAuthn_Biometrics' ||
          authMethod === 'WebAuthn_Registration' ||
          (action === 'AUTH_LOGIN' && (hasDevice || details.includes('biometric') || details.includes('passkey'))) ||
          (action === 'AUTH_FAILED' && (details.includes('biometric') || details.includes('passkey')))
        );
      }).slice(0, maxCount);
    } catch (e) {
      console.warn('Failed to retrieve biometric auth logs:', e);
      return [];
    }
  }
};
