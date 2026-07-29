import React, { useState, useEffect } from 'react';
import { Send, MessageSquare, Mail, CheckCircle2, AlertCircle, RefreshCw, Smartphone, ExternalLink, ShieldCheck, Cpu } from 'lucide-react';
import { EndoscopyRecord, DispatchLog } from '../types';
import Modal from './Modal';

interface WhatsAppDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: EndoscopyRecord;
  onDispatchSuccess?: (updatedLog: DispatchLog) => void;
  onDispatchError?: (errorMsg: string) => void;
}

export const COUNTRY_CODES = [
  { code: '+92', country: 'Pakistan 🇵🇰' },
  { code: '+91', country: 'India 🇮🇳' },
  { code: '+1', country: 'USA / Canada 🇺🇸 🇨🇦' },
  { code: '+971', country: 'UAE 🇦🇪' },
  { code: '+966', country: 'Saudi Arabia 🇸🇦' },
  { code: '+44', country: 'United Kingdom 🇬🇧' },
  { code: '+968', country: 'Oman 🇴🇲' },
  { code: '+974', country: 'Qatar 🇶🇦' },
  { code: '+965', country: 'Kuwait 🇰🇼' },
  { code: '+973', country: 'Bahrain 🇧🇭' },
  { code: '+61', country: 'Australia 🇦🇺' },
  { code: '+49', country: 'Germany 🇩🇪' },
  { code: '+33', country: 'France 🇫🇷' },
  { code: '+39', country: 'Italy 🇮🇹' },
  { code: '+34', country: 'Spain 🇪🇸' },
  { code: '+81', country: 'Japan 🇯🇵' },
  { code: '+86', country: 'China 🇨🇳' },
  { code: '+60', country: 'Malaysia 🇲🇾' },
  { code: '+65', country: 'Singapore 🇸🇬' },
  { code: '+20', country: 'Egypt 🇪🇬' },
  { code: '+90', country: 'Turkey 🇹🇷' },
  { code: '+27', country: 'South Africa 🇿🇦' },
  { code: '+880', country: 'Bangladesh 🇧🇩' },
  { code: '+94', country: 'Sri Lanka 🇱🇰' },
  { code: '+977', country: 'Nepal 🇳🇵' },
  { code: '+55', country: 'Brazil 🇧🇷' },
  { code: '+52', country: 'Mexico 🇲🇽' },
  { code: 'custom', country: '➕ Custom Code...' }
];

