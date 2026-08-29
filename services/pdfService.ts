
import { Patient, InventoryItem, EndoscopyRecord, IncidentRecord } from '../types';
import { formatProcedureDisplay } from '../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
// @ts-ignore
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, safeFirestoreWrite } from './firebaseConfig';
import kidneyCentreLogoImg from '../src/assets/images/kidney_centre_logo_1785918380698.jpg';

/**
 * Dispatches a global toast event to notify the user of a completed PDF document generation and download.
 */
const triggerPDFToast = (message: string, title: string = 'PDF Generated') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app:toast', {
        detail: {
          message,
          type: 'success',
          title,
          duration: 4000
        }
      })
    );
  }
};

export const getVerificationUrl = (type: string, id: string | number, extra?: Record<string, string>): string => {
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://kidneycentre.com';
  const url = new URL(origin);
  url.searchParams.set('verify', type);
  url.searchParams.set('id', String(id));
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
};

export const generateQRCodeDataUrl = async (verificationUrl: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(verificationUrl, {
      margin: 1,
      width: 180,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.warn('QR Code generation error:', err);
    return '';
  }
};

export interface SummaryItem {
  label: string;
  value: string | number;
}

export interface SummarySection {
  title: string;
  items: SummaryItem[];
}

export interface ReportMetadata {
  generatedBy: string;
  filters: string;
  period?: string;
  customSummarySections?: SummarySection[];
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
  // High-DPI canvas layout matching official header ratio: 880px width x 290px height
  canvas.width = 880;
  canvas.height = 290;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Clean White Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Red Logo Badge Container (Official TKC Red Square)
  const redColor = '#C81C24';
  const badgeX = 18;
  const badgeY = 12;
  const badgeW = 142;
  const badgeH = 142;

  ctx.fillStyle = redColor;
  ctx.fillRect(badgeX, badgeY, badgeW, badgeH);

  // --- 1. Left Emblem: White Kidney Outer Silhouette ---
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(badgeX + 22, badgeY + 128);
  ctx.bezierCurveTo(badgeX + 8, badgeY + 92, badgeX + 12, badgeY + 28, badgeX + 46, badgeY + 10);
  ctx.bezierCurveTo(badgeX + 68, badgeY + 2, badgeX + 88, badgeY + 12, badgeX + 90, badgeY + 34);
  ctx.bezierCurveTo(badgeX + 92, badgeY + 58, badgeX + 88, badgeY + 92, badgeX + 76, badgeY + 112);
  ctx.bezierCurveTo(badgeX + 68, badgeY + 125, badgeX + 54, badgeY + 138, badgeX + 46, badgeY + 138);
  ctx.bezierCurveTo(badgeX + 38, badgeY + 138, badgeX + 28, badgeY + 132, badgeX + 22, badgeY + 128);
  ctx.fill();

  // --- 2. Inner Red Cavity inside Kidney ---
  ctx.fillStyle = redColor;
  ctx.beginPath();
  ctx.moveTo(badgeX + 38, badgeY + 128);
  ctx.bezierCurveTo(badgeX + 24, badgeY + 92, badgeX + 26, badgeY + 36, badgeX + 48, badgeY + 22);
  ctx.bezierCurveTo(badgeX + 64, badgeY + 14, badgeX + 76, badgeY + 24, badgeX + 78, badgeY + 40);
  ctx.bezierCurveTo(badgeX + 80, badgeY + 60, badgeX + 74, badgeY + 86, badgeX + 62, badgeY + 106);
  ctx.bezierCurveTo(badgeX + 52, badgeY + 118, badgeX + 44, badgeY + 124, badgeX + 38, badgeY + 128);
  ctx.fill();

  // --- 3. White Internal Calyx Tree / Wave Branches ---
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(badgeX + 38, badgeY + 128);
  ctx.bezierCurveTo(badgeX + 35, badgeY + 100, badgeX + 38, badgeY + 70, badgeX + 48, badgeY + 52);
  // Branch 1 (Upper left)
  ctx.bezierCurveTo(badgeX + 50, badgeY + 40, badgeX + 58, badgeY + 32, badgeX + 64, badgeY + 36);
  ctx.bezierCurveTo(badgeX + 68, badgeY + 40, badgeX + 64, badgeY + 48, badgeX + 58, badgeY + 50);
  // Branch 2 (Upper middle)
  ctx.bezierCurveTo(badgeX + 66, badgeY + 44, badgeX + 74, badgeY + 40, badgeX + 78, badgeY + 48);
  ctx.bezierCurveTo(badgeX + 80, badgeY + 54, badgeX + 72, badgeY + 60, badgeX + 64, badgeY + 62);
  // Branch 3 (Middle)
  ctx.bezierCurveTo(badgeX + 72, badgeY + 60, badgeX + 80, badgeY + 58, badgeX + 82, badgeY + 66);
  ctx.bezierCurveTo(badgeX + 82, badgeY + 74, badgeX + 72, badgeY + 78, badgeX + 62, badgeY + 78);
  // Branch 4 (Lower)
  ctx.bezierCurveTo(badgeX + 68, badgeY + 80, badgeX + 76, badgeY + 82, badgeX + 74, badgeY + 92);
  ctx.bezierCurveTo(badgeX + 70, badgeY + 100, badgeX + 58, badgeY + 106, badgeX + 46, badgeY + 128);
  ctx.closePath();
  ctx.fill();

  // --- 4. Red Internal Wave Accents ---
  ctx.strokeStyle = redColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(badgeX + 42, badgeY + 115);
  ctx.bezierCurveTo(badgeX + 45, badgeY + 85, badgeX + 52, badgeY + 65, badgeX + 62, badgeY + 50);
  ctx.stroke();

  // --- 5. Right Emblem: White Wing / Crest Symbol in Upper Right of Badge ---
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(badgeX + 96, badgeY + 22);
  ctx.lineTo(badgeX + 122, badgeY + 22);
  ctx.lineTo(badgeX + 122, badgeY + 16);
  ctx.lineTo(badgeX + 128, badgeY + 16);
  ctx.lineTo(badgeX + 128, badgeY + 22);
  ctx.lineTo(badgeX + 134, badgeY + 22);
  ctx.lineTo(badgeX + 134, badgeY + 28);
  // Outer scalloped wing contour
  ctx.bezierCurveTo(badgeX + 136, badgeY + 48, badgeX + 126, badgeY + 68, badgeX + 98, badgeY + 78);
  // Inner wing curve back to top
  ctx.bezierCurveTo(badgeX + 112, badgeY + 62, badgeX + 115, badgeY + 44, badgeX + 106, badgeY + 32);
  ctx.lineTo(badgeX + 96, badgeY + 28);
  ctx.closePath();
  ctx.fill();

  // Wing inner notch cutouts
  ctx.fillStyle = redColor;
  ctx.beginPath();
  ctx.arc(badgeX + 120, badgeY + 38, 3, 0, Math.PI * 2);
  ctx.arc(badgeX + 114, badgeY + 52, 3.5, 0, Math.PI * 2);
  ctx.arc(badgeX + 106, badgeY + 64, 3, 0, Math.PI * 2);
  ctx.fill();

  // --- 6. English Stacked Header Text ---
  ctx.fillStyle = '#000000';
  ctx.font = '900 38px "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText('THE', 178, 48);
  ctx.fillText('KIDNEY', 178, 88);
  ctx.fillText('CENTRE', 178, 128);

  ctx.font = 'bold 15px Arial, Helvetica, sans-serif';
  ctx.fillStyle = '#101828';
  ctx.fillText('POST GRADUATE TRAINING INSTITUTE', 178, 150);

  // --- 7. Horizontal Separator Line ---
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(15, 168);
  ctx.lineTo(865, 168);
  ctx.stroke();

  // --- 8. Urdu Title Section ---
  ctx.font = 'bold 24px "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", "Urdu Typesetting", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.fillText('دی کڈنی سینٹر پوسٹ گریجوئٹ ٹریننگ انسٹیٹیوٹ', 440, 214, 830);

  // --- 9. Address and Contact Details ---
  ctx.font = 'bold 16px Arial, Helvetica, sans-serif';
  ctx.fillStyle = '#000000';
  ctx.fillText('172/N, R.A. Lines, Rafiqi Shaheed Road, Karachi-75530, Pakistan  |  Tel: (92-21) 35661000-10', 440, 268, 830);

  return canvas.toDataURL('image/png');
};

export interface LogoSettings {
  useCustomLogo: boolean;
  customLogoDataUrl: string | null;
  customLogoBase64?: string;
  logoUrl?: string;
  updatedAt?: number;
  widthMm: number;
  heightMm: number;
  scaleHeightMm?: number;
  sidebarLogoWidthPx?: number;
  scalePercent: number;
  align: 'left' | 'center' | 'right';
  alignment?: 'left' | 'center' | 'right';
  offsetX: number;
  offsetY: number;
  offsetYMm?: number;
  maintainAspectRatio: boolean;
}

export const DEFAULT_LOGO_SETTINGS: LogoSettings = {
  useCustomLogo: false,
  customLogoDataUrl: null,
  customLogoBase64: '',
  logoUrl: '',
  updatedAt: Date.now(),
  widthMm: 68,
  heightMm: 24,
  scaleHeightMm: 24,
  sidebarLogoWidthPx: 40,
  scalePercent: 100,
  align: 'left',
  alignment: 'left',
  offsetX: 0,
  offsetY: 0,
  offsetYMm: 0,
  maintainAspectRatio: true,
};

export const getLogoSettings = (): LogoSettings => {
  if (typeof window === 'undefined') return DEFAULT_LOGO_SETTINGS;
  try {
    const saved = localStorage.getItem('hdu_logo_settings');
    if (saved) {
      return { ...DEFAULT_LOGO_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Error loading logo settings:', e);
  }
  return DEFAULT_LOGO_SETTINGS;
};

export const saveLogoSettings = (settings: LogoSettings) => {
  if (typeof window === 'undefined') return;
  try {
    const updatedSettings: LogoSettings = {
      ...settings,
      updatedAt: Date.now()
    };
    localStorage.setItem('hdu_logo_settings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new Event('hdu_logo_settings_changed'));

    // Persist asynchronously to Firestore cloud database
    try {
      safeFirestoreWrite(async () => {
        await setDoc(doc(db, 'system_settings', 'branding'), updatedSettings, { merge: true });
      }, 5000).catch(err => console.warn('Background branding save to Firestore:', err));
    } catch (fsErr) {
      console.warn('Firestore branding doc save init error:', fsErr);
    }
  } catch (e) {
    console.error('Error saving logo settings:', e);
  }
};

export const syncLogoSettingsFromFirestore = async (): Promise<LogoSettings> => {
  if (typeof window === 'undefined') return getLogoSettings();
  try {
    const docRef = doc(db, 'system_settings', 'branding');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const remoteSettings = snap.data() as LogoSettings;
      if (remoteSettings && (remoteSettings.customLogoBase64 || remoteSettings.logoUrl || remoteSettings.useCustomLogo !== undefined)) {
        const merged = { ...DEFAULT_LOGO_SETTINGS, ...remoteSettings };
        localStorage.setItem('hdu_logo_settings', JSON.stringify(merged));
        window.dispatchEvent(new Event('hdu_logo_settings_changed'));
        return merged;
      }
    }
  } catch (e) {
    console.warn('Sync logo settings from Firestore offline/skipped:', e);
  }
  return getLogoSettings();
};

// Initial background sync on module initialization
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncLogoSettingsFromFirestore();
  }, 1000);
}

