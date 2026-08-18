import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Check, 
  RefreshCw, 
  Download, 
  Upload, 
  FileText, 
  Eye, 
  EyeOff, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Settings, 
  Tag, 
  MessageSquare,
  Mail,
  ShieldCheck,
  Bookmark,
  Star,
  Search,
  Layers,
  ArrowRight
} from 'lucide-react';
import Modal from './Modal';
import { 
  MessageTemplate, 
  TemplateCategory, 
  TEMPLATE_PLACEHOLDERS, 
  DEFAULT_MESSAGE_TEMPLATES, 
  messageTemplateService 
} from '../services/messageTemplateService';
import { Patient, EndoscopyRecord } from '../types';

interface MessageTemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate?: (template: MessageTemplate) => void;
  initialSelectedCategory?: TemplateCategory;
  samplePatient?: Patient | null;
  sampleEndoscopy?: EndoscopyRecord | null;
}

const CATEGORY_META: Record<TemplateCategory, { label: string; color: string; bg: string; icon: string }> = {
  patient_summary: { label: 'Clinical Summary', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800', icon: '🏥' },
  physician_handover: { label: 'Doctor Handover', color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800', icon: '🩺' },
  discharge_notice: { label: 'Discharge / Transfer', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800', icon: '🚪' },
  critical_alert: { label: 'Critical Alert', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800', icon: '🚨' },
  endoscopy_report: { label: 'Endoscopy Findings', color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800', icon: '🔬' },
  custom: { label: 'Custom Template', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800', icon: '✨' }
};

export const MessageTemplateManagerModal: React.FC<MessageTemplateManagerModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  initialSelectedCategory,
  samplePatient,
  sampleEndoscopy
}) => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>(initialSelectedCategory || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Editor state
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<TemplateCategory>('patient_summary');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  
  // Live Preview Toggle & Active Tab
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit');
  const [activePlaceholderCategory, setActivePlaceholderCategory] = useState<'all' | 'patient' | 'clinical' | 'meta' | 'facility'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const [lastFocusedField, setLastFocusedField] = useState<'body' | 'subject'>('body');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load templates on open
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setIsEditing(false);
      setEditingId(null);
      setPreviewMode('edit');
    }
  }, [isOpen]);

  const loadTemplates = () => {
    const list = messageTemplateService.getTemplates();
    setTemplates(list);
  };

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setStatusNotification({ message, type });
    setTimeout(() => setStatusNotification(null), 3000);
  };

  const handleStartCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormCategory(initialSelectedCategory || 'patient_summary');
    setFormSubject('🏥 Clinical Update: {{patientName}} (MRN: {{mrn}})');
    setFormBody(`🏥 *THE KIDNEY CENTRE MEDICAL UPDATE*\n----------------------------------------\n👤 *Patient:* {{patientName}}\n🔢 *MR Number:* {{mrn}}\n🏢 *Unit:* {{unit}} ({{bed}})\n👨‍⚕️ *Consultant:* {{consultant}}\n📋 *Status:* {{status}}\n\n_Dispatched via The Kidney Centre System._`);
    setFormDescription('Custom configured communication template.');
    setFormIsDefault(false);
    setIsEditing(true);
    setPreviewMode('edit');
  };

  const handleStartEdit = (template: MessageTemplate) => {
    setEditingId(template.id);
    setFormName(template.name);
    setFormCategory(template.category);
    setFormSubject(template.subjectTemplate || '');
    setFormBody(template.bodyTemplate);
    setFormDescription(template.description || '');
    setFormIsDefault(!!template.isDefault);
    setIsEditing(true);
    setPreviewMode('edit');
  };

  const handleDuplicate = (template: MessageTemplate) => {
    const duplicated: MessageTemplate = {
      ...template,
      id: `tpl_custom_${Date.now()}`,
      name: `${template.name} (Copy)`,
      isDefault: false,
      isSystemDefault: false,
      lastModified: new Date().toISOString()
    };
    const updated = [...templates, duplicated];
    messageTemplateService.saveTemplates(updated);
    setTemplates(updated);
    showNotification(`Duplicated template as "${duplicated.name}"`, 'success');
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete template "${name}"?`)) {
      messageTemplateService.deleteTemplate(id);
      loadTemplates();
      showNotification(`Template "${name}" deleted.`, 'info');
      if (editingId === id) {
        setIsEditing(false);
        setEditingId(null);
      }
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Reset all message templates back to system factory defaults? Any custom templates will be replaced.')) {
      const reset = messageTemplateService.resetToDefaults();
      setTemplates(reset);
      setIsEditing(false);
      showNotification('Templates successfully restored to hospital defaults.', 'success');
    }
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formBody.trim()) {
      showNotification('Template Name and Message Body are required.', 'error');
      return;
    }

    const saved = messageTemplateService.upsertTemplate({
      id: editingId || undefined,
      name: formName.trim(),
      category: formCategory,
      subjectTemplate: formSubject.trim(),
      bodyTemplate: formBody.trim(),
      description: formDescription.trim(),
      isDefault: formIsDefault
    });

    if (formIsDefault) {
      messageTemplateService.setDefaultTemplate(saved.id, formCategory);
    }

    loadTemplates();
    setIsEditing(false);
    setEditingId(null);
    showNotification(`Template "${saved.name}" saved successfully!`, 'success');
  };

  // Insert placeholder at cursor
  const handleInsertPlaceholder = (placeholderKey: string) => {
    if (lastFocusedField === 'subject' && subjectInputRef.current) {
      const input = subjectInputRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const before = formSubject.substring(0, start);
      const after = formSubject.substring(end);
      const newText = before + placeholderKey + after;
      setFormSubject(newText);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + placeholderKey.length, start + placeholderKey.length);
      }, 50);
    } else if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const before = formBody.substring(0, start);
      const after = formBody.substring(end);
      const newText = before + placeholderKey + after;
      setFormBody(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + placeholderKey.length, start + placeholderKey.length);
      }, 50);
    } else {
      setFormBody(prev => prev + ' ' + placeholderKey);
    }
  };

  // Export JSON
  const handleExportJSON = () => {
    const data = messageTemplateService.exportTemplatesJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kidney_centre_message_templates_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification('Exported templates configuration file.', 'success');
  };

  // Import JSON
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = messageTemplateService.importTemplatesJSON(content);
        if (result.success) {
          loadTemplates();
          showNotification(`Successfully imported ${result.count} message templates!`, 'success');
        } else {
          showNotification(`Import failed: ${result.error}`, 'error');
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesCategory = activeCategoryFilter === 'all' || t.category === activeCategoryFilter;
    const matchesSearch = !searchQuery || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.bodyTemplate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Sample data context for real-time preview
  const previewContext = {
    patient: samplePatient || {
      id: 'P-9921',
      name: 'MUHAMMAD ZULFIQAR',
      regNo: 'MR-58291',
      gender: 'Male',
      unit: 'HDU',
      location: 'Bed 03 (Bay A)',
      category: 'Nephrology',
      consultant: 'Dr. Tariq Mahmood',
      status: 'Active' as any,
      shiftTo: 'Active (In-Unit)',
      triagePriority: 'Urgent' as any,
      codeStatus: 'Full Code' as any,
      lengthOfStay: 3,
      admissionDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    endoscopy: sampleEndoscopy || {
      id: 'endo-preview',
      referringUnit: 'HDU',
      name: 'MUHAMMAD ZULFIQAR',
      regNo: 'MR-58291',
      doctor: 'Dr. Tariq Mahmood',
      procedure: 'Diagnostic Upper GI Endoscopy (OGD)',
      date: new Date().toISOString().split('T')[0],
      time: '11:45 AM',
      diagnosis: 'Erosive Antral Gastritis, Grade I Esophageal Varices (Non-bleeding)',
      recommendations: 'Continue PPI infusion, high-protein diet, review in Nephro/GI joint clinic in 2 weeks.'
    },
    generatedBy: 'Dr. Medical Officer (RMO)'
  };

  const renderedSubjectPreview = messageTemplateService.renderTemplate(formSubject, previewContext);
  const renderedBodyPreview = messageTemplateService.renderTemplate(formBody, previewContext);

  const filteredPlaceholders = TEMPLATE_PLACEHOLDERS.filter(p => 
    activePlaceholderCategory === 'all' || p.category === activePlaceholderCategory
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Message & Clinical Summary Templates"
      maxWidth="max-w-5xl"
    >
      <div className="space-y-4">
        {/* Status Notification Banner */}
        {statusNotification && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
            statusNotification.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
            statusNotification.type === 'error' ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800' :
            'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
          }`}>
            <div className="flex items-center gap-2">
              {statusNotification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4" />}
              <span>{statusNotification.message}</span>
            </div>
            <button onClick={() => setStatusNotification(null)} className="text-xs opacity-60 hover:opacity-100 font-mono">✕</button>
          </div>
        )}

        {/* Top Control Bar (Search, Category Filters, Create Button, Import/Export) */}
        {!isEditing ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search templates by title, body keywords, or placeholders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-slate-400 outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 font-medium"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleStartCreate}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl font-bold text-xs shadow-sm shadow-red-500/20 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Template</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="flex items-center gap-1 px-2.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all"
                  title="Export Templates to JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Export</span>
                </button>

                <label 
                  className="flex items-center gap-1 px-2.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all cursor-pointer"
                  title="Import Templates from JSON"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Import</span>
                  <input 
                    ref={fileInputRef} 
                    type="file" 
                    accept=".json" 
                    onChange={handleImportFile} 
                    className="hidden" 
                  />
                </label>

                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="flex items-center gap-1 px-2.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl font-bold text-xs transition-all"
                  title="Restore System Defaults"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Reset Defaults</span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                  activeCategoryFilter === 'all' 
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                All Templates ({templates.length})
              </button>
              {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
                const count = templates.filter(t => t.category === catKey).length;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setActiveCategoryFilter(catKey)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                      activeCategoryFilter === catKey
                        ? `${meta.bg} ${meta.color} font-black ring-1 ring-current shadow-xs`
                        : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                    <span className="text-[10px] opacity-75 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Main Content Area */}
        {isEditing ? (
          /* TEMPLATE FORM & LIVE PREVIEW */
          <form onSubmit={handleSaveForm} className="space-y-4">
            {/* Editor Header Bar */}
            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-600 text-white rounded-xl shadow-xs">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {editingId ? 'Edit Message Template' : 'Create New Message Template'}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Define text layout and insert dynamic clinical placeholders for automated pre-fill.
                  </p>
                </div>
              </div>

              {/* Mode Toggle (Edit vs Live Preview) */}
              <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <button
                  type="button"
                  onClick={() => setPreviewMode('edit')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    previewMode === 'edit'
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('preview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    previewMode === 'preview'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Live Preview</span>
                </button>
              </div>
            </div>

            {/* Form Fields & Dynamic Placeholders */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Form Controls (7 cols) */}
              <div className="lg:col-span-7 space-y-3.5">
                {/* Name & Category Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">
                      Template Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g., HDU Bed Handover Summary"
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">
                      Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as TemplateCategory)}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white font-bold"
                    >
                      {Object.entries(CATEGORY_META).map(([key, meta]) => (
                        <option key={key} value={key}>
                          {meta.icon} {meta.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Email Subject Line */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-red-500" />
                      Email Subject Template
                    </span>
                    <span className="text-[9px] text-slate-400 font-normal">Used for Gmail & email dispatches</span>
                  </label>
                  <input
                    ref={subjectInputRef}
                    type="text"
                    value={formSubject}
                    onFocus={() => setLastFocusedField('subject')}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="e.g. 🏥 Clinical Summary: {{patientName}} (MRN: {{mrn}})"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white font-medium"
                  />
                </div>

                {/* Description & Default Checkbox */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">
                      Short Description / Usage Note
                    </label>
                    <input
                      type="text"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Brief note about when to use this template"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-normal"
                    />
                  </div>

                  <div className="pt-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={formIsDefault}
                        onChange={(e) => setFormIsDefault(e.target.checked)}
                        className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                      />
                      <span>Set Default for Category</span>
                    </label>
                  </div>
                </div>

                {/* Template Message Body (Textarea) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-emerald-600" />
                      Message Body (WhatsApp & Summary Content) *
                    </label>
                    <span className="text-[9px] text-slate-400">Supports Markdown (*bold*, _italic_) & placeholders</span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    required
                    rows={12}
                    value={formBody}
                    onFocus={() => setLastFocusedField('body')}
                    onChange={(e) => setFormBody(e.target.value)}
                    placeholder="Enter message text with placeholders like {{patientName}}, {{mrn}}, {{unit}}, {{consultant}}..."
                    className="w-full p-3.5 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-800 dark:text-slate-100 leading-relaxed"
                  />
                </div>
              </div>

              {/* Right Column: Placeholders Helper Palette & Real-Time Preview (5 cols) */}
              <div className="lg:col-span-5 space-y-3">
                {previewMode === 'preview' ? (
                  /* LIVE REAL-TIME RENDER PREVIEW */
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 space-y-3 shadow-xl sticky top-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-black text-white uppercase tracking-wider">Live Sample Preview</span>
                      </div>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                        Real-time Resolved
                      </span>
                    </div>

                    {formSubject && (
                      <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 space-y-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">Rendered Subject:</span>
                        <p className="text-xs font-bold text-white leading-tight">{renderedSubjectPreview}</p>
                      </div>
                    )}

                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/90 space-y-2 max-h-[340px] overflow-y-auto font-mono text-[11px] text-emerald-300/90 whitespace-pre-wrap leading-relaxed">
                      {renderedBodyPreview || '(Message body is empty)'}
                    </div>

                    <div className="text-[9px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
                      <span>Previewing with test patient MRN: <strong className="text-slate-200">MR-58291</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(renderedBodyPreview);
                          showNotification('Copied rendered preview to clipboard!', 'info');
                        }}
                        className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copy Preview
                      </button>
                    </div>
                  </div>
                ) : (
                  /* INTERACTIVE DYNAMIC PLACEHOLDERS PALETTE */
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 sticky top-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-red-500" />
                        Insert Placeholders (Click to Add)
                      </span>
                      <span className="text-[8px] text-slate-400">Target: {lastFocusedField === 'subject' ? 'Subject' : 'Message Body'}</span>
                    </div>

                    {/* Placeholder Categories */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
                      {(['all', 'patient', 'clinical', 'meta', 'facility'] as const).map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setActivePlaceholderCategory(cat)}
                          className={`px-2 py-0.5 rounded-md font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                            activePlaceholderCategory === cat
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                              : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Placeholder Clickable Chips */}
                    <div className="flex flex-wrap gap-1.5 max-h-[300px] overflow-y-auto p-1">
                      {filteredPlaceholders.map(item => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleInsertPlaceholder(item.key)}
                          className="group inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-800 rounded-lg text-[10px] font-mono text-slate-700 dark:text-slate-200 hover:text-red-700 dark:hover:text-red-400 transition-all shadow-2xs active:scale-95"
                          title={`${item.label}: ${item.description} (e.g. ${item.example})`}
                        >
                          <Plus className="w-2.5 h-2.5 text-slate-400 group-hover:text-red-500" />
                          <span className="font-bold">{item.key}</span>
                        </button>
                      ))}
                    </div>

                    <div className="bg-white dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] text-slate-500 dark:text-slate-400 space-y-1">
                      <p className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Quick Pro-Tip:
                      </p>
                      <p>
                        Click any variable chip above to instantly inject it into your message at the cursor position. When sharing a clinical summary, the system will automatically fill real patient vitals, MRN, bed, and doctor names.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Buttons Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditingId(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewMode(prev => prev === 'edit' ? 'preview' : 'edit')}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{previewMode === 'edit' ? 'Test Live Preview' : 'Back to Editor'}</span>
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl font-black text-xs shadow-md shadow-red-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Template</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* TEMPLATE LIST VIEW */
          <div className="space-y-3">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mx-auto text-slate-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No message templates match your filter</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Try selecting "All Templates" or click "New Template" to create one.</p>
                </div>
                <button
                  type="button"
                  onClick={handleStartCreate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Custom Template</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[58vh] overflow-y-auto pr-1">
                {filteredTemplates.map(tpl => {
                  const meta = CATEGORY_META[tpl.category] || CATEGORY_META.custom;
                  const isDefault = tpl.isDefault;

                  return (
                    <div
                      key={tpl.id}
                      className={`group relative bg-white dark:bg-slate-800/90 rounded-2xl p-4 border transition-all duration-200 hover:shadow-md flex flex-col justify-between ${
                        isDefault 
                          ? 'border-red-300 dark:border-red-800/70 shadow-xs ring-1 ring-red-500/20' 
                          : 'border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-2.5">
                        {/* Top Meta Badges */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${meta.bg} ${meta.color}`}>
                              <span>{meta.icon}</span>
                              <span>{meta.label}</span>
                            </span>

                            {isDefault && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                Category Default
                              </span>
                            )}

                            {tpl.isSystemDefault && (
                              <span className="text-[8.5px] font-bold text-slate-400 dark:text-slate-400">
                                Hospital Standard
                              </span>
                            )}
                          </div>

                          {/* Quick Actions (Duplicate, Edit, Delete) */}
                          <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleDuplicate(tpl)}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              title="Duplicate Template"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStartEdit(tpl)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                              title="Edit Template"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(tpl.id, tpl.name)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                              title={tpl.isSystemDefault ? "Reset to Original" : "Delete Template"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                            {tpl.name}
                          </h4>
                          {tpl.description && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                              {tpl.description}
                            </p>
                          )}
                        </div>

                        {/* Snippet Preview */}
                        <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-[10px] font-mono text-slate-600 dark:text-slate-300 line-clamp-3 whitespace-pre-wrap leading-relaxed select-all">
                          {tpl.bodyTemplate}
                        </div>
                      </div>

                      {/* Card Bottom: Selection or Use Shortcut */}
                      <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                        <span className="text-[9px] text-slate-400 font-mono">
                          Updated: {new Date(tpl.lastModified).toLocaleDateString()}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {onSelectTemplate ? (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectTemplate(tpl);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[10px] shadow-2xs active:scale-95 transition-all"
                            >
                              <span>Apply Template</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(tpl)}
                              className="text-[10px] font-bold text-red-600 hover:text-red-700 dark:text-red-400 hover:underline"
                            >
                              Customize & Preview →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer info bar */}
        {!isEditing && (
          <div className="flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Bookmark className="w-3 h-3 text-red-500" />
                <span>{templates.length} Active Templates Configured</span>
              </span>
            </div>
            <p className="mt-1 sm:mt-0 italic">
              Templates auto-sync across WhatsApp dispatches, Gmail summaries, and clinical handover memos.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default MessageTemplateManagerModal;
