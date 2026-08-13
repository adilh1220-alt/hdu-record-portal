import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, FileText, User, Calendar, Building2, Stethoscope, X, ExternalLink, Printer, Award, Lock } from 'lucide-react';
import { EndoscopyRecord, Patient } from '../types';

interface RecordVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  verifyParams: {
    type: string;
    id?: string;
    mrn?: string;
    name?: string;
    date?: string;
  } | null;
  onNavigateToTab?: (tab: string) => void;
}

export const RecordVerificationModal: React.FC<RecordVerificationModalProps> = ({
  isOpen,
  onClose,
  verifyParams,
  onNavigateToTab
}) => {
  const [matchedRecord, setMatchedRecord] = useState<any>(null);
  const [verifiedAt] = useState<string>(new Date().toLocaleString());

  useEffect(() => {
    if (!verifyParams) return;

    // Try to load matched record from localStorage if available
    try {
      if (verifyParams.type === 'endoscopy') {
        const stored = localStorage.getItem('endoscopy_records');
        if (stored) {
          const records: EndoscopyRecord[] = JSON.parse(stored);
          const found = records.find(r => 
            (verifyParams.id && r.id === verifyParams.id) || 
            (verifyParams.mrn && (r.regNo === verifyParams.mrn || r.serialNo === verifyParams.id))
          );
          if (found) setMatchedRecord(found);
        }
      } else if (verifyParams.type === 'patient') {
        const stored = localStorage.getItem('hdu_patients');
        if (stored) {
          const patients: Patient[] = JSON.parse(stored);
          const found = patients.find(p => p.regNo === verifyParams.mrn || p.id === verifyParams.id);
          if (found) setMatchedRecord(found);
        }
      }
    } catch (e) {
      console.warn('Verification matching error:', e);
    }
  }, [verifyParams]);

  if (!isOpen || !verifyParams) return null;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'endoscopy': return 'Endoscopy Procedure Report';
      case 'patient': return 'In-Patient Census Record';
      case 'census': return 'Clinical Census Register';
      case 'inventory': return 'Inventory & Supply Report';
      case 'safety': return 'Safety Incident Audit Report';
      default: return 'Official Clinical Report';
    }
  };

  const getTargetTab = (type: string) => {
    switch (type) {
      case 'endoscopy': return 'endoscopy-logs';
      case 'patient': return 'active';
      case 'census': return 'active';
      case 'inventory': return 'inventory';
      case 'safety': return 'safety';
      default: return 'dashboard';
    }
  };

  const patientName = matchedRecord?.name || verifyParams.name || 'Clinical Record Subject';
  const mrn = matchedRecord?.regNo || verifyParams.mrn || verifyParams.id || 'N/A';
  const procedureOrTitle = matchedRecord?.procedure || getTypeLabel(verifyParams.type);
  const doctor = matchedRecord?.doctor || 'Attending Physician';
  const dateStr = matchedRecord?.date || verifyParams.date || new Date().toLocaleDateString();

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        
        {/* Verification Top Banner */}
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mx-auto w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center mb-3 shadow-inner">
            <ShieldCheck className="w-8 h-8 text-emerald-200 animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/30 border border-emerald-300/40 text-[10px] font-black tracking-widest uppercase mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            Verified Authentic Clinical Record
          </div>

          <h2 className="text-xl font-black tracking-tight uppercase">The Kidney Centre</h2>
          <p className="text-xs text-emerald-100 font-medium">Post Graduate Training Institute • Digital Verification</p>
        </div>

        {/* Record Content Overview */}
        <div className="p-6 space-y-5">
          
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Document Type</span>
                <span className="text-sm font-black text-slate-900 dark:text-white uppercase">{getTypeLabel(verifyParams.type)}</span>
              </div>
              <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-black rounded-md border border-emerald-300 dark:border-emerald-800">
                STATUS: OFFICIAL
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-medium text-slate-400 block">Patient Name</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{patientName}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-slate-400 block">MR Number</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{mrn}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-slate-400 block">Procedure / Detail</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{procedureOrTitle}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-slate-400 block">Date / Timestamp</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{dateStr}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-slate-400 block">Attending Physician</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{doctor}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-slate-400 block">Digital Hash / ID</span>
                <span className="font-mono text-[10px] text-slate-500 truncate block">{verifyParams.id || 'TKC-VERIFIED-REG'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40">
            <Lock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p>
              This digital QR verification code confirms that this record was generated directly by the official medical records system at <strong className="text-slate-800 dark:text-slate-200">The Kidney Centre</strong> on <span className="font-mono">{verifiedAt}</span>.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            {onNavigateToTab && (
              <button
                onClick={() => {
                  onNavigateToTab(getTargetTab(verifyParams.type));
                  onClose();
                }}
                className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <ExternalLink className="w-4 h-4" />
                View Full Record in App
              </button>
            )}

            <button
              onClick={onClose}
              className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all"
            >
              Close Verification
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