export const getEffectiveLogoBase64 = (): string => {
  const settings = getLogoSettings();
  const custom = settings.customLogoBase64 || settings.customLogoDataUrl || settings.logoUrl;
  if (custom) {
    return custom;
  }
  return generateKidneyCentreLogoBase64();
};

/**
 * Appends a cache-busting timestamp parameter to the logo URL or data reference
 * to ensure that PDF views and preview sheets load the newly updated image immediately
 * without returning cached browser image resources.
 */
export const getLogoUrlWithCacheBust = (providedUrl?: string | null): string => {
  const settings = getLogoSettings();
  const timestamp = settings.updatedAt || Date.now();
  const targetUrl = providedUrl || settings.logoUrl || settings.customLogoBase64 || settings.customLogoDataUrl || getEffectiveLogoBase64();

  if (!targetUrl) return '';

  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://') || targetUrl.startsWith('/')) {
    const separator = targetUrl.includes('?') ? '&' : '?';
    return `${targetUrl}${separator}t=${timestamp}`;
  }

  return targetUrl;
};

export const calculateLogoRenderParams = (
  defaultX: number = 14,
  defaultY: number = 7,
  defaultWidth: number = 68,
  defaultHeight: number = 24,
  pageWidth: number = 210
) => {
  const settings = getLogoSettings();
  const rawLogo = getEffectiveLogoBase64();
  const logoBase64 = getLogoUrlWithCacheBust(rawLogo);
  const timestamp = settings.updatedAt || Date.now();

  const align = settings.alignment || settings.align || 'left';
  const scale = (settings.scalePercent || 100) / 100;

  // Use customized width/height if set and different from old legacy defaults (42x14)
  const baseWidth = (settings.widthMm && settings.widthMm !== 42) ? settings.widthMm : defaultWidth;
  const baseHeight = (settings.heightMm && settings.heightMm !== 14) ? settings.heightMm : defaultHeight;

  const targetWidth = baseWidth * scale;
  const targetHeight = baseHeight * scale;

  let calculatedX = defaultX;
  if (align === 'center') {
    calculatedX = (pageWidth - targetWidth) / 2;
  } else if (align === 'right') {
    calculatedX = pageWidth - targetWidth - defaultX;
  }

  calculatedX += settings.offsetX || 0;
  const offsetYVal = settings.offsetYMm !== undefined ? settings.offsetYMm : (settings.offsetY || 0);
  const calculatedY = defaultY + offsetYVal;

  return {
    logoBase64,
    cacheBustTimestamp: timestamp,
    x: Math.max(0, calculatedX),
    y: Math.max(0, calculatedY),
    width: Math.max(5, targetWidth),
    height: Math.max(5, targetHeight)
  };
};

