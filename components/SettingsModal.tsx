import React, { useState, useEffect, memo } from 'react';
import Modal from './Modal';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import EmailConnectionDiagnostic from './EmailConnectionDiagnostic';
import BiometricWalkthroughModal from './BiometricWalkthroughModal';
import { Shield, Activity, Fingerprint, Plus, Trash2, CheckCircle2, AlertCircle, Smartphone, Laptop, Key, HelpCircle, ExternalLink, Zap } from 'lucide-react';
import { webAuthnService, BiometricCredential, WebAuthnSupport } from '../services/webAuthnService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'security' | 'diagnostics' | 'biometrics';
  onOpenSmtpConfig?: () => void;
}

interface PasswordInputProps {
  label: string;
  value: string;
  setValue: (v: string) => void;
  show: boolean;
  setShow: (s: boolean) => void;
  placeholder: string;
  disabled: boolean;
  id: string;
}

// Optimization: Defined outside parent and memoized to prevent focus loss on mobile re-renders
const PasswordInput = memo(({ 
  label, 
  value, 
  setValue, 
  show, 
  setShow, 
  placeholder,
  disabled,
  id
}: PasswordInputProps) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        required
        disabled={disabled}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-400 outline-none transition-all text-sm font-medium bg-slate-50/50 pr-12"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="current-password"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
        tabIndex={-1}
      >
        {show ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        )}
      </button>
    </div>
  </div>
));

