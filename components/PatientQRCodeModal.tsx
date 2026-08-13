import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Modal from './Modal';
import { Patient, EndoscopyRecord } from '../types';
import { 
  QrCode, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  User, 
  Building, 
  Calendar, 
  ShieldAlert, 
  FileText,
  Sparkles
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { generateKidneyCentreLogoBase64, getEffectiveLogoBase64 } from '../services/pdfService';

interface PatientQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | EndoscopyRecord | null;
  type?: 'patient' | 'endoscopy';
}

export const PatientQRCodeModal: React.FC<PatientQRCodeModalProps> = ({
  isOpen,
  onClose,
  patient,
  type = 'patient'
}) => {
  const [copied, setCopied] = useState(false);

  if (!patient) return null;

  const regNo = patient.regNo || 'N/A';
  const name = patient.name || 'Unknown Patient';
  const unit = ('unit' in patient ? patient.unit : patient.referringUnit) || 'HDU';
  const consultant = ('consultant' in patient ? patient.consultant : patient.doctor) || 'N/A';
  const location = ('location' in patient ? patient.location : 'Endoscopy Suite') || 'N/A';
  const category = ('category' in patient ? patient.category : 'Endoscopy') || 'N/A';
  const codeStatus = ('codeStatus' in patient ? patient.codeStatus : 'Full Code') || 'Full Code';
  const admissionDate = ('admissionDate' in patient ? patient.admissionDate : patient.date) || 'N/A';

  // Construct structured QR payload
  const qrPayloadData = {
    app: 'TheKidneyCentre-HDU',
    recordType: type,
    id: patient.id,
    regNo: regNo,
    name: name,
    unit: unit,
    location: location,
    consultant: consultant,
    category: category,
    codeStatus: codeStatus,
    admissionDate: admissionDate,
    timestamp: new Date().toISOString()
  };

  const qrPayloadString = JSON.stringify(qrPayloadData);

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(qrPayloadString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPNG = () => {
    const svgElement = document.getElementById('patient-qr-svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 1000;
      canvas.height = 1000;
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 100, 100, 800, 800);

        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `QR_Bedside_${regNo.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleDownloadPDFBadge = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [100, 150] // Bedside Card format (100mm x 150mm)
    });

    const logoBase64 = getEffectiveLogoBase64();

    // Background Card Styling
    doc.setFillColor(250, 250, 250);
    doc.rect(0, 0, 100, 150, 'F');

    // Top Header Banner
    doc.setFillColor(185, 28, 28); // Red
    doc.rect(0, 0, 100, 18, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('HIGH DEPENDENCY UNIT', 50, 9, { align: 'center' });
    doc.setFontSize(8);
    doc.text('PATIENT BEDSIDE QR IDENTIFIER', 50, 14, { align: 'center' });

    // Institution Logo
    try {
      doc.addImage(logoBase64, 'PNG', 35, 22, 30, 12);
    } catch {
      // ignore
    }

    // Patient Details
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(name, 50, 40, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(185, 28, 28);
    doc.text(`MRN: ${regNo}`, 50, 46, { align: 'center' });

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(10, 50, 90, 50);

    // Metadata Table Box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(10, 53, 80, 28, 2, 2, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    doc.text(`Unit: `, 14, 59);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${unit}`, 32, 59);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Bed/Loc: `, 14, 65);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${location}`, 32, 65);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Consultant: `, 14, 71);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${consultant}`, 32, 71);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Code Status: `, 14, 77);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text(`${codeStatus}`, 32, 77);

    // QR Code Image onto PDF
    const svgElement = document.getElementById('patient-qr-svg');
    if (svgElement) {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        canvas.width = 400;
        canvas.height = 400;
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, 400, 400);
          ctx.drawImage(img, 0, 0, 400, 400);
          const qrPng = canvas.toDataURL('image/png');
          doc.addImage(qrPng, 'PNG', 28, 85, 44, 44);

          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.setFont('helvetica', 'bold');
          doc.text('Scan using mobile camera for instant record access', 50, 134, { align: 'center' });

          doc.setFontSize(6);
          doc.setFont('helvetica', 'normal');
          doc.text(`Generated on ${new Date().toLocaleDateString('en-US')}`, 50, 138, { align: 'center' });

          doc.save(`Bedside_QR_Badge_${regNo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
        }
      };

      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bedside Medical QR Identifier">
      <div className="space-y-6">
        {/* Main Card */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-5 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-emerald-500 to-red-600"></div>

          {/* Patient Header */}
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 border border-red-800/60 text-red-400 text-[10px] font-black uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              <span>{unit} Bedside Tag</span>
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">{name}</h3>
            <p className="text-xs font-mono font-bold text-red-400">MRN: {regNo}</p>
          </div>

          {/* QR Container */}
          <div className="inline-block p-4 bg-white rounded-2xl shadow-2xl border-4 border-slate-800 mx-auto">
            <QRCodeSVG
              id="patient-qr-svg"
              value={qrPayloadString}
              size={180}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 gap-2 text-left bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-xs">
            <div>
              <span className="text-[9px] font-black text-slate-500 uppercase block">Location</span>
              <span className="font-bold text-slate-200">{location}</span>
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-500 uppercase block">Code Status</span>
              <span className="font-bold text-red-400">{codeStatus}</span>
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-500 uppercase block">Consultant</span>
              <span className="font-bold text-slate-200 truncate block">{consultant}</span>
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-500 uppercase block">Category</span>
              <span className="font-bold text-slate-200">{category}</span>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleDownloadPDFBadge}
            className="flex items-center justify-center gap-2 py-3 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print Badge PDF</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPNG}
            className="flex items-center justify-center gap-2 py-3 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Save QR Image</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPayload}
            className="flex items-center justify-center gap-2 py-3 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied Data' : 'Copy Payload'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PatientQRCodeModal;
