import React, { createContext, useContext, useState, useEffect } from 'react';
// @ts-ignore
import { doc, getDoc } from 'firebase/firestore';
import { AuthUser } from '../types';
import { authService } from '../services/authService';
import { db } from '../services/firebaseConfig';
import { syncLogoSettingsFromFirestore } from '../services/pdfService';

interface AuthContextType {
  currentUser: AuthUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
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
    const unsubscribe = authService.onAuthStateChanged(async (user) => {
      if (user) {
        let role: 'Admin' | 'Consultant' | 'Staff' = 'Staff';
        let status: 'Active' | 'Left' = 'Active';
        let assignedUnit: string | undefined = undefined;

        try {
          // Fetch authoritative role from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as any;
            role = data.role || 'Staff';
            status = data.status || 'Active';
            assignedUnit = data.assignedUnit;
          }
        } catch (error) {
          console.warn("Firestore user fetch offline/unreachable fallback:", error);
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
        }

        // Force logout if status is 'Left'
        if (status === 'Left') {
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

        // Sync branding/logo settings from Firestore database
        syncLogoSettingsFromFirestore().catch(() => {});
      } else {
        setCurrentUser(null);
        Object.keys(localStorage).forEach(key => {
          if ((key.startsWith('hdu_') || key.startsWith('clinical_')) && key !== 'hdu_logo_settings') {
            localStorage.removeItem(key);
          }
        });
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, pass: string) => {
    await authService.login(email, pass);
  };

  const signup = async (email: string, pass: string, name: string, role: 'Admin' | 'Consultant' | 'Staff', assignedUnit?: string) => {
    await authService.signup(email, pass, name, role, assignedUnit);
  };

  const logout = async () => {
    await authService.logout();
    setCurrentUser(null);
    // Clear all HDU related session data except branding/logo settings
    Object.keys(localStorage).forEach(key => {
      if ((key.startsWith('hdu_') || key.startsWith('clinical_')) && key !== 'hdu_logo_settings') {
        localStorage.removeItem(key);
      }
    });
  };

  const isAdmin = currentUser?.role === 'Admin';
  const canManageRecords = isAdmin || currentUser?.role === 'Consultant' || currentUser?.role === 'Staff';

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, signup, logout, isAdmin, canManageRecords }}>
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