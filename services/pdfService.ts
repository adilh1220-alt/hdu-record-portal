
import { Patient, InventoryItem, EndoscopyRecord, IncidentRecord } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportMetadata {
  generatedBy: string;
  filters: string;
  period?: string;
}

const calculateLOSValue = (admissionDate: string) => {
  const start = new Date(admissionDate);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - start.getTime();
  const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  return diffDays;
};

export const generateKidneyCentreLogoBase64 = (): string => {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  // High-DPI 2x resolution: 500x210 nominal layout scaled to 1000x420 physical pixels
  canvas.width = 1000;
  canvas.height = 420;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer black border (2x stroke weight)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 8;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(20, 20, 960, 380, 16);
    ctx.stroke();
  } else {
    ctx.strokeRect(20, 20, 960, 380);
  }

  // Red square
  ctx.fillStyle = '#E02424'; // Red
  ctx.fillRect(50, 40, 110, 110);

  // Draw white outer kidney shape (scaled 2x)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(104, 52);
  ctx.bezierCurveTo(72, 52, 64, 80, 64, 104);
  ctx.bezierCurveTo(64, 128, 88, 140, 112, 136);
  ctx.bezierCurveTo(136, 132, 144, 108, 132, 88);
  ctx.bezierCurveTo(124, 76, 108, 92, 100, 88);
  ctx.bezierCurveTo(92, 84, 120, 52, 104, 52);
  ctx.fill();

  // Draw inner red kidney (scaled 2x)
  ctx.fillStyle = '#E02424';
  ctx.beginPath();
  ctx.moveTo(104, 64);
  ctx.bezierCurveTo(80, 64, 76, 84, 76, 100);
  ctx.bezierCurveTo(76, 116, 92, 126, 108, 122);
  ctx.bezierCurveTo(124, 118, 128, 102, 120, 88);
  ctx.bezierCurveTo(114, 80, 104, 90, 100, 86);
  ctx.bezierCurveTo(96, 82, 112, 64, 104, 64);
  ctx.fill();

  // Draw innermost white kidney (scaled 2x)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(104, 76);
  ctx.bezierCurveTo(88, 76, 84, 88, 84, 98);
  ctx.bezierCurveTo(84, 108, 96, 114, 104, 112);
  ctx.bezierCurveTo(112, 110, 116, 100, 112, 92);
  ctx.bezierCurveTo(108, 86, 102, 90, 100, 88);
  ctx.bezierCurveTo(98, 86, 108, 76, 104, 76);
  ctx.fill();

  // Draw "THE KIDNEY CENTRE" stacked English text
  ctx.fillStyle = '#000000';
  ctx.font = '900 48px "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText('THE', 180, 40);
  ctx.fillText('KIDNEY', 180, 82);
  ctx.fillText('CENTRE', 180, 124);


  // Horizontal line separator
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(20, 176);
  ctx.lineTo(980, 176);
  ctx.stroke();

  // "POST GRADUATE TRAINING INSTITUTE" text
  ctx.font = 'bold 22px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.fillText('POST GRADUATE TRAINING INSTITUTE', 500, 186);

  // Urdu Calligraphy text
  ctx.font = 'bold 44px "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", "Urdu Typesetting", Arial, sans-serif';
  ctx.fillText('دی کڈنی سینٹر', 500, 220);

  ctx.font = 'bold 26px "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", "Urdu Typesetting", Arial, sans-serif';
  ctx.fillText('پوسٹ گریجویٹ ٹریننگ انسٹیٹیوٹ', 500, 276);

  // Address and Contact separator
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, 316);
  ctx.lineTo(950, 316);
  ctx.stroke();

  // Address
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 20px Arial, Helvetica, sans-serif';
  ctx.fillText('197/9, Rafiqui Shaheed Road, Karachi-75530', 500, 330);

  // Contacts
  ctx.font = 'normal 19px Arial, Helvetica, sans-serif';
  ctx.fillText('Phone: PABX 3566-1000 (10 Lines)   |   Mob: 0347-5661000, 0302-8271166', 500, 362);

  return canvas.toDataURL('image/png');
};

