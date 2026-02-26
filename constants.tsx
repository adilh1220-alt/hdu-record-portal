
import { Patient, InventoryItem, PatientStatus, ClinicalUnit, TaskPriority } from './types';

export const CLINICAL_UNITS: ClinicalUnit[] = ['HDU', 'ICU', 'TRANSPLANT', '4th-WARD', 'WARD5'];

export const UNIT_DETAILS: Record<ClinicalUnit, { label: string, color: string }> = {
  HDU: { label: 'High Dependency', color: 'bg-red-600' },
  ICU: { label: 'Intensive Care', color: 'bg-indigo-600' },
  TRANSPLANT: { label: 'Transplant Bay', color: 'bg-emerald-600' },
  '4th-WARD': { label: 'Ward', color: 'bg-pink-500' },
  WARD5: { label: '5th Floor Ward', color: 'bg-amber-500' }
};

export const TASK_PRIORITIES: TaskPriority[] = ['High', 'Medium', 'Low'];

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  High: 'bg-red-100 text-red-700 border-red-200',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200',
  Low: 'bg-slate-100 text-slate-700 border-slate-200'
};

export const CONSULTANTS = [
  'Dr. Salman Khalid', 'Dr. Ruqaya', 'Dr. Kiran Nasir', 'Dr. Bilal', 
  'Dr. Shoaib', 'Dr. Murtaza', 'Dr. Raheela', 'Dr. Aysha', 
  'Dr. Shakeel', 'Dr. Zohaib', 'Dr. Shariq'
];

export const ENDOSCOPY_DOCTORS = [
  'Dr. Shahid Majid', 'Dr. Fahad', 'Dr. Aneel Kumar'
];

export const ENDOSCOPY_PROCEDURES = [
  'EGD', 'Colonoscopy', 'ERCP', 'Sigmoidoscopy', 'Band Ligation', 'Endoscopy+Band ligation', 'Endoscopy+Biopsy'
];

export const CATEGORIES: string[] = ['Medicine', 'Surgery', 'Urology', 'Nephrology', 'Cardiology', 'Others'];
export const LOCATIONS: string[] = ['OT', 'WARD', 'ICU', 'ER', 'Pvt Ward'];
export const CODE_STATUSES: any[] = ['Full Code', 'DNR', 'DNI'];

export const INVENTORY_CATEGORIES = [
  'Respiratory', 'Emergency', 'Consumables', 'PPE', 'Disposable', 'Medication'
];

export const INVENTORY_UNITS = [
  'PCS', 'VIAL', 'AMP', 'BOX', 'STRIP', 'BOTTLE'
];

export const INCIDENT_CATEGORIES = [
  'Patient Fall', 'Phlebitis', 'Pressure Sore', 'Medication Error'
];

export const INITIAL_PATIENTS: Patient[] = [];
export const INITIAL_INVENTORY: InventoryItem[] = [];

export const COLORS = {
  primary: '#dc2626', // Red-600
  secondary: '#1e293b', // Slate-800
  accent: '#f8fafc', // Slate-50
  danger: '#ef4444', // Red-500
};

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
