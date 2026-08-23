import React, { useState, useEffect, useMemo } from 'react';
import { UserActivity, activityService } from '../services/activityService';
import { webAuthnService, BiometricCredential } from '../services/webAuthnService';
import { 
  Fingerprint, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Smartphone, 
  Laptop, 
  KeyRound, 
  RefreshCw, 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  Clock, 
  Shield, 
  AlertTriangle, 
  Zap, 
  Eye, 
  UserCheck, 
  UserX,
  FileSpreadsheet,
  Info,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import Modal from './Modal';

interface BiometricAuditLogTabProps {
  onRefreshEnrolled?: () => void;
}

export const BiometricAuditLogTab: React.FC<BiometricAuditLogTabProps> = ({ onRefreshEnrolled }) => {
  const [logs, setLogs] = useState<UserActivity[]>([]);
  const [enrolledCreds, setEnrolledCreds] = useState<BiometricCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [maxLogs, setMaxLogs] = useState(50);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED' | 'ENROLLED' | 'REVOKED'>('ALL');
  const [deviceFilter, setDeviceFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Log Modal
  const [selectedLog, setSelectedLog] = useState<UserActivity | null>(null);

  useEffect(() => {
    loadLogs();
  }, [maxLogs]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const [bioLogs, creds] = await Promise.all([
        webAuthnService.getBiometricAuthLogs(maxLogs),
        webAuthnService.getCredentials()
      ]);
      setLogs(bioLogs);
      setEnrolledCreds(creds);
    } catch (err) {
      console.warn('Failed to load biometric security logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    if (onRefreshEnrolled) onRefreshEnrolled();
  };

  // Filtered & Sorted Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Status Filter
      if (statusFilter === 'SUCCESS') {
        const isSuccess = log.status === 'SUCCESS' && (log.action === 'AUTH_LOGIN' || log.action === 'BIOMETRIC_LOGIN_SUCCESS');
        if (!isSuccess) return false;
      } else if (statusFilter === 'FAILED') {
        const isFailed = log.status === 'ERROR' || log.action === 'BIOMETRIC_FAILED' || log.action === 'AUTH_FAILED';
        if (!isFailed) return false;
      } else if (statusFilter === 'ENROLLED') {
        if (log.action !== 'BIOMETRIC_ENROLLED') return false;
      } else if (statusFilter === 'REVOKED') {
        if (log.action !== 'BIOMETRIC_REVOKED') return false;
      }

      // 2. Device Filter
      if (deviceFilter !== 'ALL') {
        const device = (log.metadata?.deviceName || '').toLowerCase();
        if (deviceFilter === 'MOTO' && !device.includes('moto') && !device.includes('android')) return false;
        if (deviceFilter === 'APPLE' && !device.includes('apple') && !device.includes('touch id') && !device.includes('face id') && !device.includes('mac')) return false;
        if (deviceFilter === 'WINDOWS' && !device.includes('windows') && !device.includes('hello')) return false;
        if (deviceFilter === 'KEY' && !device.includes('fido') && !device.includes('key') && !device.includes('usb')) return false;
      }

      // 3. Date Filter
      if (startDate) {
        const logDate = new Date(log.timestamp);
        logDate.setHours(0, 0, 0, 0);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (logDate < start) return false;
      }
      if (endDate) {
        const logDate = new Date(log.timestamp);
        logDate.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        if (logDate > end) return false;
      }

      // 4. Search Filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const actor = (log.performedBy || '').toLowerCase();
        const details = (log.details || '').toLowerCase();
        const email = (log.metadata?.email || log.metadata?.attemptedEmail || '').toLowerCase();
        const device = (log.metadata?.deviceName || '').toLowerCase();
        const failReason = (log.metadata?.failureReason || '').toLowerCase();

        return (
          actor.includes(term) ||
          details.includes(term) ||
          email.includes(term) ||
          device.includes(term) ||
          failReason.includes(term)
        );
      }

      return true;
    });
  }, [logs, statusFilter, deviceFilter, startDate, endDate, searchTerm]);

  // Telemetry Calculations
  const telemetry = useMemo(() => {
    const total = logs.length;
    const successes = logs.filter(l => l.status === 'SUCCESS' && (l.action === 'AUTH_LOGIN' || l.action === 'BIOMETRIC_LOGIN_SUCCESS')).length;
    const failures = logs.filter(l => l.status === 'ERROR' || l.action === 'BIOMETRIC_FAILED' || l.action === 'AUTH_FAILED').length;
    const enrollments = logs.filter(l => l.action === 'BIOMETRIC_ENROLLED').length;
    const revocations = logs.filter(l => l.action === 'BIOMETRIC_REVOKED').length;
    const successRate = (successes + failures) > 0 
      ? Math.round((successes / (successes + failures)) * 100) 
      : 100;

    const motoCount = logs.filter(l => (l.metadata?.deviceName || '').toLowerCase().includes('moto') || (l.metadata?.deviceName || '').toLowerCase().includes('android')).length;

    return {
      total,
      successes,
      failures,
      enrollments,
      revocations,
      successRate,
      motoCount,
      activeCredsCount: enrolledCreds.length
    };
  }, [logs, enrolledCreds]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Timestamp', 'Event Type', 'Outcome', 'Clinician Email / Actor', 'Device Name', 'Authenticator Type', 'Details / Failure Reason'];
    const rows = filteredLogs.map(log => [
      `"${new Date(log.timestamp).toLocaleString()}"`,
      `"${log.action}"`,
      `"${log.status || 'INFO'}"`,
      `"${log.metadata?.email || log.performedBy || 'Unknown'}"`,
      `"${log.metadata?.deviceName || 'N/A'}"`,
      `"${log.metadata?.authenticatorType || 'platform'}"`,
      `"${(log.metadata?.failureReason || log.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `biometric_security_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getEventBadge = (log: UserActivity) => {
    if (log.action === 'BIOMETRIC_ENROLLED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
          <Sparkles className="w-3 h-3 text-blue-600" />
          Passkey Enrolled
        </span>
      );
    }
    if (log.action === 'BIOMETRIC_REVOKED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
          <UserX className="w-3 h-3 text-amber-600" />
          Passkey Revoked
        </span>
      );
    }
    if (log.status === 'SUCCESS' || log.action === 'AUTH_LOGIN' || log.action === 'BIOMETRIC_LOGIN_SUCCESS') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Verified / Sign-In
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
        <XCircle className="w-3 h-3 text-red-600" />
        Challenge Failed
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Security Status */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden border border-slate-800 shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
              <Fingerprint className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                  Biometric Authentication & Passkey Security Log
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Auditing Active
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed max-w-2xl">
                Real-time cryptographic audit trail of biometric sign-ins, fingerprint verification challenges, Moto G54 sensors, and passkey credential lifecycles for hospital compliance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-black uppercase tracking-wider flex items-center gap-2 border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
              title="Export Current Log to CSV"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Log</span>
            </button>
          </div>
        </div>

        {/* Real-time Telemetry Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80 text-left">
          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
              Total Logged
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-white font-mono">{telemetry.total}</span>
              <span className="text-[10px] text-slate-400">events</span>
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
              Successful Sign-Ins
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-emerald-400 font-mono">{telemetry.successes}</span>
              <span className="text-[10px] text-emerald-500/80 font-bold">verified</span>
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[9px] font-black uppercase tracking-widest text-red-400 block mb-1">
              Failed / Cancelled
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-red-400 font-mono">{telemetry.failures}</span>
              <span className="text-[10px] text-red-400/80 font-bold">flagged</span>
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
              Verification Rate
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-white font-mono">{telemetry.successRate}%</span>
              <span className="text-[10px] text-slate-400">efficiency</span>
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 block mb-1">
              Enrolled Passkeys
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-blue-400 font-mono">{telemetry.activeCredsCount}</span>
              <span className="text-[10px] text-blue-300">devices</span>
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[9px] font-black uppercase tracking-widest text-orange-400 block mb-1">
              Moto G54 / Android
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-orange-400 font-mono">{telemetry.motoCount}</span>
              <span className="text-[10px] text-orange-300">mobile hits</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search clinician, device, email or error..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-red-100 outline-none transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 no-scrollbar">
            {[
              { id: 'ALL', label: 'All Events', count: logs.length },
              { id: 'SUCCESS', label: 'Verified Sign-Ins', count: telemetry.successes },
              { id: 'FAILED', label: 'Failed Challenges', count: telemetry.failures },
              { id: 'ENROLLED', label: 'Enrollments', count: telemetry.enrollments },
              { id: 'REVOKED', label: 'Revocations', count: telemetry.revocations }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-mono ${
                  statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filter Row: Device Type, Dates & Limits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Hardware / Device</label>
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-red-200"
            >
              <option value="ALL">All Hardware Types</option>
              <option value="MOTO">Moto G54 / Android</option>
              <option value="APPLE">Apple (Touch ID / Face ID / Mac)</option>
              <option value="WINDOWS">Windows Hello</option>
              <option value="KEY">FIDO2 / Security Key</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Fetch Depth Limit</label>
            <select
              value={maxLogs}
              onChange={(e) => setMaxLogs(Number(e.target.value))}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value={25}>Last 25 Events</option>
              <option value={50}>Last 50 Events</option>
              <option value={100}>Last 100 Events</option>
              <option value={200}>Last 200 Events</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-600" />
              Authentication Event Stream
            </h4>
            <span className="text-[9px] bg-slate-900 text-white px-2 py-0.5 rounded-full font-black tracking-tight">
              {filteredLogs.length} MATCHING
            </span>
          </div>
          <span className="text-[9px] text-slate-400 font-bold hidden sm:inline-block">
            Click any row to inspect cryptographic payload
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-red-200 border-t-red-600 rounded-full animate-spin" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Biometric Security Stream...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                <Fingerprint className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-xs font-black text-slate-600 uppercase tracking-wide">
                No biometric events matching your filters
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Biometric login attempts from Moto G54, Apple Touch ID, and Windows Hello will appear here automatically.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider select-none">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Status & Outcome</th>
                  <th className="px-6 py-4">Clinician / Actor</th>
                  <th className="px-6 py-4">Device & Hardware</th>
                  <th className="px-6 py-4">Diagnostic Details</th>
                  <th className="px-6 py-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredLogs.map((log) => {
                  const isError = log.status === 'ERROR' || log.action === 'BIOMETRIC_FAILED' || log.action === 'AUTH_FAILED';
                  const isEnroll = log.action === 'BIOMETRIC_ENROLLED';
                  const isRevoke = log.action === 'BIOMETRIC_REVOKED';
                  const deviceName = log.metadata?.deviceName || 'Standard Authenticator';
                  const isMoto = deviceName.toLowerCase().includes('moto') || deviceName.toLowerCase().includes('android');

                  return (
                    <tr 
                      key={log.id || `${log.timestamp}_${log.action}`}
                      onClick={() => setSelectedLog(log)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                        isError ? 'bg-red-50/20' : isEnroll ? 'bg-blue-50/15' : ''
                      }`}
                    >
                      {/* Timestamp */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-xs">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium">
                            {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getEventBadge(log)}
                      </td>

                      {/* Clinician */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 text-xs">
                            {log.metadata?.displayName || log.performedBy || 'Clinician'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono lowercase">
                            {log.metadata?.email || log.metadata?.attemptedEmail || 'staff@hospital.org'}
                          </span>
                        </div>
                      </td>

                      {/* Hardware / Device */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                            isMoto 
                              ? 'bg-red-50 text-red-600 border-red-200' 
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            <Smartphone className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 block truncate max-w-[160px]">
                                {deviceName}
                              </span>
                              {isMoto && (
                                <span className="text-[7px] bg-red-100 text-red-800 font-black px-1.5 py-0.2 rounded uppercase">
                                  MOTO
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400 block uppercase tracking-tight">
                              {log.metadata?.authenticatorType ? `${log.metadata.authenticatorType} Enclave` : 'Hardware TPM'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Diagnostic details */}
                      <td className="px-6 py-4 max-w-xs">
                        <p className={`text-[11px] truncate leading-relaxed ${
                          isError ? 'text-red-700 font-bold' : 'text-slate-600'
                        }`} title={log.metadata?.failureReason || log.details}>
                          {log.metadata?.failureReason || log.details}
                        </p>
                      </td>

                      {/* Inspect action */}
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 group-hover:text-red-600 transition-colors"
                          title="View Security Payload"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-slate-900 px-6 py-3 border-t border-slate-800 flex items-center justify-between text-[9px] text-slate-400 font-black uppercase tracking-widest">
          <span>Medical Security Operations Center</span>
          <span>WebAuthn FIDO2 & Android Biometric Standards</span>
        </div>
      </div>

      {/* Security Telemetry & Inspection Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title="Biometric Security Inspection"
          maxWidth="max-w-xl"
        >
          <div className="space-y-4 text-left p-1">
            {/* Header Badge */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedLog.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                    {selectedLog.action}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <div>
                {getEventBadge(selectedLog)}
              </div>
            </div>

            {/* Diagnostic Message Card */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                Audit Log Description
              </span>
              <p className="text-xs text-slate-800 font-medium leading-relaxed">
                {selectedLog.details}
              </p>
            </div>

            {/* Device & Clinician Breakdown Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">
                  Clinician Identity
                </span>
                <p className="font-bold text-slate-900 truncate">
                  {selectedLog.metadata?.displayName || selectedLog.performedBy}
                </p>
                <p className="text-[10px] text-slate-500 font-mono truncate">
                  {selectedLog.metadata?.email || selectedLog.metadata?.attemptedEmail || 'N/A'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">
                  Hardware Authenticator
                </span>
                <p className="font-bold text-slate-900 truncate">
                  {selectedLog.metadata?.deviceName || 'Default Device'}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  {selectedLog.metadata?.authenticatorType || 'Platform TPM'}
                </p>
              </div>
            </div>

            {/* Failure diagnostics if applicable */}
            {selectedLog.metadata?.failureReason && (
              <div className="p-3.5 bg-red-50 rounded-xl border border-red-200 text-red-900 space-y-1">
                <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-tight text-red-950">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  <span>Reported Challenge Failure</span>
                </div>
                <p className="text-xs font-medium text-red-800">
                  {selectedLog.metadata.failureReason}
                </p>
                {selectedLog.metadata?.errorCode && (
                  <span className="inline-block text-[9px] font-mono bg-red-200/60 text-red-950 px-2 py-0.5 rounded">
                    Error Code: {selectedLog.metadata.errorCode}
                  </span>
                )}
              </div>
            )}

            {/* Raw Security Telemetry Payload */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block ml-1">
                Raw Metadata Payload (JSON)
              </span>
              <pre className="p-3 bg-slate-950 text-emerald-400 font-mono text-[10px] rounded-xl overflow-x-auto max-h-36 border border-slate-800">
                {JSON.stringify(selectedLog.metadata || {}, null, 2)}
              </pre>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition-all"
            >
              Close Telemetry
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BiometricAuditLogTab;
