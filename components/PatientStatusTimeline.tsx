import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Patient, TransferLog, ClinicalUnit } from '../types';
import { UNIT_DETAILS, TRIAGE_COLORS } from '../constants';
import { exportPatientSummaryPDF } from '../services/pdfService';
import { useAuth } from '../contexts/AuthContext';

interface PatientStatusTimelineProps {
  patient: Patient;
  compact?: boolean;
  onClose?: () => void;
  onOpenTransferModal?: (patient: Patient) => void;
}

export const PatientStatusTimeline: React.FC<PatientStatusTimelineProps> = ({
  patient,
  compact = false,
  onClose,
  onOpenTransferModal,
}) => {
  const { currentUser, canManageRecords } = useAuth();
  const [filterType, setFilterType] = useState<'all' | 'transfers' | 'beds'>('all');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const history = patient.transferHistory || [];
  const currentDisplayName = currentUser?.displayName || currentUser?.email || 'Medical Staff';

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return 'N/A';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'N/A';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDurationText = (startIso?: string, endIso?: string) => {
    if (!startIso || !endIso) return null;
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return null;
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const mins = totalMinutes % 60;

    if (days > 0) {
      return `${days}d ${hours}h stay`;
    }
    if (hours > 0) {
      return `${hours}h ${mins}m stay`;
    }
    return `${mins}m stay`;
  };

  const getUnitBadgeColor = (unit: ClinicalUnit | string) => {
    switch (unit) {
      case 'HDU':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'ICU':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'TRANSPLANT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case '4th-WARD':
        return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'WARD5':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'ENDOSCOPY':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Determine initial admission bed/location
  const initialUnit = history.length > 0 ? history[0].fromUnit : patient.unit;
  const initialLocation = history.length > 0 ? (history[0].fromLocation || 'Initial Bed') : (patient.location || 'Admitted Bed');

  // Filter logs if user toggles filter
  const filteredHistory = history.filter((log) => {
    if (filterType === 'transfers') return log.fromUnit !== log.toUnit;
    if (filterType === 'beds') return (log.fromLocation || '') !== (log.toLocation || '');
    return true;
  });

  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    exportPatientSummaryPDF(patient, currentDisplayName);
  };

  return (
    <div className={`space-y-4 font-sans text-slate-800 ${compact ? 'p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 shadow-xs' : ''}`}>
      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[8px] font-black uppercase tracking-wider">Current Bed</span>
            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
            </svg>
          </div>
          <p className="text-xs font-black text-slate-900 truncate">{patient.location || 'Unassigned'}</p>
          <span className="text-[8.5px] font-bold text-indigo-600 mt-0.5">{patient.unit} Unit</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[8px] font-black uppercase tracking-wider">Movements</span>
            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L17.5 12M21 7.5H7.5" />
            </svg>
          </div>
          <p className="text-xs font-black text-slate-900">{history.length} Event{history.length === 1 ? '' : 's'}</p>
          <span className="text-[8.5px] font-bold text-slate-400">Total Movements</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[8px] font-black uppercase tracking-wider">Admission Date</span>
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
            </svg>
          </div>
          <p className="text-xs font-black text-slate-900">{formatDate(patient.admissionDate)}</p>
          <span className="text-[8.5px] font-bold text-emerald-600">Length of stay: {patient.lengthOfStay || 0}d</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[8px] font-black uppercase tracking-wider">Disposition / Shift</span>
            <span className={`w-2 h-2 rounded-full ${patient.dischargeDate || (patient.shiftTo && patient.shiftTo !== 'In-Unit (Active)') ? 'bg-indigo-500' : 'bg-emerald-500 animate-pulse'}`}></span>
          </div>
          <p className="text-xs font-black text-slate-900 truncate">{patient.shiftTo || (patient.dischargeDate ? 'Discharged (DC)' : 'Active In-Patient')}</p>
          <span className="text-[8.5px] font-bold text-slate-500">{patient.dischargeDate ? `DC: ${patient.dischargeDate}` : 'Currently in HDU'}</span>
        </div>
      </div>

      {/* Control Actions & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
        <div className="flex items-center space-x-1 bg-slate-200/60 p-1 rounded-xl">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              filterType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Logs ({history.length + 2})
          </button>
          <button
            onClick={() => setFilterType('transfers')}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              filterType === 'transfers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Unit Transfers
          </button>
          <button
            onClick={() => setFilterType('beds')}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              filterType === 'beds' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Bed Changes
          </button>
        </div>

        <div className="flex items-center gap-2">
          {canManageRecords && onOpenTransferModal && !patient.dischargeDate && (
            <button
              onClick={() => onOpenTransferModal(patient)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider shadow-xs transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L17.5 12M21 7.5H7.5" />
              </svg>
              <span>Transfer / Reassign Bed</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-xs cursor-pointer"
            title="Print Timeline & Clinical Summary"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 1.523a1.125 1.125 0 01-1.12 1.227H7.231c-.615 0-1.114-.507-1.12-1.125L6.34 18m11.32 0h-11.32m11.32 0a3 3 0 003-3V9.75a3 3 0 00-3-3h-11.32a3 3 0 00-3 3V15a3 3 0 003 3m11.32-11.25V4.5a2.25 2.25 0 00-2.25-2.25h-6.75a2.25 2.25 0 00-2.25 2.25v2.25m6.75 0h-6.75M8.25 10.5h.008v.008H8.25V10.5zm.375 0a.375 0 11-.75 0 .375 0 01.75 0z" />
            </svg>
            <span>Print Summary</span>
          </button>
        </div>
      </div>

      {/* Visual Status Timeline Trail */}
      <div className="relative pl-6 pr-2 py-2 border-l-2 border-slate-200 space-y-6 ml-3">
        {/* EVENT 1: ADMISSION */}
        <div className="relative group">
          {/* Timeline Node Ring */}
          <span className="absolute -left-[33px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-white shadow-sm">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </span>

          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Initial Admission
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[8.5px] font-bold border ${getUnitBadgeColor(initialUnit)}`}>
                  {initialUnit}
                </span>
              </div>
              <span className="text-[9px] font-mono font-bold text-slate-400">{formatDate(patient.admissionDate)}</span>
            </div>

            <div className="text-[10px] text-slate-700 font-medium space-y-1 bg-slate-50/80 p-2 rounded-lg border border-slate-100">
              <p className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Assigned Bed Location:</span>
                <span className="font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                  {initialLocation}
                </span>
              </p>
              <p className="flex items-center justify-between text-[9px]">
                <span className="font-bold text-slate-500 uppercase tracking-wider">Attending Consultant:</span>
                <span className="font-bold text-slate-800">{patient.consultant}</span>
              </p>
            </div>
          </div>
        </div>

        {/* EVENT LOGS 2..N: TRANSFERS & BED CHANGES */}
        {filteredHistory.length === 0 && history.length > 0 ? (
          <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-center text-[10px] text-amber-800 font-medium">
            No events match the selected filter tab.
          </div>
        ) : filteredHistory.length === 0 && history.length === 0 ? (
          <div className="relative group">
            {/* Timeline Node Ring */}
            <span className="absolute -left-[33px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-slate-600 ring-4 ring-white shadow-xs">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>

            <div className="bg-slate-50/90 p-3.5 rounded-xl border border-dashed border-slate-300 text-slate-600 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                  Continuous Single Stay
                </span>
                <span className="text-[8.5px] font-bold text-slate-400">
                  {getDurationText(patient.admissionDate, new Date().toISOString()) || 'Active Stay'}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-600 pt-0.5">
                No internal unit transfers or bed reassignments recorded. Patient has remained in initial assigned location <strong className="text-slate-800 font-bold">{initialLocation}</strong> since admission.
              </p>
            </div>
          </div>
        ) : (
          filteredHistory.map((log, index) => {
            const isUnitChange = log.fromUnit !== log.toUnit;
            const isExpanded = expandedIndex === index;
            const prevIso = index === 0 ? patient.admissionDate : filteredHistory[index - 1].timestamp;
            const durationBadge = getDurationText(prevIso, log.timestamp);

            return (
              <div key={index} className="relative group">
                {/* Timeline Node Ring */}
                <span
                  className={`absolute -left-[33px] top-1 flex h-5 w-5 items-center justify-center rounded-full text-white ring-4 ring-white shadow-sm ${
                    isUnitChange ? 'bg-red-600' : 'bg-indigo-600'
                  }`}
                >
                  {isUnitChange ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L17.5 12M21 7.5H7.5" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
                    </svg>
                  )}
                </span>

                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[8.5px] font-bold border ${getUnitBadgeColor(log.fromUnit)}`}>
                        {log.fromUnit}
                      </span>
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      <span className={`px-2 py-0.5 rounded-md text-[8.5px] font-extrabold border ${getUnitBadgeColor(log.toUnit)}`}>
                        {log.toUnit}
                      </span>

                      {isUnitChange ? (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-red-100 text-red-700">
                          Unit Transfer
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-indigo-100 text-indigo-700">
                          Bed Reassignment
                        </span>
                      )}

                      {durationBadge && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                          ⏱ {durationBadge}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] font-mono font-bold text-slate-400">{formatDateTime(log.timestamp)}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9.5px] font-medium bg-slate-50/90 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Bed Movement:</span>
                      <div className="flex items-center gap-1 text-slate-900 font-extrabold">
                        <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{log.fromLocation || 'N/A'}</span>
                        <span className="text-slate-400">&rarr;</span>
                        <span className="bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-200">{log.toLocation || 'N/A'}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Clinical Reason:</span>
                      <p className="text-slate-800 font-semibold">{log.reason || 'Routine clinical management transfer'}</p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[8.5px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>Authorized by: <strong className="text-slate-700">{log.performedBy || 'Clinical Staff'}</strong></span>
                    <span className="text-indigo-600 hover:underline">
                      {isExpanded ? 'Less details &laquo;' : 'More details &raquo;'}
                    </span>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2.5 pt-2 border-t border-slate-200/80 text-[9px] text-slate-600 space-y-1 overflow-hidden"
                      >
                        <p><strong className="font-bold text-slate-800">Event ID:</strong> {log.timestamp}</p>
                        <p><strong className="font-bold text-slate-800">Origin Unit:</strong> {UNIT_DETAILS[log.fromUnit as ClinicalUnit]?.label || log.fromUnit}</p>
                        <p><strong className="font-bold text-slate-800">Destination Unit:</strong> {UNIT_DETAILS[log.toUnit as ClinicalUnit]?.label || log.toUnit}</p>
                        <p><strong className="font-bold text-slate-800">Transfer Reason Details:</strong> {log.reason}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })
        )}

        {/* EVENT FINAL: CURRENT BED STATUS */}
        <div className="relative group">
          {/* Timeline Node Ring */}
          <span
            className={`absolute -left-[33px] top-1 flex h-5 w-5 items-center justify-center rounded-full text-white ring-4 ring-white shadow-md ${
              patient.dischargeDate ? 'bg-slate-600' : 'bg-red-600 animate-pulse'
            }`}
          >
            {patient.dischargeDate ? (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
          </span>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-3.5 rounded-xl shadow-md border border-slate-700">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-red-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                Current Active Status
              </span>
              <span className="text-[8.5px] font-mono text-slate-300">
                {patient.dischargeDate ? `Discharged: ${formatDate(patient.dischargeDate)}` : 'Active In-Bed'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-800">
              <div>
                <p className="text-xs font-black text-white">{patient.name}</p>
                <p className="text-[9px] text-slate-300 font-mono">MR No: {patient.regNo} &bull; {patient.category}</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block">Bed Assignment</span>
                  <span className="text-xs font-black text-indigo-300 bg-indigo-950/80 px-2.5 py-0.5 rounded border border-indigo-800/80">
                    {patient.location || 'N/A'} ({patient.unit})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
