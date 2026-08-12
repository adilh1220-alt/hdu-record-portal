import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import Modal from './Modal';
import { Patient, EndoscopyRecord } from '../types';
import { 
  Camera, 
  Upload, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  User, 
  Building, 
  Calendar, 
  ExternalLink, 
  Sparkles,
  RefreshCw,
  FileText
} from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  endoscopyRecords?: EndoscopyRecord[];
  onSelectPatient: (patient: Patient) => void;
  onSelectEndoscopyRecord?: (record: EndoscopyRecord) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  patients,
  endoscopyRecords = [],
  onSelectPatient,
  onSelectEndoscopyRecord
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [scanning, setScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [foundPatient, setFoundPatient] = useState<Patient | null>(null);
  const [foundEndoscopy, setFoundEndoscopy] = useState<EndoscopyRecord | null>(null);
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera stream cleanly
  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  // Start camera stream
  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    setScannedResult(null);
    setFoundPatient(null);
    setFoundEndoscopy(null);
    setNotFoundQuery(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS Safari
        await videoRef.current.play();
        setScanning(true);
        requestAnimationFrame(scanTick);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Camera access failed or permission denied. Please allow camera permissions or upload a QR image.');
      setScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const scanTick = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameId.current = requestAnimationFrame(scanTick);
      return;
    }

    const video = videoRef.current;
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        handleProcessQRCode(code.data);
        return; // stop continuous animation once found
      }
    }

    animationFrameId.current = requestAnimationFrame(scanTick);
  };

  const handleProcessQRCode = (qrString: string) => {
    stopCamera();
    setScannedResult(qrString);

    let searchRegNo = '';
    let searchId = '';

    try {
      const parsed = JSON.parse(qrString);
      if (parsed) {
        searchRegNo = (parsed.regNo || parsed.mrn || '').toString().trim().toLowerCase();
        searchId = (parsed.id || '').toString().trim().toLowerCase();
      }
    } catch {
      // Raw string format
      searchRegNo = qrString.trim().toLowerCase();
      searchId = qrString.trim().toLowerCase();
    }

    // Search active HDU/Ward patients
    const matchPatient = patients.find(p => 
      (p.regNo && p.regNo.trim().toLowerCase() === searchRegNo) ||
      (p.id && p.id.trim().toLowerCase() === searchId) ||
      (p.name && p.name.trim().toLowerCase().includes(searchRegNo && searchRegNo.length > 3 ? searchRegNo : '____impossible____'))
    );

    // Search Endoscopy records
    const matchEndoscopy = endoscopyRecords.find(e => 
      (e.regNo && e.regNo.trim().toLowerCase() === searchRegNo) ||
      (e.id && e.id.trim().toLowerCase() === searchId)
    );

    if (matchPatient) {
      setFoundPatient(matchPatient);
      playBeepSound();
    } else if (matchEndoscopy) {
      setFoundEndoscopy(matchEndoscopy);
      playBeepSound();
    } else {
      setNotFoundQuery(searchRegNo || qrString);
    }
  };

  const playBeepSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz pitch
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // ignore
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleProcessQRCode(code.data);
          } else {
            setCameraError('No valid QR code detected in the uploaded image.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { stopCamera(); onClose(); }} title="Scan Bedside Patient QR Code">
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'camera' 
                ? 'bg-red-600 text-white shadow-md' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Mobile / Camera Scan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'upload' 
                ? 'bg-red-600 text-white shadow-md' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>
        </div>

        {/* Camera Feed View */}
        {activeTab === 'camera' && !foundPatient && !foundEndoscopy && !notFoundQuery && (
          <div className="relative bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 aspect-video flex items-center justify-center shadow-inner">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
            />

            {/* Scanning Overlay Box */}
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-dashed border-red-500 rounded-2xl relative animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-red-500 rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-red-500 rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-red-500 rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-red-500 rounded-br-lg"></div>
                </div>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/90 p-4 flex flex-col items-center justify-center text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <p className="text-xs text-slate-300 max-w-xs">{cameraError}</p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera</span>
                </button>
              </div>
            )}

            <div className="absolute bottom-3 left-3 right-3 text-center">
              <span className="px-3 py-1 bg-slate-900/80 text-slate-200 border border-slate-700 rounded-full text-[10px] font-mono font-bold">
                Position patient QR code inside camera frame
              </span>
            </div>
          </div>
        )}

        {/* Upload Fallback View */}
        {activeTab === 'upload' && !foundPatient && !foundEndoscopy && !notFoundQuery && (
          <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/50 text-center space-y-3">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-2xl mx-auto flex items-center justify-center border border-red-200 dark:border-red-900">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Select or Drop Patient QR Code Image</p>
              <p className="text-[10px] text-slate-500">Supports PNG, JPG, WebP image formats</p>
            </div>
            <label className="inline-flex items-center justify-center px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md">
              <span>Browse Image File</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Found Patient Result Card */}
        {foundPatient && (
          <div className="bg-emerald-950/30 border-2 border-emerald-500/50 p-5 rounded-2xl text-slate-100 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-emerald-800/40 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">Patient Record Located</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-700/50">
                MRN: {foundPatient.regNo}
              </span>
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-black text-white">{foundPatient.name}</h4>
              <p className="text-xs text-slate-400 flex items-center gap-3 font-medium">
                <span>Unit: <strong className="text-slate-200">{foundPatient.unit}</strong></span>
                <span>Location: <strong className="text-slate-200">{foundPatient.location}</strong></span>
                <span>Category: <strong className="text-slate-200">{foundPatient.category}</strong></span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-[9px] font-black text-slate-500 uppercase block">Consultant</span>
                <span className="font-bold text-slate-200">{foundPatient.consultant}</span>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-500 uppercase block">Code Status</span>
                <span className="font-bold text-red-400">{foundPatient.codeStatus}</span>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-500 uppercase block">Admission Date</span>
                <span className="font-bold text-slate-200">{foundPatient.admissionDate}</span>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-500 uppercase block">Current Status</span>
                <span className="font-bold text-emerald-400">{foundPatient.status || 'Active'}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onSelectPatient(foundPatient);
                  onClose();
                }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Patient Record</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFoundPatient(null);
                  if (activeTab === 'camera') startCamera();
                }}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all"
              >
                Scan Next
              </button>
            </div>
          </div>
        )}

        {/* Found Endoscopy Record Card */}
        {foundEndoscopy && (
          <div className="bg-indigo-950/30 border-2 border-indigo-500/50 p-5 rounded-2xl text-slate-100 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-indigo-800/40 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-black uppercase text-indigo-400 tracking-wider">Endoscopy Log Located</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 font-mono text-[10px] font-bold border border-indigo-700/50">
                MRN: {foundEndoscopy.regNo}
              </span>
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-black text-white">{foundEndoscopy.name}</h4>
              <p className="text-xs text-slate-400 font-medium">
                Procedure: <strong className="text-indigo-300">{foundEndoscopy.procedure}</strong>
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              {onSelectEndoscopyRecord && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectEndoscopyRecord(foundEndoscopy);
                    onClose();
                  }}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  <span>Open Endoscopy Procedure Report</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setFoundEndoscopy(null);
                  if (activeTab === 'camera') startCamera();
                }}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all"
              >
                Scan Next
              </button>
            </div>
          </div>
        )}

        {/* Not Found View */}
        {notFoundQuery && (
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 text-slate-200 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <div>
              <h4 className="text-sm font-bold text-white">Record Not Found</h4>
              <p className="text-xs text-slate-400">
                Scanned query: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">{notFoundQuery}</code>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNotFoundQuery(null);
                if (activeTab === 'camera') startCamera();
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Scanning Again</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default QRScannerModal;
