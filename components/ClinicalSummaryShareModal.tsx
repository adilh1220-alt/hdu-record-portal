import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  MessageSquare, 
  Mail, 
  Send, 
  Copy, 
  Check, 
  Download, 
  FileText, 
  ExternalLink, 
  Sparkles, 
  Settings, 
  Smartphone, 
  Tag, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Printer,
  ChevronDown
} from 'lucide-react';
import Modal from './Modal';
import { Patient, EndoscopyRecord } from '../types';
import { 
  MessageTemplate, 
  messageTemplateService, 
  TEMPLATE_PLACEHOLDERS 
} from '../services/messageTemplateService';
import MessageTemplateManagerModal from './MessageTemplateManagerModal';
import { COUNTRY_CODES, sanitizeLocalNumber } from './WhatsAppDispatchModal';
import { 
  exportPatientSummaryPDF, 
  exportSingleEndoscopyReportPDF,
  getPatientSummaryPDFBlob,
  getSingleEndoscopyReportPDFBlob
} from '../services/pdfService';
import { useAuth } from '../contexts/AuthContext';

interface ClinicalSummaryShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: Patient | null;
  endoscopy?: EndoscopyRecord | null;
}

export const ClinicalSummaryShareModal: React.FC<ClinicalSummaryShareModalProps> = ({
  isOpen,
  onClose,
  patient,
  endoscopy
}) => {
  const { currentUser } = useAuth();
  const currentDisplayName = currentUser?.displayName || currentUser?.email || 'Medical Practitioner';

  // Templates state
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);

  // Editable fields
  const [subjectText, setSubjectText] = useState('');
  const [messageBody, setMessageBody] = useState('');

  // WhatsApp fields
  const [selectedCountryCode, setSelectedCountryCode] = useState('+92');
  const [customCountryCode, setCustomCountryCode] = useState('+');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');

  // Statuses
  const [copiedField, setCopiedField] = useState<'body' | 'txt' | 'all' | null>(null);
  const [activeChannelTab, setActiveChannelTab] = useState<'quick' | 'whatsapp' | 'email'>('quick');
  const [isSharingPDF, setIsSharingPDF] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // Load templates on open and select appropriate default
  useEffect(() => {
    if (isOpen) {
      loadTemplatesAndApplyDefault();
    }
  }, [isOpen, patient, endoscopy]);

  // Listen for template update events across windows/tabs
  useEffect(() => {
    const handleTemplatesUpdated = () => {
      loadTemplatesAndApplyDefault();
    };
    window.addEventListener('medilog_message_templates_updated', handleTemplatesUpdated);
    return () => window.removeEventListener('medilog_message_templates_updated', handleTemplatesUpdated);
  }, [patient, endoscopy]);

  const loadTemplatesAndApplyDefault = () => {
    const allTemplates = messageTemplateService.getTemplates();
    setTemplates(allTemplates);

    // Pick best initial template based on context
    let defaultTpl: MessageTemplate | undefined;
    if (endoscopy) {
      defaultTpl = allTemplates.find(t => t.category === 'endoscopy_report' && t.isDefault) ||
                   allTemplates.find(t => t.category === 'endoscopy_report') ||
                   allTemplates[0];
    } else if (patient?.dischargeDate) {
      defaultTpl = allTemplates.find(t => t.category === 'discharge_notice' && t.isDefault) ||
                   allTemplates.find(t => t.category === 'discharge_notice') ||
                   allTemplates[0];
    } else {
      defaultTpl = allTemplates.find(t => t.category === 'patient_summary' && t.isDefault) ||
                   allTemplates.find(t => t.category === 'patient_summary') ||
                   allTemplates[0];
    }

    if (defaultTpl) {
      setSelectedTemplateId(defaultTpl.id);
      applyTemplateToForm(defaultTpl);
    }

    // Pre-populate phone / email if available on patient or endoscopy
    const targetWhatsApp = patient?.whatsappNumber || endoscopy?.whatsappNumber;
    const targetEmail = patient?.emailAddress || endoscopy?.emailAddress;

    if (targetWhatsApp) {
      const matched = COUNTRY_CODES.find(c => c.code !== 'custom' && targetWhatsApp.startsWith(c.code));
      if (matched) {
        setSelectedCountryCode(matched.code);
        setPhoneNumber(sanitizeLocalNumber(targetWhatsApp.substring(matched.code.length), matched.code));
      } else {
        setPhoneNumber(sanitizeLocalNumber(targetWhatsApp, '+92'));
      }
    } else {
      setPhoneNumber('');
    }

    if (targetEmail) {
      setRecipientEmail(targetEmail);
    } else {
      setRecipientEmail('');
    }
  };

  const applyTemplateToForm = (tpl: MessageTemplate) => {
    const context = {
      patient: patient || undefined,
      endoscopy: endoscopy || undefined,
      generatedBy: currentDisplayName
    };

    const renderedSubj = messageTemplateService.renderTemplate(tpl.subjectTemplate || '', context);
    const renderedBody = messageTemplateService.renderTemplate(tpl.bodyTemplate, context);

    setSubjectText(renderedSubj);
    setMessageBody(renderedBody);
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedTemplateId(newId);
    const found = templates.find(t => t.id === newId);
    if (found) {
      applyTemplateToForm(found);
    }
  };

  const handleResetToTemplate = () => {
    const found = templates.find(t => t.id === selectedTemplateId);
    if (found) {
      applyTemplateToForm(found);
    }
  };

  // WhatsApp computation
  const activePrefix = selectedCountryCode === 'custom' ? customCountryCode : selectedCountryCode;
  const sanitizedLocalNumber = sanitizeLocalNumber(phoneNumber, activePrefix);
  const fullWhatsAppNumber = `${activePrefix}${sanitizedLocalNumber}`;
  const digitsOnly = fullWhatsAppNumber.replace(/[^\d]/g, '');

  const whatsappDirectUrl = digitsOnly
    ? `https://api.whatsapp.com/send?phone=${digitsOnly}&text=${encodeURIComponent(messageBody)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(messageBody)}`;

  const handleLaunchWhatsApp = () => {
    window.open(whatsappDirectUrl, '_blank', 'noopener,noreferrer');
  };

  // Gmail Web Composer
  const handleLaunchGmail = () => {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&su=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(messageBody)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Mailto Client
  const handleLaunchMailto = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(messageBody)}`;
    window.location.href = mailtoUrl;
  };

  // Native Mobile Share Sheet with PDF Attachment
  const handleNativeShare = async () => {
    setIsSharingPDF(true);
    setShareFeedback(null);
    try {
      let fileObj: { blob: Blob; filename: string; file: File } | null = null;
      if (endoscopy) {
        fileObj = await getSingleEndoscopyReportPDFBlob(endoscopy, currentDisplayName);
      } else if (patient) {
        fileObj = await getPatientSummaryPDFBlob(patient, currentDisplayName);
      }

      if (fileObj && typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [fileObj.file] })) {
        await navigator.share({
          files: [fileObj.file],
          title: subjectText || `Clinical Report - ${patient?.name || endoscopy?.name || 'Patient'}`,
          text: messageBody
        });
        setShareFeedback('Report PDF shared directly via device share sheet!');
        setTimeout(() => setShareFeedback(null), 4000);
        return;
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: subjectText || `Clinical Summary - ${patient?.name || endoscopy?.name || 'Patient'}`,
          text: messageBody,
          url: origin
        });
        return;
      }

      handleCopyText();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        handleCopyText();
      }
    } finally {
      setIsSharingPDF(false);
    }
  };

  // Direct Send WhatsApp with PDF Attached / Direct Flow
  const handleSharePDFWhatsApp = async () => {
    setIsSharingPDF(true);
    setShareFeedback(null);
    try {
      let fileObj: { blob: Blob; filename: string; file: File } | null = null;
      if (endoscopy) {
        fileObj = await getSingleEndoscopyReportPDFBlob(endoscopy, currentDisplayName);
      } else if (patient) {
        fileObj = await getPatientSummaryPDFBlob(patient, currentDisplayName);
      }

      if (!fileObj) {
        handleLaunchWhatsApp();
        return;
      }

      // Check if Web Share API with Files is supported (mobile Android Chrome, iOS Safari, etc.)
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [fileObj.file] })) {
        try {
          await navigator.share({
            files: [fileObj.file],
            title: subjectText || (endoscopy ? `Endoscopy Report - ${endoscopy.name}` : `Clinical Summary - ${patient?.name}`),
            text: messageBody
          });
          setShareFeedback('Report PDF sent to WhatsApp via device picker!');
          setTimeout(() => setShareFeedback(null), 4500);
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

      handleLaunchWhatsApp();
      setShareFeedback('PDF generated & WhatsApp opened! Attach the downloaded PDF to your chat.');
      setTimeout(() => setShareFeedback(null), 5500);
    } catch (err: any) {
      console.error('Error generating PDF for WhatsApp:', err);
      handleLaunchWhatsApp();
    } finally {
      setIsSharingPDF(false);
    }
  };

  // Copy Message Text
  const handleCopyText = () => {
    navigator.clipboard.writeText(messageBody);
    setCopiedField('body');
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Download .TXT
  const handleDownloadTxt = () => {
    const blob = new Blob([messageBody], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const nameSlug = (patient?.name || endoscopy?.name || 'patient').toLowerCase().replace(/\s+/g, '_');
    link.download = `clinical_summary_${nameSlug}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCopiedField('txt');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleDownloadPDF = () => {
    if (endoscopy) {
      exportSingleEndoscopyReportPDF(endoscopy, currentDisplayName);
    } else if (patient) {
      exportPatientSummaryPDF(patient, currentDisplayName);
    }
  };

  const currentTemplate = templates.find(t => t.id === selectedTemplateId);

  if (!isOpen) return null;

  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={endoscopy ? "Share Endoscopy Procedure Report & Findings" : "Share Clinical Summary & Messages"}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          {/* Top Header Card with Patient/Record Context & Template Selector */}
          <div className="bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-black shadow-sm">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {patient?.name || endoscopy?.name || 'Patient Summary'}
                    </h4>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                      MRN: {patient?.regNo || endoscopy?.regNo || 'N/A'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {endoscopy ? (
                      <>
                        Procedure: <strong className="text-slate-800 dark:text-slate-200">{endoscopy.procedure || 'Endoscopy'}</strong> • Endoscopist: <strong className="text-slate-800 dark:text-slate-200">{endoscopy.doctor || 'Physician'}</strong>
                      </>
                    ) : (
                      <>
                        Unit: <strong className="text-slate-800 dark:text-slate-200">{patient?.unit || 'HDU'}</strong> ({patient?.location || 'Bed N/A'}) • Consultant: <strong className="text-slate-800 dark:text-slate-200">{patient?.consultant || 'Physician'}</strong>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Template Configuration Quick Button */}
              <button
                type="button"
                onClick={() => setIsTemplateManagerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                title="Configure custom message templates"
              >
                <Settings className="w-3.5 h-3.5 text-red-500" />
                <span>Configure Templates</span>
              </button>
            </div>

            {/* Template Selector Dropdown & Info Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/80 items-center">
              <div className="sm:col-span-4 flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1 whitespace-nowrap">
                  <Tag className="w-3 h-3 text-red-500" />
                  Pre-filled Template:
                </span>
              </div>
              <div className="sm:col-span-8 flex items-center gap-2">
                <select
                  value={selectedTemplateId}
                  onChange={handleTemplateChange}
                  className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
                >
                  {templates.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} {tpl.isDefault ? '★ (Default)' : ''}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleResetToTemplate}
                  className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Re-render message from template"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Main Work Area: Message Editor & Quick Dispatch Channels */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Area: Live Editable Message & Subject (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              {/* Subject (for Email) */}
              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-red-500" />
                    Summary Subject (Email & Notifications)
                  </span>
                </label>
                <input
                  type="text"
                  value={subjectText}
                  onChange={(e) => setSubjectText(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white font-bold"
                />
              </div>

              {/* Message Body with Instant Copy Toolbar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-emerald-600" />
                    Message Content (Pre-filled from Template)
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-all"
                  >
                    {copiedField === 'body' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-500" />
                        <span>Copy Message</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={11}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="w-full p-3.5 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-800 dark:text-slate-100 leading-relaxed"
                />
              </div>
            </div>

            {/* Right Area: Dispatch Channels & Instant Actions (5 cols) */}
            <div className="lg:col-span-5 space-y-3.5">
              {/* Live Feedback Notification Banner */}
              {shareFeedback && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="leading-snug">{shareFeedback}</p>
                </div>
              )}

              {/* Primary 1-Click Mobile Share Button with direct PDF attachment */}
              <button
                type="button"
                onClick={handleNativeShare}
                disabled={isSharingPDF}
                className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-60 text-white py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] cursor-pointer"
              >
                {isSharingPDF ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Preparing PDF Report...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Share PDF via App / Mobile Sheet</span>
                  </>
                )}
              </button>

              {/* WhatsApp Direct Send Section */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/80 p-3.5 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                    WhatsApp Direct Dispatch
                  </span>
                  <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400">Direct PDF & Chat</span>
                </div>

                {/* Country Code & Phone Input */}
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    <select
                      value={selectedCountryCode}
                      onChange={(e) => setSelectedCountryCode(e.target.value)}
                      className="w-1/3 px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-white"
                    >
                      {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code}>{c.code} ({c.country.split(' ')[0]})</option>
                      ))}
                    </select>

                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 300 1234567"
                      className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                  {digitsOnly && (
                    <span className="text-[9px] font-mono text-slate-500 block truncate">
                      Recipient: +{digitsOnly}
                    </span>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  {/* Direct WhatsApp PDF Share Button */}
                  <button
                    type="button"
                    onClick={handleSharePDFWhatsApp}
                    disabled={isSharingPDF}
                    className="w-full py-2.5 px-3 bg-[#25D366] hover:bg-[#1ebd5a] disabled:opacity-60 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer"
                  >
                    {isSharingPDF ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating PDF...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5 text-slate-900" />
                        <span>Send PDF Report via WhatsApp</span>
                      </>
                    )}
                  </button>

                  {/* Text-only WhatsApp Link fallback */}
                  <button
                    type="button"
                    onClick={handleLaunchWhatsApp}
                    className="w-full py-1.5 px-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/80 font-bold text-[11px] rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3 text-emerald-600" />
                    <span>Send Text Summary Only</span>
                  </button>
                </div>
              </div>

              {/* Email Send Section */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-red-500" />
                    Email Dispatch Channels
                  </span>
                </div>

                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="Recipient Doctor / Clinic Email (Optional)"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-white"
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleLaunchGmail}
                    className="py-2 px-2 bg-red-600/10 hover:bg-red-600/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 font-bold text-[11px] rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Mail className="w-3.5 h-3.5 text-red-500" />
                    <span>Open in Gmail</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLaunchMailto}
                    className="py-2 px-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-[11px] rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5 text-blue-500" />
                    <span>Default Mail</span>
                  </button>
                </div>
              </div>

              {/* Download / Export Options */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  <span>{copiedField === 'txt' ? 'Downloaded!' : 'Save as .TXT'}</span>
                </button>

                {(patient || endoscopy) && (
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    className="py-2 px-3 bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-red-400" />
                    <span>Download PDF</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Embedded Message Template Manager Modal */}
      <MessageTemplateManagerModal
        isOpen={isTemplateManagerOpen}
        onClose={() => {
          setIsTemplateManagerOpen(false);
          loadTemplatesAndApplyDefault();
        }}
        onSelectTemplate={(tpl) => {
          setSelectedTemplateId(tpl.id);
          applyTemplateToForm(tpl);
        }}
        samplePatient={patient}
        sampleEndoscopy={endoscopy}
      />
    </>
  );
};

export default ClinicalSummaryShareModal;