export const exportToPDF = (title: string, headers: string[], rows: any[][], metadata: ReportMetadata) => {
  const doc = new jsPDF('landscape'); 
  
  // Hospital Branding Header
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.setFont('helvetica', 'bold');
  doc.text("THE KIDNEY CENTRE POST GRADUATE TRAINING INSTITUTE", 14, 13);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.text("197/9, Rafiqui Shaheed Road, Karachi-75530   |   PABX: 3566-1000 (10 Lines)   |   Mob: 0347-5661000, 0302-8271166", 14, 18);

  // Divide line
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.line(14, 23, 282, 23);

  // Report Title & Metadata
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 32);
  

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); 
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated By: ${metadata.generatedBy}`, 14, 39);
  doc.text(`Timestamp: ${new Date().toLocaleString()}`, 14, 44);
  doc.text(`Active Filters: ${metadata.filters}`, 14, 49);
  if (metadata.period) {
    doc.text(`Report Period: ${metadata.period}`, 14, 54);
  }

  const tableStartY = metadata.period ? 62 : 57;

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: tableStartY,
    styles: { fontSize: 7, font: 'helvetica', cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 20 },
    didDrawPage: function (data: any) {
      const str = "Page " + doc.getNumberOfPages();
      doc.setFontSize(8);
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height ? pageSize.height : (pageSize as any).getHeight();
      doc.setTextColor(148, 163, 184); 
      doc.text(str, data.settings.margin.left, pageHeight - 10);
      doc.text("Official HDU Internal Report - Unauthorized reproduction is strictly prohibited", 180, pageHeight - 10);
    }
  });

  // Summary Section
  const finalY = (doc as any).lastAutoTable.finalY || tableStartY + 20;
  const pageHeight = doc.internal.pageSize.height;
  
  // Check if we need a new page for the summary
  if (finalY + 40 > pageHeight) {
    doc.addPage();
    doc.setPage(doc.getNumberOfPages());
  }

  const summaryY = (finalY + 40 > pageHeight) ? 20 : finalY + 15;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, summaryY, 268, 25, 3, 3, 'F');
  doc.roundedRect(14, summaryY, 268, 25, 3, 3, 'S');

  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text("REPORT SUMMARY", 20, summaryY + 10);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Total Records Processed: ${rows.length}`, 20, summaryY + 18);
  

  doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}_${new Date().getTime()}.pdf`);
};

export const exportAccessSlipPDF = (userData: { name: string; email: string; password?: string; role: string }) => {
  const doc = new jsPDF();
  
  // Header Box
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text("HDU MANAGEMENT SYSTEM", 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text("STAFF ACCESS CREDENTIALS SLIP", 105, 30, { align: 'center' });

  // Border Around Content
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(20, 50, 170, 100, 3, 3, 'S');

  // Body Content
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  
  const startX = 30;
  let currentY = 70;

  const addField = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, startX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(value, startX + 50, currentY);
    currentY += 15;
  };

  addField("Staff Name", userData.name.toUpperCase());
  addField("Email Address", userData.email);
  addField("Access Level", userData.role.toUpperCase());
  addField("Temp Password", userData.password || "******** (Previously Set)");

  // Footer Instructions
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  const footerText = "Thank you for joining us! You can now use the portal to manage clinical records. Please change your password after your first login.";
  const splitText = doc.splitTextToSize(footerText, 150);
  doc.text(splitText, 105, 130, { align: 'center' });

  // System Metadata
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Issued On: ${new Date().toLocaleString()}`, 30, 145);
  doc.text("Internal Use Only - Confidential Clinical Tool", 105, 160, { align: 'center' });

  doc.save(`access_slip_${userData.name.toLowerCase().replace(/\s+/g, '_')}.pdf`);
};

export const exportPatientsPDF = (patients: Patient[], metadata: ReportMetadata) => {
  const headers = ['Reg No', 'Patient Name', 'Gender', 'Category', 'Triage', 'Location', 'Code', 'Consultant', 'In-Date', 'Out-Date', 'LOS'];
  const rows = patients.map(p => [
    p.regNo, 
    p.name, 
    p.gender,
    p.category, 
    p.triagePriority || 'Stable',
    p.location || 'N/A',
    p.codeStatus, 
    p.consultant, 
    p.admissionDate,
    p.dischargeDate || 'N/A',
    p.lengthOfStay
  ]);
  exportToPDF("Clinical Patient Record", headers, rows, metadata);
};

export const exportInventoryPDF = (inventory: InventoryItem[], metadata: ReportMetadata) => {
  const headers = ['Item Name', 'Category', 'Stock', 'Min', 'Unit', 'Last Updated'];
  // Fix: Changed i.unit to i.measurementUnit to match updated InventoryItem interface
  const rows = inventory.map(i => [i.name, i.category, i.quantity, i.minThreshold, i.measurementUnit, i.lastUpdated]);
  exportToPDF("Inventory Audit Report", headers, rows, metadata);
};

