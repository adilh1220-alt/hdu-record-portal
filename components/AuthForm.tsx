import React, { useState, useRef, useEffect } from 'react';
import { ClipboardList, Fingerprint, Shield, Sparkles, KeyRound, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';
import { authService } from '../services/authService';
import { webAuthnService, WebAuthnSupport } from '../services/webAuthnService';
import Modal from './Modal';

const AuthForm: React.FC = () => {
  const [isLogin] = useState(true); // Fixed to login mode
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  
  // Biometric States
  const [biometricSupport, setBiometricSupport] = useState<WebAuthnSupport | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricFeedback, setBiometricFeedback] = useState<string | null>(null);
  const [lastBiometricUser, setLastBiometricUser] = useState<{ email: string; displayName: string; userUid: string; deviceName: string } | null>(null);
  const [hasEnrolledCreds, setHasEnrolledCreds] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);

  // Reset States
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showInactivityAlert, setShowInactivityAlert] = useState(false);

  const { login, loginWithBiometrics } = useAuth();

  // Detect inactivity logout & check WebAuthn on mount
  useEffect(() => {
    if (localStorage.getItem('hdu_inactivity_logout') === 'true') {
      setShowInactivityAlert(true);
      localStorage.removeItem('hdu_inactivity_logout');
    }

    // Check WebAuthn support and existing enrolled credentials
    const checkAuthn = async () => {
      try {
        const support = await webAuthnService.checkSupport();
        setBiometricSupport(support);

        const creds = await webAuthnService.getCredentials();
        setHasEnrolledCreds(creds.length > 0);

        const lastUser = webAuthnService.getLastBiometricUser();
        if (lastUser) {
          setLastBiometricUser(lastUser);
          if (!email) {
            setEmail(lastUser.email);
          }
        }
      } catch (e) {
        console.warn('Biometric support check failed:', e);
      }
    };
    checkAuthn();
  }, []);

  // Clear error alert after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Handle Biometric Login
  const handleBiometricLogin = async () => {
    setError('');
    setBiometricFeedback('Verifying biometric credential...');
    setBiometricLoading(true);

    try {
      const targetEmail = email || lastBiometricUser?.email || undefined;
      const result = await loginWithBiometrics(targetEmail);
      
      setBiometricFeedback(`Welcome back, ${result.userProfile.displayName}!`);
    } catch (err: any) {
      console.warn('Biometric login failed:', err);
      const friendlyMsg = err.message || 'Biometric verification cancelled or unavailable.';
      setError(friendlyMsg);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setBiometricLoading(false);
      setBiometricFeedback(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // 1. Authenticate with Firebase Auth
      await login(email, password);
      
      const staffList = await userService.getAllUsers();
      const staffMember = staffList.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (staffMember && staffMember.status === 'Left') {
        await authService.logout();
        throw { code: 'custom/deactivated', message: 'Access Denied. Your account has been deactivated. Please contact the Administrator.' };
      }
    } catch (err: any) {
      // UI Feedback: Trigger Shake and Focus management
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPassword('');
      passwordRef.current?.focus();

      // Custom Error Mapping
      const errorCode = err.code || "";
      let friendlyMessage = "Authentication failed. Please check credentials.";

      if (errorCode === 'auth/user-not-found') {
        friendlyMessage = 'User not found. Please verify the email address.';
      } else if (errorCode === 'auth/wrong-password') {
        friendlyMessage = 'Invalid password. Please try again.';
      } else if (errorCode === 'auth/invalid-credential') {
        friendlyMessage = 'Invalid credentials. Please check your email and password.';
      } else if (errorCode === 'auth/too-many-requests') {
        friendlyMessage = 'Account locked due to too many failed attempts. Please try again later.';
      } else if (errorCode === 'auth/user-disabled') {
        friendlyMessage = 'This account has been disabled. Please contact the administrator.';
      } else if (errorCode === 'auth/invalid-email') {
        friendlyMessage = 'The email address is badly formatted.';
      } else if (errorCode === 'custom/deactivated') {
        friendlyMessage = err.message;
      }

      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage(null);
    setResetLoading(true);

    try {
      await authService.sendPasswordReset(resetEmail);
      setResetMessage({ 
        text: "Recovery link dispatched. Please check your medical inbox/spam folder.", 
        type: 'success' 
      });
      setTimeout(() => {
        setIsResetModalOpen(false);
        setResetMessage(null);
        setResetEmail('');
      }, 5000);
    } catch (err: any) {
      setResetMessage({ text: err.message, type: 'error' });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 auth-gradient relative overflow-hidden">
      {/* Top Error Alert Bar */}
      {error && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-red-600 text-white px-6 py-4 flex items-center justify-center gap-3 animate-in slide-in-from-top duration-300 shadow-xl">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-xs font-black uppercase tracking-widest">{error}</span>
          <button onClick={() => setError('')} className="ml-4 p-1 hover:bg-red-700 rounded-full transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className={`w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-300 ${shake ? 'animate-shake' : 'animate-in fade-in zoom-in'}`}>
        <div className="bg-slate-100 p-10 text-center border-b border-slate-200">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-200">
            <ClipboardList className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">RECORD MANAGEMENT PORTAL</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-3">Authorized Clinical Personnel Only</p>
        </div>

        <div className="p-8">
          {showInactivityAlert && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-amber-800 tracking-wider">Session Expired</h4>
                  <button 
                    onClick={() => setShowInactivityAlert(false)} 
                    className="text-amber-500 hover:text-amber-700 p-0.5 rounded transition-colors"
                    aria-label="Dismiss alert"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-[11px] font-semibold text-amber-700 mt-1 leading-relaxed">
                  You were automatically signed out after 15 minutes of inactivity for compliance and patient-data security.
                </p>
              </div>
            </div>
          )}

          {/* Biometric WebAuthn Fast Login Section */}
          {biometricSupport?.isSupported && (
            <div className="mb-6 space-y-3">
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={biometricLoading || loading}
                className={`w-full p-4 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 relative overflow-hidden group cursor-pointer shadow-md active:scale-95 ${
                  hasEnrolledCreds || lastBiometricUser
                    ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700 hover:border-red-500/50 shadow-slate-900/20'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 hover:border-slate-400'
                }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                  hasEnrolledCreds || lastBiometricUser
                    ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-red-500/30'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  <Fingerprint className={`w-6 h-6 ${biometricLoading ? 'animate-pulse text-white' : ''}`} />
                </div>

                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider truncate">
                      {biometricLoading 
                        ? 'Verifying Biometrics...' 
                        : lastBiometricUser 
                          ? `Fast Biometric Sign-In` 
                          : 'Sign In with Biometrics'
                      }
                    </span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      hasEnrolledCreds || lastBiometricUser
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      WebAuthn
                    </span>
                  </div>

                  <p className={`text-[10px] truncate mt-0.5 font-medium ${
                    hasEnrolledCreds || lastBiometricUser ? 'text-slate-300' : 'text-slate-500'
                  }`}>
                    {lastBiometricUser 
                      ? `${lastBiometricUser.displayName} (${lastBiometricUser.deviceName || biometricSupport.deviceLabel})`
                      : `${biometricSupport.deviceLabel} • 1-Tap Secure Entry`
                    }
                  </p>
                </div>

                {biometricLoading ? (
                  <div className="w-5 h-5 border-2 border-red-400/30 border-t-red-500 rounded-full animate-spin shrink-0" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" title="Biometric Authenticator Ready" />
                )}
              </button>

              {biometricFeedback && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{biometricFeedback}</span>
                </div>
              )}

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200" />
                <span className="flex-shrink mx-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Or use medical password
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest ml-1">Email Address</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-100 outline-none transition-all text-sm font-medium bg-slate-50/50"
                placeholder="staff@hospital.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Security Credentials</label>
                <button 
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setIsResetModalOpen(true);
                  }}
                  className="text-[9px] font-black text-red-600 uppercase tracking-widest hover:text-red-700 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-100 outline-none transition-all pr-12 text-sm font-medium bg-slate-50/50"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] text-white shadow-xl transition-all ${
                loading 
                  ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                  : 'bg-red-500 hover:bg-red-600 active:scale-[0.98] shadow-red-200'
              }`}
            >
              {loading ? 'Authenticating...' : 'LOGIN'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest leading-relaxed">
              Confidential Medical Information System<br/>Unauthorized access is strictly prohibited.
            </p>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-center space-x-2">
          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Encrypted Clinical Network</span>
        </div>
      </div>

      <Modal 
        isOpen={isResetModalOpen} 
        onClose={() => {
          setIsResetModalOpen(false);
          setResetMessage(null);
        }} 
        title="Credential Recovery"
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center space-y-3 mb-4">
             <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
             </div>
             <p className="text-sm text-slate-600">Enter your registered medical email to receive a secure password reset link.</p>
          </div>

          {resetMessage && (
            <div className={`p-4 rounded-xl text-xs font-bold ${
              resetMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
            } animate-in fade-in slide-in-from-top-1`}>
              {resetMessage.text}
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest ml-1">Medical Email</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-100 outline-none transition-all text-sm bg-slate-50/50"
                placeholder="staff@hospital.org"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={resetLoading || !resetEmail}
                className={`flex-1 px-4 py-3 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg transition-all ${
                  resetLoading || !resetEmail ? 'bg-slate-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-95'
                }`}
              >
                {resetLoading ? 'Dispatching...' : 'Send Link'}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};

export default AuthForm;