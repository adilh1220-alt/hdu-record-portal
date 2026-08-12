import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useToast } from '../contexts/ToastContext';
import {
  getLogoSettings,
  saveLogoSettings,
  getEffectiveLogoBase64,
  getLogoUrlWithCacheBust,
  DEFAULT_LOGO_SETTINGS,
  LogoSettings,
  generateKidneyCentreLogoBase64
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
  Building,
  Check,
  Loader2
} from 'lucide-react';

interface HeaderLogoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HeaderLogoModal: React.FC<HeaderLogoModalProps> = ({ isOpen, onClose }) => {
  const [logoSettings, setLogoSettings] = useState<LogoSettings>(getLogoSettings());
  const [logoBase64, setLogoBase64] = useState<string>(getEffectiveLogoBase64());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      const current = getLogoSettings();
      setLogoSettings(current);
      setLogoBase64(getEffectiveLogoBase64());
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
    setLogoBase64(getEffectiveLogoBase64());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        const updated: LogoSettings = {
          ...logoSettings,
          useCustomLogo: true,
          customLogoBase64: base64,
          customLogoDataUrl: base64
        };
        handleUpdateSettings(updated);
        const msg = 'Custom hospital logo uploaded & applied successfully!';
        showInternalToast(`✓ ${msg}`);
        toast.success(msg, 'Logo Uploaded & Saved');
      }
      setIsUploading(false);
      e.target.value = '';
    };

    reader.onerror = () => {
      const errMsg = 'Failed to read image file.';
      showInternalToast(`Error: ${errMsg}`);
      toast.error(errMsg, 'Upload Failed');
      setIsUploading(false);
      e.target.value = '';
    };

    reader.readAsDataURL(file);
  };

  const handleResetToDefault = () => {
    const defaultSettings: LogoSettings = {
      ...DEFAULT_LOGO_SETTINGS,
      useCustomLogo: false,
      customLogoBase64: '',
      customLogoDataUrl: null
    };
    handleUpdateSettings(defaultSettings);
    const msg = 'Restored to default institution logo.';
    showInternalToast(`✓ ${msg}`);
    toast.info(msg, 'Logo Restored');
  };

  const handleDoneAndApply = () => {
    saveLogoSettings(logoSettings);
    toast.success('Logo & header branding applied across sidebar & PDF reports!', 'Settings Saved');
    onClose();
  };

  const align = logoSettings.alignment || logoSettings.align || 'left';
  const scaleHeight = logoSettings.scaleHeightMm || logoSettings.heightMm || 26;
  const offsetY = logoSettings.offsetYMm !== undefined ? logoSettings.offsetYMm : (logoSettings.offsetY || 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Institutional Header Logo Branding">
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

        {/* Live Preview Panel */}
        <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-red-500" />
              Live PDF & Report Header Preview
            </span>
            <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold border ${
              logoSettings.customLogoBase64
                ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}>
              {logoSettings.customLogoBase64 ? '✓ Custom Logo Active' : 'Default Logo'}
            </span>
          </div>

          <div
            className="bg-white text-slate-900 p-4 rounded-xl shadow-inner min-h-[100px] flex flex-col justify-center transition-all overflow-hidden border border-slate-200"
            style={{
              alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
            }}
          >
            <img
              key={logoSettings.updatedAt || Date.now()}
              src={getLogoUrlWithCacheBust(logoBase64)}
              alt="Header Logo Preview"
              style={{
                height: `${scaleHeight * 2.2}px`,
                marginTop: `${offsetY}px`
              }}
              className="max-w-full object-contain transition-all duration-200"
            />
          </div>
        </div>

        {/* Action Controls */}
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
            <span>{isUploading ? 'Uploading Logo...' : 'Upload Custom Logo'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={isUploading}
            className={`flex items-center justify-center gap-2 py-3.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all ${
              isUploading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>Restore Default Logo</span>
          </button>
        </div>

        {/* Adjustments Section */}
        <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block border-b border-slate-200 dark:border-slate-800 pb-2">
            Header Branding Dimensions & Position
          </span>

          {/* Alignment */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Logo Alignment</label>
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

          {/* Vertical Offset Slider */}
          <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-800 pt-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <Move className="w-3.5 h-3.5 text-red-500" />
                Top Vertical Margin (Y Offset)
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
              <span>0mm (Top edge)</span>
              <span>25mm (Spacing)</span>
            </div>
          </div>
        </div>

        {/* Bottom Persistent Status Indicator & Done Button */}
        <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                {logoSettings.customLogoBase64
                  ? 'Custom Hospital Logo Saved & Applied'
                  : 'Default Institution Logo Active'}
              </span>
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-black uppercase tracking-wider">
              Ready
            </span>
          </div>

          <button
            type="button"
            onClick={handleDoneAndApply}
            className="w-full py-3.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>Done & Apply</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default HeaderLogoModal;

