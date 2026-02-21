
export type ClinicalUnit = 'HDU' | 'ICU' | 'TRANSPLANT' | '4th-WARD' | 'WARD5';

export enum PatientStatus {
  ACTIVE = 'Active',
  DISCHARGED = 'Discharged',
  DECEASED = 'Deceased'
}

export type PatientCategory = 'Medicine' | 'Surgery' | 'Urology' | 'Nephrology' | 'Cardiology' | 'Others';
export type CodeStatus = 'Full Code' | 'DNR' | 'DNI';

export interface Patient {
  id: string;
  unit: ClinicalUnit;
  serialNo?: string;
  regNo: string;
  name: string;
  gender: string;
  admissionDate: string;
  dischargeDate?: string;
  category: PatientCategory;
  location: string;
  codeStatus: CodeStatus;
  consultant: string;
  status?: PatientStatus;
  lengthOfStay: number;
}

export interface InventoryItem {
  id: string;
  unit: ClinicalUnit;
  name: string;
  category: string;
  quantity: number;
  minThreshold: number;
  measurementUnit: string;
  expiryDate: string;
  lastUpdated: string;
  notes?: string;
}

export interface EndoscopyRecord {
  id: string;
  referringUnit: ClinicalUnit;
  serialNo?: string;
  regNo: string;
  name: string;
  doctor: string;
  procedure: string;
  date: string;
}

export type TaskPriority = 'High' | 'Medium' | 'Low';
export type TaskStatus = 'Pending' | 'Completed';

export interface ClinicalTask {
  id: string;
  unit: ClinicalUnit;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  dueDate?: string;
  assignedBy: string;
}

export interface AdmissionData {
  month: string;
  count: number;
}

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: 'Admin' | 'Consultant' | 'Staff';
  status?: 'Active' | 'Left';
}

export interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  targetUser: string;
  details: string;
  timestamp: string;
}
