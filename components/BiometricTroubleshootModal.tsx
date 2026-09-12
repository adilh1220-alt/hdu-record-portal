import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ExternalLink,
  Laptop,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  X,
  ChevronRight,
  Info,
  Key,
  Lock,
  ArrowRight,
  Settings,
  Cpu,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  webAuthnService,
  BiometricDiagnosticReport,
  HardwareProbeResult
} from '../services/webAuthnService';

interface BiometricTroubleshootModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'diagnostics' | 'windows-guide' | 'dell-hardware' | 'urdu-help';
  onOpenEnrollment?: () => void;
}

export const BiometricTroubleshootModal: React.FC<BiometricTroubleshootModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'diagnostics',
  onOpenEnrollment
}) => {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'windows-guide' | 'dell-hardware' | 'urdu-help'>(defaultTab);
  const [report, setReport] = useState<BiometricDiagnosticReport | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [probeResult, setProbeResult] = useState<HardwareProbeResult | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);

  // Load diagnostics when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      fetchReport();
    } else {
      setProbeResult(null);
    }
  }, [isOpen, defaultTab]);

  const fetchReport = async () => {
    setIsLoadingReport(true);
    try {
      const data = await webAuthnService.runDiagnostics();
      setReport(data);
    } catch (err) {
      console.error('Failed to run diagnostics:', err);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handleRunSensorProbe = async () => {
    setIsProbing(true);
    setProbeResult(null);
    try {
      const res = await webAuthnService.runHardwareSensorProbe();
      setProbeResult(res);
      // Refresh general report after probe
      await fetchReport();
    } catch (err: any) {
      setProbeResult({
        success: false,
        status: 'ERROR',
        errorCode: 'ERR_HARDWARE_COMMUNICATION_FAULT',
        userMessage: 'Unexpected sensor probe failure.',
        technicalDetails: err.message || 'Unknown error occurred during probe.',
        remedySteps: [
          'Verify your fingerprint scanner is clean and dry.',
          'Ensure Windows Hello PIN is configured in Windows Settings.'
        ],
        osContext: report?.isWindows ? 'windows' : 'generic'
      });
    } finally {
      setIsProbing(false);
    }
  };

  const handleCopyReport = () => {
    if (!report) return;
    const text = [
      `=== CLINICAL HDU BIOMETRIC & WEBAUTHN DIAGNOSTIC REPORT ===`,
      `Timestamp: ${report.timestamp}`,
      `OS: ${report.osName}`,
      `Browser: ${report.browser}`,
      `User-Agent: ${report.userAgent}`,
      `Secure Context (HTTPS): ${report.isSecureContext ? 'YES' : 'NO'}`,
      `Window Context: ${report.isInIframe ? 'IFRAME (RESTRICTED)' : 'STANDALONE WINDOW'}`,
      `WebAuthn API: ${report.hasWebAuthnAPI ? 'SUPPORTED' : 'UNAVAILABLE'}`,
      `Platform Authenticator (Windows Hello): ${report.isPlatformAuthenticatorAvailable ? 'READY' : 'UNAVAILABLE / NOT CONFIGURED'}`,
      `Enrolled Passkeys: ${report.enrolledCredentialsCount}`,
      `Overall Health: ${report.overallHealth}`,
      `----------------------------------------------------`,
      `Checks Breakdown:`,
      ...report.checks.map(c => `[${c.status.toUpperCase()}] ${c.name} (${c.errorCode || 'OK'}): ${c.summary} - ${c.details}`),
      `----------------------------------------------------`,
      probeResult ? [
        `Live Sensor Probe Result:`,
        `Status: ${probeResult.status}`,
        `Code: ${probeResult.errorCode}`,
        `Message: ${probeResult.userMessage}`,
        `Technical: ${probeResult.technicalDetails}`,
        `Remedies:\n${probeResult.remedySteps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
      ].join('\n') : `Live Probe: Not executed`
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2500);
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        id="troubleshoot-biometric-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
              <Fingerprint className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Troubleshoot Biometric Login & Sensor Diagnostics
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">
                  Windows Hello & WebAuthn
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Dell Latitude 7300, Windows 10/11, and hardware sensor configuration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyReport}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Copy Diagnostic Report for IT"
            >
              {copiedLog ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copiedLog ? 'Copied!' : 'Copy Report'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`py-3 px-3.5 border-b-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'diagnostics'
                ? 'border-red-600 text-red-600 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Interactive Diagnostic Panel</span>
            {report?.overallHealth === 'BLOCKED' && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('windows-guide')}
            className={`py-3 px-3.5 border-b-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'windows-guide'
                ? 'border-red-600 text-red-600 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>Windows 10/11 & Windows Hello Setup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dell-hardware')}
            className={`py-3 px-3.5 border-b-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'dell-hardware'
                ? 'border-red-600 text-red-600 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Dell Latitude 7300 Hardware & Drivers</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('urdu-help')}
            className={`py-3 px-3.5 border-b-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'urdu-help'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="font-bold text-sm">اردو رہنمائی</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">Urdu</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
          
          {/* TAB 1: DIAGNOSTICS PANEL */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Top Banner with Platform Context */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-300">Detected Platform:</span>
                      <span className="text-xs font-black text-white bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-700">
                        {report ? `${report.osName} • ${report.browser}` : 'Detecting...'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Standard browser WebAuthn queries the OS credential provider (Windows Hello) to interact with physical sensors.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchReport}
                    disabled={isLoadingReport}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReport ? 'animate-spin text-red-400' : ''}`} />
                    <span>Refresh</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRunSensorProbe}
                    disabled={isProbing}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md shadow-red-600/30 transition-all cursor-pointer"
                  >
                    {isProbing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Detecting Sensor...</span>
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-4 h-4" />
                        <span>Run Sensor Test</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Iframe Alert if running in embedded frame */}
              {report?.isInIframe && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wide">
                        [ERR_IFRAME_RESTRICTED] Embedded Preview Frame Detected
                      </h4>
                      <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                        Modern browsers block native biometric prompts (Windows Hello) inside preview frames. You must open the portal in a standalone browser tab.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenInNewTab}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open in New Tab</span>
                  </button>
                </div>
              )}

              {/* LIVE SENSOR PROBE RESULT (If run) */}
              {probeResult && (
                <div 
                  className={`p-5 rounded-2xl border transition-all animate-in slide-in-from-top-2 ${
                    probeResult.status === 'SUCCESS'
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                      : probeResult.status === 'WARNING'
                      ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                      : 'bg-red-50/80 border-red-300 text-red-950'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <div 
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          probeResult.status === 'SUCCESS'
                            ? 'bg-emerald-200 text-emerald-700'
                            : probeResult.status === 'WARNING'
                            ? 'bg-amber-200 text-amber-700'
                            : 'bg-red-200 text-red-700'
                        }`}
                      >
                        {probeResult.status === 'SUCCESS' ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : probeResult.status === 'WARNING' ? (
                          <AlertTriangle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded bg-white border shadow-2xs">
                            {probeResult.errorCode}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wider opacity-75">
                            Sensor Probe Diagnosis
                          </span>
                        </div>
                        <h4 className="text-sm font-black mt-1">
                          {probeResult.userMessage}
                        </h4>
                        <p className="text-xs mt-1 font-mono opacity-80 bg-white/70 p-2 rounded-lg border border-black/5">
                          {probeResult.technicalDetails}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Remediation Steps */}
                  <div className="mt-4 pt-4 border-t border-black/10 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-75 block">
                      Recommended Action Steps:
                    </span>
                    <ul className="space-y-1.5 text-xs">
                      {probeResult.remedySteps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-black/10 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="font-medium leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ul>

                    {probeResult.errorCode === 'ERR_ENROLLMENT_REQUIRED' && onOpenEnrollment && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenEnrollment();
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm cursor-pointer"
                        >
                          <Fingerprint className="w-4 h-4 text-red-400" />
                          <span>Enroll This Laptop Now in Portal</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hardware & WebAuthn Check Matrix */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-red-600" />
                    <span>Hardware & Browser Environment Matrix</span>
                  </h4>
                  <span className="text-[10px] text-slate-500 font-bold">
                    {report?.checks.length || 0} System Checks
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {report?.checks.map((c) => (
                    <div
                      key={c.id}
                      className={`p-4 rounded-xl border transition-all ${
                        c.status === 'pass'
                          ? 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                          : c.status === 'warn'
                          ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
                          : 'bg-red-50/50 border-red-200 hover:border-red-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          {c.status === 'pass' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : c.status === 'warn' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span className="text-xs font-black text-slate-900 block">
                              {c.name}
                            </span>
                            <span className={`text-[11px] font-bold ${
                              c.status === 'pass' ? 'text-emerald-700' : c.status === 'warn' ? 'text-amber-800' : 'text-red-700'
                            }`}>
                              {c.summary}
                            </span>
                          </div>
                        </div>

                        {c.errorCode && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider bg-white border border-slate-300 text-slate-800 shrink-0">
                            {c.errorCode}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                        {c.details}
                      </p>

                      {c.recommendedAction && (
                        <div className="mt-2.5 p-2 bg-white rounded-lg border border-slate-200 text-[10px] text-slate-700 font-medium">
                          <strong className="text-slate-900 block mb-0.5">Quick Remedy:</strong>
                          <div className="whitespace-pre-line leading-relaxed">
                            {c.recommendedAction}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Common Error Codes Reference Cheat Sheet */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Common Hardware & WebAuthn Error Codes Explained
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="font-mono text-[10px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                      ERR_WIN_HELLO_NOT_CONFIGURED
                    </span>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Windows Hello requires a Windows PIN before enabling fingerprints. Set PIN first in Windows Settings.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="font-mono text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      ERR_IFRAME_RESTRICTED
                    </span>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Browser security prevents fingerprint prompts inside iframes. Open the app in a new top-level tab.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="font-mono text-[10px] font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                      ERR_NOT_ALLOWED_CANCELLED
                    </span>
                    <p className="text-[11px] text-slate-600 mt-1">
                      The prompt appeared, but was dismissed or timed out after 30 seconds without resting finger on scanner.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="font-mono text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      ERR_ENROLLMENT_REQUIRED
                    </span>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Hardware is operational, but this laptop has not yet been paired with your medical account in Portal Settings.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: WINDOWS 10/11 & WINDOWS HELLO SETUP GUIDE */}
          {activeTab === 'windows-guide' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Architecture Clarification Notice */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3.5 text-blue-950">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wide text-blue-900">
                    How Browser Web-Auth Works On Windows 10 & 11
                  </h4>
                  <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                    Web browsers (Google Chrome, Microsoft Edge, Firefox) do <strong>NOT</strong> communicate directly with raw USB or laptop fingerprint chips. Instead, the W3C Web Authentication standard delegates to the <strong>OS-Level Windows Hello Credential Provider</strong>.
                  </p>
                  <p className="text-xs text-blue-800 mt-1 font-semibold">
                    Therefore, your fingerprint <strong>must first be enrolled inside Windows Hello</strong> before any website can recognize it!
                  </p>
                </div>
              </div>

              {/* 5-Step Visual Walkthrough */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Step-by-Step Enrollment Walkthrough (Windows 10 / 11)
                </h4>

                {/* Step 1 */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                    1
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black uppercase tracking-wide text-slate-900">
                        Open Windows Sign-in Settings
                      </h5>
                      <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">
                        Win + I Shortcut
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono font-bold">Win + I</kbd> on your keyboard to open Windows Settings. Navigate to:
                    </p>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 font-mono text-xs text-slate-800 font-bold flex items-center gap-2">
                      <span>Settings</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <span>Accounts</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-red-600">Sign-in options</span>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                    2
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black uppercase tracking-wide text-slate-900">
                        Create a "Windows Hello PIN" First (Mandatory)
                      </h5>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                        Prerequisite
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Microsoft requires a backup PIN before fingerprint recognition can be enabled.
                    </p>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 text-xs text-slate-700">
                      <p>• Click <strong>Windows Hello PIN</strong> under "Manage how you sign in".</p>
                      <p>• Click <strong>Set up</strong> or <strong>Add</strong>, enter your Windows user password, and pick a 4-6 digit PIN.</p>
                      <p className="text-[11px] text-slate-500 italic">• If already set up, proceed to Step 3.</p>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                    3
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black uppercase tracking-wide text-slate-900">
                        Enroll Fingerprint in Windows Hello
                      </h5>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                        Sensor Calibration
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      In the same <em>Sign-in options</em> menu, select <strong>Windows Hello Fingerprint</strong> and click <strong>Set up</strong>.
                    </p>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 text-xs text-slate-700">
                      <p>• Click <strong>Get Started</strong>.</p>
                      <p>• Enter your Windows Hello PIN when asked.</p>
                      <p>• Place your index finger or thumb repeatedly on the laptop sensor until the blue circle fills 100%.</p>
                      <p>• Click <strong>Close</strong> once completed.</p>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                    4
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h5 className="text-xs font-black uppercase tracking-wide text-slate-900">
                      Open Portal In A Dedicated Standalone Browser Window
                    </h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Ensure you are accessing The Kidney Centre portal directly in Google Chrome or Microsoft Edge (not inside an iframe or preview sandbox).
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenInNewTab}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Clinical Portal in New Tab</span>
                    </button>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                    5
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h5 className="text-xs font-black uppercase tracking-wide text-slate-900">
                      Pair Laptop Passkey in Portal Settings
                    </h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Sign in once with your standard clinical email and password. Then go to <strong>Settings &rarr; Biometrics &rarr; Enroll Sensor</strong>. Your Dell Latitude 7300 will now allow instant 1-tap fingerprint sign-in every day!
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: DELL LATITUDE 7300 HARDWARE & DRIVERS */}
          {activeTab === 'dell-hardware' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Dell Latitude 7300 Specific Banner */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wide text-white">
                    Dell Latitude 7300 Fingerprint Sensor Architecture
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    On the Dell Latitude 7300, the fingerprint sensor is integrated directly into the <strong>Power Button</strong> (top-right of the keyboard) or the palmrest. It utilizes the <strong>Dell ControlVault3</strong> or <strong>Goodix Biometric Chipset</strong>.
                  </p>
                </div>
              </div>

              {/* Troubleshooting Checklist */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Hardware Diagnostic Checklist for Dell Latitude 7300
                </h4>

                {/* Driver Check */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center">
                      A
                    </span>
                    <h5 className="text-xs font-black uppercase tracking-wide text-slate-900">
                      Check Device Manager for Dell ControlVault Driver
                    </h5>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    If Windows displays <em>"We couldn't find a fingerprint scanner compatible with Windows Hello Fingerprint"</em>, the Dell driver is missing.
                  </p>
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1">
                    <p>1. Press <kbd className="px-1 py-0.5 bg-slate-100 border rounded font-mono text-[10px]">Win + R</kbd>, type <code className="text-red-600 font-bold">devmgmt.msc</code> and press Enter.</p>
                    <p>2. Expand the <strong>Biometric devices</strong> node.</p>
                    <p>3. Verify you see <strong>Dell ControlVault w/ Fingerprint Touch Sensor</strong> or <strong>Goodix fingerprint device</strong> without any yellow warning triangle (!).</p>
                    <p>4. If missing or marked with an exclamation, download <strong>Dell Command | Update</strong> or install the <em>Dell ControlVault3 Host Components Driver and Firmware</em> from Dell Support.</p>
                  </div>
                </div>

                {/* Windows Biometric Service */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center">
                      B
                    </span>
                    <h5 className="text-xs font-black uppercase tracking-wide text-slate-900">
                      Verify Windows Biometric Service (WbioSrvc)
                    </h5>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The background Windows Biometric Service must be in a 'Running' state for browser WebAuthn API calls to succeed.
                  </p>
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1">
                    <p>1. Press <kbd className="px-1 py-0.5 bg-slate-100 border rounded font-mono text-[10px]">Win + R</kbd>, type <code className="text-red-600 font-bold">services.msc</code> and press Enter.</p>
                    <p>2. Scroll down to <strong>Windows Biometric Service</strong>.</p>
                    <p>3. Status should show <strong>Running</strong> and Startup Type should be <strong>Automatic</strong>.</p>
                    <p>4. Right-click and choose <strong>Restart</strong> if the scanner is unresponsive.</p>
                  </div>
                </div>

                {/* Dell Latitude BIOS / TPM 2.0 */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center">
                      C
                    </span>
                    <h5 className="text-xs font-black uppercase tracking-wide text-slate-900">
                      BIOS Security & Fingerprint Sensor Enablement
                    </h5>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    On some refurbished or enterprise Dell Latitude 7300 units, the fingerprint sensor may be toggled OFF in the Dell UEFI BIOS.
                  </p>
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1">
                    <p>1. Restart the Dell laptop and tap <kbd className="px-1 py-0.5 bg-slate-100 border rounded font-mono text-[10px]">F2</kbd> repeatedly to enter BIOS setup.</p>
                    <p>2. Navigate to <strong>Security &rarr; Intel Software Guard Extensions (SGX) / TPM 2.0 Security</strong> and ensure TPM is <strong>ON</strong> and <strong>Enabled</strong>.</p>
                    <p>3. Navigate to <strong>Miscellaneous Devices</strong> and verify <strong>Fingerprint Reader</strong> is checked.</p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: URDU GUIDANCE FOR CLINICIANS */}
          {activeTab === 'urdu-help' && (
            <div className="space-y-6 animate-in fade-in duration-200" dir="rtl">
              
              {/* Urdu Greeting Banner */}
              <div className="p-5 bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 text-white rounded-2xl shadow-md space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Fingerprint className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">
                      ڈیل لیٹیٹیوڈ 7300 (Dell Latitude 7300) پر فنگر پرنٹ لاگ ان کا مکمل طریقہ
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      اگر آپ کے پاس ڈیل لیپ ٹاپ ہے اور فنگر پرنٹ سے لاگ ان نہیں ہو رہا، تو مندرجہ ذیل آسان اقدامات کریں:
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 1 in Urdu */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-right">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                    ۱
                  </span>
                  <h5 className="text-xs font-black uppercase text-slate-900">
                    گوگل ویریفیکیشن اور ونڈوز ہیلو میں فرق
                  </h5>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  جب آپ براؤزر (گوگل کروم یا ایج) میں فنگر پرنٹ استعمال کرتے ہیں، تو براؤزر خود فنگر پرنٹ نہیں پڑھتا بلکہ وہ <strong>ونڈوز 10/11 کے ونڈوز ہیلو (Windows Hello)</strong> کو درخواست بھیجتا ہے۔ اس لیے ضروری ہے کہ پہلے آپ کا فنگر پرنٹ ونڈوز کی اپنی سیٹنگز میں رجسٹر ہو۔
                </p>
              </div>

              {/* Step 2 in Urdu */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-right">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                    ۲
                  </span>
                  <h5 className="text-xs font-black uppercase text-slate-900">
                    ونڈوز سیٹنگز میں پہلے PIN اور پھر Fingerprint بنائیں
                  </h5>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5 leading-relaxed font-medium">
                  <p>1. کی بورڈ پر <kbd className="px-1.5 py-0.5 bg-slate-100 border rounded font-mono text-[10px]">Windows Key + I</kbd> دبائیں تاکہ سیٹنگز کھل جائیں۔</p>
                  <p>2. <strong>Accounts</strong> میں جائیں اور پھر <strong>Sign-in options</strong> پر کلک کریں۔</p>
                  <p>3. <strong>Windows Hello PIN</strong> پر کلک کر کے پہلے 4 یا 6 ہندسوں کا پن کوڈ بنائیں۔ (مائیکروسافٹ کی شرط ہے کہ پن کوڈ کے بغیر فنگر پرنٹ ایکٹیو نہیں ہوتا)۔</p>
                  <p>4. اس کے بعد <strong>Windows Hello Fingerprint</strong> پر کلک کر کے <strong>Set up</strong> دبائیں اور ڈیل لیپ ٹاپ کے پاور بٹن والے فنگر پرنٹ سینسر پر اپنی انگلی بار بار رکھ کر 100 فیصد مکمل کریں۔</p>
                </div>
              </div>

              {/* Step 3 in Urdu */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-right">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                    ۳
                  </span>
                  <h5 className="text-xs font-black uppercase text-slate-900">
                    پورٹل کو الگ ٹیب میں کھولیں (Open in New Tab)
                  </h5>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  براؤزر سیکیورٹی کی وجہ سے چھوٹے پِریویو فریم کے اندر ونڈوز ہیلو کا پاپ اَپ بلاک ہو جاتا ہے۔ پورٹل کو ہمیشہ اوپر دیے گئے بٹن <strong>Open in New Tab</strong> پر کلک کر کے الگ مکمل ونڈو میں چلائیں۔
                </p>
              </div>

              {/* Step 4 in Urdu */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-right">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                    ۴
                  </span>
                  <h5 className="text-xs font-black uppercase text-slate-900">
                    پورٹل میں فنگر پرنٹ جوڑیں (Enroll Biometrics)
                  </h5>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  پہلی بار اپنے ہسپتال والے ای میل اور پاس ورڈ سے لاگ ان کریں۔ اس کے بعد سائیڈ بار میں <strong>Settings &rarr; Biometrics</strong> میں جائیں اور <strong>Enroll Sensor</strong> کے بٹن پر کلک کریں۔ جب ونڈوز ہیلو کا پاپ اَپ آئے تو فنگر پرنٹ رکھیں—آپ کا لیپ ٹاپ ہمیشہ کے لیے پورٹل کے ساتھ جڑ جائے گا اور آئندہ 1 کلک پر لاگ ان ہوگا!
                </p>
              </div>

              {/* Step 5 Driver in Urdu */}
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2 text-right text-amber-950">
                <h5 className="text-xs font-black uppercase flex items-center justify-end gap-1.5">
                  <span>ڈیل ڈرائیور کا مسئلہ (Dell ControlVault Driver)</span>
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </h5>
                <p className="text-xs text-amber-900 leading-relaxed font-medium">
                  اگر ونڈوز سیٹنگز میں لکھا آئے کہ <em>"We couldn't find a fingerprint scanner"</em>، تو اس کا مطلب ہے کہ ڈیل لیپ ٹاپ کا فنگر پرنٹ ڈرائیور انسٹال نہیں ہے۔ اپنے کمپیوٹر کے ڈیوائس مینیجر (Device Manager) میں چیک کریں یا Dell Support ویب سائٹ سے <strong>Dell ControlVault3 Host Components Driver</strong> ڈاؤن لوڈ کریں۔
                </p>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>W3C WebAuthn & FIDO2 Level 2 Biometric Standard Compliant</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {report?.isInIframe && (
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in New Tab</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider transition-colors cursor-pointer shadow-sm"
            >
              Done / Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BiometricTroubleshootModal;