// Helper functions to draw crisp vector icons in jsPDF header
const drawUserIcon = (doc: jsPDF, x: number, y: number, color = [79, 70, 229]) => {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.circle(x + 1.1, y - 1.5, 0.7, 'F');
  doc.roundedRect(x + 0.3, y - 0.6, 1.6, 1.0, 0.4, 0.4, 'F');
};

const drawClockIcon = (doc: jsPDF, x: number, y: number, color = [100, 116, 139]) => {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.22);
  doc.circle(x + 1.1, y - 1.0, 1.0, 'S');
  doc.line(x + 1.1, y - 1.0, x + 1.1, y - 1.6);
  doc.line(x + 1.1, y - 1.0, x + 1.5, y - 1.0);
};

const drawFilterIcon = (doc: jsPDF, x: number, y: number, color = [16, 185, 129]) => {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.2);
  // Sliders icon
  doc.line(x + 0.2, y - 1.6, x + 2.0, y - 1.6);
  doc.circle(x + 1.4, y - 1.6, 0.3, 'F');
  doc.line(x + 0.2, y - 0.5, x + 2.0, y - 0.5);
  doc.circle(x + 0.8, y - 0.5, 0.3, 'F');
};

const drawCalendarIcon = (doc: jsPDF, x: number, y: number, color = [217, 119, 6]) => {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.22);
  doc.roundedRect(x + 0.2, y - 2.0, 1.8, 1.8, 0.3, 0.3, 'S');
  doc.line(x + 0.2, y - 1.3, x + 2.0, y - 1.3);
  doc.line(x + 0.6, y - 2.3, x + 0.6, y - 1.9);
  doc.line(x + 1.6, y - 2.3, x + 1.6, y - 1.9);
};

