
// Fix: Reverted to named imports for firebase/auth to resolve property access and missing member errors
// Added @ts-ignore to suppress 'no exported member' errors for modular auth in this environment
// @ts-ignore
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider, User, sendPasswordResetEmail } from 'firebase/auth';
// @ts-ignore
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

export const authService = {
  login: async (email: string, pass: string) => {
    try {
      // Fix: Use named function call directly
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      // Propagation of raw error to allow code-based mapping in the UI
      throw error;
    }
  },

  signup: async (email: string, pass: string, name: string, role: string) => {
    try {
      // Fix: Use named function call directly
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        const user = userCredential.user;
        // Fix: Use named function call directly
        await updateProfile(user, { displayName: name });
        
        // Create Firestore record for the user
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: name,
          role: role,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error: any) {
      throw new Error(error.message || "Failed to create account");
    }
  },

  logout: async () => {
    try {
      // Fix: Use named function call directly
      await signOut(auth);
    } catch (error: any) {
      throw new Error("Failed to logout");
    }
  },

  sendPasswordReset: async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
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
      // Firebase Auth automatically handles secure hashing and salted storage
      await updatePassword(user, newPassword);
    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        throw new Error("Incorrect current password.");
      }
      if (error.code === 'auth/requires-recent-login') {
        throw new Error("Security Protocol: Re-authentication required. Please sign out and sign in again.");
      }
      throw new Error(error.message || "Failed to update security credentials.");
    }
  },

  // Fix: Reference User type and function directly
  onAuthStateChanged: (callback: (user: User | null) => void) => {
    // Fix: Use named function call directly
    return onAuthStateChanged(auth, callback);
  }
};