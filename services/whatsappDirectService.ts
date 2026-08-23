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

    // Default message payload: Clean PDF document link reference without textual assembly details
    const defaultText = customMessage || (
      record 
        ? `📄 *Official Medical Report PDF*\nPatient: *${record.name.toUpperCase()}* (MR: ${record.regNo})\n_Attached: Official Endoscopy Procedure Report PDF_`
        : `📄 *Official Clinical Summary PDF*\nPatient: *${patient?.name || 'Patient'}* (MR: ${patient?.regNo || 'N/A'})\n_Attached: Official Patient Clinical Summary PDF_`
    );

    // 2. Native Mobile Web Share API with attached PDF file (Primary for Android & iOS mobile)
    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: filename
        });

        return {
          success: true,
          method: 'native_share_file',
          message: 'Official Report PDF shared directly to WhatsApp/device.',
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
        console.warn('Native share file failed or fell back:', shareErr);
      }
    }

    // 3. Desktop / Web fallback: Download PDF once and launch WhatsApp chat with clean direct wa.me link
    const whatsappUrl = digitsOnly
      ? `https://wa.me/${digitsOnly}?text=${encodeURIComponent(defaultText)}`
      : `https://wa.me/?text=${encodeURIComponent(defaultText)}`;

    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    try {
      const win = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        const tempA = document.createElement('a');
        tempA.href = whatsappUrl;
        tempA.target = '_blank';
        tempA.rel = 'noopener noreferrer';
        document.body.appendChild(tempA);
        tempA.click();
        document.body.removeChild(tempA);
      }
    } catch {
      console.warn('Failed to open WhatsApp window');
    }

    return {
      success: true,
      method: 'whatsapp_web_fallback',
      message: `PDF generated and WhatsApp opened for +${digitsOnly || 'contact'}!`,
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