export const exportToPDF = async (title: string, headers: string[], rows: any[][], metadata: ReportMetadata) => {
  const doc = new jsPDF('landscape'); 
  const pageWidth = doc.internal.pageSize.width;

  // Header Logo with user adjustments - proportional width to eliminate wide empty gap
  const renderParams = calculateLogoRenderParams(14, 5, 24, 24, 297);
  if (renderParams.logoBase64) {
    doc.addImage(renderParams.logoBase64, 'PNG', renderParams.x, renderParams.y, renderParams.width, renderParams.height);
  }

  // Report Title & Metadata - positioned close to logo (tightened distance)
  const startX = renderParams.logoBase64 ? (renderParams.x + renderParams.width + 4.5) : 14;
  
  // Title - compact professional font size
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.setFont('helvetica', 'bold');
  const fullTitle = metadata.period ? `${title} — ${metadata.period}` : title;
  doc.text(fullTitle, startX, 10.5);

  // Line 1: User & Timestamp with dynamic vector icons
  let curX = startX;
  const line1Y = 15.2;

  // User Icon + Generated By
  drawUserIcon(doc, curX, line1Y, [79, 70, 229]);
  curX += 2.6;
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Generated By:', curX, line1Y);
  curX += doc.getTextWidth('Generated By:') + 1.2;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(metadata.generatedBy, curX, line1Y);
  curX += doc.getTextWidth(metadata.generatedBy) + 2.5;

  // Divider
  doc.setTextColor(203, 213, 225);
  doc.text('|', curX, line1Y);
  curX += 2.5;

  // Clock Icon + Timestamp
  drawClockIcon(doc, curX, line1Y, [100, 116, 139]);
  curX += 2.6;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Timestamp:', curX, line1Y);
  curX += doc.getTextWidth('Timestamp:') + 1.2;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const timeStr = new Date().toLocaleString();
  doc.text(timeStr, curX, line1Y);

  // Line 2: Active Filters with filter icon
  const line2Y = 19.5;
  drawFilterIcon(doc, startX, line2Y, [16, 185, 129]);
  let line2X = startX + 2.6;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Active Filters:', line2X, line2Y);
  line2X += doc.getTextWidth('Active Filters:') + 1.2;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(metadata.filters, line2X, line2Y);

  // Line 3: Report Period / Range (if provided) with calendar icon
  let tableStartY = 24.5;
  if (metadata.period) {
    const line3Y = 23.8;
    drawCalendarIcon(doc, startX, line3Y, [217, 119, 6]);
    let line3X = startX + 2.6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Report Period / Range:', line3X, line3Y);
    line3X += doc.getTextWidth('Report Period / Range:') + 1.2;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(metadata.period, line3X, line3Y);
    tableStartY = 28.5;
  }

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: tableStartY,
    styles: { fontSize: 7, font: 'helvetica', cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold' }, // Professional executive slate grey
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 20 },
    didDrawPage: function (data: any) {
      const str = "Page " + doc.getNumberOfPages();
      doc.setFontSize(8);
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height ? pageSize.height : (pageSize as any).getHeight();
      doc.setTextColor(148, 163, 184); 
      doc.text(str, data.settings.margin.left, pageHeight - 10);
    }
  });

  // Dynamic Multi-Column Summary Section
  const finalY = (doc as any).lastAutoTable.finalY || tableStartY + 20;
  const pageHeight = doc.internal.pageSize.height;

  const summarySections = metadata.customSummarySections || [
    {
      title: 'REPORT SUMMARY',
      items: [{ label: 'Total Records Processed', value: rows.length }]
    }
  ];

  const maxItems = Math.max(...summarySections.map(s => s.items.length), 1);
  const neededHeight = Math.max(26, 12 + (maxItems * 5.5));

  let summaryY = finalY + 10;
  if (summaryY + neededHeight + 15 > pageHeight) {
    doc.addPage();
    doc.setPage(doc.getNumberOfPages());
    summaryY = 20;
  }

  const numCols = summarySections.length;
  const totalUsableWidth = 268; // 297mm - 14mm left - 15mm right margin
  const gap = 5;
  const colWidth = (totalUsableWidth - (numCols - 1) * gap) / numCols;

  summarySections.forEach((section, colIdx) => {
    const colX = 14 + colIdx * (colWidth + gap);

    // Header bar - Professional Slate Grey
    doc.setFillColor(71, 85, 105); // Slate-600 executive grey
    doc.roundedRect(colX, summaryY, colWidth, 7, 2, 2, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(section.title.toUpperCase(), colX + 4, summaryY + 4.8);

    // Body container
    const bodyY = summaryY + 7;
    const bodyHeight = neededHeight - 7;
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.roundedRect(colX, bodyY, colWidth, bodyHeight, 2, 2, 'FD');

    // Items list
    let itemY = bodyY + 5.5;
    section.items.forEach((item) => {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85); // Slate-700

      const labelText = String(item.label);
      const valText = String(item.value);

      const maxLabelWidth = colWidth - 28;
      const splitLabel = doc.splitTextToSize(labelText, maxLabelWidth);
      doc.text(splitLabel[0], colX + 4, itemY);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42); // Slate-900
      doc.text(valText, colX + colWidth - 4, itemY, { align: 'right' });

      itemY += 5.5;
    });
  });

  const filename = `${title.replace(/\s+/g, '_').toLowerCase()}_${new Date().getTime()}.pdf`;
  doc.save(filename);
  triggerPDFToast(`PDF report "${title}" generated and downloaded successfully.`, 'Export Complete');
};

