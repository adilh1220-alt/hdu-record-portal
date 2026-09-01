import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { Eye, Download, FileText, Table, Printer, ExternalLink, ArrowLeft, Loader2, Calendar, User } from 'lucide-react';
import { downloadCSV } from '../services/exportService';

export type ExportFormat = 'PDF' | 'CSV';

export interface ExportOptions {
  generatedBy: string;
  includeDateRange: boolean;
  startDate: string;
  endDate: string;
  format: ExportFormat;
}

export interface PreviewData {
  type: 'pdf' | 'csv';
  blobUrl?: string;
  filename?: string;
  doc?: any;
  title?: string;
  headers?: string[];
  rows?: any[][];
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  onPreview?: (options: ExportOptions) => Promise<PreviewData | string | void> | PreviewData | string | void;
  title: string;
  showDateRange?: boolean;
  defaultGeneratedBy?: string;
}

const ExportModal: React.FC<ExportModalProps> = ({ 
  isOpen, 
  onClose, 
  onExport, 
  onPreview,
  title, 
  showDateRange = true,
  defaultGeneratedBy = 'Medical Staff'
}) => {
  const [generatedBy, setGeneratedBy] = useState(defaultGeneratedBy);
  const [includeDateRange, setIncludeDateRange] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [format, setFormat] = useState<ExportFormat>('PDF');

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isOpen) {
      setGeneratedBy(defaultGeneratedBy);
      setIsPreviewMode(false);
      setPreviewError(null);
    } else {
      // Clean up blob URL on modal close
      if (previewBlobUrl) {
        try {
          URL.revokeObjectURL(previewBlobUrl);
        } catch {
          // ignore
        }
        setPreviewBlobUrl(null);
        setPreviewData(null);
      }
    }
  }, [isOpen, defaultGeneratedBy]);

  const handleConfirmDownload = () => {
    onExport({
      generatedBy,
      includeDateRange,
      startDate,
      endDate,
      format
    });
    onClose();
  };

  const handleGeneratePreview = async () => {
    if (!onPreview) {
      // If no preview handler is provided, fallback to standard export
      handleConfirmDownload();
      return;
    }

    setIsLoadingPreview(true);
    setPreviewError(null);

    try {
      const result = await onPreview({
        generatedBy,
        includeDateRange,
        startDate,
        endDate,
        format
      });

      if (!result) {
        setPreviewError('Unable to generate preview data.');
        setIsLoadingPreview(false);
        return;
      }

      if (typeof result === 'string') {
        if (previewBlobUrl) {
          URL.revokeObjectURL(previewBlobUrl);
        }
        setPreviewBlobUrl(result);
        setPreviewData({ type: 'pdf', blobUrl: result });
      } else if (result.type === 'pdf') {
        if (previewBlobUrl) {
          URL.revokeObjectURL(previewBlobUrl);
        }
        setPreviewBlobUrl(result.blobUrl || null);
        setPreviewData(result);
      } else if (result.type === 'csv') {
        setPreviewData(result);
      }

      setIsPreviewMode(true);
    } catch (err: any) {
      console.error('Error generating export preview:', err);
      setPreviewError(err?.message || 'Failed to render document preview.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownloadFromPreview = () => {
    if (previewData?.type === 'pdf') {
      if (previewData.doc && typeof previewData.doc.save === 'function') {
        const filename = previewData.filename || `${title.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.pdf`;
        previewData.doc.save(filename);
      } else if (previewBlobUrl) {
        const link = document.createElement('a');
        link.href = previewBlobUrl;
        link.download = previewData.filename || `${title.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        handleConfirmDownload();
      }
    } else if (previewData?.type === 'csv') {
      if (previewData.headers && previewData.rows) {
        downloadCSV(previewData.title || title, previewData.headers, previewData.rows);
      } else {
        handleConfirmDownload();
      }
    } else {
      handleConfirmDownload();
    }
    onClose();
  };

  const handlePrint = () => {
    if (previewData?.type === 'pdf' && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch (err) {
        console.warn('Iframe print access restricted, opening window:', err);
      }
    }
    if (previewBlobUrl) {
      const printWin = window.open(previewBlobUrl, '_blank');
      if (printWin) {
        printWin.focus();
      }
    }
  };

  const handleOpenInNewTab = () => {
    if (previewBlobUrl) {
      window.open(previewBlobUrl, '_blank');
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={
        isPreviewMode ? (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
            <span className="font-extrabold tracking-tight">{title} &mdash; Live Preview</span>
          </div>
        ) : (
          title
        )
      }
      maxWidth={isPreviewMode ? 'max-w-5xl' : 'max-w-md'}
    >
      {isPreviewMode ? (
        /* Preview Screen */
        <div className="space-y-4">
          {/* Metadata & Mode Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                format === 'PDF' ? 'bg-slate-900 text-white' : 'bg-emerald-700 text-white'
              }`}>
                {format === 'PDF' ? 'PDF Document (Landscape)' : 'CSV Spreadsheet Data'}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-slate-600 text-[11px]">
                <User className="w-3 h-3 text-slate-400" />
                <strong className="text-slate-800">{generatedBy || 'Medical Staff'}</strong>
              </span>
              {includeDateRange && (startDate || endDate) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                  <Calendar className="w-3 h-3 text-amber-600" />
                  {startDate || 'Any'} &rarr; {endDate || 'Any'}
                </span>
              )}
            </div>

            <button
              onClick={() => setIsPreviewMode(false)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Edit Options</span>
            </button>
          </div>

          {/* Interactive Document Viewport */}
          {previewData?.type === 'pdf' && previewBlobUrl ? (
            <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 shadow-inner">
              <iframe
                ref={iframeRef}
                src={previewBlobUrl}
                title="PDF Live Document Preview"
                className="w-full h-[62vh] sm:h-[68vh] border-0 bg-slate-100"
              />
            </div>
          ) : previewData?.type === 'csv' && previewData.rows ? (
            <div className="w-full max-h-[60vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-inner">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider sticky top-0">
                    {previewData.headers?.map((h, idx) => (
                      <th key={idx} className="px-3 py-2.5 border-r border-slate-700 last:border-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700 text-[11px]">
                  {previewData.rows.slice(0, 35).map((row, rIdx) => (
                    <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/60 hover:bg-slate-100/60'}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 border-r border-slate-100 last:border-0 truncate max-w-[200px]">
                          {String(cell ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.rows.length > 35 && (
                <div className="p-2.5 bg-slate-50 text-center text-[10px] font-bold text-slate-500 border-t border-slate-200">
                  Showing first 35 rows for preview &bull; Total {previewData.rows.length} rows will be exported
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="font-medium text-sm">No preview content generated.</p>
            </div>
          )}

          {/* Preview Footer Action Controls */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button 
              onClick={() => setIsPreviewMode(false)}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-2">
              {format === 'PDF' && previewBlobUrl && (
                <>
                  <button
                    onClick={handleOpenInNewTab}
                    className="px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all inline-flex items-center gap-1.5 shadow-xs"
                    title="Open document in a separate browser tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    <span>New Tab</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all inline-flex items-center gap-1.5 shadow-xs"
                    title="Print Document"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    <span>Print</span>
                  </button>
                </>
              )}

              <button 
                onClick={handleDownloadFromPreview}
                className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg flex items-center justify-center space-x-2 shadow-red-100 active:scale-95 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {format}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Settings / Options Screen */
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Export Format</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat('PDF')}
                className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${
                  format === 'PDF' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                PDF Document
              </button>
              <button
                type="button"
                onClick={() => setFormat('CSV')}
                className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${
                  format === 'CSV' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                CSV Spreadsheet
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Generated By</label>
            <input 
              type="text" 
              value={generatedBy}
              onChange={(e) => setGeneratedBy(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 outline-none text-[11px] font-bold"
              placeholder="Name of personnel"
            />
          </div>

          {showDateRange && (
            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <label className="flex items-center space-x-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={includeDateRange}
                  onChange={(e) => setIncludeDateRange(e.target.checked)}
                  className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
                />
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest group-hover:text-red-600 transition-colors">Apply Date Boundary</span>
              </label>

              {includeDateRange && (
                <div className="grid grid-cols-2 gap-3 pt-1 animate-in slide-in-from-top-1 duration-200">
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">Start Date</label>
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-2 text-[10px] font-bold border border-slate-200 rounded-lg outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">End Date</label>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-2 text-[10px] font-bold border border-slate-200 rounded-lg outline-none bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {previewError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
              {previewError}
            </div>
          )}

          <div className="pt-4 flex flex-col sm:flex-row gap-2.5">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors order-3 sm:order-1 flex-1"
            >
              Cancel
            </button>
            
            {onPreview && (
              <button 
                type="button"
                onClick={handleGeneratePreview}
                disabled={isLoadingPreview}
                className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 hover:border-indigo-300 transition-all shadow-sm flex items-center justify-center space-x-2 active:scale-95 cursor-pointer order-1 sm:order-2 flex-1 disabled:opacity-50"
              >
                {isLoadingPreview ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    <span>Rendering...</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Preview {format}</span>
                  </>
                )}
              </button>
            )}

            <button 
              type="button"
              onClick={handleConfirmDownload}
              className="bg-red-600 text-white px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg flex items-center justify-center space-x-2 shadow-red-100 active:scale-95 cursor-pointer order-2 sm:order-3 flex-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Generate {format}</span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ExportModal;