export const WhatsAppDispatchModal: React.FC<WhatsAppDispatchModalProps> = ({
  isOpen,
  onClose,
  record,
  onDispatchSuccess,
  onDispatchError
}) => {
  const [selectedCountryCode, setSelectedCountryCode] = useState('+92');
  const [customCountryCode, setCustomCountryCode] = useState('+');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'email' | 'history' | 'status'>('whatsapp');
  
  const [isSending, setIsSending] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{
    success?: boolean;
    message?: string;
    details?: string;
    messageId?: string;
    whatsappWebUrl?: string;
  } | null>(null);

  const [gatewayStatus, setGatewayStatus] = useState<{
    status?: string;
    provider?: string;
    whatsappGateway?: { status: string; provider: string; senderNumber: string };
    recentLogs?: any[];
  } | null>(null);

  useEffect(() => {
    if (record) {
      if (record.whatsappNumber) {
        // Parse country code if present
        const matchedCode = COUNTRY_CODES.find(c => c.code !== 'custom' && record.whatsappNumber?.startsWith(c.code));
        if (matchedCode) {
          setSelectedCountryCode(matchedCode.code);
          const rawNum = record.whatsappNumber.replace(matchedCode.code, '').replace(/\D/g, '').replace(/^0+/, '');
          setPhoneNumber(rawNum);
        } else if (record.whatsappNumber.startsWith('+')) {
          setSelectedCountryCode('custom');
          const match = record.whatsappNumber.match(/^(\+\d{1,4})(.*)$/);
          if (match) {
            setCustomCountryCode(match[1]);
            setPhoneNumber(match[2].replace(/\D/g, '').replace(/^0+/, ''));
          } else {
            setPhoneNumber(record.whatsappNumber.replace(/\D/g, '').replace(/^0+/, ''));
          }
        } else {
          setSelectedCountryCode('+92');
          setPhoneNumber(record.whatsappNumber.replace(/\D/g, '').replace(/^0+/, ''));
        }
      } else {
        setSelectedCountryCode('+92');
        setPhoneNumber('');
      }

      if (record.emailAddress) {
        setEmailAddress(record.emailAddress);
      } else {
        setEmailAddress('');
      }
    }
  }, [record]);

  useEffect(() => {
    if (isOpen) {
      fetchGatewayStatus();
    }
  }, [isOpen]);

  const fetchGatewayStatus = async () => {
    try {
      const res = await fetch('/api/cloud-functions/status');
      if (res.ok) {
        const data = await res.json();
        setGatewayStatus(data);
      }
    } catch (e) {
      console.warn("Cloud function status fetch failed:", e);
    }
  };

  const activePrefix = selectedCountryCode === 'custom' ? customCountryCode : selectedCountryCode;
  const fullWhatsAppNumber = `${activePrefix}${phoneNumber.replace(/[^\d]/g, '')}`;

  const generatedTemplateMessage = `🏥 *MEDILOG CLINICAL ENDOSCOPY REPORT*

Dear *${record.name.toUpperCase()}*,
Your endoscopy procedure report is compiled and ready.

• *MR Number:* ${record.regNo}
• *Procedure:* ${record.procedure}
• *Date:* ${record.date} ${record.time ? `@ ${record.time}` : ''}
• *Attending Doctor:* Dr. ${record.doctor}
• *Diagnosis:* ${record.diagnosis || 'Diagnostic exam completed.'}

📄 *Recommendations:* ${record.recommendations || 'Please follow up with your consulting clinician.'}

_This automated message was sent via MediLog Serverless Cloud Gateway._`;

  const handleSendWhatsApp = async () => {
    if (!phoneNumber) {
      alert("Please enter a valid patient phone number.");
      return;
    }

    setIsSending(true);
    setDispatchResult(null);

    try {
      const response = await fetch('/api/cloud-functions/dispatch-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: fullWhatsAppNumber,
          patientName: record.name,
          procedure: record.procedure,
          date: record.date,
          doctor: record.doctor,
          pdfSummary: record.diagnosis || 'Procedure findings completed',
          customMessage: generatedTemplateMessage
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const newLog: DispatchLog = {
          id: data.messageId || `wa_${Date.now()}`,
          channel: 'whatsapp',
          recipient: fullWhatsAppNumber,
          status: data.status === 'SUCCESS' ? 'sent' : 'simulated',
          timestamp: new Date().toISOString(),
          messageId: data.messageId,
          details: data.info
        };

        setDispatchResult({
          success: true,
          message: data.info || "WhatsApp dispatch triggered successfully via Cloud Function!",
          messageId: data.messageId,
          whatsappWebUrl: data.whatsappWebUrl
        });

        if (data.whatsappWebUrl) {
          window.open(data.whatsappWebUrl, '_blank');
        }

        if (onDispatchSuccess) {
          onDispatchSuccess(newLog);
        }
      } else {
        const errorMsg = data.error || "Failed to dispatch WhatsApp message via Cloud Function gateway.";
        setDispatchResult({
          success: false,
          message: errorMsg,
          details: JSON.stringify(data)
        });
        if (onDispatchError) {
          onDispatchError(errorMsg);
        }
      }
    } catch (err: any) {
      const errorMsg = "Network/Server error communicating with Cloud Function gateway.";
      setDispatchResult({
        success: false,
        message: errorMsg,
        details: err.message
      });
      if (onDispatchError) {
        onDispatchError(errorMsg);
      }
    } finally {
      setIsSending(false);
      fetchGatewayStatus();
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress) {
      alert("Please enter a valid patient email address.");
      return;
    }

    setIsSending(true);
    setDispatchResult(null);

    try {
      const response = await fetch('/api/cloud-functions/dispatch-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailAddress,
          patientName: record.name,
          procedure: record.procedure,
          date: record.date,
          doctor: record.doctor,
          pdfSummary: record.diagnosis || 'Procedure findings completed'
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const newLog: DispatchLog = {
          id: data.messageId || `email_${Date.now()}`,
          channel: 'email',
          recipient: emailAddress,
          status: 'simulated',
          timestamp: new Date().toISOString(),
          messageId: data.messageId,
          details: data.info
        };

        setDispatchResult({
          success: true,
          message: "Email report dispatched successfully via Cloud Function!",
          messageId: data.messageId
        });

        if (onDispatchSuccess) {
          onDispatchSuccess(newLog);
        }
      } else {
        const errorMsg = data.error || "Failed to dispatch email via Cloud Function gateway.";
        setDispatchResult({
          success: false,
          message: errorMsg
        });
        if (onDispatchError) {
          onDispatchError(errorMsg);
        }
      }
    } catch (err: any) {
      const errorMsg = "Error communicating with Cloud Function email gateway.";
      setDispatchResult({
        success: false,
        message: errorMsg,
        details: err.message
      });
      if (onDispatchError) {
        onDispatchError(errorMsg);
      }
    } finally {
      setIsSending(false);
      fetchGatewayStatus();
    }
  };

  const openDirectWhatsAppWeb = () => {
    const waUrl = `https://wa.me/${fullWhatsAppNumber.replace(/[^\d]/g, '')}?text=${encodeURIComponent(generatedTemplateMessage)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Automated Patient Report Dispatch Gateway"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Patient Summary Banner */}
        <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">Patient Record</span>
              <span className="text-slate-400 text-xs">| MR: <strong className="text-white font-mono">{record.regNo}</strong></span>
            </div>
            <h3 className="text-sm font-bold mt-0.5 text-slate-100">{record.name}</h3>
            <p className="text-[11px] text-slate-400">{record.procedure} • Dr. {record.doctor} ({record.date})</p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 rounded-full">
              <Cpu className="w-3 h-3 text-emerald-400 animate-pulse" /> Cloud Function Active
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`py-2 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'whatsapp'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-600" /> WhatsApp Dispatch
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`py-2 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'email'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Mail className="w-4 h-4 text-blue-600" /> Email Dispatch
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-purple-600 text-purple-700 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-purple-600" /> Dispatch History ({record.dispatchHistory?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`py-2 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'status'
                ? 'border-amber-600 text-amber-700 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4 text-amber-600" /> Serverless Gateway
          </button>
        </div>

        {/* TAB 1: WHATSAPP DISPATCH */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Patient WhatsApp Phone Number
              </label>
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <select
                  value={selectedCountryCode}
                  onChange={(e) => setSelectedCountryCode(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 shadow-2xs"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code !== 'custom' ? `${c.code} (${c.country})` : c.country}
                    </option>
                  ))}
                </select>

                {selectedCountryCode === 'custom' && (
                  <input
                    type="text"
                    placeholder="+91"
                    value={customCountryCode}
                    onChange={(e) => setCustomCountryCode(e.target.value)}
                    className="w-24 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                )}

                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="3001234567 (without leading 0)"
                  value={phoneNumber}
                  onChange={(e) => {
                    const onlyDigits = e.target.value.replace(/\D/g, '');
                    const cleanNum = onlyDigits.replace(/^0+/, '');
                    setPhoneNumber(cleanNum);
                  }}
                  className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Format: International format (e.g. {fullWhatsAppNumber}). Message is dispatched directly to the patient's mobile app.
              </p>
            </div>

            {/* Template Message Preview */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex justify-between items-center">
                <span>WhatsApp Message Preview</span>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Auto-formatted Medical Template
                </span>
              </label>
              <div className="p-3.5 bg-emerald-950/10 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-sans text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-medium">
                {generatedTemplateMessage}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={isSending || !phoneNumber}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    Executing Cloud Gateway...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send via Cloud Function
                  </>
                )}
              </button>

              <a
                href={phoneNumber ? `https://wa.me/${fullWhatsAppNumber.replace(/[^\d]/g, '')}?text=${encodeURIComponent(generatedTemplateMessage)}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!phoneNumber) {
                    e.preventDefault();
                    alert("Please enter a valid patient phone number.");
                  }
                }}
                className={`py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl border flex items-center justify-center gap-2 transition-all shadow-2xs ${
                  phoneNumber
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 cursor-pointer'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                }`}
              >
                <ExternalLink className="w-4 h-4 text-emerald-600" />
                Open Direct WhatsApp App
              </a>
            </div>
          </div>
        )}

        {/* TAB 2: EMAIL DISPATCH */}
        {activeTab === 'email' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Patient Email Address
              </label>
              <input
                type="email"
                placeholder="patient@example.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                The report PDF and clinical instructions will be delivered securely to this inbox via serverless Cloud Function gateway.
              </p>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs text-blue-900 dark:text-blue-200">
              <p className="font-bold mb-1">Email Dispatch Specs:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-blue-800 dark:text-blue-300">
                <li>Automated PDF Attachment included</li>
                <li>Encrypted Transmission via Serverless Node Gateway</li>
                <li>Instant Delivery Receipt confirmation</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={handleSendEmail}
              disabled={isSending || !emailAddress}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Dispatching Email...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Dispatch Email Report
                </>
              )}
            </button>
          </div>
        )}

        {/* TAB 3: DISPATCH HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
              Audit Trail & Delivery Logs
            </h4>

            {(!record.dispatchHistory || record.dispatchHistory.length === 0) ? (
              <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 text-xs font-medium">
                No dispatches recorded for this endoscopy report yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {record.dispatchHistory.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      {log.channel === 'whatsapp' ? (
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-lg">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-lg">
                          <Mail className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {log.recipient} <span className="text-[10px] text-slate-400 font-mono">({log.messageId})</span>
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {new Date(log.timestamp).toLocaleString()} • {log.details}
                        </p>
                      </div>
                    </div>
                    <div>
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold rounded-full uppercase">
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SERVERLESS GATEWAY STATUS */}
        {activeTab === 'status' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-900 text-white rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold flex items-center gap-1.5 text-amber-400">
                  <Cpu className="w-4 h-4" /> Cloud Function Architecture Status
                </span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono rounded">
                  Status: Active
                </span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Serverless API endpoints are deployed on Cloud Run microservices. WhatsApp API dispatches run via server-side isolated routes (`/api/cloud-functions/*`) keeping API keys strictly protected from client exposure.
              </p>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 pt-1 font-mono">
                <div>WhatsApp Gateway: <strong className="text-white">{gatewayStatus?.whatsappGateway?.provider || 'Meta Cloud API / Twilio'}</strong></div>
                <div>Execution Mode: <strong className="text-emerald-400">{gatewayStatus?.whatsappGateway?.status === 'configured' ? 'Live API' : 'Sandbox / Simulation Mode'}</strong></div>
              </div>
            </div>

            {/* Server Logs Stream */}
            <div>
              <h5 className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider mb-1">
                Recent Cloud Function Execution Logs
              </h5>
              <div className="p-3 bg-slate-950 text-emerald-400 font-mono text-[10px] rounded-xl max-h-40 overflow-y-auto space-y-1.5">
                {gatewayStatus?.recentLogs && gatewayStatus.recentLogs.length > 0 ? (
                  gatewayStatus.recentLogs.map((log: any) => (
                    <div key={log.id} className="border-b border-slate-900 pb-1">
                      <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                      <span className="text-amber-300">[{log.functionName}]</span>{' '}
                      <span className="text-white">To: {log.recipient}</span> —{' '}
                      <span className={log.status === 'SUCCESS' ? 'text-emerald-400' : 'text-cyan-300'}>{log.status}</span>: {log.details}
                    </div>
                  ))
                ) : (
                  <div className="text-slate-600">No function execution logs recorded yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Result Feedback Banner */}
        {dispatchResult && (
          <div className={`p-3 rounded-xl border text-xs ${
            dispatchResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
          }`}>
            <div className="flex items-start gap-2">
              {dispatchResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-bold">{dispatchResult.message}</p>
                {dispatchResult.messageId && (
                  <p className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Cloud Function Receipt ID: {dispatchResult.messageId}
                  </p>
                )}
                {dispatchResult.details && (
                  <p className="text-[10px] mt-1 text-red-700 dark:text-red-300 font-mono">
                    {dispatchResult.details}
                  </p>
                )}
                {dispatchResult.whatsappWebUrl && (
                  <div className="mt-2">
                    <a
                      href={dispatchResult.whatsappWebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white font-bold text-[10px] uppercase rounded-lg hover:bg-emerald-700"
                    >
                      <ExternalLink className="w-3 h-3" /> Launch WhatsApp Web Direct Link
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default WhatsAppDispatchModal;
