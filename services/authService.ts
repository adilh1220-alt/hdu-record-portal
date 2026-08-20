
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider, User, sendPasswordResetEmail } from 'firebase/auth';
// @ts-ignore
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, safeFirestoreWrite } from './firebaseConfig';
import { activityService } from './activityService';

export const authService = {
  login: async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      throw error;
    }
  },

  signup: async (email: string, pass: string, name: string, role: string, assignedUnit?: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        const user = userCredential.user;
        await updateProfile(user, { displayName: name });
        
        // Create Firestore record for the user
        await safeFirestoreWrite(async () => {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: name,
            role: role,
            assignedUnit: assignedUnit || null,
            createdAt: new Date().toISOString()
          });
        });
      }
    } catch (error: any) {
      throw new Error(error.message || "Failed to create account");
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error("Failed to logout");
    }
  },

  sendPasswordReset: async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      activityService.logAuthEvent(
        'PASSWORD_CHANGE',
        `Password recovery link dispatched to ${email}`,
        email,
        'Staff',
        'INFO',
        { eventType: 'RESET_DISPATCH' }
      );
    } catch (error: any) {
      activityService.logAuthEvent(
        'AUTH_FAILED',
        `Password recovery failed for ${email}: ${error.message}`,
        email,
        'Unknown',
        'WARNING',
        { errorCode: error.code }
      );
      if (error.code === 'auth/user-not-found') {
        throw new Error("No medical account found with this email address.");
      }
      throw new Error(error.message || "Failed to initiate password recovery.");
    }
  },

  updateUserPassword: async (currentPassword: string, newPassword: string) => {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error("Security Context Error: No authenticated session found.");
    
    try {
      // 1. Re-authenticate first to ensure the user knows the current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // 2. Perform the update
      await updatePassword(user, newPassword);

      activityService.logAuthEvent(
        'PASSWORD_CHANGE',
        `Master password updated successfully for authenticated session ${user.email}`,
        user.email,
        'Staff',
        'SUCCESS',
        { uid: user.uid }
      );
    } catch (error: any) {
      activityService.logAuthEvent(
        'AUTH_FAILED',
        `Password update challenge failed for ${user.email}: ${error.message}`,
        user.email,
        'Staff',
        'ERROR',
        { errorCode: error.code }
      );
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        throw new Error("Incorrect current password.");
      }
      if (error.code === 'auth/requires-recent-login') {
        throw new Error("Security Protocol: Re-authentication required. Please sign out and sign in again.");
      }
      throw new Error(error.message || "Failed to update security credentials.");
    }
  },

  onAuthStateChanged: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
  }
};