export const exportAccessSlipPDF = (userData: { name: string; email: string; password?: string; role: string }) => {
  const doc = new jsPDF();
  
  // Header Box
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text("THE KIDNEY CENTRE MEDICAL RECORD SYSTEM", 105, 20, { align: 'center' });
  
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

  const slipFilename = `access_slip_${userData.name.toLowerCase().replace(/\s+/g, '_')}.pdf`;
  doc.save(slipFilename);
  triggerPDFToast(`Staff credential slip for ${userData.name} exported successfully.`, 'Credentials Exported');
};

export const exportPatientsPDF = async (patients: Patient[], metadata: ReportMetadata) => {
  const headers = ['Reg No', 'Patient Name', 'Gender', 'Category', 'Location', 'Code', 'Consultant', 'In-Date', 'Out-Date', 'LOS'];
  const rows = patients.map(p => [
    p.regNo, 
    p.name, 
    p.gender,
    p.category, 
    p.location || 'N/A',
    p.codeStatus, 
    p.consultant, 
    p.admissionDate,
    p.dischargeDate || 'N/A',
    p.lengthOfStay
  ]);

  const summarySections: SummarySection[] = [
    {
      title: 'PATIENT SUMMARY',
      items: [
        { label: 'Total Patients', value: patients.length }
      ]
    }
  ];

  await exportToPDF("Clinical Patient Record", headers, rows, {
    ...metadata,
    customSummarySections: metadata.customSummarySections || summarySections
  });
};

export const exportInventoryPDF = async (inventory: InventoryItem[], metadata: ReportMetadata) => {
  const headers = ['Item Name', 'Category', 'Stock', 'Min', 'Unit', 'Recorded By', 'Last Updated'];
  const rows = inventory.map(i => [i.name, i.category, i.quantity, i.minThreshold, i.measurementUnit, i.createdBy || 'Staff', i.lastUpdated]);

  const lowStock = inventory.filter(i => i.quantity <= i.minThreshold).length;
  const categories = new Set(inventory.map(i => i.category)).size;

  const summarySections: SummarySection[] = [
    {
      title: 'INVENTORY STOCK SUMMARY',
      items: [
        { label: 'Total Inventory Items', value: inventory.length },
        { label: 'Low / Critical Stock Items', value: lowStock },
        { label: 'Product Categories', value: categories }
      ]
    }
  ];

  await exportToPDF("Inventory Audit Report", headers, rows, {
    ...metadata,
    customSummarySections: metadata.customSummarySections || summarySections
  });
};

