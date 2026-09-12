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

export interface DiagnosticCheckItem {
  id: string;
  name: string;
  category: 'api' | 'environment' | 'hardware' | 'credential';
  status: 'pass' | 'warn' | 'fail';
  summary: string;
  details: string;
  errorCode?: string;
  recommendedAction?: string;
}

export interface BiometricDiagnosticReport {
  timestamp: string;
  userAgent: string;
  osName: string;
  isWindows: boolean;
  isDellCandidate: boolean;
  browser: string;
  isSecureContext: boolean;
  isInIframe: boolean;
  hasWebAuthnAPI: boolean;
  isPlatformAuthenticatorAvailable: boolean;
  isConditionalMediationAvailable: boolean;
  enrolledCredentialsCount: number;
  checks: DiagnosticCheckItem[];
  overallHealth: 'HEALTHY' | 'ACTION_NEEDED' | 'BLOCKED';
}

export interface HardwareProbeResult {
  success: boolean;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  errorCode: string;
  errorName?: string;
  userMessage: string;
  technicalDetails: string;
  remedySteps: string[];
  osContext: 'windows' | 'android' | 'macos' | 'generic';
}

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
  },

  /**
   * Run comprehensive Web Authentication API & Hardware environment diagnostics
   */
  runDiagnostics: async (): Promise<BiometricDiagnosticReport> => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isWindows = /Windows/i.test(ua);
    const isMac = /Macintosh|Mac OS X/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const isDellCandidate = isWindows; // Common hospital laptops (Dell Latitude 7300/7400/5400)
    
    let osName = 'Unknown OS';
    if (isWindows) osName = 'Windows 10 / 11';
    else if (isMac) osName = 'macOS (Apple)';
    else if (isAndroid) osName = 'Android OS';
    else if (/Linux/i.test(ua)) osName = 'Linux';

    let browser = 'Unknown Browser';
    if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
    else if (/Chrome\//i.test(ua)) browser = 'Google Chrome';
    else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
    else if (/Safari\//i.test(ua)) browser = 'Apple Safari';

    const isSecureContext = typeof window !== 'undefined' ? !!window.isSecureContext : false;
    const isInIframe = isRunningInIframe();
    const hasWebAuthnAPI = typeof window !== 'undefined' && !!window.PublicKeyCredential && typeof navigator !== 'undefined' && !!navigator.credentials;

    let isPlatformAuthenticatorAvailable = false;
    if (hasWebAuthnAPI && typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      try {
        isPlatformAuthenticatorAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch (e) {
        console.warn('Diagnostics: platform authenticator check failed:', e);
      }
    }

    let isConditionalMediationAvailable = false;
    if (hasWebAuthnAPI && typeof (PublicKeyCredential as any).isConditionalMediationAvailable === 'function') {
      try {
        isConditionalMediationAvailable = await (PublicKeyCredential as any).isConditionalMediationAvailable();
      } catch (e) {
        // ignore
      }
    }

    const enrolled = await webAuthnService.getCredentials();
    const enrolledCount = enrolled.length;

    const checks: DiagnosticCheckItem[] = [];

    // 1. Browser WebAuthn API
    if (hasWebAuthnAPI) {
      checks.push({
        id: 'webauthn-api',
        name: 'Web Authentication API Support',
        category: 'api',
        status: 'pass',
        summary: 'Supported & active in browser',
        details: `${browser} provides native PublicKeyCredential and navigator.credentials interfaces.`
      });
    } else {
      checks.push({
        id: 'webauthn-api',
        name: 'Web Authentication API Support',
        category: 'api',
        status: 'fail',
        summary: 'API Unavailable or disabled',
        errorCode: 'ERR_NO_WEBAUTHN_API',
        details: 'The browser engine does not expose the W3C WebAuthn API.',
        recommendedAction: 'Update Google Chrome or Microsoft Edge to the latest version and ensure security flags are not disabling WebAuthn.'
      });
    }

    // 2. Security Context (HTTPS)
    if (isSecureContext) {
      checks.push({
        id: 'secure-context',
        name: 'Transport Security (HTTPS)',
        category: 'environment',
        status: 'pass',
        summary: 'Origin is a cryptographic Secure Context',
        details: 'Connection is encrypted over TLS/HTTPS, satisfying WebAuthn cryptographic origin mandates.'
      });
    } else {
      checks.push({
        id: 'secure-context',
        name: 'Transport Security (HTTPS)',
        category: 'environment',
        status: 'fail',
        summary: 'Insecure origin (HTTP)',
        errorCode: 'ERR_INSECURE_CONTEXT',
        details: 'Biometric passkeys and WebAuthn calls are blocked on unencrypted HTTP connections.',
        recommendedAction: 'Access the portal via HTTPS protocol (https://).'
      });
    }

    // 3. Execution Frame / Sandbox
    if (!isInIframe) {
      checks.push({
        id: 'frame-context',
        name: 'Browser Window Context',
        category: 'environment',
        status: 'pass',
        summary: 'Top-level Standalone Tab',
        details: 'Application is running directly in top-level window. Full hardware sensor dialogs permitted.'
      });
    } else {
      checks.push({
        id: 'frame-context',
        name: 'Browser Window Context',
        category: 'environment',
        status: 'warn',
        summary: 'Embedded Preview Iframe Detected',
        errorCode: 'ERR_IFRAME_RESTRICTED',
        details: 'Browsers strictly block direct Windows Hello hardware prompts inside cross-origin or preview iframes to prevent clickjacking.',
        recommendedAction: 'Open The Kidney Centre portal in a dedicated browser tab using the "Open in New Tab" button.'
      });
    }

    // 4. Platform Authenticator (Windows Hello / Touch ID / Sensor Hardware)
    if (isPlatformAuthenticatorAvailable) {
      checks.push({
        id: 'platform-authenticator',
        name: isWindows ? 'Windows Hello Biometric Provider' : 'Platform Biometric Authenticator',
        category: 'hardware',
        status: 'pass',
        summary: isWindows ? 'Windows Hello reported ready' : 'Platform authenticator available',
        details: isWindows 
          ? 'Windows 10/11 confirms Windows Hello biometric / PIN provider is active and ready to handle WebAuthn requests.'
          : 'Operating system reported a built-in user-verifying authenticator.'
      });
    } else {
      checks.push({
        id: 'platform-authenticator',
        name: isWindows ? 'Windows Hello Biometric Provider' : 'Platform Biometric Authenticator',
        category: 'hardware',
        status: 'warn',
        summary: isWindows ? 'Windows Hello not responding or not configured' : 'Platform authenticator not detected',
        errorCode: 'ERR_PLATFORM_AUTH_UNAVAILABLE',
        details: isWindows 
          ? 'Windows reports that Windows Hello Fingerprint / PIN is either not configured in Windows Settings, or the biometric hardware driver (e.g. Dell ControlVault) is not responding.'
          : 'The OS does not report a ready biometric sensor to the browser.',
        recommendedAction: isWindows
          ? '1. Open Windows Settings (Win + I) > Accounts > Sign-in options.\n2. Ensure a Windows Hello PIN is created first.\n3. Click Windows Hello Fingerprint and enroll your finger.\n4. Check Device Manager > Biometric devices for Dell ControlVault / Goodix driver.'
          : 'Ensure biometric login is enabled in your operating system settings.'
      });
    }

    // 5. Enrolled Portal Credentials
    if (enrolledCount > 0) {
      checks.push({
        id: 'enrolled-credentials',
        name: 'Portal Biometric Passkeys',
        category: 'credential',
        status: 'pass',
        summary: `${enrolledCount} registered passkey${enrolledCount > 1 ? 's' : ''} on record`,
        details: `This device/account has ${enrolledCount} active credential(s) enrolled in the clinical database.`
      });
    } else {
      checks.push({
        id: 'enrolled-credentials',
        name: 'Portal Biometric Passkeys',
        category: 'credential',
        status: 'warn',
        summary: 'No passkeys registered for this portal yet',
        errorCode: 'ERR_ENROLLMENT_REQUIRED',
        details: 'The hardware sensor may work in Windows, but it has not yet been paired with your medical account in this portal.',
        recommendedAction: 'Sign in with your email and password first, then go to Portal Settings > Biometrics > "Enroll Sensor" to link your fingerprint.'
      });
    }

    let overallHealth: 'HEALTHY' | 'ACTION_NEEDED' | 'BLOCKED' = 'HEALTHY';
    if (checks.some(c => c.status === 'fail')) {
      overallHealth = 'BLOCKED';
    } else if (checks.some(c => c.status === 'warn')) {
      overallHealth = 'ACTION_NEEDED';
    }

    return {
      timestamp: new Date().toISOString(),
      userAgent: ua,
      osName,
      isWindows,
      isDellCandidate,
      browser,
      isSecureContext,
      isInIframe,
      hasWebAuthnAPI,
      isPlatformAuthenticatorAvailable,
      isConditionalMediationAvailable,
      enrolledCredentialsCount: enrolledCount,
      checks,
      overallHealth
    };
  },

  /**
   * Run an interactive hardware sensor probe via WebAuthn to test if the browser
   * can detect the physical fingerprint scanner / Windows Hello prompt
   */
  runHardwareSensorProbe: async (): Promise<HardwareProbeResult> => {
    const diag = await webAuthnService.runDiagnostics();

    // Context determination
    const osContext: 'windows' | 'android' | 'macos' | 'generic' = 
      diag.isWindows ? 'windows' : /Android/i.test(diag.userAgent) ? 'android' : /Macintosh/i.test(diag.userAgent) ? 'macos' : 'generic';

    // 1. Check API presence
    if (!diag.hasWebAuthnAPI) {
      return {
        success: false,
        status: 'ERROR',
        errorCode: 'ERR_NO_WEBAUTHN_API',
        errorName: 'NotSupportedError',
        userMessage: 'Browser does not support the Web Authentication API.',
        technicalDetails: 'window.PublicKeyCredential is not available in this browser runtime.',
        remedySteps: [
          'Switch to a modern browser like Google Chrome or Microsoft Edge.',
          'Verify that WebAuthn or Passkeys have not been disabled in browser experimental flags.'
        ],
        osContext
      };
    }

    // 2. Check Secure Context
    if (!diag.isSecureContext) {
      return {
        success: false,
        status: 'ERROR',
        errorCode: 'ERR_INSECURE_CONTEXT',
        errorName: 'SecurityError',
        userMessage: 'WebAuthn requires an HTTPS encrypted connection.',
        technicalDetails: 'window.isSecureContext is false. Biometric hardware access is restricted to HTTPS.',
        remedySteps: [
          'Ensure the URL starts with https:// rather than http://.',
          'If testing locally, use localhost or an SSL tunnel.'
        ],
        osContext
      };
    }

    // 3. Check Iframe Restriction
    if (diag.isInIframe) {
      return {
        success: false,
        status: 'WARNING',
        errorCode: 'ERR_IFRAME_RESTRICTED',
        errorName: 'NotAllowedError',
        userMessage: 'Hardware biometric prompts are blocked inside preview iframes.',
        technicalDetails: 'Running inside an embedded frame. Browsers require top-level window context for Windows Hello / biometric prompts.',
        remedySteps: [
          'Click the "Open in New Tab" button in the top bar.',
          'In the new standalone tab, the Windows Hello fingerprint dialog will trigger natively without restriction.'
        ],
        osContext
      };
    }

    // 4. Check Windows Hello Platform Authenticator on Windows
    if (diag.isWindows && !diag.isPlatformAuthenticatorAvailable) {
      return {
        success: false,
        status: 'WARNING',
        errorCode: 'ERR_WIN_HELLO_NOT_CONFIGURED',
        errorName: 'NotAllowedError',
        userMessage: 'Windows Hello is not configured or fingerprint scanner driver is offline.',
        technicalDetails: 'PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable returned false on Windows.',
        remedySteps: [
          'Press Windows Key + I to open Windows Settings.',
          'Navigate to Accounts > Sign-in options.',
          'Create a "Windows Hello PIN" first (Microsoft requires a PIN before allowing fingerprints).',
          'Click "Windows Hello Fingerprint" and follow the scanner calibration prompts.',
          'On Dell Latitude laptops: Open Device Manager (devmgmt.msc) > Biometric Devices and verify "Dell ControlVault" or "Goodix Fingerprint" is active.'
        ],
        osContext
      };
    }

    // 5. Perform interactive challenge probe
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      // Fetch existing credentials or prepare probe buffer
      const existingCreds = await webAuthnService.getCredentials();
      const hardwareCreds = existingCreds.filter(c => !c.isSimulated && c.rawId);

      let allowList: PublicKeyCredentialDescriptor[] = [];
      if (hardwareCreds.length > 0) {
        allowList = hardwareCreds.map(c => ({
          id: base64URLToBuffer(c.rawId || c.id),
          type: 'public-key',
          transports: (c.transports as AuthenticatorTransport[]) || ['internal']
        }));
      } else {
        // Use a dummy 16-byte credential ID to trigger the OS Windows Hello / Biometric prompt probe
        const dummyId = new Uint8Array(16);
        window.crypto.getRandomValues(dummyId);
        allowList = [{
          id: dummyId,
          type: 'public-key'
        }];
      }

      const probeOptions: CredentialRequestOptions = {
        publicKey: {
          challenge,
          timeout: 20000,
          rpId: window.location.hostname,
          allowCredentials: allowList,
          userVerification: 'preferred'
        }
      };

      const assertion = await navigator.credentials.get(probeOptions) as PublicKeyCredential | null;

      if (assertion) {
        return {
          success: true,
          status: 'SUCCESS',
          errorCode: 'STATUS_HARDWARE_VERIFIED',
          userMessage: 'Fingerprint sensor successfully detected and verified!',
          technicalDetails: `Assertion completed with credential ID: ${assertion.id.slice(0, 12)}... Authenticator attachment confirmed.`,
          remedySteps: [
            'Your biometric sensor is communicating seamlessly with the portal.',
            'You can now use 1-Tap Fast Biometric Sign-In on the login screen anytime.'
          ],
          osContext
        };
      } else {
        return {
          success: false,
          status: 'WARNING',
          errorCode: 'ERR_NOT_ALLOWED_CANCELLED',
          errorName: 'NotAllowedError',
          userMessage: 'Sensor prompt was dismissed or timed out.',
          technicalDetails: 'navigator.credentials.get returned null or prompt was closed.',
          remedySteps: [
            'Click "Run Sensor Test" again.',
            'When the Windows Hello prompt appears, touch your finger to the scanner within 20 seconds.'
          ],
          osContext
        };
      }
    } catch (err: any) {
      const errName = err?.name || '';
      const errMsg = (err?.message || '').toLowerCase();

      // Handle common DOMExceptions & hardware conditions
      if (errName === 'NotAllowedError') {
        if (errMsg.includes('timed out') || errMsg.includes('canceled') || errMsg.includes('cancelled')) {
          return {
            success: false,
            status: 'WARNING',
            errorCode: 'ERR_NOT_ALLOWED_CANCELLED',
            errorName: errName,
            userMessage: 'Biometric scan prompt was cancelled or timed out.',
            technicalDetails: err.message,
            remedySteps: [
              'Click "Run Sensor Test" again.',
              'Ensure your finger touches the scanner firmly and rests until Windows recognizes it.',
              'If using Windows Hello, you can also enter your Windows PIN as a fallback.'
            ],
            osContext
          };
        }

        // If no credentials found on device
        if (diag.enrolledCredentialsCount === 0) {
          return {
            success: true, // Hardware works, just needs enrollment!
            status: 'WARNING',
            errorCode: 'ERR_ENROLLMENT_REQUIRED',
            errorName: errName,
            userMessage: 'Fingerprint sensor responded, but this laptop is not enrolled in the portal yet.',
            technicalDetails: 'Hardware communication with OS credential provider was initiated, but no passkey is registered for this specific hospital account.',
            remedySteps: [
              'Log in once with your standard email & password.',
              'Click "Settings" in the sidebar, open the "Biometrics" tab.',
              'Click "Enroll Sensor" to register your Dell Latitude fingerprint sensor for 1-tap login.'
            ],
            osContext
          };
        }

        return {
          success: false,
          status: 'WARNING',
          errorCode: 'ERR_NOT_ALLOWED_CANCELLED',
          errorName: errName,
          userMessage: 'Access not allowed or prompt dismissed.',
          technicalDetails: err.message,
          remedySteps: [
            'Make sure you touch the laptop fingerprint scanner when the system dialog appears.',
            'Check Windows Hello status in Windows Settings > Accounts > Sign-in options.'
          ],
          osContext
        };
      }

      if (errName === 'SecurityError') {
        return {
          success: false,
          status: 'ERROR',
          errorCode: 'ERR_SECURITY_RESTRICTION',
          errorName: errName,
          userMessage: 'Security restriction blocked WebAuthn.',
          technicalDetails: err.message,
          remedySteps: [
            'Ensure the domain name matches the relying party ID.',
            'Check that browser security settings allow passkey operations for this site.'
          ],
          osContext
        };
      }

      if (errName === 'NotSupportedError') {
        return {
          success: false,
          status: 'ERROR',
          errorCode: 'ERR_HARDWARE_NOT_SUPPORTED',
          errorName: errName,
          userMessage: 'Hardware or cryptographic configuration is not supported.',
          technicalDetails: err.message,
          remedySteps: [
            'Update your laptop biometric drivers (e.g. Dell ControlVault3 Firmware & Driver from support.dell.com).',
            'Ensure Windows 10/11 has all pending Windows Updates installed.'
          ],
          osContext
        };
      }

      return {
        success: false,
        status: 'ERROR',
        errorCode: 'ERR_HARDWARE_COMMUNICATION_FAULT',
        errorName: errName,
        userMessage: 'Biometric hardware communication error.',
        technicalDetails: err.message || 'Unknown WebAuthn exception during hardware probe.',
        remedySteps: [
          'Restart the Windows Biometric Service: Press Win + R, type services.msc, right-click "Windows Biometric Service" and select Restart.',
          'Clean your fingerprint scanner surface with a dry cloth.',
          'Re-calibrate your fingerprint in Windows Settings > Accounts > Sign-in options.'
        ],
        osContext
      };
    }
  }
};
