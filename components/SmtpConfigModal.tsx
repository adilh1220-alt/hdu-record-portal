import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { dailyReportService } from '../services/dailyReportService';
import { Server, ShieldCheck, Mail, Key, CheckCircle2, AlertCircle, RefreshCw, Send, Eye, EyeOff, HelpCircle, Activity, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { EmailConnectionDiagnostic } from './EmailConnectionDiagnostic';

interface SmtpConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

export const SmtpConfigModal: React.FC<SmtpConfigModalProps> = ({ isOpen, onClose, onConfigSaved }) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'config' | 'diagnostics'>('config');
  const [host, setHost] = useState('smtp.gmail.com');
  const [port, setPort] = useState<number>(587);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [testEmail, setTestEmail] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ user?: string; pass?: string }>({});

  // Load current configuration on open
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setFeedback(null);
    setSaveSuccess(false);
    setValidationErrors({});

    dailyReportService.getSmtpConfig()
      .then(data => {
        setHost(data.host || 'smtp.gmail.com');
        setPort(data.port || 587);
        setUser(data.user || '');
        setHasPassword(data.hasPassword || false);
        setSenderEmail(data.senderEmail || data.user || '');
        setIsConfigured(data.isConfigured || false);
        
        const defaultRecipient = currentUser?.email || data.user || 'adilh1220@gmail.com';
        setTestEmail(defaultRecipient);
      })
      .catch(err => {
        console.error("Failed to load SMTP configuration:", err);
      })
      .finally(() => setLoading(false));
  }, [isOpen, currentUser]);

  // Handle Preset Selection
  const applyPreset = (preset: 'gmail' | 'outlook' | 'sendgrid') => {
    if (preset === 'gmail') {
      setHost('smtp.gmail.com');
      setPort(587);
    } else if (preset === 'outlook') {
      setHost('smtp.office365.com');
      setPort(587);
    } else if (preset === 'sendgrid') {
      setHost('smtp.sendgrid.net');
      setPort(587);
      if (!user) setUser('apikey');
    }
  };

  // Test Connection
  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { user?: string; pass?: string } = {};
    if (!user.trim()) {
      errors.user = 'SMTP Username / Email is required';
    }
    if (!pass && !hasPassword) {
      errors.pass = 'App Password is required';
    }
    setValidationErrors(errors);

    if (errors.user || errors.pass) {
      setFeedback({ type: 'error', message: 'Please enter your Gmail address and 16-character App Password before testing.' });
      return;
    }

    if (!testEmail.trim()) {
      setFeedback({ type: 'error', message: 'Please specify a target email address for verification.' });
      return;
    }

    setTesting(true);
    setFeedback(null);

    try {
      const result = await dailyReportService.testSmtpConnection({
        testEmail: testEmail.trim(),
        host: host.trim(),
        port: Number(port),
        user: user.trim(),
        pass: pass.trim(),
        senderEmail: senderEmail.trim() || user.trim()
      });

      setFeedback({
        type: 'success',
        message: result.message || `SMTP Connection verified! Verification email sent to ${testEmail}.`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'SMTP Connection Test failed. Please check host, port, user credentials or app password.'
      });
    } finally {
      setTesting(false);
    }
  };

  // Save Credentials
  const handleSaveConfig = async () => {
    const errors: { user?: string; pass?: string } = {};
    if (!user.trim()) {
      errors.user = 'SMTP Username / Email (e.g. adilh1220@gmail.com) is required';
    }
    if (!pass.trim() && !hasPassword) {
      errors.pass = '16-character Google App Password is required';
    }
    setValidationErrors(errors);

    if (errors.user || errors.pass) {
      setFeedback({ 
        type: 'error', 
        message: 'Missing required credentials: Enter your full email address and 16-character App Password.' 
      });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const result = await dailyReportService.saveSmtpConfig({
        host: host.trim() || 'smtp.gmail.com',
        port: Number(port) || 587,
        user: user.trim(),
        pass: pass.trim(),
        senderEmail: senderEmail.trim() || user.trim()
      });

      setIsConfigured(result.smtpConfig?.isConfigured ?? true);
      setHasPassword(result.smtpConfig?.hasPassword ?? true);
      setPass(''); // Clear plain password field after save
      setSaveSuccess(true);
      setValidationErrors({});

      setFeedback({
        type: 'success',
        message: 'SMTP Credentials saved & activated successfully! Real automated email reports will now deliver directly to inboxes.'
      });

      if (onConfigSaved) onConfigSaved();
      
      setTimeout(() => {
        setSaveSuccess(false);
      }, 5000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to save SMTP configuration. Please check your network connection.'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Outgoing Email (SMTP) Configuration">
      <div className="space-y-6">

        {/* Header & Gateway Banner */}
        <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-lg border border-sky-500/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">Admin SMTP Mail Transport</h3>
                <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded ${
                  isConfigured 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {isConfigured ? 'Active Gateway' : 'Simulation Mode'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Configure outgoing email server credentials to dispatch daily patient census & inventory reports to real inboxes
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'config'
                ? 'bg-slate-900 text-white shadow'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <SettingsIcon className="w-4 h-4" /> Server Credentials
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'diagnostics'
                ? 'bg-sky-600 text-white shadow'
                : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
          >
            <Activity className="w-4 h-4" /> Live Connection Diagnostics
          </button>
        </div>

        {activeTab === 'config' ? (
          <div className="space-y-6">

        {/* Feedback Alert */}
        {feedback && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2 border ${
            feedback.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : 'bg-red-50 text-red-900 border-red-200'
          }`}>
            <div className="flex items-start gap-2.5">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{feedback.message}</span>
            </div>
            <div className="flex items-center gap-2">
              {feedback.type === 'error' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('diagnostics')}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold"
                >
                  Diagnose
                </button>
              )}
              <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
            </div>
          </div>
        )}

        {/* Quick Presets */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
            Quick Provider Presets
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset('gmail')}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5 text-red-500" /> Google Gmail / Workspace
            </button>
            <button
              type="button"
              onClick={() => applyPreset('outlook')}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5 text-sky-600" /> Microsoft Outlook 365
            </button>
            <button
              type="button"
              onClick={() => applyPreset('sendgrid')}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Server className="w-3.5 h-3.5 text-blue-600" /> SendGrid API / Relay
            </button>
          </div>
        </div>

        {/* Main Configuration Form */}
        <div className="space-y-4">
          
          {/* Host & Port */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">SMTP Host / Server</label>
              <input
                type="text"
                placeholder="e.g. smtp.gmail.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Port</label>
              <select
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                <option value={587}>587 (TLS/STARTTLS)</option>
                <option value={465}>465 (SSL/TLS)</option>
                <option value={25}>25 (Standard Unencrypted)</option>
              </select>
            </div>
          </div>

          {/* Username & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  SMTP Username / Email <span className="text-red-500">*</span>
                </label>
                {validationErrors.user && (
                  <span className="text-[10px] text-red-600 font-bold">Required</span>
                )}
              </div>
              <input
                type="email"
                placeholder="e.g. adilh1220@gmail.com"
                value={user}
                onChange={(e) => {
                  setUser(e.target.value);
                  if (validationErrors.user) setValidationErrors(prev => ({ ...prev, user: undefined }));
                }}
                className={`w-full px-3 py-2 border rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-slate-900 bg-white ${
                  validationErrors.user ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
                }`}
              />
              {/* Quick Fill Options */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500 font-semibold">Quick fill:</span>
                <button
                  type="button"
                  onClick={() => {
                    setUser('adilh1220@gmail.com');
                    if (!senderEmail) setSenderEmail('adilh1220@gmail.com');
                    if (validationErrors.user) setValidationErrors(prev => ({ ...prev, user: undefined }));
                  }}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold transition-colors"
                >
                  adilh1220@gmail.com
                </button>
                {currentUser?.email && currentUser.email !== 'adilh1220@gmail.com' && (
                  <button
                    type="button"
                    onClick={() => {
                      setUser(currentUser.email);
                      if (!senderEmail) setSenderEmail(currentUser.email);
                      if (validationErrors.user) setValidationErrors(prev => ({ ...prev, user: undefined }));
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold transition-colors"
                  >
                    {currentUser.email}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Password / App Password <span className="text-red-500">*</span>
                </label>
                {hasPassword && !pass ? (
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">✓ Saved on Server</span>
                ) : (
                  <span className="text-[10px] text-amber-600 font-semibold">(16-char App Password)</span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={hasPassword ? '•••••••••••••••• (Leave unchanged to keep)' : 'Enter 16-character Google App Password'}
                  value={pass}
                  onChange={(e) => {
                    setPass(e.target.value);
                    if (validationErrors.pass) setValidationErrors(prev => ({ ...prev, pass: undefined }));
                  }}
                  className={`w-full pl-3 pr-10 py-2 border rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-slate-900 bg-white ${
                    validationErrors.pass
                      ? 'border-red-500 bg-red-50/20'
                      : !pass && !hasPassword
                      ? 'border-amber-300 focus:border-amber-500'
                      : 'border-slate-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                {hasPassword && !pass 
                  ? 'Your password is active. Enter a new App Password only if changing accounts.' 
                  : 'Requires Google App Password (not your regular account password).'}
              </p>
            </div>
          </div>

          {/* Sender Identity */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Sender Display Email (From Address)</label>
            <input
              type="email"
              placeholder="e.g. reports@kidneycentre.org"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            />
            <p className="text-[10px] text-slate-500 font-medium">Leave empty to use SMTP Username as sender address.</p>
          </div>

          {/* Gmail App Password Tip */}
          <div className="bg-sky-50 border border-sky-200 text-sky-900 p-3.5 rounded-xl text-xs flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">How to get a Google App Password (16 Characters):</span>
              <p className="text-[11px] leading-relaxed text-sky-800">
                1. Go to your <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="underline font-bold text-sky-900">Google Account Security</a> settings and ensure <strong>2-Step Verification</strong> is ON.<br/>
                2. In the top search bar, type <strong>App Passwords</strong>.<br/>
                3. Create an App Password named <em>Clinical Portal</em>, then copy the 16 letters and paste them in the Password box above.
              </p>
            </div>
          </div>

        </div>

        {/* Verification & Test Section */}
        <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 space-y-3">
          <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">Test & Verify Connection</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              placeholder="Enter test recipient email (e.g. adilh1220@gmail.com)"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            />
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || loading}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {testing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying Connection...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Send Test Verification Email
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback Alert directly above the Save button (Always visible regardless of scroll) */}
        {feedback && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-start justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 border ${
            feedback.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-sm' 
              : 'bg-red-50 text-red-900 border-red-300 shadow-sm'
          }`}>
            <div className="flex items-start gap-2.5">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{feedback.message}</span>
            </div>
            <div className="flex items-center gap-2">
              {feedback.type === 'error' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('diagnostics')}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[10px] font-bold"
                >
                  Run Diagnostics
                </button>
              )}
              <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1.5 transition-colors"
          >
            <Activity className="w-3.5 h-3.5" /> Open Diagnostics Tab
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={saving || loading}
              className={`px-6 py-2.5 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                saveSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Saving Configuration...
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" /> Saved & Activated!
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Save & Activate SMTP
                </>
              )}
            </button>
          </div>
        </div>

          </div>
        ) : (
          <div className="space-y-4">
            <EmailConnectionDiagnostic onOpenSmtpConfig={() => setActiveTab('config')} />
          </div>
        )}

      </div>
    </Modal>
  );
};
