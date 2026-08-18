import { Patient, EndoscopyRecord } from '../types';

export type TemplateCategory = 'patient_summary' | 'physician_handover' | 'discharge_notice' | 'critical_alert' | 'endoscopy_report' | 'custom';

export interface TemplatePlaceholder {
  key: string;
  label: string;
  description: string;
  example: string;
  category: 'patient' | 'clinical' | 'facility' | 'meta';
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  subjectTemplate?: string; // For Email Subject Line
  bodyTemplate: string;     // Multi-line message with placeholders
  isDefault?: boolean;
  isSystemDefault?: boolean;
  description?: string;
  lastModified: string;
}

export const TEMPLATE_PLACEHOLDERS: TemplatePlaceholder[] = [
  // Patient Demographics
  { key: '{{patientName}}', label: 'Patient Name', description: 'Full name of the patient', example: 'MUHAMMAD ALI', category: 'patient' },
  { key: '{{mrn}}', label: 'MR Number', description: 'Hospital registration / MRN', example: '458921', category: 'patient' },
  { key: '{{gender}}', label: 'Gender', description: 'Patient gender', example: 'Male', category: 'patient' },
  { key: '{{age}}', label: 'Age', description: 'Patient age if recorded', example: '58 Yrs', category: 'patient' },
  
  // Clinical & Location
  { key: '{{unit}}', label: 'Current Unit', description: 'Hospital ward or clinical unit', example: 'HDU', category: 'clinical' },
  { key: '{{bed}}', label: 'Bed / Location', description: 'Bed number or room location', example: 'Bed 04', category: 'clinical' },
  { key: '{{category}}', label: 'Specialty Category', description: 'Department specialty', example: 'Nephrology', category: 'clinical' },
  { key: '{{consultant}}', label: 'Attending Consultant', description: 'Primary doctor / consultant name', example: 'Dr. A. R. Siddiqui', category: 'clinical' },
  { key: '{{status}}', label: 'Inpatient Status', description: 'Active, Discharged, Deceased', example: 'Active (In-Unit)', category: 'clinical' },
  { key: '{{shiftTo}}', label: 'Shift / Transfer Destination', description: 'Ward, ICU, or Discharge disposition', example: 'Shift to Ward', category: 'clinical' },
  { key: '{{triagePriority}}', label: 'Triage Priority', description: 'Critical, Urgent, or Stable', example: 'Urgent', category: 'clinical' },
  { key: '{{codeStatus}}', label: 'Code Status', description: 'Full Code, DNR, DNI', example: 'Full Code', category: 'clinical' },
  { key: '{{lengthOfStay}}', label: 'Length of Stay (Days)', description: 'Total days since admission', example: '4 Days', category: 'clinical' },
  
  // Procedures & Findings (Endoscopy / Surgical)
  { key: '{{procedure}}', label: 'Procedure Name', description: 'Name of the procedure performed', example: 'Diagnostic Upper GI Endoscopy', category: 'clinical' },
  { key: '{{diagnosis}}', label: 'Clinical Diagnosis / Findings', description: 'Clinical findings or diagnosis', example: 'Erosive Gastritis with Grade I Esophageal Varices', category: 'clinical' },
  { key: '{{recommendations}}', label: 'Recommendations / Plan', description: 'Clinical plan & advice', example: 'Start PPI IV OD, repeat scope in 6 weeks.', category: 'clinical' },
  
  // Dates & Meta
  { key: '{{admissionDate}}', label: 'Admission Date', description: 'Date of admission', example: '12-Aug-2026', category: 'meta' },
  { key: '{{dischargeDate}}', label: 'Discharge Date', description: 'Date of discharge if applicable', example: '16-Aug-2026', category: 'meta' },
  { key: '{{date}}', label: 'Current / Event Date', description: 'Current date stamp', example: '16-Aug-2026', category: 'meta' },
  { key: '{{time}}', label: 'Current / Event Time', description: 'Current time stamp', example: '02:30 PM', category: 'meta' },
  { key: '{{generatedBy}}', label: 'Staff / Sender Name', description: 'Logged in user sending the summary', example: 'Dr. Farooq (RMO)', category: 'meta' },
  { key: '{{hospitalName}}', label: 'Hospital Name', description: 'Institution name', example: 'The Kidney Centre', category: 'facility' },
  { key: '{{portalUrl}}', label: 'Portal Link', description: 'Link to verification or portal', example: 'https://thekidneycentre.portal', category: 'facility' },
];

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tpl_std_summary',
    name: 'Standard Inpatient Clinical Summary',
    category: 'patient_summary',
    isDefault: true,
    isSystemDefault: true,
    description: 'Comprehensive clinical briefing including MRN, bed, consultant, triage level, and stay duration.',
    subjectTemplate: '🏥 Clinical Summary: {{patientName}} (MRN: {{mrn}}) - {{unit}}',
    bodyTemplate: `🏥 *{{hospitalName}} - CLINICAL INPATIENT SUMMARY*
----------------------------------------
👤 *Patient:* {{patientName}}
🔢 *MR Number:* {{mrn}}
🚻 *Gender:* {{gender}} | *LOS:* {{lengthOfStay}}
🏢 *Unit / Location:* {{unit}} - {{bed}}
🩺 *Specialty:* {{category}}

👨‍⚕️ *Attending Consultant:* {{consultant}}
🚨 *Triage Priority:* {{triagePriority}}
🛡️ *Code Status:* {{codeStatus}}
📋 *Current Status:* {{status}}
📍 *Shift / Disposition:* {{shiftTo}}

📅 *Admission Date:* {{admissionDate}}
🚪 *Discharge Date:* {{dischargeDate}}
⚠️ *Confidential Medical Summary*
Prepared by: {{generatedBy}} on {{date}} @ {{time}}
Access Medical Records: {{portalUrl}}`,
    lastModified: new Date().toISOString()
  },
  {
    id: 'tpl_physician_handover',
    name: 'Physician Shift & Handover Brief',
    category: 'physician_handover',
    isSystemDefault: true,
    description: 'Concise doctor-to-doctor clinical handover report focusing on acuity, consultant, and unit movement.',
    subjectTemplate: '🩺 Shift Handover: {{patientName}} [{{unit}} / {{bed}}]',
    bodyTemplate: `🩺 *PHYSICIAN CLINICAL HANDOVER BRIEF*
🏥 *{{hospitalName}} | Unit: {{unit}}*
----------------------------------------
• *Patient Name:* {{patientName}}
• *MR Number:* {{mrn}} ({{gender}})
• *Bed Assignment:* {{bed}}
• *Attending Consultant:* {{consultant}}
• *Triage Priority:* {{triagePriority}} ({{codeStatus}})
• *Clinical Status:* {{status}} -> {{shiftTo}}
• *Stay Duration:* {{lengthOfStay}}

📝 *Handover Notes / Follow-up Plan:*
Please monitor vital stability and confirm shift orders.

_Handover generated by {{generatedBy}} at {{time}} ({{date}})_`,
    lastModified: new Date().toISOString()
  },
  {
    id: 'tpl_discharge_notice',
    name: 'Discharge & Transfer Notification',
    category: 'discharge_notice',
    isSystemDefault: true,
    description: 'Formal patient movement and discharge memo for families, wards, or coordinating medical staff.',
    subjectTemplate: '📄 Patient Movement / Discharge Memo: {{patientName}} (MRN: {{mrn}})',
    bodyTemplate: `📄 *PATIENT DISCHARGE & TRANSFER MEMO*
🏥 *{{hospitalName}} Medical Records*
----------------------------------------
Dear Medical Staff / Attendant,

This is to confirm the clinical movement status for:
• *Patient:* {{patientName}}
• *MR Number:* {{mrn}}
• *Discharged From:* {{unit}} ({{bed}})
• *Primary Consultant:* {{consultant}}
• *Disposition / Destination:* {{shiftTo}}
• *Discharge / Shift Date:* {{dischargeDate}}

For verification or further inquiries, please consult The Kidney Centre nursing administration.
Portal: {{portalUrl}}`,
    lastModified: new Date().toISOString()
  },
  {
    id: 'tpl_endoscopy_report',
    name: 'Endoscopy Procedure Findings & Advice',
    category: 'endoscopy_report',
    isDefault: true,
    isSystemDefault: true,
    description: 'Complete endoscopy procedure summary with endoscopist, diagnosis, and recommendations.',
    subjectTemplate: '🔬 Endoscopy Report: {{patientName}} (MRN: {{mrn}}) - {{procedure}}',
    bodyTemplate: `🔬 *{{hospitalName}} - ENDOSCOPY PROCEDURE REPORT*
----------------------------------------
👤 *Patient:* {{patientName}}
🔢 *MR Number:* {{mrn}}
📅 *Date of Procedure:* {{date}} {{time}}
👨‍⚕️ *Endoscopist:* Dr. {{consultant}}
🔬 *Procedure:* {{procedure}}

📋 *Clinical Diagnosis / Findings:*
{{diagnosis}}

💊 *Post-Procedure Recommendations & Plan:*
{{recommendations}}

_Official clinical report issued by {{hospitalName}} Gastro/Endoscopy Suite._
_Verified by {{generatedBy}} on {{date}}_`,
    lastModified: new Date().toISOString()
  },
  {
    id: 'tpl_critical_alert',
    name: '🚨 Urgent Critical Patient Alert',
    category: 'critical_alert',
    isSystemDefault: true,
    description: 'High-visibility alert template for critical status patients needing immediate consultant attention.',
    subjectTemplate: '🚨 URGENT CLINICAL ALERT: {{patientName}} [{{unit}} - {{bed}}]',
    bodyTemplate: `🚨 *URGENT CLINICAL PRIORITY ALERT*
🏥 *{{hospitalName}} - {{unit}} Emergency Dispatch*
----------------------------------------
⚠️ *ATTENTION ON-CALL CONSULTANT / ICU TEAM*

• *Patient:* {{patientName}}
• *MRN:* {{mrn}} | *Location:* {{unit}} ({{bed}})
• *Triage Priority:* 🔴 {{triagePriority}}
• *Code Status:* {{codeStatus}}
• *Consultant in Charge:* {{consultant}}
• *Current Movement:* {{shiftTo}}

Immediate assessment requested.
Dispatched by {{generatedBy}} at {{time}} ({{date}}).`,
    lastModified: new Date().toISOString()
  },
  {
    id: 'tpl_brief_sms',
    name: 'Brief Mobile SMS / WhatsApp Notice',
    category: 'patient_summary',
    isSystemDefault: true,
    description: 'Ultra-compact single message format optimized for quick WhatsApp or SMS messaging.',
    subjectTemplate: 'Notice: {{patientName}} (MRN: {{mrn}})',
    bodyTemplate: `🏥 *{{hospitalName}} Inpatient Update*
Patient: {{patientName}} (MRN: {{mrn}})
Unit: {{unit}} ({{bed}}) | Dr: {{consultant}}
Status: {{status}} [{{shiftTo}}]
Triage: {{triagePriority}} | Code: {{codeStatus}}
Time: {{date}} {{time}} - By {{generatedBy}}`,
    lastModified: new Date().toISOString()
  }
];

