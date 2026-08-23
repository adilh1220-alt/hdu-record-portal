import React, { useState, useEffect } from 'react';
import { AuthUser } from '../types';
import { BiometricCredential, WebAuthnSupport, webAuthnService } from '../services/webAuthnService';
import { useAuth } from '../contexts/AuthContext';
import BiometricWalkthroughModal from './BiometricWalkthroughModal';
import { 
  Fingerprint, 
  ShieldCheck, 
  Smartphone, 
  Laptop, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  UserCheck, 
  Key, 
  Sparkles,
  Shield,
  HelpCircle,
  BookOpen,
  ExternalLink,
  Zap
} from 'lucide-react';

interface BiometricConfigPanelProps {
  users: AuthUser[];
  currentUser: AuthUser | null;
  selectedClinicianUid?: string | null;
  onAuditLog?: (action: string, targetUser: string, details: string) => void;
  onCredentialsChange?: () => void;
}

export const BiometricConfigPanel: React.FC<BiometricConfigPanelProps> = ({
  users,
  currentUser,
  selectedClinicianUid,
  onAuditLog,
  onCredentialsChange
}) => {
  const { 
    biometricSupport: ctxSupport, 
    registeredBiometrics: ctxCreds,
    checkBiometricSupport, 
    refreshBiometricCredentials, 
    registerBiometrics, 
    revokeBiometrics, 
    loginWithBiometrics 
  } = useAuth();

  const [support, setSupport] = useState<WebAuthnSupport | null>(ctxSupport);
  const [credentials, setCredentials] = useState<BiometricCredential[]>(ctxCreds || []);
  const [selectedUid, setSelectedUid] = useState<string>('');
  const [deviceLabel, setDeviceLabel] = useState<string>('');
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [loadingCreds, setLoadingCreds] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState<boolean>(false);
  const [showWalkthroughModal, setShowWalkthroughModal] = useState<boolean>(false);

  // Initialize selected UID with passed prop or current logged-in user
  useEffect(() => {
    if (selectedClinicianUid) {
      setSelectedUid(selectedClinicianUid);
    } else if (currentUser?.uid && !selectedUid) {
      setSelectedUid(currentUser.uid);
    }
  }, [selectedClinicianUid, currentUser]);

  // Load support status & credentials on mount
  useEffect(() => {
    initWebAuthn();
  }, []);

  useEffect(() => {
    if (ctxSupport) {
      setSupport(ctxSupport);
      if (!deviceLabel && ctxSupport.deviceLabel) {
        setDeviceLabel(ctxSupport.deviceLabel);
      }
    }
  }, [ctxSupport]);

  useEffect(() => {
    if (ctxCreds) {
      setCredentials(ctxCreds);
    }
  }, [ctxCreds]);

  const initWebAuthn = async () => {
    try {
      setLoadingCreds(true);
      const [supp, creds] = await Promise.all([
        checkBiometricSupport(),
        refreshBiometricCredentials()
      ]);
      setSupport(supp);
      setCredentials(creds);
      if (!deviceLabel && supp?.deviceLabel) {
        setDeviceLabel(supp.deviceLabel);
      }
    } catch (e) {
      console.warn('Failed to load WebAuthn data:', e);
    } finally {
      setLoadingCreds(false);
    }
  };

  const refreshCredentials = async () => {
    try {
      setLoadingCreds(true);
      const creds = await refreshBiometricCredentials();
      setCredentials(creds);
      onCredentialsChange?.();
    } catch (e) {
      console.warn('Failed to refresh credentials:', e);
    } finally {
      setLoadingCreds(false);
    }
  };

  const activeClinicians = users.filter(u => u.status !== 'Left');
  const targetClinician = users.find(u => u.uid === selectedUid) || currentUser;

  // Handle Enrollment of Biometric Credential for the selected clinician
  const handleEnrollFingerprint = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetClinician) {
      setFeedback({ text: 'Please select a clinician account first.', type: 'error' });
      return;
    }

    if (!support?.isSupported) {
      setFeedback({ 
        text: 'Web Authentication API is not supported in this browser. Please use Chrome, Edge, Safari, or an Android/iOS browser.', 
        type: 'error' 
      });
      return;
    }

    try {
      setIsEnrolling(true);
      setFeedback(null);

      const enrolledCred = await registerBiometrics(
        targetClinician,
        deviceLabel.trim() || undefined
      );

      const successMsg = `Successfully registered biometric passkey [${enrolledCred.deviceName}] for ${targetClinician.displayName || targetClinician.email}!`;
      setFeedback({
        text: successMsg,
        type: 'success'
      });

      // Audit Log
      onAuditLog?.(
        'Biometric Enrolled',
        targetClinician.displayName || targetClinician.email || 'Clinician',
        `Enrolled WebAuthn biometric passkey [${enrolledCred.deviceName}] (ID: ${enrolledCred.id.slice(0, 8)}...)`
      );

      await refreshCredentials();
      setTimeout(() => setFeedback(null), 10000);
    } catch (err: any) {
      setFeedback({
        text: err.message || 'Biometric sensor registration failed or was cancelled.',
        type: 'error'
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  // Handle Simulated / Instant Clinical Passkey for fast testing without hardware limitations
  const handleEnrollSimulatedPasskey = async () => {
    if (!targetClinician) {
      setFeedback({ text: 'Please select a clinician account first.', type: 'error' });
      return;
    }

    try {
      setIsEnrolling(true);
      setFeedback(null);

      const enrolledCred = await webAuthnService.registerSimulatedBiometricCredential(
        targetClinician,
        deviceLabel.trim() || `${targetClinician.displayName || 'Clinician'} Fast-Track Passkey`
      );

      setFeedback({
        text: `Registered Fast-Track Passkey [${enrolledCred.deviceName}] for ${targetClinician.displayName || targetClinician.email}! You can now test biometric verification.`,
        type: 'success'
      });

      onAuditLog?.(
        'Biometric Enrolled',
        targetClinician.displayName || targetClinician.email || 'Clinician',
        `Enrolled Clinical Fast-Track Passkey [${enrolledCred.deviceName}]`
      );

      await refreshCredentials();
      setTimeout(() => setFeedback(null), 10000);
    } catch (err: any) {
      setFeedback({
        text: err.message || 'Failed to register fast-track passkey.',
        type: 'error'
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  // Test Verification flow
  const handleTestVerification = async () => {
    try {
      setIsTesting(true);
      setFeedback(null);

      const emailToTest = targetClinician?.email;
      const res = await loginWithBiometrics(emailToTest);

      setFeedback({
        text: `Biometric verification successful! Recognized ${res.userProfile.displayName} via [${res.credentialInfo.deviceName}].`,
        type: 'success'
      });

      await refreshCredentials();
    } catch (err: any) {
      setFeedback({
        text: err.message || 'Biometric verification failed.',
        type: 'error'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Delete Credential flow
  const handleDeleteCredential = async (cred: BiometricCredential) => {
    const isSelf = cred.userUid === currentUser?.uid;
    const confirmPrompt = isSelf
      ? `Revoke your biometric passkey for "${cred.deviceName}"?`
      : `Revoke biometric passkey "${cred.deviceName}" for ${cred.displayName}?`;

    if (!window.confirm(confirmPrompt)) return;

    try {
      setDeletingId(cred.id);
      await revokeBiometrics(cred.id);
      
      setFeedback({
        text: `Biometric passkey [${cred.deviceName}] revoked successfully.`,
        type: 'info'
      });

      onAuditLog?.(
        'Biometric Revoked',
        cred.displayName || cred.userEmail,
        `Revoked WebAuthn biometric passkey [${cred.deviceName}]`
      );

      await refreshCredentials();
      setTimeout(() => setFeedback(null), 6000);
    } catch (e: any) {
      setFeedback({
        text: e.message || 'Failed to revoke biometric passkey.',
        type: 'error'
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0 animate-in fade-in duration-300">
      {/* Header bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
            <Fingerprint className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Clinician Biometric & WebAuthn Registration
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                FIDO2 Standard
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium mt-0.5">
              Enroll hardware fingerprint sensors, Touch ID, Windows Hello, and Passkeys for secure 1-tap sign-in
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowWalkthroughModal(true)}
            className="px-3 py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-200 hover:text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors border border-red-500/40 cursor-pointer shadow-2xs"
          >
            <Smartphone className="w-3.5 h-3.5 text-red-400" />
            <span>Mobile / Moto Guide</span>
          </button>
          <button
            type="button"
            onClick={() => setShowHowItWorks(prev => !prev)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>{showHowItWorks ? 'Hide Guide' : 'How It Works'}</span>
          </button>
          <button
            type="button"
            onClick={refreshCredentials}
            disabled={loadingCreds}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer"
            title="Refresh Biometric Database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingCreds ? 'animate-spin text-red-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Guide Banner */}
      {showHowItWorks && (
        <div className="bg-slate-50 p-5 border-b border-slate-200 text-slate-700 space-y-3 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>WebAuthn Biometric Security Architecture</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="font-black text-slate-900 block mb-1">1. Hardware Protection</span>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Biometric data (fingerprints/face scans) never leaves the local device. The hardware Secure Enclave / TPM handles matching.
              </p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="font-black text-slate-900 block mb-1">2. Public-Key Cryptography</span>
              <p className="text-[11px] leading-relaxed text-slate-500">
                A unique FIDO2 cryptographic credential pair is created and registered to the clinician's medical profile.
              </p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="font-black text-slate-900 block mb-1">3. 1-Tap Fast Sign-In</span>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Clinicians can tap "Sign In With Biometrics" on the login screen for instantaneous authenticated access without typing passwords.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sensor Detection & Status Banner */}
      {support?.isInIframe && (
        <div className="p-3.5 bg-amber-500/10 border-b border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-800 dark:text-amber-200 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-black">Preview Frame Detected: </span>
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Direct hardware passkeys (Windows Hello / biometric readers) require a standalone window.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-colors shadow-xs cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in New Tab</span>
          </button>
        </div>
      )}

      <div className="p-5 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
            support?.isSupported 
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
              : 'bg-amber-50 text-amber-600 border-amber-200'
          }`}>
            {support?.isSupported ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hardware Sensor Status:</span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                support?.isSupported 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                  : 'bg-amber-100 text-amber-800 border-amber-200'
              }`}>
                {support?.isSupported ? 'Ready & Supported' : 'Unsupported Browser / Device'}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-800 mt-0.5">
              {support?.deviceLabel || 'Detecting local hardware authenticator...'}
            </p>
          </div>
        </div>

        {/* Global summary stats */}
        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
          <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-red-500" />
            <span>Enrolled Passkeys:</span>
            <span className="font-black text-slate-900">{credentials.length}</span>
          </div>
          <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Biometric Clinicians:</span>
            <span className="font-black text-slate-900">
              {new Set(credentials.map(c => c.userUid)).size}
            </span>
          </div>
        </div>
      </div>

      {/* Action feedback */}
      {feedback && (
        <div className={`p-4 border-b flex items-start gap-3 animate-in fade-in ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          feedback.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : feedback.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 space-y-1.5">
            <p className="text-xs font-bold leading-relaxed">{feedback.text}</p>
            {feedback.type === 'error' && (
              <div className="text-[11px] font-normal text-slate-700 bg-white/70 p-2.5 rounded-lg border border-red-100 space-y-1">
                <p className="font-bold text-red-900">Recommended Next Step:</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleOpenInNewTab}
                    className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open in New Tab</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleEnrollSimulatedPasskey}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>Enroll Instant Passkey (1-Click)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <button 
            type="button" 
            onClick={() => setFeedback(null)} 
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Body: Two Columns (Enrollment Form vs. Registered Credentials Matrix) */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Clinician Fingerprint Enrollment Terminal */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-red-600" />
                Enroll Fingerprint Sensor
              </h4>
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                Step 1 of 1
              </span>
            </div>

            <form onSubmit={handleEnrollFingerprint} className="space-y-3.5">
              {/* Select Clinician */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center justify-between">
                  <span>Target Clinician Profile</span>
                  {targetClinician?.uid === currentUser?.uid && (
                    <span className="text-red-600 font-bold normal-case text-[9px]">(You)</span>
                  )}
                </label>
                <select
                  value={selectedUid}
                  onChange={(e) => setSelectedUid(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-100 uppercase cursor-pointer"
                >
                  {activeClinicians.map((u) => {
                    const hasBio = credentials.some(c => c.userUid === u.uid);
                    return (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName || u.email} ({u.role || 'Staff'}) {hasBio ? '• [Enrolled]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Device / Authenticator Label */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Device / Workstation Label
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={deviceLabel}
                    onChange={(e) => setDeviceLabel(e.target.value)}
                    placeholder="e.g. Dr. Sarah Surface Pro / Station 4 Scanner"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-100"
                  />
                  <Laptop className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <p className="text-[9px] text-slate-400 ml-1">
                  Identifies which computer, tablet, or fingerprint reader is authorized.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isEnrolling || !support?.isSupported || !targetClinician}
                  className={`w-full py-3.5 px-4 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 shadow-md ${
                    isEnrolling
                      ? 'bg-red-700 text-white cursor-wait animate-pulse'
                      : !support?.isSupported
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white shadow-red-600/20 cursor-pointer'
                  }`}
                >
                  {isEnrolling ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Touch Fingerprint Sensor Now...</span>
                    </>
                  ) : (
                    <>
                      <Fingerprint className="w-4 h-4 text-red-200" />
                      <span>Enroll Hardware Fingerprint</span>
                    </>
                  )}
                </button>

                {/* Instant Passkey button */}
                <button
                  type="button"
                  onClick={handleEnrollSimulatedPasskey}
                  disabled={isEnrolling || !targetClinician}
                  className="w-full py-2.5 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>⚡ Instant Passkey (1-Click)</span>
                </button>

                {/* Test Verification Button */}
                <button
                  type="button"
                  onClick={handleTestVerification}
                  disabled={isTesting || credentials.length === 0}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-[10px] uppercase tracking-wider bg-white border border-slate-200 hover:bg-slate-100 active:scale-[0.98] text-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isTesting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
                      <span>Verifying Biometric Scan...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Test Biometric Verification</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Registered Biometric Credentials Directory */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Registered Clinician Passkeys ({credentials.length})
            </h4>
            <span className="text-[9px] text-slate-400 font-bold">
              Stored securely in hardware keyrings
            </span>
          </div>

          {loadingCreds ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Syncing biometric passkeys...</p>
            </div>
          ) : credentials.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-300 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white text-slate-300 border border-slate-200 flex items-center justify-center mx-auto shadow-2xs">
                <Fingerprint className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-700">No Biometric Passkeys Registered Yet</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                  Select a clinician on the left terminal and click "Enroll Clinician Fingerprint" to attach a hardware passkey.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
              {credentials.map((cred) => {
                const isSelected = cred.userUid === selectedUid;
                const isCurrent = cred.userUid === currentUser?.uid;

                return (
                  <div
                    key={cred.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected 
                        ? 'bg-red-50/40 border-red-200 shadow-2xs' 
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        cred.authenticatorType === 'platform' 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                          : 'bg-blue-50 text-blue-600 border-blue-200'
                      }`}>
                        <Fingerprint className="w-5 h-5" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black uppercase text-slate-900 tracking-tight">
                            {cred.displayName || 'Medical Personnel'}
                          </span>
                          {isCurrent && (
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-slate-900 text-white">
                              You
                            </span>
                          )}
                          <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {cred.authenticatorType || 'platform'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold lowercase flex items-center gap-1">
                          <span>{cred.userEmail}</span>
                          <span>•</span>
                          <span className="font-black text-slate-700 capitalize">{cred.deviceName}</span>
                        </p>
                        <div className="flex items-center gap-3 text-[8.5px] text-slate-400 font-bold pt-0.5">
                          <span>Enrolled: {new Date(cred.createdAt).toLocaleDateString()}</span>
                          {cred.lastUsedAt && (
                            <span>Last active: {new Date(cred.lastUsedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setSelectedUid(cred.userUid)}
                        className="px-2.5 py-1 rounded-lg text-[9px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                        title="Select this clinician in enrollment form"
                      >
                        Select
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCredential(cred)}
                        disabled={deletingId === cred.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Revoke / Delete this biometric key"
                      >
                        {deletingId === cred.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-red-600 rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Guided Walkthrough Modal */}
      <BiometricWalkthroughModal
        isOpen={showWalkthroughModal}
        onClose={() => setShowWalkthroughModal(false)}
        support={support}
        onStartEnrollment={() => {
          setShowWalkthroughModal(false);
          const formElement = document.querySelector('form');
          if (formElement) formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      />
    </div>
  );
};

export default BiometricConfigPanel;
