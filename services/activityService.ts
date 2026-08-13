import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { db, safeFirestoreWrite } from './firebaseConfig';

export interface UserActivity {
  id?: string;
  action: 'CREATE' | 'MODIFY' | 'DELETE';
  recordType: string;
  details: string;
  performedBy: string;
  timestamp: string;
  unit?: string;
}

export const activityService = {
  logActivity: async (action: 'CREATE' | 'MODIFY' | 'DELETE', recordType: string, details: string, performedBy: string, unit?: string) => {
    try {
      await safeFirestoreWrite(async () => {
        await addDoc(collection(db, 'user_activities'), {
          action,
          recordType,
          details,
          performedBy,
          timestamp: new Date().toISOString(),
          unit: unit || 'Global'
        });
      }, 5000);
    } catch (error) {
      console.warn("Could not persist user activity log to Firestore (Offline or Stream busy):", error);
    }
  },

  getActivities: async (maxCount: number = 100): Promise<UserActivity[]> => {
    try {
      const q = query(collection(db, 'user_activities'), orderBy('timestamp', 'desc'), limit(maxCount));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) as UserActivity[];
    } catch (error) {
      console.error("Error fetching user activities:", error);
      return [];
    }
  },

  clearActivity: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'user_activities', id));
    } catch (error) {
      console.error("Error deleting activity:", error);
    }
  }
};
