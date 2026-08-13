import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { dailyReportService } from '../services/dailyReportService';
import { DailyEmailReportSettings, DailyReportLog, ClinicalUnit, Patient, InventoryItem } from '../types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { Mail, Clock, ShieldCheck, Send, CheckCircle2, AlertCircle, RefreshCw, Layers, Plus, Trash2, Eye, History, Server, FileText, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { SmtpConfigModal } from './SmtpConfigModal';

interface DailyEmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CLINICAL_UNITS: ClinicalUnit[] = ['HDU', 'ICU', 'TRANSPLANT', '4th-WARD', 'WARD5', 'ENDOSCOPY'];

export const DailyEmailReportModal: React.FC<DailyEmailReportModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'settings' | 'preview' | 'logs'>('settings');
  
  // Settings state
  const [settings, setSettings] = useState<DailyEmailReportSettings>({
    enabled: true,
    scheduleTime: '08:00',
    recipients: ['adilh1220@gmail.com'],
    unitScope: 'ALL',
    includeCensus: true,
    includeInventory: true,
    includeMortality: true,
    includeIncidents: true
  });
  
  const [smtpStatus, setSmtpStatus] = useState<{
    host: string;
    port: number;
    user: string;
    senderEmail: string;
    isConfigured: boolean;
  }>({
    host: 'smtp.gmail.com',
    port: 587,
    user: '',
    senderEmail: 'reports@kidneycentre.org',
    isConfigured: false
  });

  const [newRecipient, setNewRecipient] = useState('');
  const [logs, setLogs] = useState<DailyReportLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);

  // Live Firestore Snapshot for Preview & Report Payload
  const [activePatients, setActivePatients] = useState<Patient[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [mortalityCount, setMortalityCount] = useState<number>(0);
  const [totalInventoryCount, setTotalInventoryCount] = useState<number>(0);
  const [previewHtml, setPreviewHtml] = useState<string>('');

  // Fetch settings, logs, and live Firestore data
  const loadData = async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      // 1. Fetch Server Settings
      const serverData = await dailyReportService.getSettings();
      setSettings(serverData.settings);
      setSmtpStatus(serverData.smtpConfig);

      // 2. Fetch Audit Logs
      const logData = await dailyReportService.getLogs();
      setLogs(logData);

      // 3. Fetch Live Patients Census from Firestore
      const patientsSnap = await getDocs(collection(db, 'patients'));
      const patientsList: Patient[] = [];
      patientsSnap.forEach(docSnap => {
        const data = docSnap.data() as Patient;
        if (!data.status || data.status === 'Active') {
          patientsList.push({ id: docSnap.id, ...data });
        }
      });
      setActivePatients(patientsList);

      // 4. Fetch Live Inventory from Firestore
      const inventorySnap = await getDocs(collection(db, 'inventory'));
      const inventoryList: InventoryItem[] = [];
      const alertsList: InventoryItem[] = [];
      inventorySnap.forEach(docSnap => {
        const data = docSnap.data() as InventoryItem;
        inventoryList.push({ id: docSnap.id, ...data });
        if (data.quantity <= data.minThreshold) {
          alertsList.push({ id: docSnap.id, ...data });
        }
      });
      setLowStockItems(alertsList);
      setTotalInventoryCount(inventoryList.length);

      // 5. Fetch 24H Mortality Count
      const mortalitySnap = await getDocs(collection(db, 'mortality_records'));
      setMortalityCount(mortalitySnap.size);

    } catch (err: any) {
      console.error("Error loading daily report configuration:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isOpen]);

  // Handle adding recipient email
  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    const email = newRecipient.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setStatusMessage({ text: 'Please enter a valid email address.', type: 'error' });
      return;
    }
    if (settings.recipients.includes(email)) {
      setStatusMessage({ text: 'Email is already in recipient list.', type: 'error' });
      return;
    }
    setSettings(prev => ({
      ...prev,
      recipients: [...prev.recipients, email]
    }));
    setNewRecipient('');
    setStatusMessage(null);
  };

  // Handle removing recipient
  const handleRemoveRecipient = (emailToRemove: string) => {
    if (settings.recipients.length <= 1) {
      setStatusMessage({ text: 'At least one authorized recipient email is required.', type: 'error' });
      return;
    }
    setSettings(prev => ({
      ...prev,
      recipients: prev.recipients.filter(e => e !== emailToRemove)
    }));
    setStatusMessage(null);
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const updated = await dailyReportService.updateSettings(settings);
      setSettings(updated);
      setStatusMessage({ text: 'Automated daily report schedule & recipients saved successfully.', type: 'success' });
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to save daily report configuration.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Trigger Instant Manual Report Send
  const handleSendReportNow = async () => {
    if (settings.recipients.length === 0) {
      setStatusMessage({ text: 'No recipients configured for dispatch.', type: 'error' });
      return;
    }

    setDispatching(true);
    setStatusMessage(null);

    // Filter patients by unit scope if specified
    const filteredPatients = settings.unitScope === 'ALL' 
      ? activePatients 
      : activePatients.filter(p => p.unit === settings.unitScope);

    const filteredInventory = settings.unitScope === 'ALL'
      ? lowStockItems
      : lowStockItems.filter(i => i.unit === settings.unitScope);

    try {
      const result = await dailyReportService.dispatchReport({
        recipients: settings.recipients,
        unitScope: settings.unitScope,
        patients: filteredPatients.map(p => ({
          name: p.name,
          regNo: p.regNo,
          unit: p.unit,
          category: p.category,
          triagePriority: p.triagePriority || 'Stable',
          codeStatus: p.codeStatus || 'Full Code',
          location: p.location || 'Bed'
        })),
        inventoryAlerts: filteredInventory.map(i => ({
          name: i.name,
          unit: i.unit,
          category: i.category,
          quantity: i.quantity,
          minThreshold: i.minThreshold,
          measurementUnit: i.measurementUnit || 'units'
        })),
        mortalityCount,
        totalInventoryCount,
        triggerType: 'MANUAL_TEST',
        generatedBy: currentUser?.displayName || currentUser?.email || 'Attending Physician'
      });

      if (result.reportHtmlPreview) {
        setPreviewHtml(result.reportHtmlPreview);
      }

      if (result.status === 'DELIVERED') {
        setStatusMessage({
          text: `Daily Report Dispatched & Delivered via SMTP to ${result.recipients.join(', ')}!`,
          type: 'success'
        });
      } else {
        setStatusMessage({
          text: `Daily Report Generated & Logged (Simulation Gateway Mode)! Real email delivery to external inboxes requires SMTP credentials in server .env`,
          type: 'success'
        });
      }

      // Refresh logs
      const updatedLogs = await dailyReportService.getLogs();
      setLogs(updatedLogs);

    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to dispatch daily email report.', type: 'error' });
    } finally {
      setDispatching(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Automated Daily Email Report Terminal">
      <div className="space-y-6">

        {/* Top Header & SMTP Status Banner */}
        <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-lg border border-sky-500/30">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">Executive Daily Census & Inventory Dispatch</h3>
                <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded ${
                  settings.enabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'
                }`}>
                  {settings.enabled ? 'Schedule Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Automated daily email summary of active patient occupancy & low stock inventory alerts
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
              <Server className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-300">SMTP Transport:</span>
              <span className={smtpStatus.isConfigured ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {smtpStatus.isConfigured ? `Configured (${smtpStatus.host})` : 'Simulation Gateway Mode'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSmtpModalOpen(true)}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow hover:shadow-sky-500/20"
            >
              <Settings className="w-3.5 h-3.5" /> Configure SMTP
            </button>
          </div>
        </div>

        {/* Simulation Mode Info Banner when SMTP credentials are not set */}
        {!smtpStatus.isConfigured && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl text-xs flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-amber-950 block">Why didn't the email arrive in my Gmail inbox?</span>
                <p className="text-[11px] leading-relaxed text-amber-900">
                  The application is currently running in <strong>Simulation Gateway Mode</strong> because SMTP credentials (<code className="bg-amber-100 px-1 py-0.5 rounded text-[10px] font-mono">SMTP_USER</code> and <code className="bg-amber-100 px-1 py-0.5 rounded text-[10px] font-mono">SMTP_PASS</code>) are not yet saved. You can configure and test your SMTP server settings right now using the <strong>Email Configuration</strong> button below.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSmtpModalOpen(true)}
              className="px-3 py-1.5 bg-amber-900 hover:bg-amber-950 text-white rounded-lg text-xs font-bold shrink-0 transition-all shadow flex items-center gap-1.5 mt-1"
            >
              <Settings className="w-3.5 h-3.5" /> Configure SMTP
            </button>
          </div>
        )}

        {/* Status Message */}
        {statusMessage && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in slide-in-from-top-2 border ${
            statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            <div className="flex items-center gap-2.5">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'settings' 
                ? 'bg-slate-900 text-white shadow' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" /> Schedule & Recipients
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'preview' 
                ? 'bg-slate-900 text-white shadow' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Eye className="w-4 h-4" /> Live Report Preview
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'logs' 
                ? 'bg-slate-900 text-white shadow' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <History className="w-4 h-4" /> Dispatch History ({logs.length})
          </button>
        </div>

        {/* TAB 1: SCHEDULE & RECIPIENTS */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            
            {/* Toggle & Time Setting */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Automated Daily Schedule</label>
                    <p className="text-[11px] text-slate-500">Enable automatic background daily dispatch</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="w-5 h-5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Daily Dispatch Time (24h)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={settings.scheduleTime}
                    onChange={(e) => setSettings(prev => ({ ...prev, scheduleTime: e.target.value }))}
                    className="px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-sm bg-white outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <span className="text-xs text-slate-500 font-medium">(e.g. 08:00 Morning Handover)</span>
                </div>
              </div>
            </div>

            {/* Scope Selection */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Clinical Unit Target Scope</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSettings(prev => ({ ...prev, unitScope: 'ALL' }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    settings.unitScope === 'ALL'
                      ? 'bg-slate-900 text-white shadow'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  🏥 ALL UNITS (Whole Hospital)
                </button>
                {CLINICAL_UNITS.map(unit => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setSettings(prev => ({ ...prev, unitScope: unit }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      settings.unitScope === unit
                        ? 'bg-slate-900 text-white shadow'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient Management */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">Authorized Recipient Email Addresses</label>
                <p className="text-[11px] text-slate-500">Personnel added here will receive the daily census & inventory report at {settings.scheduleTime}.</p>
              </div>

              {/* Recipient Chips */}
              <div className="flex flex-wrap gap-2">
                {settings.recipients.map((email) => (
                  <div key={email} className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-mono font-medium shadow-sm">
                    <Mail className="w-3.5 h-3.5 text-sky-400" />
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(email)}
                      className="text-slate-400 hover:text-red-400 transition-colors ml-1"
                      title="Remove Recipient"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Recipient Form */}
              <form onSubmit={handleAddRecipient} className="flex gap-2 pt-2">
                <input
                  type="email"
                  placeholder="Enter medical personnel email (e.g. director@hospital.com)"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Recipient
                </button>
              </form>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleSendReportNow}
                disabled={dispatching || loading}
                className="px-5 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                {dispatching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Dispatching Daily Report...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send Report Now (Instant Test)
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={saving || loading}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? 'Saving Schedule...' : 'Save Configuration'}
              </button>
            </div>

          </div>
        )}

        {/* TAB 2: LIVE REPORT PREVIEW */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-100 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-800">
                  Live Snapshot Preview: {activePatients.length} Active Patients | {lowStockItems.length} Low Stock Supply Alerts
                </span>
              </div>
              <button
                onClick={loadData}
                className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
              </button>
            </div>

            {/* Render HTML preview or iframe */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900 p-2">
              <div className="bg-slate-800 text-slate-400 px-3 py-1.5 text-[10px] font-mono flex justify-between items-center rounded-t-lg">
                <span>SUBJECT: 📊 [DAILY CENSUS & INVENTORY] Executive Report - {new Date().toLocaleDateString()}</span>
                <span>TO: {settings.recipients.join(', ')}</span>
              </div>
              <iframe
                srcDoc={previewHtml || `
                  <body style="font-family: sans-serif; padding: 24px; color: #1e293b;">
                    <div style="background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                      <h2 style="color: #C81C24; margin-top:0;">🏥 The Kidney Centre - Daily Briefing Snapshot</h2>
                      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                      <p><strong>Active Census Occupancy:</strong> ${activePatients.length} admitted patients</p>
                      <p><strong>Critical Low Stock Items:</strong> ${lowStockItems.length} SKU alerts</p>
                      <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Click "Send Report Now" above to dispatch this formatted report directly to configured recipient inboxes.</p>
                    </div>
                  </body>
                `}
                className="w-full h-96 rounded-b-lg border-0 bg-white"
                title="Email Preview"
              />
            </div>
          </div>
        )}

        {/* TAB 3: DISPATCH LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Report Execution Audit Trail</h4>
              <button onClick={loadData} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-600">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs font-medium">
                No report dispatches recorded yet. Use "Send Report Now" or wait for the scheduled dispatch time ({settings.scheduleTime}).
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Trigger</th>
                      <th className="p-3">Recipients</th>
                      <th className="p-3">Census / Alerts</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-[11px] text-slate-600">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            log.triggerType === 'AUTOMATED_SCHEDULE' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'
                          }`}>
                            {log.triggerType}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-700">
                          {log.recipients ? log.recipients.join(', ') : 'Configured List'}
                        </td>
                        <td className="p-3 text-slate-700 font-bold">
                          {log.activeCensusCount || 0} Patients | {log.lowStockAlertCount || 0} Alerts
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            log.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' :
                            log.status === 'SIMULATED' ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Admin SMTP Server Configuration Modal */}
      <SmtpConfigModal
        isOpen={isSmtpModalOpen}
        onClose={() => setIsSmtpModalOpen(false)}
        onConfigSaved={() => {
          loadData();
        }}
      />
    </Modal>
  );
};