const STORAGE_KEY = 'medilog_custom_message_templates_v1';

export interface TemplateRenderContext {
  patient?: Partial<Patient>;
  endoscopy?: Partial<EndoscopyRecord>;
  generatedBy?: string;
  customData?: Record<string, string>;
}

export const messageTemplateService = {
  // Retrieve all configured templates
  getTemplates: (): MessageTemplate[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as MessageTemplate[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with any new default templates that might have been added
          const existingIds = new Set(parsed.map(t => t.id));
          const missingDefaults = DEFAULT_MESSAGE_TEMPLATES.filter(d => !existingIds.has(d.id));
          return [...parsed, ...missingDefaults];
        }
      }
    } catch (e) {
      console.warn('Failed to load message templates from localStorage:', e);
    }
    return DEFAULT_MESSAGE_TEMPLATES;
  },

  // Save full template collection
  saveTemplates: (templates: MessageTemplate[]): void => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('medilog_message_templates_updated', { detail: templates }));
      }
    } catch (e) {
      console.error('Failed to save message templates:', e);
    }
  },

  // Add or update single template
  upsertTemplate: (template: Omit<MessageTemplate, 'lastModified'> & { id?: string }): MessageTemplate => {
    const templates = messageTemplateService.getTemplates();
    const now = new Date().toISOString();
    
    let savedTemplate: MessageTemplate;
    if (template.id) {
      const index = templates.findIndex(t => t.id === template.id);
      if (index >= 0) {
        savedTemplate = {
          ...templates[index],
          ...template,
          lastModified: now
        } as MessageTemplate;
        templates[index] = savedTemplate;
      } else {
        savedTemplate = {
          ...template,
          id: template.id,
          lastModified: now
        } as MessageTemplate;
        templates.push(savedTemplate);
      }
    } else {
      savedTemplate = {
        ...template,
        id: `tpl_custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        lastModified: now
      } as MessageTemplate;
      templates.push(savedTemplate);
    }

    messageTemplateService.saveTemplates(templates);
    return savedTemplate;
  },

  // Delete a template (or restore to system template if it's default)
  deleteTemplate: (id: string): void => {
    const templates = messageTemplateService.getTemplates();
    const target = templates.find(t => t.id === id);
    if (!target) return;

    if (target.isSystemDefault) {
      // If deleting a modified system default, reset it back to original
      const original = DEFAULT_MESSAGE_TEMPLATES.find(d => d.id === id);
      if (original) {
        const updated = templates.map(t => t.id === id ? { ...original, lastModified: new Date().toISOString() } : t);
        messageTemplateService.saveTemplates(updated);
        return;
      }
    }

    const filtered = templates.filter(t => t.id !== id);
    messageTemplateService.saveTemplates(filtered);
  },

  // Set a template as default for its category
  setDefaultTemplate: (id: string, category: TemplateCategory): void => {
    const templates = messageTemplateService.getTemplates();
    const updated = templates.map(t => {
      if (t.category === category) {
        return { ...t, isDefault: t.id === id };
      }
      return t;
    });
    messageTemplateService.saveTemplates(updated);
  },

  // Reset all templates to default library
  resetToDefaults: (): MessageTemplate[] => {
    messageTemplateService.saveTemplates(DEFAULT_MESSAGE_TEMPLATES);
    return DEFAULT_MESSAGE_TEMPLATES;
  },

  // Export templates as JSON string
  exportTemplatesJSON: (): string => {
    const templates = messageTemplateService.getTemplates();
    return JSON.stringify(templates, null, 2);
  },

  // Import templates from JSON
  importTemplatesJSON: (jsonString: string): { success: boolean; count: number; error?: string } => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) {
        return { success: false, count: 0, error: 'Uploaded file does not contain a valid templates array.' };
      }
      
      const validated: MessageTemplate[] = parsed.map((item, idx) => ({
        id: item.id || `tpl_imported_${Date.now()}_${idx}`,
        name: item.name || `Imported Template ${idx + 1}`,
        category: item.category || 'custom',
        subjectTemplate: item.subjectTemplate || '',
        bodyTemplate: item.bodyTemplate || '',
        isDefault: !!item.isDefault,
        isSystemDefault: false,
        description: item.description || '',
        lastModified: new Date().toISOString()
      }));

      messageTemplateService.saveTemplates(validated);
      return { success: true, count: validated.length };
    } catch (e: any) {
      return { success: false, count: 0, error: e.message || 'Invalid JSON format' };
    }
  },

  // Substitute all placeholders safely with context data
  renderTemplate: (
    templateText: string,
    context: TemplateRenderContext
  ): string => {
    if (!templateText) return '';

    const p = context.patient || {};
    const e = context.endoscopy || {};
    const custom = context.customData || {};
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://thekidneycentre.portal';

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeFormatted = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const patientName = (p.name || e.name || custom.patientName || 'PATIENT').toUpperCase();
    const mrn = p.regNo || e.regNo || custom.mrn || 'N/A';
    const gender = p.gender || (e as any)?.gender || custom.gender || 'Unspecified';
    const age = (e as any)?.age || custom.age || (p as any)?.age || 'N/A';
    const unit = p.unit || e.referringUnit || custom.unit || 'HDU';
    const bed = p.location || custom.bed || 'Bed N/A';
    const category = p.category || custom.category || 'General Clinical';
    const consultant = p.consultant || e.doctor || custom.consultant || 'Attending Physician';
    const status = p.status || (p.dischargeDate ? 'Discharged' : 'Active (In-Unit)') || custom.status || 'Active';
    const shiftTo = p.shiftTo || p.transferStatus || custom.shiftTo || 'In-Unit (Active)';
    const triagePriority = p.triagePriority || custom.triagePriority || 'Stable';
    const codeStatus = p.codeStatus || custom.codeStatus || 'Full Code';
    const lengthOfStay = p.lengthOfStay !== undefined ? `${p.lengthOfStay} Day(s)` : (custom.lengthOfStay || '1 Day');
    
    // Procedure & Endoscopy
    const procedure = e.procedure || custom.procedure || 'Diagnostic Clinical Exam';
    const diagnosis = e.diagnosis || custom.diagnosis || 'Clinical evaluation in progress';
    const recommendations = e.recommendations || custom.recommendations || 'Follow up with attending clinician.';
    
    const admissionDate = p.admissionDate ? new Date(p.admissionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : (custom.admissionDate || dateFormatted);
    const dischargeDate = p.dischargeDate ? new Date(p.dischargeDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : (custom.dischargeDate || '');
    const generatedBy = context.generatedBy || custom.generatedBy || 'Medical Staff';
    const hospitalName = custom.hospitalName || 'The Kidney Centre';
    const portalUrl = custom.portalUrl || origin;

    let result = templateText;

    const replacements: Record<string, string> = {
      '{{patientName}}': patientName,
      '{{mrn}}': mrn,
      '{{regNo}}': mrn,
      '{{gender}}': gender,
      '{{age}}': age,
      '{{unit}}': unit,
      '{{bed}}': bed,
      '{{location}}': bed,
      '{{category}}': category,
      '{{consultant}}': consultant,
      '{{doctor}}': consultant,
      '{{status}}': status,
      '{{shiftTo}}': shiftTo,
      '{{triagePriority}}': triagePriority,
      '{{codeStatus}}': codeStatus,
      '{{lengthOfStay}}': lengthOfStay,
      '{{procedure}}': procedure,
      '{{diagnosis}}': diagnosis,
      '{{recommendations}}': recommendations,
      '{{admissionDate}}': admissionDate,
      '{{dischargeDate}}': dischargeDate,
      '{{date}}': dateFormatted,
      '{{time}}': timeFormatted,
      '{{generatedBy}}': generatedBy,
      '{{hospitalName}}': hospitalName,
      '{{portalUrl}}': portalUrl,
    };

    Object.entries(replacements).forEach(([key, val]) => {
      // Escape for regex
      const escapedKey = key.replace(/[{}]/g, '\\$&');
      result = result.replace(new RegExp(escapedKey, 'g'), val);
    });

    return result;
  }
};
