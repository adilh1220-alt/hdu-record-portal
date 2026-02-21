import React, { createContext, useContext, useState, useEffect } from 'react';
// @ts-ignore
import { doc, getDoc } from 'firebase/firestore';
import { AuthUser } from '../types';
import { authService } from '../services/authService';
import { db } from '../services/firebaseConfig';

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
        try {
          // Fetch authoritative role from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          let role: 'Admin' | 'Consultant' | 'Staff' = 'Staff';
          let status: 'Active' | 'Left' = 'Active';
          let assignedUnit: string | undefined = undefined;
          
          if (userDoc.exists()) {
            const data = userDoc.data() as any;
            role = data.role || 'Staff';
            status = data.status || 'Active';
            assignedUnit = data.assignedUnit;
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
        } catch (error) {
          console.error("Error fetching user data from Firestore:", error);
          
          // Emergency fallback for the bypass email even if Firestore fails
          if (user.email === 'adilh1220@gmail.com') {
            const bypassUser: AuthUser = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || 'Super Admin',
              role: 'Admin',
              status: 'Active'
            };
            setCurrentUser(bypassUser);
          }
        }
      } else {
        setCurrentUser(null);
        localStorage.removeItem('hdu_session');
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
    localStorage.removeItem('hdu_session');
  };

  const isAdmin = currentUser?.role === 'Admin';
  const canManageRecords = isAdmin || currentUser?.role === 'Consultant';

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, signup, logout, isAdmin, canManageRecords }}>
      {!loading && children}
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