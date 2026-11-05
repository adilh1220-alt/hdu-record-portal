import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useToast } from '../contexts/ToastContext';
import {
  getLogoSettings,
  saveLogoSettings,
  getEffectiveLogoBase64,
  getSidebarLogoBase64,
  getLogoUrlWithCacheBust,
  DEFAULT_LOGO_SETTINGS,
  LogoSettings
} from '../services/pdfService';
import {
  Upload,
  Image as ImageIcon,
  Move,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RotateCcw,
  CheckCircle2,
  Check,
  Loader2,
  Maximize2,
  Scaling,
  MoveHorizontal,
  Ruler,
  FileText,
  Layout as LayoutIcon,
  Eye,
  EyeOff,
  ShieldCheck,
  Building
} from 'lucide-react';

interface HeaderLogoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HeaderLogoModal: React.FC<HeaderLogoModalProps> = ({ isOpen, onClose }) => {
  const [logoSettings, setLogoSettings] = useState<LogoSettings>(getLogoSettings());
  const [pdfLogoBase64, setPdfLogoBase64] = useState<string>(getEffectiveLogoBase64());
  const [sidebarLogoBase64, setSidebarLogoBase64] = useState<string>(getSidebarLogoBase64());
  const [activeTab, setActiveTab] = useState<'pdf' | 'sidebar'>('pdf');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      const current = getLogoSettings();
      setLogoSettings(current);
      setPdfLogoBase64(getEffectiveLogoBase64());
      setSidebarLogoBase64(getSidebarLogoBase64());
      setToastMessage(null);
      setIsUploading(false);
    }
  }, [isOpen]);

  const showInternalToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleUpdateSettings = (newSettings: LogoSettings) => {
    setLogoSettings(newSettings);
    saveLogoSettings(newSettings);
    setPdfLogoBase64(getEffectiveLogoBase64());
    setSidebarLogoBase64(getSidebarLogoBase64());
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawUrl = event.target?.result as string;
        if (!rawUrl) {
          reject(new Error('Failed to read file'));
          return;
        }
        if (file.type.includes('svg')) {
          resolve(rawUrl);
          return;
        }

        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxDim = 800;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawUrl);
            return;
          }

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', 0.88);
          resolve(compressed);
        };
        img.onerror = () => resolve(rawUrl);
        img.src = rawUrl;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      const errMsg = 'Please select a valid image file (PNG, JPG, SVG, WebP).';
      showInternalToast(`Error: ${errMsg}`);
      toast.error(errMsg, 'Invalid File');
      e.target.value = '';
      return;
    }

    setIsUploading(true);

    try {
      const base64 = await compressImage(file);
      if (base64) {
        const updated: LogoSettings = {
          ...logoSettings,
          useCustomLogo: true,
          useCustomLogoForPDF: true,
          // Explicitly keep sidebar logo on default unless user turns it on!
          useCustomLogoForSidebar: logoSettings.useCustomLogoForSidebar || false,
          sidebarLogoMode: logoSettings.sidebarLogoMode || 'default',
          customLogoBase64: base64,
          customLogoDataUrl: base64
        };
        handleUpdateSettings(updated);
        const msg = 'Custom hospital logo uploaded & applied to PDF reports!';
        showInternalToast(`✓ ${msg}`);
        toast.success(msg, 'Logo Uploaded for PDF Reports');
      }
    } catch (err) {
      const errMsg = 'Failed to process image file.';
      showInternalToast(`Error: ${errMsg}`);
      toast.error(errMsg, 'Upload Failed');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleResetToDefault = () => {
    const defaultSettings: LogoSettings = {
      ...DEFAULT_LOGO_SETTINGS,
      useCustomLogo: false,
      useCustomLogoForPDF: false,
      useCustomLogoForSidebar: false,
      sidebarLogoMode: 'default',
      customLogoBase64: '',
      customLogoDataUrl: null
    };
    handleUpdateSettings(defaultSettings);
    const msg = 'Restored to default institution logo for PDF reports and sidebar.';
    showInternalToast(`✓ ${msg}`);
    toast.info(msg, 'Logo Restored');
  };

  const handleDoneAndApply = () => {
    saveLogoSettings(logoSettings);
    toast.success('Branding settings applied to PDF reports & sidebar!', 'Settings Saved');
    onClose();
  };

  const align = logoSettings.alignment || logoSettings.align || 'left';
  const widthMm = logoSettings.widthMm || 68;
  const heightMm = logoSettings.heightMm || 24;
  const scalePercent = logoSettings.scalePercent || 100;
  const sidebarLogoWidthPx = logoSettings.sidebarLogoWidthPx || 40;
  const offsetY = logoSettings.offsetYMm !== undefined ? logoSettings.offsetYMm : (logoSettings.offsetY || 0);
  const offsetX = logoSettings.offsetX || 0;
  const sidebarMode = logoSettings.sidebarLogoMode || 'default';
  const useCustomPDF = logoSettings.useCustomLogoForPDF !== false && Boolean(logoSettings.customLogoBase64);

  // Calculate live preview dimensions
  const previewWidthPx = Math.round(widthMm * (scalePercent / 100) * 2.2);
  const previewHeightPx = Math.round(heightMm * (scalePercent / 100) * 2.2);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Institutional Header Logo & Branding Settings">
      <div className="space-y-5">
        {/* Status Notification Banner at Top */}
        {toastMessage && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{toastMessage}</span>
            </div>
            <span className="text-[10px] bg-emerald-600 text-white font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-black shrink-0">
              Saved
            </span>
          </div>
        )}

        {/* Navigation Section Switcher: PDF Report Logo vs Sidebar Logo */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'pdf'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>PDF Report Logo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sidebar')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'sidebar'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800'
            }`}
          >
            <LayoutIcon className="w-4 h-4 shrink-0" />
            <span>Sidebar Brand Logo</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: PDF REPORT HEADER LOGO */}
        {/* ========================================================================= */}
        {activeTab === 'pdf' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Live PDF Header Preview Card */}
            <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-red-500" />
                  Live PDF Report Header Preview ({widthMm} × {heightMm}mm @ {scalePercent}%)
                </span>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  useCustomPDF
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  {useCustomPDF ? '✓ Custom Logo Active' : 'Default Logo Active'}
                </span>
              </div>

              <div
                className="bg-white text-slate-900 p-4 rounded-xl shadow-inner min-h-[110px] flex flex-col justify-center transition-all overflow-hidden border border-slate-200"
                style={{
                  alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
                }}
              >
                <img
                  key={`pdf-${logoSettings.updatedAt || Date.now()}`}
                  src={getLogoUrlWithCacheBust(pdfLogoBase64)}
                  alt="PDF Header Logo Preview"
                  style={{
                    width: `${previewWidthPx}px`,
                    height: `${previewHeightPx}px`,
                    marginTop: `${offsetY}px`,
                    marginLeft: align === 'left' ? `${offsetX}px` : undefined,
                    marginRight: align === 'right' ? `${-offsetX}px` : undefined
                  }}
                  className="max-w-full object-contain transition-all duration-200"
                />
              </div>
            </div>

            {/* Action Buttons for PDF Logo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Upload Button */}
              <label 
                className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md ${
                  isUploading 
                    ? 'bg-red-700 text-white cursor-not-allowed pointer-events-none opacity-80' 
                    : 'bg-red-600 hover:bg-red-700 text-white cursor-pointer active:scale-95'
                }`}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>{isUploading ? 'Uploading Logo...' : 'Upload Logo for PDF Reports'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>

              {/* Reset PDF Logo Button */}
              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={isUploading}
                className={`flex items-center justify-center gap-2 py-3.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all ${
                  isUploading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
                }`}
              >
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span>Restore Default PDF Logo</span>
              </button>
            </div>

            {/* Enable/Disable Custom PDF Logo Toggle */}
            {Boolean(logoSettings.customLogoBase64) && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Use Custom Uploaded Logo on PDF Reports</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Toggle off to temporarily revert PDF reports to standard default header logo.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdateSettings({ ...logoSettings, useCustomLogoForPDF: !useCustomPDF })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    useCustomPDF
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {useCustomPDF ? '✓ Custom PDF Logo Active' : 'Default PDF Logo'}
                </button>
              </div>
            )}

            {/* Adjustments Section for PDF Header */}
            <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block">
                  Header Branding Dimensions & Position
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleUpdateSettings({ ...logoSettings, widthMm: 68, heightMm: 24, scaleHeightMm: 24 })}
                    className="px-2 py-0.5 text-[10px] font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-300 dark:border-slate-700"
                  >
                    Standard (68x24)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSettings({ ...logoSettings, widthMm: 80, heightMm: 30, scaleHeightMm: 30 })}
                    className="px-2 py-0.5 text-[10px] font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-300 dark:border-slate-700"
                  >
                    Large (80x30)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSettings({ ...logoSettings, widthMm: 50, heightMm: 18, scaleHeightMm: 18 })}
                    className="px-2 py-0.5 text-[10px] font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-300 dark:border-slate-700"
                  >
                    Compact (50x18)
                  </button>
                </div>
              </div>

              {/* Alignment */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Logo Alignment on PDF Page</label>
                <div className="grid grid-cols-3 gap-2 bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => handleUpdateSettings({ ...logoSettings, align: 'left', alignment: 'left' })}
                    className={`flex items-center justify-center py-2 rounded-lg transition-all gap-1.5 ${
                      align === 'left' ? 'bg-red-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                    <span>Left</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateSettings({ ...logoSettings, align: 'center', alignment: 'center' })}
                    className={`flex items-center justify-center py-2 rounded-lg transition-all gap-1.5 ${
                      align === 'center' ? 'bg-red-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                    <span>Center</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateSettings({ ...logoSettings, align: 'right', alignment: 'right' })}
                    className={`flex items-center justify-center py-2 rounded-lg transition-all gap-1.5 ${
                      align === 'right' ? 'bg-red-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                    <span>Right</span>
                  </button>
                </div>
              </div>

              {/* Width & Height Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                {/* Width Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <Ruler className="w-3.5 h-3.5 text-red-500" />
                      Logo Width
                    </span>
                    <span className="font-mono text-red-600 dark:text-red-400">{widthMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={120}
                    step={1}
                    value={widthMm}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      handleUpdateSettings({
                        ...logoSettings,
                        widthMm: val
                      });
                    }}
                    className="w-full accent-red-600 bg-slate-200 dark:bg-slate-700 h-2 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    <span>20mm</span>
                    <span>120mm</span>
                  </div>
                </div>

                {/* Height Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <Maximize2 className="w-3.5 h-3.5 text-red-500" />
                      Logo Height
                    </span>
                    <span className="font-mono text-red-600 dark:text-red-400">{heightMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={60}
                    step={1}
                    value={heightMm}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      handleUpdateSettings({
                        ...logoSettings,
                        heightMm: val,
                        scaleHeightMm: val
                      });
                    }}
                    className="w-full accent-red-600 bg-slate-200 dark:bg-slate-700 h-2 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    <span>10mm</span>
                    <span>60mm</span>
                  </div>
                </div>
              </div>

              {/* Scale & Offsets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                {/* Overall Scale Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <Scaling className="w-3.5 h-3.5 text-red-500" />
                      Overall Scale Factor
                    </span>
                    <span className="font-mono text-red-600 dark:text-red-400">{scalePercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={200}
                    step={5}
                    value={scalePercent}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      handleUpdateSettings({
                        ...logoSettings,
                        scalePercent: val
                      });
                    }}
                    className="w-full accent-red-600 bg-slate-200 dark:bg-slate-700 h-2 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    <span>50%</span>
                    <span>200%</span>
                  </div>
                </div>

                {/* Top Vertical Margin (Y Offset) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <Move className="w-3.5 h-3.5 text-red-500" />
                      Top Margin (Y Offset)
                    </span>
                    <span className="font-mono text-red-600 dark:text-red-400">{offsetY} mm</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={25}
                    step={1}
                    value={offsetY}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      handleUpdateSettings({
                        ...logoSettings,
                        offsetY: val,
                        offsetYMm: val
                      });
                    }}
                    className="w-full accent-red-600 bg-slate-200 dark:bg-slate-700 h-2 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    <span>0mm (Top)</span>
                    <span>25mm (Spacing)</span>
                  </div>
                </div>
              </div>

              {/* Horizontal Shift Slider */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1">
                    <MoveHorizontal className="w-3.5 h-3.5 text-red-500" />
                    Horizontal Shift (X Offset)
                  </span>
                  <span className="font-mono text-red-600 dark:text-red-400">{offsetX} mm</span>
                </div>
                <input
                  type="range"
                  min={-30}
                  max={30}
                  step={1}
                  value={offsetX}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    handleUpdateSettings({
                      ...logoSettings,
                      offsetX: val
                    });
                  }}
                  className="w-full accent-red-600 bg-slate-200 dark:bg-slate-700 h-2 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-400">
                  <span>-30mm (Left)</span>
                  <span>+30mm (Right)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SIDEBAR APP HEADER BRAND LOGO */}
        {/* ========================================================================= */}
        {activeTab === 'sidebar' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Live Sidebar Preview Box */}
            <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <LayoutIcon className="w-3.5 h-3.5 text-red-500" />
                  Live Sidebar Header Preview ({sidebarLogoWidthPx}px)
                </span>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  sidebarMode === 'default'
                    ? 'bg-blue-950 text-blue-300 border-blue-700'
                    : sidebarMode === 'custom'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {sidebarMode === 'default' && 'Default TKC Badge'}
                  {sidebarMode === 'custom' && '✓ Custom Logo Active'}
                  {sidebarMode === 'none' && 'Logo Hidden'}
                </span>
              </div>

              <div className="bg-slate-950 text-slate-100 p-3.5 rounded-xl shadow-inner min-h-[90px] flex items-center justify-start gap-3 border border-slate-800 overflow-hidden">
                {sidebarLogoBase64 ? (
                  <img
                    key={`sb-tab-${logoSettings.updatedAt || Date.now()}`}
                    src={getLogoUrlWithCacheBust(sidebarLogoBase64)}
                    alt="Sidebar Logo Preview"
                    style={{
                      width: `${sidebarLogoWidthPx}px`,
                      height: 'auto',
                      maxHeight: `${sidebarLogoWidthPx}px`
                    }}
                    className="object-contain shrink-0 transition-all duration-200 drop-shadow"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-red-950/60 border border-red-800/80 text-red-400 flex items-center justify-center font-black text-xs shrink-0 tracking-tight">
                    TKC
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-white font-bold text-xs tracking-tight leading-tight whitespace-nowrap">Record Management Portal</span>
                  <span className="text-[8px] font-bold uppercase text-red-400 tracking-tight leading-tight mt-0.5 whitespace-nowrap">Endoscopy & HDU Clinical System</span>
                </div>
              </div>
            </div>

            {/* Sidebar Logo Selection Mode Options */}
            <div className="space-y-2 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 block mb-2">
                Sidebar Header Logo Choice
              </span>

              <div className="grid grid-cols-1 gap-2.5">
                {/* Option 1: Default Institution Badge (RECOMMENDED so uploaded custom logo stays ONLY on PDF) */}
                <label className={`p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                  sidebarMode === 'default'
                    ? 'bg-red-500/10 border-red-500/50 text-slate-900 dark:text-slate-100'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="sidebarLogoMode"
                    value="default"
                    checked={sidebarMode === 'default'}
                    onChange={() => handleUpdateSettings({
                      ...logoSettings,
                      sidebarLogoMode: 'default',
                      useCustomLogoForSidebar: false
                    })}
                    className="mt-0.5 accent-red-600"
                  />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-red-500" />
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Keep Default Institution Logo in Sidebar (Recommended)</span>
                      <span className="text-[9px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800">Separate</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Custom uploaded logo will appear <strong>ONLY in PDF Reports</strong>. The sidebar will continue displaying the clean standard official hospital emblem.
                    </p>
                  </div>
                </label>

                {/* Option 2: Use Uploaded Custom Logo in Sidebar too */}
                <label className={`p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                  sidebarMode === 'custom'
                    ? 'bg-red-500/10 border-red-500/50 text-slate-900 dark:text-slate-100'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="sidebarLogoMode"
                    value="custom"
                    checked={sidebarMode === 'custom'}
                    onChange={() => handleUpdateSettings({
                      ...logoSettings,
                      sidebarLogoMode: 'custom',
                      useCustomLogoForSidebar: true
                    })}
                    className="mt-0.5 accent-red-600"
                  />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Use Custom Uploaded Logo in Sidebar</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Displays your uploaded custom hospital logo in the app's navigation sidebar header as well.
                    </p>
                  </div>
                </label>

                {/* Option 3: Hide Logo in Sidebar */}
                <label className={`p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                  sidebarMode === 'none'
                    ? 'bg-red-500/10 border-red-500/50 text-slate-900 dark:text-slate-100'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="sidebarLogoMode"
                    value="none"
                    checked={sidebarMode === 'none'}
                    onChange={() => handleUpdateSettings({
                      ...logoSettings,
                      sidebarLogoMode: 'none',
                      useCustomLogoForSidebar: false
                    })}
                    className="mt-0.5 accent-red-600"
                  />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <EyeOff className="w-4 h-4 text-slate-500" />
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Hide Logo Image in Sidebar</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Displays app title text only in the sidebar header without rendering any image.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Sidebar Logo Size Section */}
            <div className="space-y-3 bg-slate-100 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Scaling className="w-4 h-4 text-red-500" />
                  Sidebar Logo Display Size
                </span>
                <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">
                  {sidebarLogoWidthPx} px
                </span>
              </div>

              <div className="space-y-3">
                {/* Quick Size Preset Buttons */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Quick Presets:</span>
                  <div className="grid grid-cols-4 gap-1.5 flex-1 max-w-xs">
                    <button
                      type="button"
                      onClick={() => handleUpdateSettings({ ...logoSettings, sidebarLogoWidthPx: 28 })}
                      className={`py-1 px-2 text-[10px] font-bold rounded-lg border transition-all ${
                        sidebarLogoWidthPx === 28
                          ? 'bg-red-600 text-white border-red-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Small (28px)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateSettings({ ...logoSettings, sidebarLogoWidthPx: 40 })}
                      className={`py-1 px-2 text-[10px] font-bold rounded-lg border transition-all ${
                        sidebarLogoWidthPx === 40
                          ? 'bg-red-600 text-white border-red-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Standard (40px)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateSettings({ ...logoSettings, sidebarLogoWidthPx: 56 })}
                      className={`py-1 px-2 text-[10px] font-bold rounded-lg border transition-all ${
                        sidebarLogoWidthPx === 56
                          ? 'bg-red-600 text-white border-red-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Large (56px)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateSettings({ ...logoSettings, sidebarLogoWidthPx: 72 })}
                      className={`py-1 px-2 text-[10px] font-bold rounded-lg border transition-all ${
                        sidebarLogoWidthPx === 72
                          ? 'bg-red-600 text-white border-red-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      X-Large (72px)
                    </button>
                  </div>
                </div>

                {/* Slider for exact pixel sizing */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min={20}
                    max={90}
                    step={2}
                    value={sidebarLogoWidthPx}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      handleUpdateSettings({
                        ...logoSettings,
                        sidebarLogoWidthPx: val
                      });
                    }}
                    className="w-full accent-red-600 bg-slate-200 dark:bg-slate-700 h-2.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    <span>20px (Compact)</span>
                    <span>40px (Default)</span>
                    <span>90px (Extra Large)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Persistent Status Indicator & Done Button */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                {useCustomPDF
                  ? 'Custom Logo Active for PDF Reports'
                  : 'Default Logo Active for PDF Reports'}
                {' • '}
                {sidebarMode === 'default' && 'Sidebar Uses Default Badge'}
                {sidebarMode === 'custom' && 'Sidebar Uses Custom Logo'}
                {sidebarMode === 'none' && 'Sidebar Logo Hidden'}
              </span>
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-black uppercase tracking-wider">
              Configured
            </span>
          </div>

          <button
            type="button"
            onClick={handleDoneAndApply}
            className="w-full py-3.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>Done & Apply Settings</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default HeaderLogoModal;
