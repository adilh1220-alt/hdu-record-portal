import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { dailyReportService } from '../services/dailyReportService';
import { Server, ShieldCheck, Mail, Key, CheckCircle2, AlertCircle, RefreshCw, Send, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SmtpConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

export const SmtpConfigModal: React.FC<SmtpConfigModalProps> = ({ isOpen, onClose, onConfigSaved }) => {
  const { currentUser } = useAuth();
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

  // Load current configuration on open
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setFeedback(null);

    dailyReportService.getSmtpConfig()
      .then(data => {
        setHost(data.host || 'smtp.gmail.com');
        setPort(data.port || 587);
        setUser(data.user || '');
        setHasPassword(data.hasPassword || false);
        setSenderEmail(data.senderEmail || data.user || '');
        setIsConfigured(data.isConfigured || false);
        
        const defaultRecipient = currentUser?.email || data.user || '';
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
    if (!user.trim()) {
      setFeedback({ type: 'error', message: 'SMTP Username / Email is required.' });
      return;
    }
    if (!pass && !hasPassword) {
      setFeedback({ type: 'error', message: 'SMTP Password or App Password is required.' });
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
    if (!user.trim()) {
      setFeedback({ type: 'error', message: 'SMTP Username / Email is required.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const result = await dailyReportService.saveSmtpConfig({
        host: host.trim(),
        port: Number(port),
        user: user.trim(),
        pass: pass.trim(),
        senderEmail: senderEmail.trim() || user.trim()
      });

      setIsConfigured(result.smtpConfig.isConfigured);
      setHasPassword(result.smtpConfig.hasPassword);
      setPass(''); // Clear plain password field after save

      setFeedback({
        type: 'success',
        message: 'SMTP Credentials saved and activated successfully! Real daily reports will now deliver directly to inboxes.'
      });

      if (onConfigSaved) onConfigSaved();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to save SMTP configuration.'
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
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
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
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">SMTP Username / Email</label>
              <input
                type="email"
                placeholder="e.g. doctor@hospital.com"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Password / App Password</label>
                {hasPassword && !pass && (
                  <span className="text-[10px] text-emerald-600 font-bold">✓ Saved in Session</span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={hasPassword ? '•••••••••••••••• (Leave unchanged to keep)' : 'Enter password or App Password'}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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
          <div className="bg-sky-50 border border-sky-200 text-sky-900 p-3 rounded-xl text-xs flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Using Gmail / Google Workspace?</span>
              <p className="text-[11px] leading-relaxed text-sky-800">
                Google requires a 16-character <strong>App Password</strong> rather than your standard account password. Enable 2-Step Verification on your Google Account, then generate a password under <em>Account Settings &rarr; Security &rarr; App Passwords</em>.
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

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving || loading}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Save & Activate SMTP
              </>
            )}
          </button>
        </div>

      </div>
    </Modal>
  );
};
