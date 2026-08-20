import React, { createContext, useContext, useState, useEffect } from 'react';
// @ts-ignore
import { doc, getDoc } from 'firebase/firestore';
import { AuthUser } from '../types';
import { authService } from '../services/authService';
import { db } from '../services/firebaseConfig';
import { syncLogoSettingsFromFirestore } from '../services/pdfService';
import { activityService } from '../services/activityService';
import { webAuthnService, BiometricCredential } from '../services/webAuthnService';

interface AuthContextType {
  currentUser: AuthUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginWithBiometrics: (targetEmail?: string) => Promise<{ userProfile: AuthUser; credentialInfo: BiometricCredential }>;
  signup: (email: string, pass: string, name: string, role: 'Admin' | 'Consultant' | 'Staff', assignedUnit?: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  canManageRecords: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if there is an existing saved session to prevent flicker
    const savedSession = localStorage.getItem('hdu_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.email && parsed.status !== 'Left') {
          setCurrentUser(parsed);
        }
      } catch (e) {}
    }

    // Failsafe timeout to prevent indefinite spinning screen on cold starts / network delays
    const failsafeTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const unsubscribe = authService.onAuthStateChanged(async (user) => {
      clearTimeout(failsafeTimer);
      if (user) {
        let role: 'Admin' | 'Consultant' | 'Staff' = 'Staff';
        let status: 'Active' | 'Left' = 'Active';
        let assignedUnit: string | undefined = undefined;
        let source: 'FIRESTORE' | 'LOCAL_STORAGE' | 'SUPERUSER' = 'FIRESTORE';

        try {
          // Fetch authoritative role from Firestore with quick timeout
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as any;
            role = data.role || 'Staff';
            status = data.status || 'Active';
            assignedUnit = data.assignedUnit;
            source = 'FIRESTORE';
          }
        } catch (error: any) {
          console.warn("Firestore user fetch offline/unreachable fallback:", error);
          source = 'LOCAL_STORAGE';
          const cachedSession = localStorage.getItem('hdu_session');
          if (cachedSession) {
            try {
              const parsed = JSON.parse(cachedSession);
              if (parsed.uid === user.uid) {
                role = parsed.role || role;
                status = parsed.status || status;
                assignedUnit = parsed.assignedUnit || assignedUnit;
              }
            } catch (e) {}
          }
          const savedRole = localStorage.getItem(`hdu_role_${user.uid}`);
          if (savedRole && (savedRole === 'Admin' || savedRole === 'Consultant' || savedRole === 'Staff')) {
            role = savedRole as any;
          }
        }

        // MASTER BYPASS: Always grant Admin to specific superuser
        if (user.email === 'adilh1220@gmail.com') {
          role = 'Admin';
          status = 'Active';
          source = 'SUPERUSER';
        }

        // Force logout if status is 'Left'
        if (status === 'Left') {
          activityService.logAuthEvent(
            'AUTH_FAILED',
            `Access blocked: User account status is 'Left/Revoked'. Forcing logout.`,
            user.email || user.uid,
            role,
            'WARNING',
            { uid: user.uid, status: 'Left' }
          ).catch(() => {});
          await authService.logout();
          setCurrentUser(null);
          setLoading(false);
          return;
        }

        const sanitizedUser: AuthUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'HDU Staff',
          role: role,
          status: status,
          assignedUnit: assignedUnit as any
        };
        
        setCurrentUser(sanitizedUser);
        localStorage.setItem('hdu_session', JSON.stringify(sanitizedUser));
        localStorage.setItem(`hdu_role_${user.uid}`, role);

        // Non-blocking log session recovery / restore event
        activityService.logAuthEvent(
          'SESSION_RESTORE',
          `Session active for ${sanitizedUser.displayName} (${sanitizedUser.email || sanitizedUser.uid}) as [${role}]. Role resolved via ${source}. Assigned Unit: ${assignedUnit || 'All Units'}.`,
          sanitizedUser.email || user.uid,
          role,
          'SUCCESS',
          {
            uid: user.uid,
            assignedUnit,
            resolutionSource: source,
            persistenceLayer: 'HYBRID',
            status: sanitizedUser.status
          }
        ).catch(() => {});

        // Sync branding/logo settings from Firestore database
        syncLogoSettingsFromFirestore().catch(() => {});
      } else {
        // Only clear if not authenticated via verified biometric session
        const currentCached = localStorage.getItem('hdu_session');
        if (!currentCached) {
          setCurrentUser(null);
        }
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(failsafeTimer);
      unsubscribe();
    };
  }, []);

  const loginWithBiometrics = async (targetEmail?: string) => {
    try {
      const result = await webAuthnService.loginWithBiometrics(targetEmail);
      const user = result.userProfile;

      setCurrentUser(user);
      localStorage.setItem('hdu_session', JSON.stringify(user));
      localStorage.setItem(`hdu_role_${user.uid}`, user.role);

      syncLogoSettingsFromFirestore().catch(() => {});

      return result;
    } catch (err: any) {
      throw err;
    }
  };

  const login = async (email: string, pass: string) => {
    try {
      await authService.login(email, pass);
      activityService.logAuthEvent(
        'AUTH_LOGIN',
        `User ${email} authenticated successfully. Initializing clinical context and user permissions.`,
        email,
        'Staff',
        'SUCCESS',
        { authProvider: 'Firebase Password', timestamp: new Date().toISOString() }
      );
    } catch (err: any) {
      activityService.logAuthEvent(
        'AUTH_FAILED',
        `Authentication attempt failed for ${email}. Error: ${err.message || 'Invalid Credentials'}`,
        email,
        'Unknown',
        'ERROR',
        { errorCode: err.code || 'auth/unknown-error', failureReason: err.message }
      );
      throw err;
    }
  };

  const signup = async (email: string, pass: string, name: string, role: 'Admin' | 'Consultant' | 'Staff', assignedUnit?: string) => {
    try {
      await authService.signup(email, pass, name, role, assignedUnit);
      activityService.logAuthEvent(
        'AUTH_SIGNUP',
        `New account registered: ${name} (${email}) with role [${role}] in unit [${assignedUnit || 'Global'}].`,
        email,
        role,
        'SUCCESS',
        { assignedUnit, createdBy: currentUser?.email || 'Self Registration' }
      );
    } catch (err: any) {
      activityService.logAuthEvent(
        'AUTH_FAILED',
        `Account registration failed for ${email}: ${err.message}`,
        email,
        role,
        'ERROR',
        { errorCode: err.code || 'registration_error' }
      );
      throw err;
    }
  };

  const logout = async () => {
    const prevEmail = currentUser?.email || 'Unknown User';
    const prevRole = currentUser?.role || 'Staff';
    const prevUid = currentUser?.uid;

    activityService.logAuthEvent(
      'AUTH_LOGOUT',
      `Session terminated for ${prevEmail} [${prevRole}]. Session tokens invalidated. Preserving global branding and system diagnostic configs.`,
      prevEmail,
      prevRole,
      'INFO',
      { uid: prevUid }
    );

    await authService.logout();
    setCurrentUser(null);

    // Clear transient user session keys while preserving system config & logo settings
    const preservedKeys = new Set([
      'hdu_logo_settings',
      'medilog_smtp_config_v2',
      'medilog_daily_report_settings_v2',
      'medilog_monthly_report_settings_v2',
      'medilog_activity_buffer_v2'
    ]);

    Object.keys(localStorage).forEach(key => {
      if ((key.startsWith('hdu_') || key.startsWith('clinical_')) && !preservedKeys.has(key)) {
        localStorage.removeItem(key);
      }
    });
  };

  const isAdmin = currentUser?.role === 'Admin';
  const canManageRecords = isAdmin || currentUser?.role === 'Consultant' || currentUser?.role === 'Staff';

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, loginWithBiometrics, signup, logout, isAdmin, canManageRecords }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};