export const exportEndoscopyPDF = (records: EndoscopyRecord[], metadata: ReportMetadata) => {
  const headers = ['Reg No', 'Patient Name', 'Doctor', 'Procedure', 'Date'];
  const rows = records.map(r => [
    r.regNo,
    r.name,
    r.doctor,
    r.procedure,
    r.date
  ]);
  exportToPDF("Endoscopy Procedure Log", headers, rows, metadata);
};

export const exportIncidentsPDF = (incidents: IncidentRecord[], metadata: ReportMetadata) => {
  const headers = ['Date', 'Patient Name', 'Reg No', 'Category', 'Unit', 'Reported By', 'Description'];
  const rows = incidents.map(i => [
    i.incidentDate,
    i.patientName,
    i.regNo,
    i.category,
    i.unit,
    i.reportedBy,
    i.description ? i.description.replace(/<[^>]*>/g, '') : 'N/A'
  ]);
  exportToPDF("Clinical Incident Report", headers, rows, metadata);
};

export const exportPatientSummaryPDF = (patient: Patient, generatedBy: string) => {
  const doc = new jsPDF();
  
  // Header Block
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, 210, 42, 'F');
  
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text("THE KIDNEY CENTRE POST GRADUATE TRAINING INSTITUTE", 105, 12, { align: 'center' });
  
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(239, 68, 68); // Red-500 accent for clinical title
  doc.text("HIGH DEPENDENCY UNIT (HDU) - CLINICAL SUMMARY", 105, 18, { align: 'center' });
  
  // Address & Contacts
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(186, 200, 218); // Soft slate color
  doc.text("197/9, Rafiqui Shaheed Road, Karachi-75530   |   PABX: 3566-1000 (10 Lines)", 105, 24, { align: 'center' });
  doc.text("Mob: 0347-5661000, 0302-8271166   |   Official Internal Medical Ledger", 105, 29, { align: 'center' });

  // Timestamp
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text(`Generated On: ${new Date().toLocaleString()}  |  By: ${generatedBy.toUpperCase()}`, 105, 35, { align: 'center' });

  // 1. Patient Demographics & Profile Panel
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.roundedRect(14, 48, 182, 54, 3, 3, 'FD');

  doc.setTextColor(30, 41, 59); // Slate-800
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text("PATIENT DEMOGRAPHICS", 20, 56);
  
  // Horizontal separator line inside the box
  doc.setDrawColor(241, 245, 249);
  doc.line(14, 60, 196, 60);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105); // Slate-600
  
  // Demographics Grid
  const gridY1 = 66;
  const gridY2 = 74;
  const gridY3 = 82;
  const gridY4 = 90;

  // Row 1
  doc.setFont('helvetica', 'bold'); doc.text("Full Name:", 20, gridY1);
  doc.setFont('helvetica', 'normal'); doc.text(patient.name.toUpperCase(), 50, gridY1);
  doc.setFont('helvetica', 'bold'); doc.text("MR Number:", 110, gridY1);
  doc.setFont('helvetica', 'normal'); doc.text(patient.regNo, 145, gridY1);

  // Row 2
  doc.setFont('helvetica', 'bold'); doc.text("Patient Gender:", 20, gridY2);
  doc.setFont('helvetica', 'normal'); doc.text(patient.gender || 'N/A', 50, gridY2);
  doc.setFont('helvetica', 'bold'); doc.text("Clinical Unit:", 110, gridY2);
  doc.setFont('helvetica', 'normal'); doc.text(`${patient.unit} (Current)`, 145, gridY2);

  // Row 3
  doc.setFont('helvetica', 'bold'); doc.text("Location / Bed:", 20, gridY3);
  doc.setFont('helvetica', 'normal'); doc.text(patient.location || 'N/A', 50, gridY3);
  doc.setFont('helvetica', 'bold'); doc.text("Category:", 110, gridY3);
  doc.setFont('helvetica', 'normal'); doc.text(patient.category || 'N/A', 145, gridY3);

  // Row 4
  doc.setFont('helvetica', 'bold'); doc.text("Code Status:", 20, gridY4);
  doc.setFont('helvetica', 'bold');
  if (patient.codeStatus === 'Full Code') {
    doc.setTextColor(22, 163, 74); // Green
  } else {
    doc.setTextColor(220, 38, 38); // Red
  }
  doc.text(patient.codeStatus || 'Full Code', 50, gridY4);
  
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold'); doc.text("Triage Priority:", 110, gridY4);
  doc.setFont('helvetica', 'bold');
  if (patient.triagePriority === 'Critical') doc.setTextColor(220, 38, 38);
  else if (patient.triagePriority === 'Urgent') doc.setTextColor(217, 119, 6);
  else doc.setTextColor(30, 41, 59);
  doc.text(patient.triagePriority || 'Stable', 145, gridY4);

  // Reset colors
  doc.setTextColor(30, 41, 59);

  // 2. Admission Details Panel
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 108, 182, 34, 3, 3, 'FD');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text("ADMISSION DETAILS", 20, 116);
  doc.setDrawColor(241, 245, 249);
  doc.line(14, 120, 196, 120);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const admY1 = 126;
  const admY2 = 134;

  // Adm Row 1
  doc.setFont('helvetica', 'bold'); doc.text("Admitting Consultant:", 20, admY1);
  doc.setFont('helvetica', 'normal'); doc.text(patient.consultant, 60, admY1);
  doc.setFont('helvetica', 'bold'); doc.text("Admission Date:", 110, admY1);
  doc.setFont('helvetica', 'normal'); doc.text(new Date(patient.admissionDate).toLocaleDateString() + ' ' + new Date(patient.admissionDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 145, admY1);

  // Adm Row 2
  doc.setFont('helvetica', 'bold'); doc.text("Discharge Status:", 20, admY2);
  doc.setFont('helvetica', 'normal'); doc.text(patient.dischargeDate ? `Discharged on ${new Date(patient.dischargeDate).toLocaleDateString()}` : "Active Admission", 60, admY2);
  doc.setFont('helvetica', 'bold'); doc.text("Length of Stay:", 110, admY2);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38);
  doc.text(`${patient.lengthOfStay || 0} Days`, 145, admY2);

  // Reset colors
  doc.setTextColor(30, 41, 59);

  // 3. Clinical Transfer & Movement History
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text("CLINICAL MOVEMENT & TRANSFER LOG", 14, 152);

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 156, 196, 156);

  const logs = patient.transferHistory || [];
  
  if (logs.length === 0) {
    // Empty state card
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 162, 182, 22, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 162, 182, 22, 3, 3, 'S');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text("No unit or ward transfers recorded for this patient.", 105, 172, { align: 'center' });
    doc.setFontSize(8);
    doc.text(`Patient remained stable in original location (${patient.location || 'N/A'}) in unit ${patient.unit}.`, 105, 178, { align: 'center' });
  } else {
    // Generate Table of transfer history
    const tableHeaders = ['Timestamp', 'Transition', 'Location Change', 'Reason for Transfer', 'Staff ID'];
    const tableRows = logs.map(log => [
      new Date(log.timestamp).toLocaleString([], {month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'}),
      `${log.fromUnit} -> ${log.toUnit}`,
      `${log.fromLocation || 'N/A'} -> ${log.toLocation || 'N/A'}`,
      log.reason,
      log.performedBy
    ]);

    autoTable(doc, {
      head: [tableHeaders],
      body: tableRows,
      startY: 162,
      styles: { fontSize: 8, font: 'helvetica', cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 24, fontStyle: 'bold' },
        2: { cellWidth: 34 },
        3: { cellWidth: 62 },
        4: { cellWidth: 30 }
      },
      margin: { left: 14, right: 14 }
    });
  }

  // Clinical Sign-off Section (Bottom of Page)
  const pageHeight = doc.internal.pageSize.height;
  const signY = pageHeight - 38;

  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.line(14, signY, 74, signY);
  doc.line(136, signY, 196, signY);

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text("Medical Practitioner Signature", 44, signY + 5, { align: 'center' });
  doc.text("Witness / Co-signer Signature", 166, signY + 5, { align: 'center' });
  
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("CONFIDENTIAL CLINICAL DOCUMENT — FOR HEALTHCARE PROFESSIONAL USE ONLY", 105, pageHeight - 12, { align: 'center' });

  doc.save(`clinical_summary_${patient.regNo}_${new Date().getTime()}.pdf`);
};

