import React, { useState, useEffect } from 'react';
import { Send, MessageSquare, Mail, CheckCircle2, AlertCircle, RefreshCw, Smartphone, ExternalLink, ShieldCheck, Cpu, Settings, Copy, Check, Share2, FileText, Tag, Plus } from 'lucide-react';
import { EndoscopyRecord, DispatchLog } from '../types';
import Modal from './Modal';
import { MessageTemplate, messageTemplateService } from '../services/messageTemplateService';
import MessageTemplateManagerModal from './MessageTemplateManagerModal';
import { getSingleEndoscopyReportPDFBlob } from '../services/pdfService';

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

// Helper to clean and sanitize input local numbers to prevent duplicate country codes
export const sanitizeLocalNumber = (rawNum: string, countryPrefix: string): string => {
  if (!rawNum) return '';
  let cleaned = rawNum.replace(/[^\d+]/g, '');
  const prefixDigits = countryPrefix.replace(/\D/g, ''); // e.g. "92" for +92

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // If user pasted full international number with country code digits (e.g. "923001234567" when prefix is "+92")
  if (prefixDigits && cleaned.startsWith(prefixDigits) && cleaned.length > prefixDigits.length + 5) {
    cleaned = cleaned.substring(prefixDigits.length);
  }

  // Remove leading zeros (e.g. "03001234567" -> "3001234567")
  return cleaned.replace(/^0+/, '');
};

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
  
  // Custom Message Template State
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customMessageBody, setCustomMessageBody] = useState<string>('');
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfShareNotice, setPdfShareNotice] = useState<string | null>(null);

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

  const [handshakeResult, setHandshakeResult] = useState<{
    loading?: boolean;
    success?: boolean;
    status?: string;
    provider?: string;
    errorMessage?: string;
    details?: string;
  } | null>(null);

  // Load message templates
  const loadTemplates = () => {
    const list = messageTemplateService.getTemplates();
    setTemplates(list);
    const defaultTpl = list.find(t => t.category === 'endoscopy_report' && t.isDefault) ||
                       list.find(t => t.category === 'endoscopy_report') ||
                       list[0];
    if (defaultTpl) {
      setSelectedTemplateId(defaultTpl.id);
      applyTemplate(defaultTpl);
    }
  };

  const applyTemplate = (tpl: MessageTemplate) => {
    const rendered = messageTemplateService.renderTemplate(tpl.bodyTemplate, {
      endoscopy: record,
      generatedBy: 'The Kidney Centre Endoscopy Staff'
    });
    setCustomMessageBody(rendered);
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen, record]);

  useEffect(() => {
    const handleTemplatesUpdated = () => {
      loadTemplates();
    };
    window.addEventListener('medilog_message_templates_updated', handleTemplatesUpdated);
    return () => window.removeEventListener('medilog_message_templates_updated', handleTemplatesUpdated);
  }, [record]);

  useEffect(() => {
    if (record) {
      if (record.whatsappNumber) {
        // Parse country code if present
        const matchedCode = COUNTRY_CODES.find(c => c.code !== 'custom' && record.whatsappNumber?.startsWith(c.code));
        if (matchedCode) {
          setSelectedCountryCode(matchedCode.code);
          const rawNum = record.whatsappNumber.substring(matchedCode.code.length);
          setPhoneNumber(sanitizeLocalNumber(rawNum, matchedCode.code));
        } else if (record.whatsappNumber.startsWith('+')) {
          setSelectedCountryCode('custom');
          const match = record.whatsappNumber.match(/^(\+\d{1,4})(.*)$/);
          if (match) {
            setCustomCountryCode(match[1]);
            setPhoneNumber(sanitizeLocalNumber(match[2], match[1]));
          } else {
            setPhoneNumber(sanitizeLocalNumber(record.whatsappNumber, '+92'));
          }
        } else {
          setSelectedCountryCode('+92');
          setPhoneNumber(sanitizeLocalNumber(record.whatsappNumber, '+92'));
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

  const handleTestHandshake = async () => {
    setHandshakeResult({ loading: true });
    try {
      const res = await fetch('/api/cloud-functions/verify-whatsapp-handshake');
      const data = await res.json();
      setHandshakeResult(data);
    } catch (e: any) {
      setHandshakeResult({
        success: false,
        status: 'error',
        errorMessage: e.message || 'Network error verifying handshake',
        details: 'Failed to communicate with backend handshake route.'
      });
    }
  };

  const activePrefix = selectedCountryCode === 'custom' ? customCountryCode : selectedCountryCode;
  const sanitizedLocalNumber = sanitizeLocalNumber(phoneNumber, activePrefix);
  const fullWhatsAppNumber = `${activePrefix}${sanitizedLocalNumber}`;
  const digitsOnly = fullWhatsAppNumber.replace(/[^\d]/g, '');

  const fallbackTemplateMessage = `🏥 *THE KIDNEY CENTRE ENDOSCOPY REPORT*

Dear *${record.name.toUpperCase()}*,
Your endoscopy procedure report is compiled and ready.

• *MR Number:* ${record.regNo}
• *Procedure:* ${record.procedure}
• *Date:* ${record.date} ${record.time ? `@ ${record.time}` : ''}
• *Attending Doctor:* Dr. ${record.doctor}
• *Diagnosis:* ${record.diagnosis || 'Diagnostic exam completed.'}

📄 *Recommendations:* ${record.recommendations || 'Please follow up with your consulting clinician.'}

_This automated message was sent via The Kidney Centre Gateway._`;

  const effectiveMessage = customMessageBody || fallbackTemplateMessage;

  const directWhatsAppApiUrl = digitsOnly
    ? `https://api.whatsapp.com/send?phone=${digitsOnly}&text=${encodeURIComponent(effectiveMessage)}`
    : '';

  const directWaMeUrl = digitsOnly
    ? `https://wa.me/${digitsOnly}?text=${encodeURIComponent(effectiveMessage)}`
    : '';

  const handleSendWhatsApp = async () => {
    if (!phoneNumber || !digitsOnly) {
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
          customMessage: effectiveMessage
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
          message: data.info || "WhatsApp dispatch ready! Click below to launch WhatsApp.",
          messageId: data.messageId,
          whatsappWebUrl: data.whatsappWebUrl || directWhatsAppApiUrl
        });

        if (onDispatchSuccess) {
          onDispatchSuccess(newLog);
        }
      } else {
        const errorMsg = data.error || "Failed to dispatch WhatsApp message via Cloud Function gateway.";
        setDispatchResult({
          success: false,
          message: errorMsg,
          details: JSON.stringify(data),
          whatsappWebUrl: directWhatsAppApiUrl
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
        details: err.message,
        whatsappWebUrl: directWhatsAppApiUrl
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

  const handleShareDirectPDFWhatsApp = async () => {
    if (!phoneNumber || !digitsOnly) {
      alert("Please enter a valid patient phone number.");
      return;
    }

    setIsGeneratingPDF(true);
    setPdfShareNotice(null);

    try {
      const fileObj = await getSingleEndoscopyReportPDFBlob(record, 'The Kidney Centre Endoscopy Staff');

      // Check if Web Share API with Files is supported (mobile Android Chrome, iOS Safari, etc.)
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [fileObj.file] })) {
        try {
          await navigator.share({
            files: [fileObj.file],
            title: `Endoscopy Procedure Report - ${record.name}`,
            text: effectiveMessage
          });
          setPdfShareNotice('Report PDF sent to WhatsApp via device picker!');
          setTimeout(() => setPdfShareNotice(null), 4500);
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') {
            return;
          }
          console.warn('Native share with file aborted or not available, falling back:', err);
        }
      }

      // Fallback for Desktop / WhatsApp Web:
      // Trigger instant direct download of the PDF so the user has the file immediately ready, then open WhatsApp chat
      const url = URL.createObjectURL(fileObj.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileObj.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      handleOpenWhatsAppDirect();
      setPdfShareNotice('PDF generated & downloaded! WhatsApp opened — attach the file to your chat.');
      setTimeout(() => setPdfShareNotice(null), 5500);
    } catch (err: any) {
      console.error('Error generating PDF for WhatsApp:', err);
      handleOpenWhatsAppDirect();
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleOpenWhatsAppDirect = (e?: React.MouseEvent) => {
    if (!phoneNumber || !digitsOnly) {
      if (e) e.preventDefault();
      alert("Please enter a valid patient phone number.");
      return;
    }

    const targetUrl = directWhatsAppApiUrl || directWaMeUrl;
    try {
      const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        window.location.href = targetUrl;
      }
    } catch (err) {
      window.location.href = targetUrl;
    }
  };

  return (
    <>
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
                  placeholder="3001234567 or paste full +923001234567"
                  value={phoneNumber}
                  onChange={(e) => {
                    const cleanNum = sanitizeLocalNumber(e.target.value, activePrefix);
                    setPhoneNumber(cleanNum);
                  }}
                  className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Selected International Format: <strong className="text-emerald-600 font-mono font-bold">{fullWhatsAppNumber || 'None'}</strong>
              </p>
            </div>

            {/* Practical Guidance Note */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
              <div className="font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Individual Patient WhatsApp Dispatch:
              </div>
              <p className="leading-snug">
                <strong>1-Click Direct Launch:</strong> Opens WhatsApp Web/App directly with the pre-written medical endoscopy findings, MR number, doctor name, and recommendations pre-filled.
              </p>
              <p className="leading-snug text-slate-500 dark:text-slate-400">
                <strong>Server API (Background):</strong> Connect Meta Cloud API credentials (<code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">WHATSAPP_ACCESS_TOKEN</code>) in settings for automatic backend background SMS/WhatsApp delivery without opening WhatsApp Web.
              </p>
            </div>

            {/* Template Selector & Custom Message Body */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pre-filled Template & Message</span>
                </label>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsTemplateManagerOpen(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                  >
                    <Settings className="w-3 h-3 text-red-500" />
                    <span>Configure Templates</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(effectiveMessage);
                      setCopiedText(true);
                      setTimeout(() => setCopiedText(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                  >
                    {copiedText ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-400" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditingMessage(!isEditingMessage)}
                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline px-1"
                  >
                    {isEditingMessage ? 'Preview Mode' : 'Edit Text'}
                  </button>
                </div>
              </div>

              {/* Template dropdown selector */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedTemplateId(newId);
                    const found = templates.find(t => t.id === newId);
                    if (found) {
                      applyTemplate(found);
                    }
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {templates.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} {tpl.isDefault ? '★ (Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Editable Textarea or Formatted Preview */}
              {isEditingMessage ? (
                <textarea
                  rows={8}
                  value={customMessageBody}
                  onChange={(e) => setCustomMessageBody(e.target.value)}
                  className="w-full p-3.5 bg-slate-900 border border-emerald-500/50 rounded-xl text-xs font-mono text-emerald-300 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Type or customize your message..."
                />
              ) : (
                <div className="p-3.5 bg-emerald-950/10 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-sans text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-medium max-h-[220px] overflow-y-auto">
                  {effectiveMessage}
                </div>
              )}
            </div>

            {/* PDF Share Feedback Banner */}
            {pdfShareNotice && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="leading-snug">{pdfShareNotice}</p>
              </div>
            )}

            {/* Primary Direct WhatsApp PDF Action */}
            <button
              type="button"
              onClick={handleShareDirectPDFWhatsApp}
              disabled={isGeneratingPDF || !phoneNumber}
              className={`w-full py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl border flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-95 cursor-pointer ${
                phoneNumber && digitsOnly
                  ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white border-emerald-500 shadow-emerald-600/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed pointer-events-none'
              }`}
            >
              {isGeneratingPDF ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Preparing & Attaching PDF Report...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 text-white" />
                  <span>Send PDF Report via WhatsApp (Instant)</span>
                </>
              )}
            </button>

            {/* Secondary Action Buttons */}
            <div className="pt-1 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={isSending || !phoneNumber}
                className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-300 dark:border-slate-700 shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing API...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cloud API</span>
                  </>
                )}
              </button>

              <a
                href={phoneNumber && digitsOnly ? directWhatsAppApiUrl : '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!phoneNumber || !digitsOnly) {
                    e.preventDefault();
                    alert("Please enter a valid patient phone number.");
                  }
                }}
                className={`flex-1 py-2.5 px-3 text-xs font-bold uppercase tracking-wider rounded-xl border flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                  phoneNumber && digitsOnly
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 cursor-pointer active:scale-95'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed pointer-events-none'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5 text-white" />
                <span>Open Chat (Text)</span>
              </a>

              <a
                href={phoneNumber && digitsOnly ? directWaMeUrl : '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!phoneNumber || !digitsOnly) {
                    e.preventDefault();
                    alert("Please enter a valid patient phone number.");
                  }
                }}
                className={`py-2.5 px-3 text-xs font-bold uppercase tracking-wider rounded-xl border flex items-center justify-center gap-1 transition-all shadow-xs ${
                  phoneNumber && digitsOnly
                    ? 'bg-slate-800 hover:bg-slate-900 text-emerald-400 border-slate-700 cursor-pointer active:scale-95'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed pointer-events-none'
                }`}
                title="Alternative wa.me direct link"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>wa.me</span>
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

            {/* Provider Handshake Verification Tester */}
            <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> API Provider Handshake Tester
                  </h5>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Verify live connection health & credential validity with WhatsApp API Provider.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestHandshake}
                  disabled={handshakeResult?.loading}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 font-black text-[10px] uppercase rounded-lg border border-slate-700 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {handshakeResult?.loading ? 'Testing...' : 'Verify Handshake'}
                </button>
              </div>

              {handshakeResult && !handshakeResult.loading && (
                <div className={`p-2.5 rounded-lg text-[11px] font-mono border ${
                  handshakeResult.status === 'connected' || handshakeResult.status === 'simulation_mode'
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                    : 'bg-rose-950/40 text-rose-300 border-rose-800'
                }`}>
                  <div className="font-bold uppercase text-[10px]">
                    Provider: {handshakeResult.provider} | Status: {handshakeResult.status}
                  </div>
                  <div className="mt-1 leading-normal text-[10px]">
                    {handshakeResult.errorMessage && <div className="text-rose-400 font-semibold mb-0.5">{handshakeResult.errorMessage}</div>}
                    <div>{handshakeResult.details}</div>
                  </div>
                </div>
              )}
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
                {(dispatchResult.whatsappWebUrl || directWhatsAppApiUrl) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <a
                      href={dispatchResult.whatsappWebUrl || directWhatsAppApiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-white" /> Open WhatsApp Web / App
                    </a>
                    {directWaMeUrl && (
                      <a
                        href={directWaMeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold text-[11px] uppercase rounded-lg border border-slate-700 shadow-2xs transition-all active:scale-95 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> wa.me Direct Link
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>

    {/* Custom Message Template Manager Modal */}
    <MessageTemplateManagerModal
      isOpen={isTemplateManagerOpen}
      onClose={() => {
        setIsTemplateManagerOpen(false);
        loadTemplates();
      }}
      onSelectTemplate={(tpl) => {
        setSelectedTemplateId(tpl.id);
        applyTemplate(tpl);
      }}
      initialSelectedCategory="endoscopy_report"
      sampleEndoscopy={record}
    />
    </>
  );
};

export default WhatsAppDispatchModal;