export const exportEndoscopyPDF = async (records: EndoscopyRecord[], metadata: ReportMetadata) => {
  const headers = ['S.No', 'Reg No', 'Patient Name', 'Doctor / Physician', 'Procedure', 'Date', 'Logged By'];
  const rows = records.map((r, idx) => [
    r.serialNo || (idx + 1).toString().padStart(3, '0'),
    r.regNo,
    r.name,
    r.doctor || 'N/A',
    formatProcedureDisplay(r.procedure) || 'N/A',
    r.date || 'N/A',
    r.createdBy || 'Staff'
  ]);

  const totalCases = records.length;
  const uniquePatients = new Set(records.map(r => r.regNo)).size;

  // Case counts per procedure
  const procedureCounts: Record<string, number> = {};
  records.forEach(r => {
    const proc = formatProcedureDisplay(r.procedure) || 'Unspecified';
    procedureCounts[proc] = (procedureCounts[proc] || 0) + 1;
  });

  // Case counts per doctor
  const doctorCounts: Record<string, number> = {};
  records.forEach(r => {
    const docName = r.doctor?.trim() || 'Unspecified';
    doctorCounts[docName] = (doctorCounts[docName] || 0) + 1;
  });

  // Date span & Month extraction
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dates = records.map(r => r.date).filter(Boolean).sort();
  const dateRangeStr = dates.length > 0 
    ? (dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} to ${dates[dates.length - 1]}`)
    : 'N/A';

  let detectedPeriod = metadata.period;
  if (!detectedPeriod) {
    const monthsSet = new Set<string>();
    records.forEach(r => {
      if (r.date) {
        const d = new Date(r.date);
        if (!isNaN(d.getTime())) {
          monthsSet.add(`${monthNames[d.getMonth()]} ${d.getFullYear()}`);
        }
      }
    });

    const uniqueMonths = Array.from(monthsSet);
    if (uniqueMonths.length === 1) {
      detectedPeriod = uniqueMonths[0];
    } else if (uniqueMonths.length > 1) {
      detectedPeriod = `${uniqueMonths[0]} - ${uniqueMonths[uniqueMonths.length - 1]}`;
    } else {
      const current = new Date();
      detectedPeriod = `${monthNames[current.getMonth()]} ${current.getFullYear()}`;
    }
  }

  const summarySections: SummarySection[] = [
    {
      title: 'OVERALL CASE METRICS',
      items: [
        { label: 'Target Month / Period', value: detectedPeriod },
        { label: 'Total Procedures / Cases', value: `${totalCases} case${totalCases !== 1 ? 's' : ''}` },
        { label: 'Unique Patients Served', value: `${uniquePatients} patient${uniquePatients !== 1 ? 's' : ''}` },
        { label: 'Date Range Covered', value: dateRangeStr }
      ]
    },
    {
      title: 'INDIVIDUAL CASE COUNT BY PROCEDURE',
      items: Object.entries(procedureCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([proc, count]) => ({
          label: proc,
          value: `${count} case${count > 1 ? 's' : ''} (${totalCases > 0 ? ((count / totalCases) * 100).toFixed(0) : 0}%)`
        }))
    },
    {
      title: 'CASE COUNT BY PHYSICIAN',
      items: Object.entries(doctorCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([docName, count]) => ({
          label: docName,
          value: `${count} case${count > 1 ? 's' : ''} (${totalCases > 0 ? ((count / totalCases) * 100).toFixed(0) : 0}%)`
        }))
    }
  ];

  await exportToPDF("Endoscopy Procedure Log Report", headers, rows, {
    ...metadata,
    period: detectedPeriod,
    customSummarySections: summarySections
  });
};

export const exportIncidentsPDF = async (incidents: IncidentRecord[], metadata: ReportMetadata) => {
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

  const categoryCounts: Record<string, number> = {};
  incidents.forEach(i => {
    const cat = i.category || 'General';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  const summarySections: SummarySection[] = [
    {
      title: 'INCIDENT AUDIT SUMMARY',
      items: [
        { label: 'Total Incidents Logged', value: incidents.length },
        { label: 'Categories Tracked', value: Object.keys(categoryCounts).length }
      ]
    },
    {
      title: 'INCIDENTS BY CATEGORY',
      items: Object.entries(categoryCounts).slice(0, 4).map(([cat, count]) => ({
        label: cat,
        value: `${count} case${count > 1 ? 's' : ''}`
      }))
    }
  ];

  await exportToPDF("Clinical Incident Report", headers, rows, {
    ...metadata,
    customSummarySections: metadata.customSummarySections || summarySections
  });
};

export const generatePatientSummaryPDFDoc = async (patient: Patient, generatedBy: string): Promise<jsPDF> => {
  const doc = new jsPDF();

  // Header Block with Logo
  const renderParams = calculateLogoRenderParams(14, 8, 48, 22.7, 210);
  if (renderParams.logoBase64) {
    doc.addImage(renderParams.logoBase64, 'PNG', renderParams.x, renderParams.y, renderParams.width, renderParams.height);
  }

  // Header Title Box
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.roundedRect(64, 8, 132, 22.7, 2, 2, 'F');
  
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text("CLINICAL INPATIENT & PROCEDURE SUMMARY", 130, 16, { align: 'center' });

  // Timestamp
  doc.setFontSize(6.5);
  doc.setTextColor(186, 200, 218); // Soft slate color
  doc.text(`Generated On: ${new Date().toLocaleString()}  |  By: ${generatedBy.toUpperCase()}`, 130, 23, { align: 'center' });

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
  doc.setFont('helvetica', 'bold'); doc.text("Shift / Status:", 110, gridY4);
  doc.setFont('helvetica', 'bold');
  const shiftVal = (patient.transferStatus === 'Discharged (DC)' || patient.shiftTo === 'Discharged (DC)') ? 'DC' : (patient.transferStatus || patient.shiftTo || (patient.dischargeDate ? 'DC' : 'In-Unit (Active)'));
  doc.setTextColor(30, 41, 59);
  doc.text(shiftVal, 145, gridY4);

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

  return doc;
};

export const exportPatientSummaryPDF = async (patient: Patient, generatedBy: string) => {
  const doc = await generatePatientSummaryPDFDoc(patient, generatedBy);
  const filename = `clinical_summary_${patient.regNo}_${new Date().getTime()}.pdf`;
  doc.save(filename);
  triggerPDFToast(`Clinical summary PDF for ${patient.name} (${patient.regNo}) generated successfully.`, 'PDF Downloaded');
};

export const getPatientSummaryPDFBlob = async (patient: Patient, generatedBy: string): Promise<{ blob: Blob; filename: string; file: File; doc: jsPDF }> => {
  const doc = await generatePatientSummaryPDFDoc(patient, generatedBy);
  const blob = doc.output('blob');
  const filename = `clinical_summary_${patient.regNo || 'patient'}_${new Date().getTime()}.pdf`;
  const file = new File([blob], filename, { type: 'application/pdf' });
  return { blob, filename, file, doc };
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

export const generateSingleEndoscopyReportPDFDoc = async (record: EndoscopyRecord, generatedBy: string, isCompact: boolean = false): Promise<jsPDF> => {
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

  // Place the Kidney Centre logo on the left with custom settings
  const renderParams = calculateLogoRenderParams(14, 6.5, 36, 21, 210);
  if (renderParams.logoBase64) {
    doc.addImage(renderParams.logoBase64, 'PNG', renderParams.x, renderParams.y, renderParams.width, renderParams.height);
  }

  // Institutional Address & Contact Details unconditionally rendered tight right next to logo
  const logoEndX = renderParams.x + renderParams.width;
  const sepX = logoEndX + 2;
  const addressX = sepX + 2;

  // Vertical Divider Line between Logo and Address
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.3);
  doc.line(sepX, 7, sepX, 26);

  // Address & Contact Information Lines with crisp vector icons (Bounded before patient info box at x=102)
  const iconOffset = 2.8;

  // 1. Vector Map Pin (Location) Icon
  const pinX = addressX + 0.8;
  const pinY = 9.9;
  doc.setFillColor(220, 38, 38); // Red-600
  doc.circle(pinX, pinY, 0.75, 'F');
  doc.setFillColor(255, 255, 255);
  doc.circle(pinX, pinY, 0.32, 'F');
  doc.setFillColor(220, 38, 38);
  doc.triangle(pinX - 0.65, pinY + 0.35, pinX + 0.65, pinY + 0.35, pinX, pinY + 1.25, 'F');

  doc.setFontSize(6.2);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.setFont('helvetica', 'bold');
  doc.text("197/9, Rafiqui Shaheed Road, Karachi-75530.", addressX + iconOffset, 11, { maxWidth: 101 - (addressX + iconOffset) });

  // 2. Vector Phone (PABX / Landline) Icon
  const phX = addressX + 0.1;
  const phY = 14.6;
  doc.setFillColor(100, 116, 139); // Slate-500
  doc.roundedRect(phX, phY, 1.6, 1.6, 0.3, 0.3, 'F');
  doc.setFillColor(255, 255, 255);
  doc.circle(phX + 0.8, phY + 0.8, 0.35, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.6);
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.text("Phone: PABX 35661000 (10 Lines)", addressX + iconOffset, 16, { maxWidth: 101 - (addressX + iconOffset) });

  // 3. Vector Mobile / Smartphone Icon
  const mobX = addressX + 0.2;
  const mobY = 19.4;
  doc.setFillColor(100, 116, 139); // Slate-500
  doc.roundedRect(mobX, mobY, 1.4, 2.0, 0.25, 0.25, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(mobX + 0.2, mobY + 0.25, 1.0, 1.2, 'F');
  doc.setFillColor(100, 116, 139);
  doc.circle(mobX + 0.7, mobY + 1.7, 0.12, 'F');

  doc.text("Cell: 0302-8271166, 0347-5661000", addressX + iconOffset, 21, { maxWidth: 101 - (addressX + iconOffset) });

  // Patient / Procedure Metadata on Right (Aligned from x=102 to 196)
  doc.setLineWidth(0.5);
  doc.setDrawColor(15, 23, 42);
  doc.roundedRect(102, 6, pageWidth - 102 - 14, 28, 2, 2, 'S');
  doc.setLineWidth(0.2);

  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  
  const drawMetaRow = (label: string, value: string, y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 105, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    // Wrap text if needed
    const wrappedText = doc.splitTextToSize(value || 'N/A', pageWidth - 105 - 14 - 32);
    doc.text(wrappedText[0], 135, y);
    doc.setTextColor(71, 85, 105);
  };

  drawMetaRow("Patient Name", record.name || 'N/A', 10);
  drawMetaRow("MR Number", record.regNo || 'N/A', 14);
  drawMetaRow("Age / Gender", `${record.age || 'N/A'} / ${record.gender || 'N/A'}`, 18);
  drawMetaRow("Procedure Date", `${record.date || 'N/A'}${record.time ? ' @ ' + record.time : ''}`, 22);
  drawMetaRow("Endoscopist", record.doctor || 'N/A', 26);
  drawMetaRow("Ref. Physician", record.referringPhysician || 'N/A', 30);

  // Divide line with 3mm whitespace below header boxes
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.5);
  doc.line(14, 37, pageWidth - 14, 37);
  doc.setLineWidth(0.2);

  // Dynamic Procedure Title Banner Bar in PDF
  const procUpper = (formatProcedureDisplay(record.procedure) || 'ENDOSCOPY').trim().toUpperCase();
  const dynamicTitle = procUpper.includes('REPORT') ? procUpper : `${procUpper} REPORT`;

  doc.setFillColor(15, 23, 42); // Dark slate bg
  doc.roundedRect(14, 40, pageWidth - 28, 7.5, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(dynamicTitle, 18, 45);

  // Procedure Details Metrics Box
  const boxWidth = pageWidth - 28;
  const labelX = 18;
  const valueX = 62;
  const maxValWidth = boxWidth - (valueX - 14) - 4;

  const indicationsText = record.indications || 'N/A';
  const medicationsText = record.medications ? record.medications.toUpperCase() : 'N/A';

  const indLines = doc.splitTextToSize(indicationsText, maxValWidth);
  const medLines = doc.splitTextToSize(medicationsText, maxValWidth);

  const indHeight = Math.max(indLines.length * 3.8, 4);
  const medHeight = Math.max(medLines.length * 3.8, 4);

  const boxHeaderHeight = 10;
  const totalBoxHeight = boxHeaderHeight + indHeight + medHeight + 4;
  const metricsY = 50;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, metricsY, boxWidth, totalBoxHeight, 3, 3, 'FD');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, metricsY, boxWidth, totalBoxHeight, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("PROCEDURE SPECIFICS & CLINICAL METRICS", 18, metricsY + 5);
  doc.line(14, metricsY + 7, 14 + boxWidth, metricsY + 7);

  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  let rowY = metricsY + 11.5;

  // 1. INDICATIONS FOR EXAMINATION
  doc.setFont('helvetica', 'bold');
  doc.text("INDICATIONS FOR EXAM:", labelX, rowY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(indLines, valueX, rowY);
  doc.setTextColor(71, 85, 105);
  rowY += indHeight + 2;

  // 2. MEDICATIONS
  doc.setFont('helvetica', 'bold');
  doc.text("MEDICATIONS:", labelX, rowY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(medLines, valueX, rowY);
  doc.setTextColor(71, 85, 105);
  rowY += medHeight + 2;

  // Let's build narrative sections below with auto-wrapping
  let currentY = metricsY + totalBoxHeight + 6;

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
    } else if (title === "ASSESSMENT") {
      const isPageOne = doc.getNumberOfPages() === 1;
      const activeWidth = (hasImages && isPageOne) ? 136 : (pageWidth - 28);
      const boxX = 14;
      const innerPaddingX = 4;
      const textWidth = activeWidth - (innerPaddingX * 2);

      const rawDiagnosis = record.diagnosis || "N/A";
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isCompact ? 7.5 : 8.5);
      const splitDiag = doc.splitTextToSize(rawDiagnosis, textWidth);

      const labelHeight = isCompact ? 3.5 : 4;
      const diagLineHeight = isCompact ? 3.5 : 4.2;
      const topPadding = 3;
      const bottomPadding = 3;
      const gapAfterLabel = 1.5;

      const totalBoxHeight = topPadding + labelHeight + gapAfterLabel + (splitDiag.length * diagLineHeight) + bottomPadding;

      if (currentY + totalBoxHeight > pageHeight - 15) {
        doc.addPage();
        currentY = 20;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isCompact ? 7.5 : 9);
        doc.setTextColor(30, 41, 59);
        doc.text(title, 14, currentY);
        doc.setDrawColor(241, 245, 249);
        doc.line(14, currentY + 1.2, 14 + activeWidth, currentY + 1.2);
        currentY += isCompact ? 3.5 : 5;
      }

      const boxY = currentY;

      // Draw background and light border
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.3);
      doc.roundedRect(boxX, boxY, activeWidth, totalBoxHeight, 2, 2, 'FD');

      // Draw thick left dark accent border bar (slate-900) matching print preview
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(boxX, boxY, 1.8, totalBoxHeight, 'F');

      let innerY = boxY + topPadding + 2.5;

      // "DIAGNOSIS:" Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isCompact ? 7 : 8);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("DIAGNOSIS:", boxX + innerPaddingX + 1, innerY);

      innerY += gapAfterLabel + (isCompact ? 2.5 : 3.5);

      // Diagnosis content
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isCompact ? 7.5 : 8.5);
      doc.setTextColor(15, 23, 42);

      for (const line of splitDiag) {
        doc.text(line, boxX + innerPaddingX + 1, innerY);
        innerY += diagLineHeight;
      }

      currentY = boxY + totalBoxHeight + (isCompact ? 4 : 6);
    } else if (title === "RECOMMENDATIONS") {
      const isPageOne = doc.getNumberOfPages() === 1;
      const activeWidth = (hasImages && isPageOne) ? 136 : (pageWidth - 28);
      const boxX = 14;
      const innerPaddingX = 4;
      const textWidth = activeWidth - (innerPaddingX * 2);

      const rawRec = record.recommendations || "N/A";
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isCompact ? 7.5 : 8.5);
      const splitRec = doc.splitTextToSize(rawRec, textWidth);

      const recLineHeight = isCompact ? 3.5 : 4.2;
      const topPadding = 3.5;
      const bottomPadding = 3.5;

      const totalBoxHeight = topPadding + (splitRec.length * recLineHeight) + bottomPadding;

      if (currentY + totalBoxHeight > pageHeight - 15) {
        doc.addPage();
        currentY = 20;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isCompact ? 7.5 : 9);
        doc.setTextColor(30, 41, 59);
        doc.text(title, 14, currentY);
        doc.setDrawColor(241, 245, 249);
        doc.line(14, currentY + 1.2, 14 + activeWidth, currentY + 1.2);
        currentY += isCompact ? 3.5 : 5;
      }

      const boxY = currentY;

      // Draw background and light border
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.3);
      doc.roundedRect(boxX, boxY, activeWidth, totalBoxHeight, 2, 2, 'FD');

      let innerY = boxY + topPadding + 2.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isCompact ? 7.5 : 8.5);
      doc.setTextColor(30, 41, 59); // slate-800

      for (const line of splitRec) {
        doc.text(line, boxX + innerPaddingX, innerY);
        innerY += recLineHeight;
      }

      currentY = boxY + totalBoxHeight + (isCompact ? 4 : 6);
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

  return doc;
};

export const exportSingleEndoscopyReportPDF = async (record: EndoscopyRecord, generatedBy: string, isCompact: boolean = false) => {
  const doc = await generateSingleEndoscopyReportPDFDoc(record, generatedBy, isCompact);
  const filename = `endoscopy_procedure_report_${record.regNo}_${record.serialNo}.pdf`;
  doc.save(filename);
  triggerPDFToast(`Endoscopy procedure report for ${record.name} (${record.regNo}) generated successfully.`, 'PDF Downloaded');
};

export const getSingleEndoscopyReportPDFBlob = async (record: EndoscopyRecord, generatedBy: string, isCompact: boolean = false): Promise<{ blob: Blob; filename: string; file: File; doc: jsPDF }> => {
  const doc = await generateSingleEndoscopyReportPDFDoc(record, generatedBy, isCompact);
  const blob = doc.output('blob');
  const filename = `endoscopy_procedure_report_${record.regNo || 'record'}_${record.serialNo || 'doc'}.pdf`;
  const file = new File([blob], filename, { type: 'application/pdf' });
  return { blob, filename, file, doc };
};