const loadRemoteImageAsDataURL = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith('data:')) {
      img.crossOrigin = 'Anonymous';
    }
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Fill white background (useful for transparent source PNGs)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, img.width, img.height);

          // Standard radius (e.g. 5% of smaller dimension)
          const radius = Math.min(img.width, img.height) * 0.05;

          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(0, 0, img.width, img.height, radius);
          } else {
            ctx.rect(0, 0, img.width, img.height);
          }
          ctx.clip();

          // Draw the image
          ctx.drawImage(img, 0, 0);

          // Subtle slate-300 border around the rounded image
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(0, 0, img.width, img.height, radius);
          } else {
            ctx.rect(0, 0, img.width, img.height);
          }
          ctx.strokeStyle = '#CBD5E1'; // Slate-300
          ctx.lineWidth = Math.max(3, Math.min(img.width, img.height) * 0.012); // Proportional border width
          ctx.stroke();

          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          reject(new Error('Canvas context not available'));
        }
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (err) => {
      reject(new Error('Failed to load image from URL'));
    };
    img.src = url;
  });
};

export const exportSingleEndoscopyReportPDF = async (record: EndoscopyRecord, generatedBy: string, isCompact: boolean = false) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;

  // Pre-load all remote images asynchronously to avoid cross-origin canvas errors in jsPDF
  const preloadedList: { id: string; url: string; title: string }[] = [];
  const hasImages = record.images && record.images.length > 0;
  if (hasImages) {
    for (const img of record.images) {
      try {
        const loadedUrl = await loadRemoteImageAsDataURL(img.url);
        preloadedList.push({ id: img.id, url: loadedUrl, title: img.title });
      } catch (err) {
        console.warn("Failed to load remote image, using fallback:", err);
        preloadedList.push({ id: img.id, url: img.url, title: img.title });
      }
    }
  }

  // Place the Kidney Centre bordered logo on the left
  const logoBase64 = generateKidneyCentreLogoBase64();
  if (logoBase64) {
    // x = 14, y = 11. width = 66.6, height = 28 to preserve new 1000x420 aspect ratio (2.38:1)
    doc.addImage(logoBase64, 'PNG', 14, 11, 66.6, 28);
  }

  // Patient / Procedure Metadata on Right (Aligned around x=110)
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);
  doc.roundedRect(105, 11, pageWidth - 105 - 14, 28, 3, 3, 'S');
  doc.setLineWidth(0.2);

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  
  const drawMetaRow = (label: string, value: string, y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 108, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    // Wrap text if needed
    const wrappedText = doc.splitTextToSize(value || 'N/A', pageWidth - 108 - 14 - 30);
    doc.text(wrappedText[0], 138, y);
    doc.setTextColor(71, 85, 105);
  };

  drawMetaRow("Patient Name", record.name || 'N/A', 15);
  drawMetaRow("MR Number", record.regNo || 'N/A', 19);
  drawMetaRow("Age / Gender", `${record.age || 'N/A'} / ${record.gender || 'N/A'}`, 23);
  drawMetaRow("Procedure Date", `${record.date || 'N/A'}${record.time ? ' @ ' + record.time : ''}`, 27);
  drawMetaRow("Endoscopist", record.doctor || 'N/A', 31);
  drawMetaRow("Ref. Physician", record.referringPhysician || 'N/A', 35);

  // Divide
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.5);
  doc.line(14, 43, pageWidth - 14, 43);
  doc.setLineWidth(0.2);

  // Procedure Details Metrics Box (similar to Bronchoscopy Metrics in reference)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 47, pageWidth - 28, 26, 3, 3, 'FD');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 47, pageWidth - 28, 26, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("PROCEDURE SPECIFICS & CLINICAL METRICS", 18, 52);
  doc.line(14, 54, pageWidth - 14, 54);

  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  
  // Col 1
  doc.setFont('helvetica', 'bold'); doc.text("PROCEDURE PERFORMED:", 18, 59);
  doc.setFont('helvetica', 'normal'); doc.text(record.procedure || 'N/A', 56, 59);
  
  doc.setFont('helvetica', 'bold'); doc.text("MEDICATIONS:", 18, 63);
  doc.setFont('helvetica', 'normal'); doc.text(record.medications || 'N/A', 56, 63);

  // Let's build narrative sections below with auto-wrapping
  let currentY = 79;

  const addNarrativeSection = (title: string, content: string) => {
    const bottomLimit = isCompact ? 20 : 35;
    if (currentY > pageHeight - bottomLimit) {
      doc.addPage();
      currentY = 20;
    }

    const isPageOne = doc.getNumberOfPages() === 1;
    const activeWidth = (hasImages && isPageOne) ? 136 : (pageWidth - 28);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isCompact ? 7.5 : 9);
    doc.setTextColor(30, 41, 59);
    doc.text(title, 14, currentY);
    doc.setDrawColor(241, 245, 249);
    doc.line(14, currentY + 1.2, 14 + activeWidth, currentY + 1.2);
    
    currentY += isCompact ? 3.5 : 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isCompact ? 7 : 8);
    doc.setTextColor(51, 65, 85);
    
    if (title === "DETAILED FINDINGS & OBSERVATIONS") {
      const headings = [
        "ESOPHAGUS:",
        "STOMACH & ANTRUM:",
        "STOMACH:",
        "ANTRUM:",
        "DUODENUM:",
        "DUODENUM BULB:",
        "DUODENUM 2ND PART:",
        "RECTUM:",
        "SIGMOID COLON:",
        "TRANSVERSE COLON:",
        "DESCENDING COLON:",
        "ASCENDING COLON:",
        "CAECUM:",
        "COLON / RECTUM:",
        "VOCAL CORDS & LARYNX:",
        "TRACHEA & CARINA:",
        "BRONCHIAL TREE (MAIN & SEGMENTAL):",
        "BAL & BIOPSY FINDINGS:",
        "OTHER OBSERVATIONS:"
      ];
      
      const lines = (content || 'No details recorded.').split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) {
          // Empty line spacing, but skip consecutive empty lines to keep it compact
          if (i > 0 && lines[i - 1].trim()) {
            currentY += isCompact ? 1.2 : 2;
          }
          continue;
        }
        
        if (headings.includes(trimmed)) {
          if (currentY > pageHeight - 12) {
            doc.addPage();
            currentY = 20;
          }
          const currentWidth = (hasImages && doc.getNumberOfPages() === 1) ? 136 : (pageWidth - 28);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(isCompact ? 7.5 : 8.5);
          doc.setTextColor(15, 23, 42); // Darker color for headings
          doc.text(trimmed, 14, currentY);
          currentY += isCompact ? 3.5 : 4.5;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(isCompact ? 7 : 8);
          doc.setTextColor(51, 65, 85);
        } else {
          const currentWidth = (hasImages && doc.getNumberOfPages() === 1) ? 136 : (pageWidth - 28);
          const splitLines = doc.splitTextToSize(trimmed, currentWidth);
          for (const sLine of splitLines) {
            if (currentY > pageHeight - 12) {
              doc.addPage();
              currentY = 20;
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(isCompact ? 7 : 8);
              doc.setTextColor(51, 65, 85);
            }
            doc.text(sLine, 14, currentY);
            currentY += isCompact ? 3.2 : 4;
          }
          currentY += isCompact ? 1 : 1.5; // Slight spacing after paragraph
        }
      }
      currentY += isCompact ? 2 : 4; // Final section spacing
    } else {
      const currentWidth = (hasImages && doc.getNumberOfPages() === 1) ? 136 : (pageWidth - 28);
      const splitLines = doc.splitTextToSize(content || 'No details recorded.', currentWidth);
      for (const sLine of splitLines) {
        if (currentY > pageHeight - 12) {
          doc.addPage();
          currentY = 20;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(isCompact ? 7 : 8);
          doc.setTextColor(51, 65, 85);
        }
        doc.text(sLine, 14, currentY);
        currentY += isCompact ? 3.2 : 4;
      }
      currentY += isCompact ? 3.5 : 6;
    }
  };

  let findingsText = "";
  const isBronchoscopy = record.procedure?.toLowerCase().includes("bronchoscopy") || record.procedure?.toLowerCase().includes("bronch");
  const isColonoscopy = record.procedure?.toLowerCase().includes("colonoscopy") || record.procedure?.toLowerCase().includes("colon");

  if (isBronchoscopy) {
    if (record.esophagusFindings) findingsText += `VOCAL CORDS & LARYNX:\n${record.esophagusFindings}\n\n`;
    if (record.stomachFindings) findingsText += `TRACHEA & CARINA:\n${record.stomachFindings}\n\n`;
    if (record.duodenumFindings) findingsText += `BRONCHIAL TREE (MAIN & SEGMENTAL):\n${record.duodenumFindings}\n\n`;
    if (record.colonFindings) findingsText += `BAL & BIOPSY FINDINGS:\n${record.colonFindings}\n\n`;
  } else if (isColonoscopy) {
    if (record.rectumFindings) findingsText += `RECTUM:\n${record.rectumFindings}\n\n`;
    if (record.sigmoidColonFindings) findingsText += `SIGMOID COLON:\n${record.sigmoidColonFindings}\n\n`;
    if (record.transverseColonFindings) findingsText += `TRANSVERSE COLON:\n${record.transverseColonFindings}\n\n`;
    if (record.descendingColonFindings) findingsText += `DESCENDING COLON:\n${record.descendingColonFindings}\n\n`;
    if (record.ascendingColonFindings) findingsText += `ASCENDING COLON:\n${record.ascendingColonFindings}\n\n`;
    if (record.caecumFindings) findingsText += `CAECUM:\n${record.caecumFindings}\n\n`;
    if (!findingsText.trim()) {
      findingsText = "No detailed findings recorded.";
    }
  } else {
    if (record.esophagusFindings || record.stomachFindings || record.antrumFindings || record.duodenumFindings || record.duodenum2ndPartFindings) {
      if (record.esophagusFindings) findingsText += `ESOPHAGUS:\n${record.esophagusFindings}\n\n`;
      if (record.stomachFindings) findingsText += `STOMACH:\n${record.stomachFindings}\n\n`;
      if (record.antrumFindings) findingsText += `ANTRUM:\n${record.antrumFindings}\n\n`;
      if (record.duodenumFindings) findingsText += `DUODENUM BULB:\n${record.duodenumFindings}\n\n`;
      if (record.duodenum2ndPartFindings) findingsText += `DUODENUM 2ND PART:\n${record.duodenum2ndPartFindings}\n\n`;
    } else {
      findingsText = record.findings || "No detailed findings recorded.";
    }
  }

  addNarrativeSection("INDICATIONS FOR EXAMINATION", record.indications || "N/A");
  addNarrativeSection("DETAILED FINDINGS & OBSERVATIONS", findingsText);
  addNarrativeSection("ASSESSMENT", `Diagnosis: ${record.diagnosis || "N/A"}`);
  addNarrativeSection("RECOMMENDATIONS", record.recommendations || "N/A");

  // Draw Clinical Images on Page 1 (Right Column) if there are images
  if (hasImages) {
    const totalPages = doc.getNumberOfPages();
    doc.setPage(1); // Target Page 1 for image drawing

    let imgY = 79;
    
    const imgWidth = 42;
    const imgHeight = 31.5; // 4:3 aspect ratio
    
    for (let i = 0; i < preloadedList.length; i++) {
      const img = preloadedList[i];
      if (imgY + imgHeight > pageHeight - 15) {
        // Stop drawing if we would exceed the bottom of Page 1
        break;
      }
      
      try {
        doc.addImage(img.url, 'JPEG', 154, imgY, imgWidth, imgHeight);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isCompact ? 6 : 7);
        doc.setTextColor(71, 85, 105);
        
        // Wrap and print image title centered
        const centerX = 154 + (imgWidth / 2);
        const wrappedTitle = doc.splitTextToSize(img.title || `Capture ${i + 1}`, imgWidth);
        doc.text(wrappedTitle, centerX, imgY + imgHeight + (isCompact ? 2.5 : 3.5), { align: 'center' });
      } catch (err) {
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(154, imgY, imgWidth, imgHeight, 3, 3, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(isCompact ? 5.5 : 6.5);
        doc.text("Image format error", 154 + (imgWidth / 2), imgY + (imgHeight / 2), { align: 'center' });
      }
      
      imgY += imgHeight + (isCompact ? 8 : 11);
    }
    
    // Switch back to the last page so signatures are printed on the last page
    doc.setPage(totalPages);
  }

  // Clinical Signatures (Always stick to bottom if possible, or add new page)
  if (currentY > pageHeight - 35) {
    doc.addPage();
    currentY = 20;
  }

  const signY = pageHeight - 32;
  doc.setDrawColor(203, 213, 225);
  doc.line(14, signY, 74, signY);

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text("Performing Physician Signature", 44, signY + 4, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`REPORT COMPILED BY THE KIDNEY CENTRE. GENERATED BY: ${generatedBy.toUpperCase()} ON ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

  doc.save(`endoscopy_procedure_report_${record.regNo}_${record.serialNo}.pdf`);
};
