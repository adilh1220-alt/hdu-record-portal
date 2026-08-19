import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Send, 
  ShieldAlert, 
  ShieldCheck, 
  Server, 
  Lock, 
  ExternalLink, 
  Trash2, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  Mail, 
  HelpCircle,
  Terminal,
  Settings
} from 'lucide-react';
import { dailyReportService } from '../services/dailyReportService';
import { SmtpDiagnosticResult, SmtpDiagnosticLog, SmtpDiagnosticStatus } from '../types';

interface EmailConnectionDiagnosticProps {
  onOpenSmtpConfig?: () => void;
  className?: string;
  isCompact?: boolean;
}

export const EmailConnectionDiagnostic: React.FC<EmailConnectionDiagnosticProps> = ({
  onOpenSmtpConfig,
  className = '',
  isCompact = false
}) => {
  const [running, setRunning] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<SmtpDiagnosticResult | null>(null);
  const [logs, setLogs] = useState<SmtpDiagnosticLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [sendTestMail, setSendTestMail] = useState(false);
  const [testRecipient, setTestRecipient] = useState('adilh1220@gmail.com');
  const [filter, setFilter] = useState<'ALL' | 'PASSED' | 'FAILED'>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);

  // Custom override parameters for testing
  const [customHost, setCustomHost] = useState('');
  const [customPort, setCustomPort] = useState<number | ''>('');
  const [customUser, setCustomUser] = useState('');
  const [customPass, setCustomPass] = useState('');

  // Load diagnostic logs on mount
  useEffect(() => {
    fetchLogs();
    // Run initial fast probe
    handleRunDiagnostic(false);
  }, []);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await dailyReportService.getDiagnosticLogs();
      setLogs(data);
    } catch (err) {
      console.warn('Failed to load logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRunDiagnostic = async (withTestMail: boolean = sendTestMail) => {
    setRunning(true);
    try {
      const params: any = {
        sendTestMail: withTestMail,
        testEmail: testRecipient.trim() || undefined
      };

      if (customHost.trim()) params.host = customHost.trim();
      if (customPort !== '') params.port = Number(customPort);
      if (customUser.trim()) params.user = customUser.trim();
      if (customPass.trim()) params.pass = customPass.trim();

      const result = await dailyReportService.runDiagnosticProbe(params);
      setDiagnosticResult(result);
      if (result.user && !testRecipient) {
        setTestRecipient(result.user);
      }
      await fetchLogs();
    } catch (err: any) {
      console.error('Diagnostic error:', err);
    } finally {
      setRunning(false);
    }
  };

  const handleClearLogs = async () => {
    if (window.confirm('Are you sure you want to clear all diagnostic audit logs?')) {
      await dailyReportService.clearDiagnosticLogs();
      setLogs([]);
    }
  };

  const getStatusBadge = (status?: SmtpDiagnosticStatus) => {
    switch (status) {
      case 'AUTHENTICATED':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
          icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
          label: 'AUTHENTICATED & READY',
          desc: 'Credentials verified with Google SMTP Mail Server.'
        };
      case 'AUTH_FAILED':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
          icon: <ShieldAlert className="w-4 h-4 text-rose-600" />,
          label: 'AUTHENTICATION REJECTED (Google 535)',
          desc: 'Google rejected password. A 16-character App Password is required.'
        };
      case 'TIMEOUT':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
          icon: <Clock className="w-4 h-4 text-amber-600" />,
          label: 'SOCKET TIMEOUT (Port 587)',
          desc: 'Connection timed out. Network or firewall blocking port 587.'
        };
      case 'UNREACHABLE':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
          icon: <XCircle className="w-4 h-4 text-red-600" />,
          label: 'HOST UNREACHABLE',
          desc: 'Could not resolve smtp.gmail.com or connection refused.'
        };
      case 'NOT_CONFIGURED':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
          icon: <AlertTriangle className="w-4 h-4 text-slate-500" />,
          label: 'NOT CONFIGURED',
          desc: 'SMTP Username or App Password is missing.'
        };
      default:
        return {
          bg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800',
          icon: <Server className="w-4 h-4 text-sky-600" />,
          label: 'CONNECTING...',
          desc: 'Diagnostic probe initializing.'
        };
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'PASSED') return log.status === 'PASSED';
    if (filter === 'FAILED') return log.status === 'FAILED';
    return true;
  });

  const currentBadge = getStatusBadge(diagnosticResult?.status);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Header Card */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30">
                <Activity className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black tracking-tight">Email Connection Diagnostic</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-900/60 text-sky-300 border border-sky-700/50">
                LIVE PROBE
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Real-time socket, TLS handshake, and Google SMTP credential verification engine to pinpoint connection, timeout, and authentication failures.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenSmtpConfig && (
              <button
                type="button"
                onClick={onOpenSmtpConfig}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
              >
                <Settings className="w-3.5 h-3.5 text-sky-400" />
                Configure SMTP
              </button>
            )}

            <button
              type="button"
              onClick={() => handleRunDiagnostic(sendTestMail)}
              disabled={running}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {running ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Running Probe...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  Run Diagnostics
                </>
              )}
            </button>
          </div>
        </div>

        {/* Real-time Status Strip */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-700">
              {currentBadge.icon}
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Connection State</span>
              <span className="text-xs font-black text-white">{currentBadge.label}</span>
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Probe Latency</span>
              <span className="text-xs font-black text-emerald-400 font-mono">
                {diagnosticResult ? `${diagnosticResult.latencyMs} ms` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 ml-1">
                {diagnosticResult && diagnosticResult.latencyMs < 300 ? '(Fast)' : diagnosticResult ? '(Standard)' : ''}
              </span>
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-sky-400">
              <Server className="w-4 h-4" />
            </div>
            <div className="truncate">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Target SMTP Host</span>
              <span className="text-xs font-bold text-slate-200 font-mono truncate block">
                {diagnosticResult?.host || 'smtp.gmail.com'}:{diagnosticResult?.port || 587}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Step Diagnostic Visual Pipeline */}
      {diagnosticResult && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-600" />
              Diagnostic Probe Execution Stages
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              Checked at {new Date(diagnosticResult.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {diagnosticResult.steps.map((step, idx) => {
              const isPassed = step.status === 'PASSED';
              const isFailed = step.status === 'FAILED';
              const isRunning = step.status === 'RUNNING';
              const isSkipped = step.status === 'SKIPPED';

              let cardBg = 'bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800';
              let icon = <Clock className="w-4 h-4 text-slate-400" />;
              let badgeColor = 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300';

              if (isPassed) {
                cardBg = 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50';
                icon = <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
                badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300';
              } else if (isFailed) {
                cardBg = 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50';
                icon = <XCircle className="w-4 h-4 text-rose-600" />;
                badgeColor = 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300';
              } else if (isRunning) {
                cardBg = 'bg-sky-50 border-sky-300 dark:bg-sky-950/30 dark:border-sky-800';
                icon = <RefreshCw className="w-4 h-4 text-sky-600 animate-spin" />;
                badgeColor = 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300';
              }

              return (
                <div key={step.id} className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${cardBg}`}>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-black text-slate-400">STAGE 0{idx + 1}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${badgeColor}`}>
                        {step.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                      {icon}
                      <span className="truncate">{step.name}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <p className="line-clamp-2 text-[10px] leading-tight font-medium">
                      {step.details || step.description}
                    </p>
                    {step.durationMs !== undefined && step.durationMs > 0 && (
                      <span className="text-[9px] font-mono font-bold text-slate-500 block">
                        ⏱ {step.durationMs}ms
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Root Cause & Diagnostic Advice Card */}
      {diagnosticResult && !diagnosticResult.success && (
        <div className="bg-gradient-to-r from-rose-50 via-white to-rose-50/50 dark:from-rose-950/30 dark:via-slate-900 dark:to-rose-950/20 p-5 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-sm shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-black text-rose-900 dark:text-rose-300">
                  Diagnostic Failure Identified
                </h4>
                {diagnosticResult.errorCode && (
                  <span className="px-2 py-0.5 rounded bg-rose-200/80 dark:bg-rose-900/70 text-rose-900 dark:text-rose-200 font-mono text-[10px] font-bold">
                    CODE: {diagnosticResult.errorCode}
                  </span>
                )}
                {diagnosticResult.smtpResponseCode && diagnosticResult.smtpResponseCode > 0 ? (
                  <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[10px] font-bold">
                    SMTP RFC: {diagnosticResult.smtpResponseCode}
                  </span>
                ) : null}
              </div>
              <p className="text-xs font-medium text-rose-800 dark:text-rose-200/90 leading-relaxed">
                {diagnosticResult.friendlyExplanation}
              </p>
            </div>
          </div>

          {/* Actionable Resolution Box */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-rose-200/80 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
                Recommended Resolution Steps:
              </span>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 flex items-center gap-1 hover:underline"
              >
                Google App Passwords <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <pre className="text-xs text-slate-700 dark:text-slate-300 font-sans whitespace-pre-line leading-relaxed bg-slate-50 dark:bg-slate-900/80 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              {diagnosticResult.suggestedFix}
            </pre>
          </div>
        </div>
      )}

      {/* Interactive Controls & Test Dispatch Options */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={sendTestMail}
              onChange={(e) => setSendTestMail(e.target.checked)}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
            />
            <span>Also dispatch a physical verification email to inbox</span>
          </label>

          <button
            type="button"
            onClick={() => setShowAdvancedParams(!showAdvancedParams)}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 flex items-center gap-1"
          >
            {showAdvancedParams ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showAdvancedParams ? 'Hide Custom Probe Parameters' : 'Custom Probe Parameters'}
          </button>
        </div>

        {sendTestMail && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 animate-fade-in">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="email"
              placeholder="Test Recipient Email (e.g. adilh1220@gmail.com)"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        )}

        {showAdvancedParams && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Override Host</label>
              <input
                type="text"
                placeholder="smtp.gmail.com"
                value={customHost}
                onChange={(e) => setCustomHost(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Override Port</label>
              <input
                type="number"
                placeholder="587"
                value={customPort}
                onChange={(e) => setCustomPort(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Override Username</label>
              <input
                type="email"
                placeholder="adilh1220@gmail.com"
                value={customUser}
                onChange={(e) => setCustomUser(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Override App Password</label>
              <input
                type="password"
                placeholder="16-char App Password"
                value={customPass}
                onChange={(e) => setCustomPass(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Historical Diagnostic Audit Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-0">
        <div className="p-4 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              SMTP Diagnostic & Test Logs ({filteredLogs.length})
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Pills */}
            <div className="flex items-center bg-slate-200 dark:bg-slate-800 rounded-lg p-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setFilter('ALL')}
                className={`px-2 py-1 rounded-md transition-all ${filter === 'ALL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter('PASSED')}
                className={`px-2 py-1 rounded-md transition-all ${filter === 'PASSED' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Passed
              </button>
              <button
                type="button"
                onClick={() => setFilter('FAILED')}
                className={`px-2 py-1 rounded-md transition-all ${filter === 'FAILED' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Failed
              </button>
            </div>

            {logs.length > 0 && (
              <button
                type="button"
                onClick={handleClearLogs}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                title="Clear Logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Logs List */}
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-1">
            <Terminal className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 stroke-[1.5]" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No diagnostic audit logs recorded yet.</p>
            <p className="text-[11px] text-slate-400">Click &apos;Run Diagnostics&apos; above to execute an active connection probe.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-80 overflow-y-auto">
            {filteredLogs.map((log) => {
              const isPassed = log.status === 'PASSED';
              const isExpanded = expandedLogId === log.id;

              return (
                <div key={log.id} className="p-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all space-y-2">
                  <div 
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="flex items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isPassed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {log.summary}
                          </span>
                          {log.errorCode && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                              {log.errorCode}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {log.host}:{log.port} • User: {log.user || 'None'} • Latency: {log.latencyMs}ms
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-950 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1.5 animate-fade-in border border-slate-200 dark:border-slate-800">
                      <div><strong className="text-slate-500">Log ID:</strong> {log.id}</div>
                      <div><strong className="text-slate-500">Timestamp:</strong> {log.timestamp}</div>
                      <div><strong className="text-slate-500">Target Host:</strong> {log.host}:{log.port}</div>
                      <div><strong className="text-slate-500">User Account:</strong> {log.user}</div>
                      {log.testRecipient && <div><strong className="text-slate-500">Test Recipient:</strong> {log.testRecipient}</div>}
                      {log.details && (
                        <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                          <strong className="text-slate-500">Raw Trace / Details:</strong>
                          <pre className="text-[10px] text-rose-600 dark:text-rose-400 whitespace-pre-wrap mt-0.5">
                            {log.details}
                          </pre>
                        </div>
                      )}
                      {log.suggestedFix && (
                        <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-800 text-[10px] font-sans text-sky-700 dark:text-sky-300">
                          <strong>Fix Advice:</strong> {log.suggestedFix}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailConnectionDiagnostic;
