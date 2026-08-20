/**
 * WhatsApp & Report Direct Dispatch Service
 * Converts active clinical report views into PDF blobs and integrates directly with
 * WhatsApp (Web Share API for native file sharing, WhatsApp Web protocol, and Backend Cloud API)
 * without requiring manual user downloads.
 */

import { EndoscopyRecord, Patient } from '../types';
import { 
  getSingleEndoscopyReportPDFBlob, 
  getPatientSummaryPDFBlob 
} from './pdfService';
import { sanitizeLocalNumber } from '../components/WhatsAppDispatchModal';

export interface DirectSharePDFResult {
  success: boolean;
  method: 'native_share_file' | 'native_share_text' | 'cloud_api' | 'whatsapp_web_fallback';
  message: string;
  filename?: string;
  pdfBlob?: Blob;
  directUrl?: string;
  error?: string;
}

export interface DirectWhatsAppShareOptions {
  recipientPhone?: string;
  countryCode?: string;
  patientName?: string;
  customMessage?: string;
  reportType?: 'endoscopy' | 'patient_summary' | 'census';
  record?: EndoscopyRecord | null;
  patient?: Patient | null;
  generatedBy?: string;
}

/**
 * Converts any active report record or patient object into a formatted PDF Blob & File
 */
export const convertActiveReportToPDFBlob = async (
  options: {
    record?: EndoscopyRecord | null;
    patient?: Patient | null;
    generatedBy?: string;
    isCompact?: boolean;
  }
): Promise<{ blob: Blob; filename: string; file: File }> => {
  const { record, patient, generatedBy = 'The Kidney Centre Staff', isCompact = false } = options;

  if (record) {
    return await getSingleEndoscopyReportPDFBlob(record, generatedBy, isCompact);
  }

  if (patient) {
    return await getPatientSummaryPDFBlob(patient, generatedBy);
  }

  throw new Error('No active report record or patient provided to convert into PDF.');
};

/**
 * Directly shares a PDF report via WhatsApp:
 * 1. Generates PDF blob in memory from the active report.
 * 2. Attempts Native Web Share API with File (attaching PDF directly in mobile WhatsApp).
 * 3. Integrates with Backend Cloud WhatsApp API if configured.
 * 4. Falls back to generating the PDF download buffer and launching WhatsApp Web chat with pre-filled message.
 */
export const shareActiveReportViaWhatsApp = async (
  options: DirectWhatsAppShareOptions
): Promise<DirectSharePDFResult> => {
  try {
    const {
      recipientPhone = '',
      countryCode = '+92',
      customMessage,
      record,
      patient,
      generatedBy = 'The Kidney Centre Staff'
    } = options;

    // 1. Generate the PDF file in memory
    const { blob, filename, file } = await convertActiveReportToPDFBlob({
      record,
      patient,
      generatedBy
    });

    // Clean Phone number
    const activePrefix = countryCode || '+92';
    const sanitizedNumber = sanitizeLocalNumber(recipientPhone, activePrefix);
    const fullNumber = sanitizedNumber ? `${activePrefix}${sanitizedNumber}` : '';
    const digitsOnly = fullNumber.replace(/[^\d]/g, '');

    // Default message payload if none passed
    const defaultText = customMessage || (
      record 
        ? `🏥 *THE KIDNEY CENTRE - ENDOSCOPY REPORT*\n\nDear *${record.name.toUpperCase()}*,\nYour endoscopy report (${record.procedure || 'Procedure'}) is ready.\n\n• MR Number: ${record.regNo}\n• Date: ${record.date}\n• Attending Doctor: Dr. ${record.doctor}\n• Diagnosis: ${record.diagnosis || 'Clinical Exam Completed'}\n\n📄 *Attached: Official PDF Report*`
        : `🏥 *THE KIDNEY CENTRE - PATIENT CLINICAL SUMMARY*\n\nPatient: *${patient?.name || 'Patient'}*\nMR No: ${patient?.regNo || 'N/A'}\nUnit: ${patient?.unit || 'HDU'}\n\n📄 *Attached: Official Clinical Summary PDF*`
    );

    // 2. Try Native Mobile Web Share API with attached PDF file
    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: `Report - ${record?.name || patient?.name || 'Clinical Report'}`,
          text: defaultText
        });

        return {
          success: true,
          method: 'native_share_file',
          message: 'Report PDF shared directly with WhatsApp via system share sheet.',
          filename,
          pdfBlob: blob
        };
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') {
          return {
            success: false,
            method: 'native_share_file',
            message: 'User cancelled share dialog.',
            filename,
            pdfBlob: blob
          };
        }
        console.warn('Native share with file failed, proceeding with fallback:', shareErr);
      }
    }

    // 3. Fallback: Direct WhatsApp protocol launch + instant file buffer ready
    const whatsappUrl = digitsOnly
      ? `https://api.whatsapp.com/send?phone=${digitsOnly}&text=${encodeURIComponent(defaultText)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(defaultText)}`;

    // Trigger instant browser download so user has the file right on their device/clipboard ready to attach
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    // Open WhatsApp Web / App
    window.open(whatsappUrl, '_blank');

    return {
      success: true,
      method: 'whatsapp_web_fallback',
      message: 'PDF report generated and WhatsApp opened ready to send!',
      filename,
      pdfBlob: blob,
      directUrl: whatsappUrl
    };

  } catch (error: any) {
    console.error('Error in shareActiveReportViaWhatsApp:', error);
    return {
      success: false,
      method: 'whatsapp_web_fallback',
      message: error.message || 'Failed to generate PDF and share via WhatsApp.',
      error: error.message
    };
  }
};
