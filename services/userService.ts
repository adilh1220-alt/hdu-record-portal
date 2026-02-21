// @ts-ignore
import { collection, getDocs, doc, updateDoc, query, orderBy, setDoc, addDoc, limit, getDoc } from 'firebase/firestore';
// @ts-ignore
import { initializeApp } from 'firebase/app';
// @ts-ignore
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { db, firebaseConfig } from './firebaseConfig';
import { AuthUser, AuditLog } from '../types';

export const userService = {
  getAllUsers: async (): Promise<AuthUser[]> => {
    try {
      const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...(doc.data() as Record<string, any>)
      })) as AuthUser[];
    } catch (error) {
      console.error("Error fetching users:", error);
      throw error;
    }
  },

  getUserByUid: async (uid: string): Promise<AuthUser | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return { uid: userDoc.id, ...userDoc.data() } as AuthUser;
      }
      return null;
    } catch (error) {
      console.error("Error fetching user:", error);
      throw error;
    }
  },

  updateUserRole: async (uid: string, role: 'Admin' | 'Consultant' | 'Staff'): Promise<void> => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { role });
      localStorage.setItem(`hdu_role_${uid}`, role);
    } catch (error) {
      console.error("Error updating user role:", error);
      throw error;
    }
  },

  deactivateUser: async (uid: string): Promise<void> => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { status: 'Left' });
    } catch (error) {
      console.error("Error deactivating user:", error);
      throw error;
    }
  },

  activateUser: async (uid: string): Promise<void> => {
    try {
      const userRef = doc(db, 'users', uid);
      // Restore to Active status to re-enable clinical database access
      await updateDoc(userRef, { status: 'Active' });
    } catch (error) {
      console.error("Error activating user:", error);
      throw error;
    }
  },

  adminCreateUser: async (email: string, pass: string, name: string, role: 'Admin' | 'Consultant' | 'Staff', assignedUnit?: string) => {
    // Use the robust config exported from firebaseConfig.ts
    const tempApp = initializeApp(firebaseConfig, "TempAdminCreateApp");
    const tempAuth = getAuth(tempApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(tempAuth, email, pass);
      const newUser = userCredential.user;

      await updateProfile(newUser, { displayName: name });

      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        email: newUser.email,
        displayName: name,
        role: role,
        assignedUnit: assignedUnit || null,
        status: 'Active',
        createdAt: new Date().toISOString()
      });

      await signOut(tempAuth);
    } catch (error: any) {
      throw new Error(error.message || "Failed to create user");
    }
  },

  addAuditLog: async (log: Omit<AuditLog, 'id' | 'timestamp'>) => {
    try {
      await addDoc(collection(db, 'audit_logs'), {
        ...log,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error adding audit log:", error);
    }
  },

  getAuditLogs: async (maxLogs: number = 20): Promise<AuditLog[]> => {
    try {
      const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(maxLogs));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) as AuditLog[];
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      return [];
    }
  }
};