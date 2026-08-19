
import { Patient, InventoryItem, PatientStatus, ClinicalUnit, TaskPriority } from './types';

export const CLINICAL_UNITS: ClinicalUnit[] = ['HDU', 'ICU', 'TRANSPLANT', '4th-WARD', 'WARD5', 'ENDOSCOPY'];

export const UNIT_DETAILS: Record<ClinicalUnit, { label: string, color: string, capacity: number }> = {
  HDU: { label: 'High Dependency', color: 'bg-red-600', capacity: 12 },
  ICU: { label: 'Intensive Care', color: 'bg-indigo-600', capacity: 8 },
  TRANSPLANT: { label: 'Transplant Bay', color: 'bg-emerald-600', capacity: 6 },
  '4th-WARD': { label: 'Ward', color: 'bg-pink-500', capacity: 20 },
  WARD5: { label: '5th Floor Ward', color: 'bg-amber-500', capacity: 20 },
  ENDOSCOPY: { label: 'Endoscopy Unit', color: 'bg-teal-600', capacity: 10 }
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
  'Dr. Shakeel', 'Dr. Zohaib', 'Dr. Shariq', 'Dr. Khem chand', 'Dr. Saima Kashif',
  'Dr. Zafar Zaidi'
];

export const ENDOSCOPY_DOCTORS = [
  'Dr. Shahid Majid', 'Dr. Mohammad Fahad', 'Dr. Aneel Kumar'
];

export const ENDOSCOPY_PROCEDURES = [
  'Esophagogastroduodenoscopy (EGD)', 'Colonoscopy', 'Flexible Sigmoidoscopy', 'Sigmoidoscopy', 'ERCP', 'Band Ligation', 'Endoscopy+Band ligation', 'Endoscopy+Biopsy', 'Flexible Bronchoscopy'
];

export const CATEGORIES: string[] = ['Medicine', 'Surgery', 'Urology', 'Nephrology', 'Cardiology', 'Others'];
export const LOCATIONS: string[] = ['OT', 'WARD', 'ICU', 'ER', 'Pvt Ward'];
export const CODE_STATUSES: any[] = ['Full Code', 'DNR', 'DNI'];
export const TRIAGE_PRIORITIES = ['Critical', 'Urgent', 'Stable'];

export const SHIFT_TO_OPTIONS: string[] = [
  'In-Unit (Active)',
  'DC',
  'Shift to Ward',
  'Shift to ICU',
  'Shift to OT',
  'Shift to Pvt Ward',
  'Shift to Transplant Bay',
  'Shift to Emergency (ER)',
  'Shift to Other Hospital',
  'LAMA (Left Against Medical Advice)',
  'Expired / Deceased'
];

export const TRANSFER_DISCHARGE_STATUSES: string[] = SHIFT_TO_OPTIONS;

export const TRANSFER_DISCHARGE_COLORS: Record<string, string> = {
  'Active (In-Unit)': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'In-Unit (Active)': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'DC': 'bg-blue-50 text-blue-700 border-blue-200',
  'Discharged (DC)': 'bg-blue-50 text-blue-700 border-blue-200',
  'Discharge Home': 'bg-blue-50 text-blue-700 border-blue-200',
  'Discharged': 'bg-blue-50 text-blue-700 border-blue-200',
  'Ward Transfer': 'bg-pink-50 text-pink-700 border-pink-200',
  'Shift to Ward': 'bg-pink-50 text-pink-700 border-pink-200',
  'ICU Transfer': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Shift to ICU': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'OT Transfer': 'bg-amber-50 text-amber-700 border-amber-200',
  'Shift to OT': 'bg-amber-50 text-amber-700 border-amber-200',
  'Pvt Ward Transfer': 'bg-purple-50 text-purple-700 border-purple-200',
  'Shift to Pvt Ward': 'bg-purple-50 text-purple-700 border-purple-200',
  'Transplant Bay Transfer': 'bg-teal-50 text-teal-700 border-teal-200',
  'Shift to Transplant Bay': 'bg-teal-50 text-teal-700 border-teal-200',
  'Emergency (ER) Transfer': 'bg-orange-50 text-orange-700 border-orange-200',
  'Shift to Emergency (ER)': 'bg-orange-50 text-orange-700 border-orange-200',
  'Other Hospital Transfer': 'bg-sky-50 text-sky-700 border-sky-200',
  'Shift to Other Hospital': 'bg-sky-50 text-sky-700 border-sky-200',
  'LAMA': 'bg-yellow-50 text-yellow-800 border-yellow-200',
  'LAMA (Left Against Medical Advice)': 'bg-yellow-50 text-yellow-800 border-yellow-200',
  'Mortality': 'bg-rose-50 text-rose-800 border-rose-200',
  'Expired / Deceased': 'bg-rose-50 text-rose-800 border-rose-200',
};

export const SHIFT_TO_COLORS = TRANSFER_DISCHARGE_COLORS;

export const TRIAGE_COLORS: Record<string, string> = {
  Critical: 'bg-red-100 text-red-800 border-red-200 font-bold',
  Urgent: 'bg-amber-100 text-amber-800 border-amber-200 font-medium',
  Stable: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

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

export const formatProcedureDisplay = (proc: string | undefined | null): string => {
  if (!proc) return 'Unspecified';
  const trimmed = proc.trim();
  const upper = trimmed.toUpperCase();
  if (upper === 'EGD' || upper === 'ESOPHAGOGASTRODUODENOSCOPY (EGD)' || upper === 'ESOPHAGOGASTRODUODENOSCOPY') {
    return 'Esophagogastroduodenoscopy (EGD)';
  }
  if (upper === 'BRONCHOSCOPY' || upper === 'FLEXIBLE BRONCHOSCOPY') {
    return 'Flexible Bronchoscopy';
  }
  return trimmed;
};