PasswordInput.displayName = 'PasswordInput';

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose,
  initialTab = 'security',
  onOpenSmtpConfig
}) => {
  const [activeTab, setActiveTab] = useState<'security' | 'biometrics' | 'diagnostics'>(initialTab);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // Biometrics Management State
  const [biometricSupport, setBiometricSupport] = useState<WebAuthnSupport | null>(null);
  const [enrolledCreds, setEnrolledCreds] = useState<BiometricCredential[]>([]);
  const [isRegisteringBio, setIsRegisteringBio] = useState(false);
  const [bioActionMessage, setBioActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [customDeviceLabel, setCustomDeviceLabel] = useState('');
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  const { 
    currentUser, 
    loginWithBiometrics, 
    registerBiometrics, 
    revokeBiometrics, 
    checkBiometricSupport, 
    refreshBiometricCredentials, 
    registeredBiometrics,
    biometricSupport: ctxSupport
  } = useAuth();

  // Load Biometric status & credentials on open
  useEffect(() => {
    if (isOpen) {
      loadBiometricsData();
    }
  }, [isOpen, currentUser]);

  const loadBiometricsData = async () => {
    try {
      const support = await checkBiometricSupport();
      setBiometricSupport(support);
      const allCreds = await refreshBiometricCredentials();
      if (currentUser?.uid) {
        setEnrolledCreds(allCreds.filter(c => c.userUid === currentUser.uid));
      }
    } catch (e) {
      console.warn('Failed to load biometrics data:', e);
    }
  };

  const handleRegisterBiometric = async () => {
    if (!currentUser) return;
    setIsRegisteringBio(true);
    setBioActionMessage(null);

    try {
      const cred = await registerBiometrics(
        currentUser, 
        customDeviceLabel.trim() || undefined
      );
      setBioActionMessage({
        text: `Successfully enrolled [${cred.deviceName}]! You can now use biometric 1-tap sign in.`,
        type: 'success'
      });
      setCustomDeviceLabel('');
      await loadBiometricsData();
    } catch (err: any) {
      setBioActionMessage({
        text: err.message || 'Failed to register biometric device.',
        type: 'error'
      });
    } finally {
      setIsRegisteringBio(false);
    }
  };

  const handleRegisterSimulatedBiometric = async () => {
    if (!currentUser) return;
    setIsRegisteringBio(true);
    setBioActionMessage(null);

    try {
      const cred = await webAuthnService.registerSimulatedBiometricCredential(
        currentUser,
        customDeviceLabel.trim() || `${currentUser.displayName || 'Doctor'} Fast-Track Passkey`
      );
      setBioActionMessage({
        text: `Successfully registered Fast-Track Passkey [${cred.deviceName}]! You can now test 1-tap sign-in instantly.`,
        type: 'success'
      });
      setCustomDeviceLabel('');
      await loadBiometricsData();
    } catch (err: any) {
      setBioActionMessage({
        text: err.message || 'Failed to register passkey.',
        type: 'error'
      });
    } finally {
      setIsRegisteringBio(false);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const handleTestBiometric = async () => {
    setBioActionMessage(null);
    try {
      await loginWithBiometrics(currentUser?.email || undefined);
      setBioActionMessage({
        text: 'Biometric verification passed successfully! Authenticator is healthy.',
        type: 'success'
      });
      await loadBiometricsData();
    } catch (err: any) {
      setBioActionMessage({
        text: `Verification test failed: ${err.message}`,
        type: 'error'
      });
    }
  };

  const handleDeleteBiometric = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove the biometric authenticator "${name}"?`)) return;
    try {
      await revokeBiometrics(id);
      setBioActionMessage({
        text: `Removed authenticator "${name}".`,
        type: 'success'
      });
      await loadBiometricsData();
    } catch (err: any) {
      setBioActionMessage({
        text: err.message || 'Failed to delete credential.',
        type: 'error'
      });
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      setMessage({ text: "Session Expired: Please log in again to update credentials.", type: 'error' });
      return;
    }
    
    setMessage(null);

    if (!currentPassword) {
      setMessage({ text: "Verification Required: Current password field is empty.", type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ text: "Protocol Violation: New password must be at least 6 characters long.", type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ text: "Verification Error: Confirmation password does not match.", type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await authService.updateUserPassword(currentPassword, newPassword);
      
      setMessage({ text: "Security credentials successfully updated.", type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        onClose();
        setMessage(null);
      }, 2500);
    } catch (error: any) {
      setMessage({ text: error.message || "Failed to finalize security update.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const isButtonDisabled = loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Administration & Clinical Settings">
      <div className="space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'security'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-800'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
            Password
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('biometrics')}
            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'biometrics'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-800'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            Biometrics / WebAuthn
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'diagnostics'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-800'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            Email Diagnostic
          </button>
        </div>

        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Personnel Account</p>
                <p className="text-sm font-bold text-slate-800">{currentUser?.email || 'N/A'}</p>
              </div>
              <div className="p-2 bg-slate-200 text-slate-500 rounded-lg">
                <Shield className="w-5 h-5 text-slate-600" />
              </div>
            </div>

            {message && (
              <div className={`p-4 rounded-xl text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-top-2 border shadow-sm ${
                message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                  {message.text}
                </div>
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-5">
              <PasswordInput 
                key="current-password-field"
                id="current-credential"
                label="Current Access Credential"
                value={currentPassword}
                setValue={setCurrentPassword}
                show={showCurrent}
                setShow={setShowCurrent}
                placeholder="Verify current password"
                disabled={loading}
              />

              <div className="h-px bg-slate-100 my-2" />

              <PasswordInput 
                key="new-password-field"
                id="new-credential"
                label="New Access Credential"
                value={newPassword}
                setValue={setNewPassword}
                show={showNew}
                setShow={setShowNew}
                placeholder="New (Min 6 chars)"
                disabled={loading}
              />

              <PasswordInput 
                key="confirm-password-field"
                id="confirm-credential"
                label="Verify New Credential"
                value={confirmPassword}
                setValue={setConfirmPassword}
                show={showConfirm}
                setShow={setShowConfirm}
                placeholder="Confirm new password"
                disabled={loading}
              />

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isButtonDisabled}
                  className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
                    isButtonDisabled 
                      ? 'bg-slate-300 shadow-none cursor-not-allowed' 
                      : 'bg-slate-800 hover:bg-slate-900'
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Updating Security...
                    </>
                  ) : (
                    'Finalize Security Update'
                  )}
                </button>
              </div>
            </form>
            
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg">
              <p className="text-center text-[9px] text-amber-700 font-bold uppercase tracking-widest leading-relaxed">
                CRITICAL: Updating your password will invalidate existing sessions on other clinical terminals. Ensure you have memorized your new credentials before proceeding.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'biometrics' && (
          <div className="space-y-6">
            {/* Iframe Detection Notice Banner */}
            {biometricSupport?.isInIframe && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-800 dark:text-amber-200 animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-black">Preview Frame Detected: </span>
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      Windows Hello and hardware biometric prompts require a standalone browser window.
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

            {/* Biometric Capability Status Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border border-slate-700 shadow-md">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                  <Fingerprint className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      WebAuthn Biometric Layer
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      FIDO2 Standard
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium mt-1 leading-relaxed">
                    Register your device's biometric sensor (Touch ID, Face ID, Windows Hello, Android Fingerprint) for instant, encrypted 1-tap login into The Kidney Centre portal without typing passwords.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Hardware Sensor: {biometricSupport?.deviceLabel || 'Biometric Authenticator Ready'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowWalkthrough(true)}
                      className="px-2.5 py-1 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-200 hover:text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors border border-red-500/40 cursor-pointer"
                    >
                      <Smartphone className="w-3 h-3 text-red-400" />
                      <span>Moto G54 / Mobile Guide</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Feedback message */}
            {bioActionMessage && (
              <div className={`p-4 rounded-xl text-xs font-bold space-y-2 animate-in fade-in border ${
                bioActionMessage.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}>
                <div className="flex items-start gap-2.5">
                  {bioActionMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 leading-snug">
                    <p>{bioActionMessage.text}</p>
                    {bioActionMessage.type === 'error' && (
                      <div className="mt-2 text-[11px] font-normal text-slate-700 bg-white/70 p-2.5 rounded-lg border border-red-100 space-y-1">
                        <p className="font-bold text-red-900">Recommended Next Steps:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                          <li>Click <strong>Open in New Tab</strong> if you want to use your physical Windows PIN / scanner.</li>
                          <li>Or click <strong>⚡ Quick Passkey (1-Click)</strong> below to test the instant biometric workflow right now in preview.</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Device Enrollment Action */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  Enroll This Terminal / Authenticator
                </h5>
                <span className="text-[9px] text-slate-400 font-bold">Choose Hardware or Instant Demo</span>
              </div>
              
              <div className="space-y-2.5">
                <input
                  type="text"
                  placeholder={`Device Label (e.g. ${biometricSupport?.deviceLabel || 'My Laptop'})`}
                  value={customDeviceLabel}
                  onChange={(e) => setCustomDeviceLabel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium outline-none focus:ring-2 focus:ring-red-100"
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleRegisterBiometric}
                    disabled={isRegisteringBio}
                    className="py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isRegisteringBio ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Touch Sensor Now...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Enroll Sensor (Windows/Touch)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleRegisterSimulatedBiometric}
                    disabled={isRegisteringBio}
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>⚡ Quick Passkey (1-Click)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Enrolled Keys List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Enrolled Authenticators ({enrolledCreds.length})
                </h5>
                {enrolledCreds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleTestBiometric}
                    className="text-[10px] font-black text-red-600 hover:text-red-700 uppercase tracking-wider underline cursor-pointer"
                  >
                    Test Verification
                  </button>
                )}
              </div>

              {enrolledCreds.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200">
                  <Fingerprint className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">No biometric passkeys registered for this user yet.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Click "Enroll Sensor" above to set up Touch ID or Windows Hello.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {enrolledCreds.map((cred) => (
                    <div
                      key={cred.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                          <Fingerprint className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-800 truncate">{cred.deviceName}</p>
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded">
                              {cred.authenticatorType}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                            Created: {new Date(cred.createdAt).toLocaleDateString()} {cred.lastUsedAt ? `• Last Used: ${new Date(cred.lastUsedAt).toLocaleDateString()}` : ''}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteBiometric(cred.id, cred.deviceName)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Remove authenticator"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'diagnostics' && (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <EmailConnectionDiagnostic 
              onOpenSmtpConfig={() => {
                onClose();
                if (onOpenSmtpConfig) onOpenSmtpConfig();
              }}
            />
          </div>
        )}
      </div>

      <BiometricWalkthroughModal
        isOpen={showWalkthrough}
        onClose={() => setShowWalkthrough(false)}
        support={biometricSupport}
        onStartEnrollment={() => {
          setShowWalkthrough(false);
        }}
      />
    </Modal>
  );
};

export default SettingsModal;
