import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Video, 
  VideoOff, 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  Sparkles, 
  Layers, 
  Check, 
  AlertCircle,
  FlipHorizontal,
  Pencil,
  ArrowUpRight,
  Circle,
  Type,
  Tag,
  Undo2,
  Redo2,
  Trash2,
  X,
  Crosshair,
  Ruler,
  Sliders,
  Palette,
  Eye,
  CheckCircle2,
  Edit3,
  MousePointer,
  Download,
  HardDrive,
  FolderDown,
  FileDown,
  FolderOpen,
  Plus,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  RotateCcw,
  Scan,
  Tv,
  ChevronDown,
  ChevronUp,
  Sun,
  Contrast,
  Move
} from 'lucide-react';

export interface SessionCapture {
  id: string;
  base64: string;
  title: string;
  timestamp: Date;
  isAddedToReport?: boolean;
}

export const triggerLocalFileDownload = (dataUrlOrBlob: string, filename: string) => {
  const link = document.createElement('a');
  link.href = dataUrlOrBlob;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

interface CameraViewProps {
  onCapture: (base64Data: string, suggestedTitle: string) => void;
  maxImagesReached?: boolean;
  currentImageCount?: number;
  procedureType?: string;
  patientRegNo?: string;
  patientName?: string;
  attachedImages?: { id: string; url: string; title: string }[];
  onRemoveAttachedImage?: (id: string) => void;
}

type ToolType = 'select' | 'pen' | 'arrow' | 'circle' | 'stamp' | 'text' | 'caliper';

interface AnnotationItem {
  id: string;
  type: ToolType;
  color: string;
  lineWidth: number;
  points?: { x: number; y: number }[]; // for pen
  startX?: number; // for arrow/circle/caliper/stamp/text
  startY?: number;
  endX?: number;
  endY?: number;
  text?: string;
  stampType?: string;
}

const CLINICAL_STAMPS = [
  { id: 'biopsy', label: '✂️ Biopsy Site', bg: '#DC2626', text: '#FFFFFF' },
  { id: 'ulcer', label: '🔴 Ulcer / Bleed', bg: '#B91C1C', text: '#FFFFFF' },
  { id: 'polyp', label: '🟡 Paris Polyp', bg: '#D97706', text: '#FFFFFF' },
  { id: 'clip', label: '🩹 Clip Placed', bg: '#2563EB', text: '#FFFFFF' },
  { id: 'lesion', label: '🎯 Suspect Lesion', bg: '#7C3AED', text: '#FFFFFF' },
  { id: 'stenosis', label: '⚠️ Stricture', bg: '#059669', text: '#FFFFFF' },
];

const CLINICAL_COLORS = [
  { name: 'Surgical Yellow', hex: '#FACC15' },
  { name: 'High-Alert Red', hex: '#EF4444' },
  { name: 'Clinical Cyan', hex: '#06B6D4' },
  { name: 'Neon Green', hex: '#22C55E' },
  { name: 'Vivid Blue', hex: '#3B82F6' },
  { name: 'Pure White', hex: '#FFFFFF' },
];

export const CameraView: React.FC<CameraViewProps> = ({
  onCapture,
  maxImagesReached = false,
  currentImageCount = 0,
  procedureType = 'Upper GI Endoscopy',
  patientRegNo = '',
  patientName = '',
  attachedImages = [],
  onRemoveAttachedImage
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);
  const [capturedFeedback, setCapturedFeedback] = useState<string | null>(null);
  const [quickLabel, setQuickLabel] = useState<string>('');
  const [autoAnnotate, setAutoAnnotate] = useState<boolean>(false);
  const [autoDownloadToPC, setAutoDownloadToPC] = useState<boolean>(() => {
    try {
      return localStorage.getItem('endoscopy_auto_download_pc') === 'true';
    } catch {
      return false;
    }
  });

  // Vision Modes & Scaling for Desktop / Laptop
  const [visionFit, setVisionFit] = useState<'fit' | 'fill' | 'scope'>(() => {
    try {
      return (localStorage.getItem('endoscopy_vision_fit') as any) || 'fit';
    } catch {
      return 'fit';
    }
  });

  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);
  const [isTrayCollapsed, setIsTrayCollapsed] = useState<boolean>(false);

  // Digital Zoom & Pan Engine (1.0x to 3.0x magnification for mucosal lesions/polyps)
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingPan, setIsDraggingPan] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Clinical Endoscopic Vision Enhancement Filters
  const [activeVisionFilter, setActiveVisionFilter] = useState<'none' | 'clarity' | 'bright' | 'nbi' | 'chromo'>('none');
  const [customBrightness, setCustomBrightness] = useState<number>(100);
  const [customContrast, setCustomContrast] = useState<number>(100);
  const [customSaturation, setCustomSaturation] = useState<number>(100);
  const [showVisionSettings, setShowVisionSettings] = useState<boolean>(false);

  // Local TVR-style Session Snapshots Tray (filmstrip)
  const [sessionCaptures, setSessionCaptures] = useState<SessionCapture[]>([]);

  // Annotator Modal State
  const [editingImage, setEditingImage] = useState<{ base64: string; title: string; captureId?: string } | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('arrow');
  const [activeColor, setActiveColor] = useState<string>('#FACC15');
  const [lineWidth, setLineWidth] = useState<number>(4);
  const [selectedStamp, setSelectedStamp] = useState<string>('biopsy');
  const [customTextPrompt, setCustomTextPrompt] = useState<string>('');
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [history, setHistory] = useState<AnnotationItem[][]>([]);
  const [redoHistory, setRedoHistory] = useState<AnnotationItem[][]>([]);
  const [caliperDistance, setCaliperDistance] = useState<string>('10 mm');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const currentItemRef = useRef<AnnotationItem | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const handleVisionFitChange = (fit: 'fit' | 'fill' | 'scope') => {
    setVisionFit(fit);
    try {
      localStorage.setItem('endoscopy_vision_fit', fit);
    } catch (e) {
      console.warn("Could not save vision fit preference", e);
    }
  };

  const getActiveFilterString = () => {
    let b = customBrightness;
    let c = customContrast;
    let s = customSaturation;
    let extra = '';

    if (activeVisionFilter === 'clarity') {
      b += 5;
      c += 22;
      s += 15;
    } else if (activeVisionFilter === 'bright') {
      b += 35;
      c += 10;
    } else if (activeVisionFilter === 'nbi') {
      // Simulated Narrow Band Imaging: highlights micro-vessels and mucosal relief
      extra = ' hue-rotate(85deg)';
      c += 35;
      s += 45;
    } else if (activeVisionFilter === 'chromo') {
      // Simulated Chromoendoscopy (Indigo Carmine / Iodine dye appearance)
      extra = ' hue-rotate(180deg)';
      c += 28;
      s += 25;
    }

    return `brightness(${b}%) contrast(${c}%) saturate(${s}%)${extra}`;
  };

  const resetFilters = () => {
    setActiveVisionFilter('none');
    setCustomBrightness(100);
    setCustomContrast(100);
    setCustomSaturation(100);
  };

  const handleMouseDownPan = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDraggingPan(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMovePan = (e: React.MouseEvent) => {
    if (!isDraggingPan || zoomLevel <= 1) return;
    const maxPan = (zoomLevel - 1) * 350;
    const newX = Math.max(-maxPan, Math.min(maxPan, e.clientX - dragStartRef.current.x));
    const newY = Math.max(-maxPan, Math.min(maxPan, e.clientY - dragStartRef.current.y));
    setPanOffset({ x: newX, y: newY });
  };

  const handleMouseUpPan = () => {
    setIsDraggingPan(false);
  };

  const handleFolderImagesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const filesArray = Array.from(files);

    filesArray.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          const rawName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
          const newCapture: SessionCapture = {
            id: `cap_folder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            base64,
            title: rawName,
            timestamp: new Date(),
            isAddedToReport: false
          };
          setSessionCaptures(prev => [newCapture, ...prev].slice(0, 50));
          setCapturedFeedback(`Imported: ${file.name} to Tray below`);
          setTimeout(() => setCapturedFeedback(null), 3000);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const toggleAutoDownload = (checked: boolean) => {
    setAutoDownloadToPC(checked);
    try {
      localStorage.setItem('endoscopy_auto_download_pc', String(checked));
    } catch (e) {
      console.warn("Could not save auto-download preference", e);
    }
  };

  const getSnapshotFilename = (title?: string) => {
    const cleanReg = (patientRegNo || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanName = (patientName || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanTitle = (title || quickLabel || 'Snapshot').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const timeStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_');
    
    const parts = [];
    if (cleanReg) parts.push(cleanReg);
    if (cleanName) parts.push(cleanName);
    parts.push(cleanTitle);
    parts.push(timeStr);
    
    return `${parts.join('_')}.jpg`;
  };

  // Procedure-aware quick tags
  const getQuickTags = () => {
    const isColon = procedureType.toLowerCase().includes('colon');
    const isBronch = procedureType.toLowerCase().includes('bronch');
    if (isColon) {
      return ['Rectum', 'Sigmoid Colon', 'Descending Colon', 'Transverse', 'Caecum / ICV', 'Polyp / Biopsy'];
    }
    if (isBronch) {
      return ['Vocal Cords', 'Trachea', 'Main Carina', 'RML / RLL', 'LUL / LLL', 'BAL Site'];
    }
    return ['GE Junction / Z-Line', 'Gastric Fundus', 'Antrum / Pylorus', 'Duodenal Bulb (D1)', 'Duodenum (D2)', 'Ulcer / Lesion'];
  };

  // Enumerate video devices
  const refreshDevices = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        setCameraError("Media devices API not supported by this browser.");
        return;
      }
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        const preferred = videoInputs.find(d => 
          d.label.toLowerCase().includes('capture') || 
          d.label.toLowerCase().includes('usb') || 
          d.label.toLowerCase().includes('hdmi') ||
          d.label.toLowerCase().includes('fhd') ||
          d.label.toLowerCase().includes('cam')
        );
        setSelectedDeviceId(preferred ? preferred.deviceId : videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn("Could not enumerate devices:", err);
    }
  };

  // Start Camera Stream
  const startCamera = async (deviceId?: string) => {
    setCameraError(null);
    stopCamera();
    setIsConnecting(true);

    try {
      let newStream: MediaStream | null = null;

      // Attempt 1: Standard / preferred device constraints
      try {
        const primaryConstraints: MediaStreamConstraints = {
          video: deviceId 
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } 
            : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        };
        newStream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
      } catch (firstErr: any) {
        console.warn("Primary getUserMedia attempt failed, falling back to SD constraints:", firstErr);
        // Attempt 2: Relaxed fallback constraints (crucial for USB composite/EasyCap dongles)
        const fallbackConstraints: MediaStreamConstraints = {
          video: deviceId ? { deviceId: { ideal: deviceId } } : true,
          audio: false
        };
        newStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }

      setStream(newStream);
      setIsStreaming(true);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play().catch(e => console.warn("Video play interrupted:", e));
      }

      await refreshDevices();
    } catch (err: any) {
      console.error("Camera access error:", err);
      setIsStreaming(false);

      const isDeviceInUse = err.name === 'NotReadableError' || 
                            err.name === 'TrackStartError' || 
                            String(err?.message || '').toLowerCase().includes('in use') ||
                            String(err?.message || '').toLowerCase().includes('could not start');

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError("Camera permission denied. Please allow browser camera access.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError("No video capture device or camera detected. Please check USB cable connection.");
      } else if (isDeviceInUse) {
        setCameraError("Capture device is in use by another application (e.g. honestech TVR 2.5 or OBS).");
      } else {
        setCameraError(`Camera error: ${err.message || String(err)}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  };

  // Switch device
  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedDeviceId(newId);
    if (isStreaming) {
      startCamera(newId);
    }
  };

  // Grab Current Raw Frame from Video (with clinical filter and digital zoom integration)
  const getRawFrameBase64 = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (isMirrored) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    // Apply clinical filter if active
    const filterString = getActiveFilterString();
    if (filterString && filterString !== 'brightness(100%) contrast(100%) saturate(100%)') {
      ctx.filter = filterString;
    } else {
      ctx.filter = 'none';
    }

    if (zoomLevel > 1) {
      const cropW = width / zoomLevel;
      const cropH = height / zoomLevel;
      const maxPanX = (zoomLevel - 1) * (width / 2);
      const maxPanY = (zoomLevel - 1) * (height / 2);
      const normPanX = (panOffset.x / 350) * (maxPanX / zoomLevel);
      const normPanY = (panOffset.y / 350) * (maxPanY / zoomLevel);

      const srcX = Math.max(0, Math.min(width - cropW, (width - cropW) / 2 - normPanX));
      const srcY = Math.max(0, Math.min(height - cropH, (height - cropH) / 2 - normPanY));
      ctx.drawImage(video, srcX, srcY, cropW, cropH, 0, 0, width, height);
    } else {
      ctx.drawImage(video, 0, 0, width, height);
    }

    return canvas.toDataURL('image/jpeg', 0.94);
  };

  // Download specific image to PC
  const downloadSnapshot = (base64Data: string, title?: string) => {
    const filename = getSnapshotFilename(title);
    triggerLocalFileDownload(base64Data, filename);
    setCapturedFeedback(`Saved to PC: ${filename}`);
    setTimeout(() => setCapturedFeedback(null), 2500);
  };

  // Direct Live Frame Download to PC
  const downloadCurrentLiveFrame = () => {
    if (!isStreaming) return;
    const base64 = getRawFrameBase64();
    if (!base64) return;

    // Visual flash
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 200);

    const titleToUse = quickLabel.trim() || `Endoscope Capture ${sessionCaptures.length + 1}`;
    downloadSnapshot(base64, titleToUse);

    // Also add to session captures history
    const newCapture = {
      id: `cap_${Date.now()}`,
      base64,
      title: titleToUse,
      timestamp: new Date()
    };
    setSessionCaptures(prev => [newCapture, ...prev].slice(0, 10));
  };

  // Download all session captures
  const downloadAllSessionCaptures = () => {
    if (sessionCaptures.length === 0) return;
    sessionCaptures.forEach((cap, idx) => {
      setTimeout(() => {
        triggerLocalFileDownload(cap.base64, getSnapshotFilename(`${cap.title}_${idx + 1}`));
      }, idx * 250);
    });
    setCapturedFeedback(`Downloaded ${sessionCaptures.length} snapshots to PC`);
    setTimeout(() => setCapturedFeedback(null), 3000);
  };

  // Add to Report handler
  const handleAddToReport = (cap: SessionCapture) => {
    if (currentImageCount >= 4) {
      setCapturedFeedback("Report already has max 4 images. Remove one from report to attach more.");
      setTimeout(() => setCapturedFeedback(null), 3000);
      return;
    }

    onCapture(cap.base64, cap.title);

    setSessionCaptures(prev => prev.map(item => item.id === cap.id ? { ...item, isAddedToReport: true } : item));
    setCapturedFeedback(`Attached to Report: ${cap.title}`);
    setTimeout(() => setCapturedFeedback(null), 2500);
  };

  // Remove individual snapshot from the video captures tray (TVR style removal)
  const handleRemoveFromTray = (captureId: string) => {
    setSessionCaptures(prev => prev.filter(c => c.id !== captureId));
    setCapturedFeedback("Snapshot removed from video tray");
    setTimeout(() => setCapturedFeedback(null), 2000);
  };

  // Clear all snapshots from the tray with safe inline confirmation (no window.confirm blocked by iframes)
  const [confirmClearTray, setConfirmClearTray] = useState<boolean>(false);

  useEffect(() => {
    if (!confirmClearTray) return;
    const timer = setTimeout(() => setConfirmClearTray(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmClearTray]);

  const handleClearAllTray = () => {
    if (sessionCaptures.length === 0) return;
    if (!confirmClearTray) {
      setConfirmClearTray(true);
      return;
    }
    const count = sessionCaptures.length;
    setSessionCaptures([]);
    setConfirmClearTray(false);
    setCapturedFeedback(`Cleared all ${count} snapshots from tray`);
    setTimeout(() => setCapturedFeedback(null), 2500);
  };

  // Capture Frame handler (TVR pattern: saves to tray first, user chooses which to add to report)
  const captureFrame = (openMarkup: boolean = false) => {
    if (!isStreaming) return;

    const base64 = getRawFrameBase64();
    if (!base64) return;

    // Visual flash
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 200);

    const titleToUse = quickLabel.trim() || `Endoscope Capture ${sessionCaptures.length + 1}`;
    
    // Auto-save to PC Downloads if enabled
    if (autoDownloadToPC) {
      triggerLocalFileDownload(base64, getSnapshotFilename(titleToUse));
    }

    const captureId = `cap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newCapture: SessionCapture = {
      id: captureId,
      base64,
      title: titleToUse,
      timestamp: new Date(),
      isAddedToReport: false
    };

    setSessionCaptures(prev => [newCapture, ...prev].slice(0, 50));

    if (openMarkup || autoAnnotate) {
      openAnnotator(base64, titleToUse, captureId);
    } else {
      setCapturedFeedback(
        autoDownloadToPC 
          ? `Saved to PC & Tray: ${titleToUse}` 
          : `Snapshot #${sessionCaptures.length + 1} added to Tray! Click '+ Add to Report' to attach.`
      );
      setTimeout(() => setCapturedFeedback(null), 2500);
    }
  };

  // Open Annotation Studio for an Image
  const openAnnotator = (base64: string, title: string, captureId?: string) => {
    setEditingImage({ base64, title, captureId });
    setAnnotations([]);
    setHistory([]);
    setRedoHistory([]);
    setActiveTool('arrow');
  };

  // Keyboard shortcut listener (Spacebar, F2, +, -, 0, T)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingImage) return;

      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if ((e.code === 'Space' || e.key === 'F2') && isStreaming) {
        e.preventDefault();
        captureFrame(false);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoomLevel(prev => Math.min(3.0, Number((prev + 0.25).toFixed(2))));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoomLevel(prev => {
          const next = Math.max(1.0, Number((prev - 0.25).toFixed(2)));
          if (next === 1.0) setPanOffset({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === '0') {
        e.preventDefault();
        setZoomLevel(1.0);
        setPanOffset({ x: 0, y: 0 });
      } else if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {
        setIsTheaterMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, maxImagesReached, quickLabel, currentImageCount, isMirrored, editingImage, autoAnnotate, zoomLevel, panOffset]);

  // Fullscreen change listener to sync state with Escape / browser actions
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  useEffect(() => {
    refreshDevices();
    return () => {
      stopCamera();
    };
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch((err) => {
          console.warn("Fullscreen request error, falling back to Theater Mode:", err);
          setIsTheaterMode(true);
        });
      } else {
        setIsTheaterMode(true);
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.warn("Exit fullscreen error:", err));
      }
      setIsFullscreen(false);
    }
  };

  // ----------------------------------------------------
  // ANNOTATION DRAWING ENGINE
  // ----------------------------------------------------

  const redrawAnnotationCanvas = (previewItem?: AnnotationItem | null) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas || !editingImage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load background image
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Render all saved annotations
      const allItems = previewItem ? [...(annotations || []).filter(Boolean), previewItem] : (annotations || []).filter(Boolean);
      allItems.forEach(item => {
        if (item) renderAnnotationItem(ctx, item);
      });
    };
    img.src = editingImage.base64;
  };

  useEffect(() => {
    if (editingImage && annotationCanvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const canvas = annotationCanvasRef.current;
        if (canvas) {
          canvas.width = img.width || 1280;
          canvas.height = img.height || 720;
          redrawAnnotationCanvas();
        }
      };
      img.src = editingImage.base64;
    }
  }, [editingImage, annotations]);

  const renderAnnotationItem = (ctx: CanvasRenderingContext2D, item: AnnotationItem | null | undefined) => {
    if (!item) return;
    const safeColor = item.color || '#ef4444';
    ctx.save();
    ctx.strokeStyle = safeColor;
    ctx.fillStyle = safeColor;
    ctx.lineWidth = item.lineWidth || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (item.type === 'pen' && item.points && item.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(item.points[0].x, item.points[0].y);
      for (let i = 1; i < item.points.length; i++) {
        ctx.lineTo(item.points[i].x, item.points[i].y);
      }
      ctx.stroke();
    } else if (item.type === 'arrow' && item.startX !== undefined && item.startY !== undefined && item.endX !== undefined && item.endY !== undefined) {
      // Draw arrow shaft
      ctx.beginPath();
      ctx.moveTo(item.startX, item.startY);
      ctx.lineTo(item.endX, item.endY);
      ctx.stroke();

      // Draw arrowhead at endX, endY
      const angle = Math.atan2(item.endY - item.startY, item.endX - item.startX);
      const headlen = (item.lineWidth || 3) * 4 + 10;
      ctx.beginPath();
      ctx.moveTo(item.endX, item.endY);
      ctx.lineTo(
        item.endX - headlen * Math.cos(angle - Math.PI / 6),
        item.endY - headlen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        item.endX - headlen * Math.cos(angle + Math.PI / 6),
        item.endY - headlen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    } else if (item.type === 'circle' && item.startX !== undefined && item.startY !== undefined && item.endX !== undefined && item.endY !== undefined) {
      const radiusX = Math.abs(item.endX - item.startX) / 2;
      const radiusY = Math.abs(item.endY - item.startY) / 2;
      const centerX = Math.min(item.startX, item.endX) + radiusX;
      const centerY = Math.min(item.startY, item.endY) + radiusY;

      ctx.beginPath();
      ctx.ellipse(centerX, centerY, Math.max(radiusX, 5), Math.max(radiusY, 5), 0, 0, 2 * Math.PI);
      ctx.stroke();

      // Soft semi-transparent highlight inside ring
      ctx.fillStyle = `${safeColor}22`;
      ctx.fill();
    } else if (item.type === 'caliper' && item.startX !== undefined && item.startY !== undefined && item.endX !== undefined && item.endY !== undefined) {
      // Measurement Caliper Line
      ctx.beginPath();
      ctx.moveTo(item.startX, item.startY);
      ctx.lineTo(item.endX, item.endY);
      ctx.stroke();

      // End tick marks
      const angle = Math.atan2(item.endY - item.startY, item.endX - item.startX);
      const perp = angle + Math.PI / 2;
      const tickLen = 12;

      ctx.beginPath();
      ctx.moveTo(item.startX - tickLen * Math.cos(perp), item.startY - tickLen * Math.sin(perp));
      ctx.lineTo(item.startX + tickLen * Math.cos(perp), item.startY + tickLen * Math.sin(perp));
      ctx.moveTo(item.endX - tickLen * Math.cos(perp), item.endY - tickLen * Math.sin(perp));
      ctx.lineTo(item.endX + tickLen * Math.cos(perp), item.endY + tickLen * Math.sin(perp));
      ctx.stroke();

      // Label background & text
      const midX = (item.startX + item.endX) / 2;
      const midY = (item.startY + item.endY) / 2;
      const label = item.text || caliperDistance || '10mm';
      ctx.font = 'bold 16px sans-serif';
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(midX - textWidth / 2 - 8, midY - 14, textWidth + 16, 26, 6);
      ctx.fill();
      ctx.strokeStyle = safeColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, midX, midY);
    } else if (item.type === 'stamp' && item.startX !== undefined && item.startY !== undefined) {
      const stampMeta = CLINICAL_STAMPS.find(s => s.id === item.stampType) || CLINICAL_STAMPS[0];
      const label = item.text || stampMeta.label;

      ctx.font = 'bold 16px sans-serif';
      const textWidth = ctx.measureText(label).width;
      const padding = 10;
      const boxW = textWidth + padding * 2;
      const boxH = 32;
      const boxX = item.startX - boxW / 2;
      const boxY = item.startY - boxH / 2;

      // Drop shadow for clinical clarity
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      ctx.fillStyle = stampMeta.bg;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 8);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, item.startX, item.startY);
    } else if (item.type === 'text' && item.startX !== undefined && item.startY !== undefined) {
      const label = item.text || 'Clinical Note';
      ctx.font = 'bold 18px sans-serif';
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(item.startX - 6, item.startY - 22, textWidth + 12, 30, 6);
      ctx.fill();
      ctx.strokeStyle = safeColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = safeColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(label, item.startX, item.startY - 18);
    }

    ctx.restore();
  };

  // Convert mouse / touch coordinates to canvas internal pixel coordinates
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!editingImage) return;
    const coords = getCanvasCoords(e);
    isDrawingRef.current = true;

    if (activeTool === 'stamp') {
      const stampMeta = CLINICAL_STAMPS.find(s => s.id === selectedStamp) || CLINICAL_STAMPS[0];
      const newItem: AnnotationItem = {
        id: `ann_${Date.now()}`,
        type: 'stamp',
        color: stampMeta.bg,
        lineWidth,
        startX: coords.x,
        startY: coords.y,
        stampType: selectedStamp,
        text: stampMeta.label
      };
      setHistory(prev => [...prev, annotations]);
      setRedoHistory([]);
      setAnnotations(prev => [...prev, newItem]);
      isDrawingRef.current = false;
      return;
    }

    if (activeTool === 'text') {
      const promptText = customTextPrompt.trim() || prompt("Enter clinical text callout:", "Lesion noted") || "";
      if (!promptText) {
        isDrawingRef.current = false;
        return;
      }
      const newItem: AnnotationItem = {
        id: `ann_${Date.now()}`,
        type: 'text',
        color: activeColor,
        lineWidth,
        startX: coords.x,
        startY: coords.y,
        text: promptText
      };
      setHistory(prev => [...prev, annotations]);
      setRedoHistory([]);
      setAnnotations(prev => [...prev, newItem]);
      isDrawingRef.current = false;
      return;
    }

    const newItem: AnnotationItem = {
      id: `ann_${Date.now()}`,
      type: activeTool,
      color: activeColor,
      lineWidth,
      startX: coords.x,
      startY: coords.y,
      endX: coords.x,
      endY: coords.y,
      points: activeTool === 'pen' ? [coords] : undefined,
      text: activeTool === 'caliper' ? caliperDistance : undefined
    };

    currentItemRef.current = newItem;
  };

  const handleMoveDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentItemRef.current) return;
    const coords = getCanvasCoords(e);

    if (currentItemRef.current.type === 'pen') {
      currentItemRef.current.points?.push(coords);
    } else {
      currentItemRef.current.endX = coords.x;
      currentItemRef.current.endY = coords.y;
    }

    redrawAnnotationCanvas(currentItemRef.current);
  };

  const handleEndDraw = () => {
    if (!isDrawingRef.current || !currentItemRef.current) return;
    isDrawingRef.current = false;

    setHistory(prev => [...prev, annotations]);
    setRedoHistory([]);
    setAnnotations(prev => [...prev, currentItemRef.current!]);
    currentItemRef.current = null;
  };

  const handleUndo = () => {
    if (history.length === 0 && annotations.length === 0) return;
    
    if (history.length > 0) {
      const previousState = history[history.length - 1];
      setRedoHistory(prev => [...prev, annotations]);
      setAnnotations(previousState);
      setHistory(prev => prev.slice(0, prev.length - 1));
    } else if (annotations.length > 0) {
      setRedoHistory(prev => [...prev, annotations]);
      setAnnotations([]);
    }
  };

  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    const nextState = redoHistory[redoHistory.length - 1];
    setHistory(prev => [...prev, annotations]);
    setAnnotations(nextState);
    setRedoHistory(prev => prev.slice(0, prev.length - 1));
  };

  const handleClearAll = () => {
    if (annotations.length === 0) return;
    setHistory(prev => [...prev, annotations]);
    setRedoHistory([]);
    setAnnotations([]);
  };

  // Keyboard shortcut listener inside the Annotator Studio (Undo: Ctrl+Z / Cmd+Z, Redo: Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z)
  useEffect(() => {
    if (!editingImage) return;

    const handleAnnotatorKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditingImage(null);
      }
    };

    window.addEventListener('keydown', handleAnnotatorKeyDown);
    return () => window.removeEventListener('keydown', handleAnnotatorKeyDown);
  }, [editingImage, annotations, history, redoHistory]);

  const handleSaveAnnotatedImage = (addToReport: boolean = true) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas || !editingImage) return;

    const finalBase64 = canvas.toDataURL('image/jpeg', 0.94);
    const titleToUse = editingImage.title || 'Marked Endoscopy Image';

    if (autoDownloadToPC) {
      triggerLocalFileDownload(finalBase64, getSnapshotFilename(titleToUse));
    }

    const targetId = editingImage.captureId || `cap_annotated_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newCapture: SessionCapture = {
      id: targetId,
      base64: finalBase64,
      title: titleToUse,
      timestamp: new Date(),
      isAddedToReport: false
    };

    // Update in session captures tray
    setSessionCaptures(prev => {
      const exists = prev.some(c => c.id === targetId);
      if (exists) {
        return prev.map(c => c.id === targetId ? newCapture : c);
      }
      return [newCapture, ...prev].slice(0, 50);
    });

    if (addToReport) {
      if (currentImageCount >= 4) {
        setCapturedFeedback("Report already has max 4 images. Saved to Tray below.");
        setTimeout(() => setCapturedFeedback(null), 3000);
      } else {
        onCapture(finalBase64, titleToUse);
        setSessionCaptures(prev => prev.map(c => c.id === targetId ? { ...c, isAddedToReport: true } : c));
        setCapturedFeedback(`Attached Annotated: ${titleToUse}`);
        setTimeout(() => setCapturedFeedback(null), 2500);
      }
    } else {
      setCapturedFeedback(`Saved Annotated to Tray: ${titleToUse}`);
      setTimeout(() => setCapturedFeedback(null), 2500);
    }

    setEditingImage(null);
    setAnnotations([]);
  };

  const handleDownloadAnnotatedOnly = () => {
    const canvas = annotationCanvasRef.current;
    if (!canvas || !editingImage) return;

    const finalBase64 = canvas.toDataURL('image/jpeg', 0.94);
    downloadSnapshot(finalBase64, editingImage.title || 'Marked_Snapshot');
  };

  return (
    <div 
      ref={containerRef}
      id="endoscopy-camera-view"
      className={`bg-slate-900 border border-slate-700/60 shadow-2xl text-white flex flex-col transition-all relative ${
        isFullscreen || isTheaterMode 
          ? 'fixed inset-0 z-50 rounded-none border-0 w-screen h-screen' 
          : 'rounded-2xl overflow-hidden'
      }`}
    >
      {/* Header Bar - Clinical Endoscopy Vision Controls */}
      <div className="bg-slate-950/90 px-3 py-2 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
        {/* Left: Feed Status & Device Selector */}
        <div className="flex items-center space-x-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
          <Video className="w-4 h-4 text-indigo-400" />
          {isStreaming && (
            <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
              HD LIVE
            </span>
          )}

          {devices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={handleDeviceChange}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer max-w-[130px] truncate"
              title="Select Video Capture Source"
            >
              {devices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Camera Source ${i + 1}`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Center: Vision Modes, Zoom & Clinical Vision Filters */}
        {isStreaming && (
          <div className="flex items-center space-x-1.5 flex-wrap gap-1">
            {/* Vision Fit / Aspect Mode (Fit vs Widescreen Fill vs Scope Circle) */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800" title="Aspect Ratio & Viewport Fit">
              <button
                type="button"
                onClick={() => handleVisionFitChange('fit')}
                className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all cursor-pointer ${
                  visionFit === 'fit' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Fit Standard 4:3 Aspect (Untouched Camera Feed)"
              >
                Fit 4:3
              </button>
              <button
                type="button"
                onClick={() => handleVisionFitChange('fill')}
                className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all cursor-pointer ${
                  visionFit === 'fill' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Widescreen Vision Fill (Covers laptop/PC screen without black sidebars)"
              >
                Wide Fill
              </button>
              <button
                type="button"
                onClick={() => handleVisionFitChange('scope')}
                className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all cursor-pointer ${
                  visionFit === 'scope' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Circular Endoscope Lens Mask (Focus on lumen center)"
              >
                Scope Lens
              </button>
            </div>

            {/* Digital Zoom Controls */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[9px]">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => {
                  const next = Math.max(1.0, Number((prev - 0.25).toFixed(2)));
                  if (next === 1.0) setPanOffset({ x: 0, y: 0 });
                  return next;
                })}
                disabled={zoomLevel <= 1.0}
                className="p-1 hover:text-white text-slate-400 disabled:opacity-40 cursor-pointer"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (zoomLevel > 1.0) {
                    setZoomLevel(1.0);
                    setPanOffset({ x: 0, y: 0 });
                  } else {
                    setZoomLevel(1.5);
                  }
                }}
                className={`px-1 font-mono font-bold cursor-pointer transition-colors ${
                  zoomLevel > 1 ? 'text-amber-300' : 'text-slate-300 hover:text-white'
                }`}
                title="Click to toggle 1.0x / 1.5x zoom (Shortcut: 0 to reset)"
              >
                {zoomLevel.toFixed(1)}x
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(3.0, Number((prev + 0.25).toFixed(2))))}
                disabled={zoomLevel >= 3.0}
                className="p-1 hover:text-white text-slate-400 disabled:opacity-40 cursor-pointer"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>

            {/* Clinical Vision Filters Popover Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowVisionSettings(prev => !prev)}
                className={`px-2 py-1 rounded-lg border text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  activeVisionFilter !== 'none' || customBrightness !== 100 || customContrast !== 100
                    ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 shadow-sm'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
                title="Endoscopic Vision Tuning: Clarity, Brightness, Simulated NBI"
              >
                <SlidersHorizontal className="w-3 h-3 text-indigo-400" />
                <span className="hidden sm:inline">Vision Tuning</span>
                {activeVisionFilter !== 'none' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>

              {/* Vision Tuning Popover Panel */}
              {showVisionSettings && (
                <div className="absolute right-0 top-full mt-1.5 w-72 bg-slate-950 border border-slate-700 rounded-xl p-3 shadow-2xl z-50 text-slate-200 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      Clinical Vision Filters
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowVisionSettings(false)}
                      className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Filter Presets */}
                  <div className="grid grid-cols-2 gap-1.5 my-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveVisionFilter('none')}
                      className={`px-2 py-1.5 rounded-lg text-[9px] font-bold text-left border cursor-pointer transition-all ${
                        activeVisionFilter === 'none'
                          ? 'bg-indigo-600 text-white border-indigo-400'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      Natural / Raw
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveVisionFilter('clarity')}
                      className={`px-2 py-1.5 rounded-lg text-[9px] font-bold text-left border cursor-pointer transition-all ${
                        activeVisionFilter === 'clarity'
                          ? 'bg-indigo-600 text-white border-indigo-400'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
                      }`}
                      title="Sharpen Mucosal Edges and Folds"
                    >
                      High Clarity
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveVisionFilter('bright')}
                      className={`px-2 py-1.5 rounded-lg text-[9px] font-bold text-left border cursor-pointer transition-all ${
                        activeVisionFilter === 'bright'
                          ? 'bg-indigo-600 text-white border-indigo-400'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
                      }`}
                      title="+35% Brightness for Dark Cavities"
                    >
                      Bright Cavity
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveVisionFilter('nbi')}
                      className={`px-2 py-1.5 rounded-lg text-[9px] font-bold text-left border cursor-pointer transition-all ${
                        activeVisionFilter === 'nbi'
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : 'bg-slate-900 text-emerald-300 border-slate-800 hover:bg-slate-850'
                      }`}
                      title="Simulated Narrow Band Imaging for Microvessels"
                    >
                      Simulated NBI
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveVisionFilter('chromo')}
                      className={`col-span-2 px-2 py-1.5 rounded-lg text-[9px] font-bold text-left border cursor-pointer transition-all ${
                        activeVisionFilter === 'chromo'
                          ? 'bg-indigo-600 text-white border-indigo-400'
                          : 'bg-slate-900 text-indigo-300 border-slate-800 hover:bg-slate-850'
                      }`}
                      title="Indigo Carmine / Chromoendoscopy Contrast"
                    >
                      Chromo Surface Dye
                    </button>
                  </div>

                  {/* Fine Tuning Sliders */}
                  <div className="space-y-2 pt-2 border-t border-slate-800 text-[9px]">
                    <div>
                      <div className="flex justify-between text-slate-400 font-bold mb-1">
                        <span>Brightness</span>
                        <span className="font-mono">{customBrightness}%</span>
                      </div>
                      <input
                        type="range"
                        min="70"
                        max="160"
                        value={customBrightness}
                        onChange={(e) => setCustomBrightness(Number(e.target.value))}
                        className="w-full accent-indigo-500 h-1 bg-slate-800 rounded cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-400 font-bold mb-1">
                        <span>Contrast</span>
                        <span className="font-mono">{customContrast}%</span>
                      </div>
                      <input
                        type="range"
                        min="70"
                        max="160"
                        value={customContrast}
                        onChange={(e) => setCustomContrast(Number(e.target.value))}
                        className="w-full accent-indigo-500 h-1 bg-slate-800 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="pt-2.5 mt-2.5 border-t border-slate-800 flex justify-between">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-[9px] text-slate-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      Reset to Natural
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowVisionSettings(false)}
                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[9px] font-bold cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right: Mirror, Theater, Fullscreen, Stream Toggle */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => setIsMirrored(!isMirrored)}
            className={`p-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              isMirrored 
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Mirror Video Feed"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* In-Browser Theater Mode (Maximize in Window without browser permission dialog) */}
          <button
            type="button"
            onClick={() => setIsTheaterMode(!isTheaterMode)}
            className={`p-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              isTheaterMode 
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-md' 
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title={isTheaterMode ? "Exit Theater Mode (T)" : "Theater Mode Vision (T)"}
          >
            <Tv className="w-3.5 h-3.5" />
          </button>

          {/* Hardware Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen Live Feed (F)"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {isStreaming ? (
            <button
              type="button"
              id="camera-stop-feed-btn"
              onClick={stopCamera}
              className="p-1.5 bg-rose-900/40 hover:bg-rose-800/70 text-rose-300 border border-rose-700/60 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer active:scale-95"
              title="Stop Live Camera Stream"
              aria-label="Stop Live Camera Stream"
            >
              <VideoOff className="w-3.5 h-3.5 text-rose-300" />
            </button>
          ) : (
            <button
              type="button"
              id="camera-start-feed-btn"
              onClick={() => startCamera(selectedDeviceId)}
              className="p-1.5 bg-emerald-600/30 hover:bg-emerald-600/60 text-emerald-300 border border-emerald-500/60 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer active:scale-95 shadow-sm"
              title="Start Live Camera Feed"
              aria-label="Start Live Camera Feed"
            >
              <Video className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            </button>
          )}
        </div>
      </div>

      {/* Video Stream Stage - Fully Responsive & Height Scaled */}
      <div 
        onMouseDown={handleMouseDownPan}
        onMouseMove={handleMouseMovePan}
        onMouseUp={handleMouseUpPan}
        onMouseLeave={handleMouseUpPan}
        className={`relative bg-black flex items-center justify-center overflow-hidden select-none ${
          isFullscreen || isTheaterMode 
            ? 'flex-1 min-h-0 w-full' 
            : 'aspect-video min-h-[220px] max-h-[380px] w-full'
        } ${zoomLevel > 1 ? (isDraggingPan ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px) ${isMirrored ? 'scaleX(-1)' : ''}`,
            filter: getActiveFilterString(),
            transformOrigin: 'center center',
          }}
          className={`max-w-full max-h-full transition-transform duration-75 select-none pointer-events-none ${
            visionFit === 'fill' 
              ? 'w-full h-full object-cover' 
              : visionFit === 'scope'
                ? 'w-auto h-auto max-w-[92vh] max-h-[92vh] aspect-square rounded-full object-cover border-4 border-slate-800 ring-2 ring-indigo-500/30 shadow-2xl'
                : 'w-full h-full object-contain'
          } ${!isStreaming ? 'hidden' : ''}`}
        />

        {/* Digital Zoom HUD when zoomed */}
        {isStreaming && zoomLevel > 1 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-950/85 backdrop-blur-md border border-indigo-500/40 text-slate-200 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-2 shadow-xl z-20">
            <Move className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Digital Zoom: <strong className="text-white">{zoomLevel.toFixed(1)}x</strong> (Drag to pan)</span>
            <button
              type="button"
              onClick={() => { setZoomLevel(1.0); setPanOffset({ x: 0, y: 0 }); }}
              className="text-xs text-indigo-300 hover:text-white underline cursor-pointer ml-1 font-bold"
            >
              Reset
            </button>
          </div>
        )}

        {/* Active Vision Filter Indicator */}
        {isStreaming && activeVisionFilter !== 'none' && (
          <div className="absolute top-3 left-3 bg-indigo-950/85 backdrop-blur-md border border-indigo-500/40 text-indigo-300 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xl z-20">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              {activeVisionFilter === 'nbi' 
                ? 'Simulated NBI (Vessels)' 
                : activeVisionFilter === 'clarity' 
                  ? 'Edge Clarity' 
                  : activeVisionFilter === 'bright' 
                    ? 'Bright Cavity' 
                    : 'Chromo Tint'}
            </span>
          </div>
        )}

        {/* Hidden Canvas for Frame Extraction */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Visual Flash on snapshot */}
        {flashEffect && (
          <div className="absolute inset-0 bg-white/80 pointer-events-none z-30 animate-out fade-out duration-200" />
        )}

        {/* Toast Badge Overlay on Capture */}
        {capturedFeedback && (
          <div className="absolute top-4 bg-emerald-600/90 text-white border border-emerald-400 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-2xl z-30 animate-in slide-in-from-top duration-200 backdrop-blur-md">
            <Check className="w-4 h-4 text-emerald-200" />
            {capturedFeedback}
          </div>
        )}

        {/* Hidden File Input for Direct Folder / honestech TVR Snapshot Import */}
        <input 
          type="file" 
          ref={folderInputRef} 
          onChange={handleFolderImagesSelect} 
          multiple 
          accept="image/*" 
          className="hidden" 
        />

        {/* Offline / Connect Prompt */}
        {!isStreaming && (
          <div className="flex flex-col items-center justify-center text-center p-5 space-y-3 z-10 max-w-lg w-full">
            {cameraError && (cameraError.includes('in use') || cameraError.includes('honestech')) ? (
              <div className="w-full bg-slate-900/95 border border-rose-500/60 rounded-2xl p-4 text-left shadow-2xl space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center flex-shrink-0 text-rose-400">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-rose-300 uppercase tracking-wider">
                      Capture Device In Use (honestech TVR 2.5 Active)
                    </h4>
                    <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                      Windows allows only one program to use the USB video capture card at a time. Because <strong className="text-white font-bold">honestech TVR 2.5</strong> is currently open on your desktop, browser live feed access is locked.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800">
                  {/* Solution 1: Stream in Portal */}
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col justify-between space-y-2">
                    <div>
                      <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Option 1: Stream in Portal
                      </span>
                      <p className="text-[8.5px] text-slate-400 mt-1 leading-normal">
                        Close the <strong className="text-slate-200">honestech TVR 2.5</strong> window (click ✖ on its window), then click:
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startCamera(selectedDeviceId)}
                      disabled={isConnecting}
                      className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider rounded-lg text-[9px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isConnecting ? 'animate-spin' : ''}`} />
                      <span>{isConnecting ? 'Connecting...' : 'Retry Live Video'}</span>
                    </button>
                  </div>

                  {/* Solution 2: Import from desktop folder */}
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col justify-between space-y-2">
                    <div>
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                        <FolderOpen className="w-3 h-3 text-indigo-400" />
                        Option 2: Import Photos
                      </span>
                      <p className="text-[8.5px] text-slate-400 mt-1 leading-normal">
                        Keep honestech TVR open! Snapshots save in <strong className="text-slate-200">Desktop / Endoscopy picture</strong>.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => folderInputRef.current?.click()}
                      disabled={maxImagesReached}
                      className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-wider rounded-lg text-[9px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                    >
                      <FolderOpen className="w-3 h-3" />
                      <span>Import From Folder</span>
                    </button>
                  </div>
                </div>

                {devices.length > 1 && (
                  <div className="flex items-center justify-between text-[9px] bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Other Video Input:</span>
                    <select
                      value={selectedDeviceId}
                      onChange={handleDeviceChange}
                      className="bg-slate-900 text-slate-200 border border-slate-700 rounded px-2 py-0.5 text-[9px] outline-none cursor-pointer"
                    >
                      {devices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Device ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  id="camera-center-launch-btn"
                  onClick={() => startCamera(selectedDeviceId)}
                  disabled={isConnecting}
                  className="w-16 h-16 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/50 hover:border-indigo-400 text-indigo-400 hover:text-indigo-300 flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-indigo-950/50 group active:scale-95 disabled:opacity-50"
                  title="Click to Open Live Camera Feed"
                  aria-label="Click to Open Live Camera Feed"
                >
                  <Camera className={`w-8 h-8 group-hover:scale-110 text-indigo-400 transition-transform duration-200 ${isConnecting ? 'animate-pulse' : ''}`} />
                </button>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-200">Endoscope Video Stream Offline</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mt-1">
                    Connect your USB capture card or Olympus / Pentax video cable and click camera to start live feed.
                  </p>
                </div>

                {cameraError && (
                  <div className="bg-rose-950/70 border border-rose-500/40 text-rose-300 px-3.5 py-2 rounded-xl text-[10px] font-bold max-w-sm flex items-center justify-between gap-2 text-left">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                      <span>{cameraError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => startCamera(selectedDeviceId)}
                      className="px-2 py-0.5 bg-rose-800 hover:bg-rose-700 text-white rounded text-[8px] uppercase tracking-wider font-bold transition-all cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                )}

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={maxImagesReached}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <FolderOpen className="w-3 h-3 text-indigo-400" />
                    <span>Import Snapshots from Desktop Folder</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Snapshot Control Bar (Visible when streaming) */}
      {isStreaming && (
        <div className="bg-slate-950 p-2.5 sm:p-3 border-t border-slate-800 flex flex-col space-y-2">
          {/* Quick Anatomical Label selector */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 flex-shrink-0" title="Organ Label Tags">
              <Layers className="w-3 h-3 text-indigo-400" />
            </span>
            {getQuickTags().map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setQuickLabel(tag)}
                className={`flex-shrink-0 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                  quickLabel === tag
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {tag}
              </button>
            ))}
            {quickLabel && (
              <button
                type="button"
                onClick={() => setQuickLabel('')}
                className="text-[8px] text-rose-400 hover:text-rose-300 font-bold px-1 py-0.5 rounded cursor-pointer"
                title="Clear selected tag"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {/* Capture Trigger Buttons & Options */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center space-x-3 text-[10px] font-bold text-slate-400">
              <label className="flex items-center space-x-1.5 cursor-pointer select-none text-[10px] text-slate-300 hover:text-white" title="Automatically launch drawing studio after capturing">
                <input 
                  type="checkbox" 
                  checked={autoAnnotate} 
                  onChange={(e) => setAutoAnnotate(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <Edit3 className="w-3 h-3 text-indigo-400" />
                  <span>Markup</span>
                </span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer select-none text-[10px] text-emerald-300 hover:text-emerald-200" title="Automatically download snapshots directly to PC Downloads">
                <input 
                  type="checkbox" 
                  checked={autoDownloadToPC} 
                  onChange={(e) => toggleAutoDownload(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-emerald-400" />
                  <span>PC Save</span>
                </span>
              </label>

              <span className="hidden md:inline-flex items-center text-[9px] text-slate-500 font-normal">
                Spacebar / F2 to Snap
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {/* Tray Collapsible Toggle */}
              <button
                type="button"
                onClick={() => setIsTrayCollapsed(prev => !prev)}
                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                title={isTrayCollapsed ? "Show Snapshots Tray" : "Hide Snapshots Tray to maximize vision space"}
              >
                <ImageIcon className="w-3 h-3 text-indigo-400" />
                <span>Tray ({sessionCaptures.length})</span>
                {isTrayCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {/* Direct Download Snapshot to PC Button */}
              <button
                type="button"
                id="download-live-snapshot-btn"
                onClick={downloadCurrentLiveFrame}
                className="p-2 sm:px-3 sm:py-2 bg-slate-800/95 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 rounded-xl transition-all border border-emerald-500/40 hover:border-emerald-400/70 shadow-md shadow-emerald-950/40 cursor-pointer active:scale-95 flex items-center justify-center group"
                title="Download live frame directly to PC"
                aria-label="Save snapshot to PC"
              >
                <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>

              {/* Capture & Markup Button */}
              <button
                type="button"
                id="capture-annotate-snapshot-btn"
                onClick={() => captureFrame(true)}
                className="p-2 sm:px-3 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-md shadow-indigo-900/50 cursor-pointer active:scale-95 border border-indigo-400/40 hover:border-indigo-300 flex items-center justify-center group"
                title="Snap & Draw Markers"
                aria-label="Capture and markup"
              >
                <Edit3 className="w-4 h-4 text-indigo-100 group-hover:scale-110 transition-transform" />
              </button>

              {/* Direct Quick Capture Button */}
              <button
                type="button"
                id="capture-live-snapshot-btn"
                onClick={() => captureFrame(false)}
                className="p-2 sm:px-4 sm:py-2 rounded-xl transition-all shadow-lg flex items-center justify-center cursor-pointer active:scale-95 group relative bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white border border-red-400/50 shadow-red-600/40 ring-2 ring-red-500/20 hover:ring-red-400/40"
                title="Snap photo to holding tray (Spacebar / F2)"
                aria-label="Snap photo to holding tray"
              >
                <Camera className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* HONESTECH TVR STYLE VIDEO SNAPSHOTS TRAY (HOLDING AREA)          */}
      {/* ================================================================ */}
      {!isTrayCollapsed && (
        <div className="bg-slate-950/95 px-3 py-2 border-t border-slate-800/90 shrink-0">
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <div className="flex items-center space-x-2 flex-wrap gap-1">
              <div className="flex items-center space-x-1.5" title="Snapshots Tray">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <span className="px-1.5 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-500/40 text-[9px] font-bold text-indigo-300">
                {sessionCaptures.length} Photos in Tray
              </span>
              <span className="text-[9px] text-slate-400 font-medium">
                Report: <strong className={currentImageCount >= 4 ? "text-amber-400" : "text-emerald-400"}>{currentImageCount}/4</strong>
              </span>
            </div>

            {sessionCaptures.length > 0 && (
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={downloadAllSessionCaptures}
                  className="p-1 sm:px-2 sm:py-0.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 rounded-lg text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                  title={`Download all ${sessionCaptures.length} tray snapshots to PC`}
                  aria-label="Save All to PC"
                >
                  <FolderDown className="w-3 h-3 text-emerald-400" />
                  <span>Save All ({sessionCaptures.length})</span>
                </button>

                {confirmClearTray ? (
                  <div className="flex items-center space-x-1 animate-in fade-in duration-150">
                    <button
                      type="button"
                      onClick={handleClearAllTray}
                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-md active:scale-95"
                      title="Confirm clear all snapshots"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear All?</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearTray(false)}
                      className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-[9px] transition-all cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleClearAllTray}
                    className="px-2 py-0.5 bg-slate-900 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 rounded-lg text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                    title="Clear all snapshots from tray"
                    aria-label="Clear Tray"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Empty state guidance */}
          {sessionCaptures.length === 0 ? (
            <div className="py-2.5 px-3 rounded-xl border border-dashed border-slate-800/80 bg-slate-900/30 text-center flex items-center justify-center space-x-2">
              <Camera className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[10px] text-slate-400">
                Ready for snapshots — press Red Camera button, Spacebar, or F2
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-thumb-slate-700">
              {sessionCaptures.map((cap, idx) => {
                const isAlreadyInReport = cap.isAddedToReport || attachedImages.some(img => img.url === cap.base64);

                return (
                  <div 
                    key={cap.id} 
                    className={`shrink-0 w-28 sm:w-32 bg-slate-900/90 border rounded-xl overflow-hidden shadow-lg p-1.5 flex flex-col space-y-1.5 transition-all ${
                      isAlreadyInReport ? 'border-emerald-500/60 ring-1 ring-emerald-500/40' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="h-16 w-full rounded-lg overflow-hidden relative bg-black border border-slate-800 group">
                      <img 
                        src={cap.base64} 
                        alt={cap.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                      />
                      
                      <span className="absolute top-1 left-1 px-1 py-0.5 bg-slate-950/80 backdrop-blur-sm text-slate-300 text-[8px] font-bold rounded">
                        #{sessionCaptures.length - idx}
                      </span>

                      {isAlreadyInReport && (
                        <span className="absolute top-1 right-1 p-0.5 bg-emerald-600/95 backdrop-blur-sm text-white rounded-full flex items-center justify-center shadow-md" title="Attached to Report">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>

                    {/* Timestamp & Label */}
                    <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono px-0.5">
                      <span className="truncate max-w-[65px]" title={cap.title}>{cap.title}</span>
                      <span>{new Date(cap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center justify-between space-x-1 pt-0.5">
                      {/* Add to Report button */}
                      {isAlreadyInReport ? (
                        <div 
                          className="w-6 h-6 bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 rounded-lg flex items-center justify-center cursor-default"
                          title="Attached in report"
                        >
                          <Check className="w-3 h-3 text-emerald-400 stroke-[2.5]" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddToReport(cap)}
                          disabled={currentImageCount >= 4}
                          className="w-6 h-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-sm disabled:opacity-40"
                          title="Attach to Report"
                          aria-label="Add to Report"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Download button */}
                      <button
                        type="button"
                        onClick={() => downloadSnapshot(cap.base64, cap.title)}
                        className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                        title="Download to PC"
                        aria-label="Download snapshot"
                      >
                        <FileDown className="w-3 h-3" />
                      </button>

                      {/* Edit Markup button */}
                      <button
                        type="button"
                        onClick={() => openAnnotator(cap.base64, cap.title, cap.id)}
                        className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                        title="Edit / Draw markers"
                        aria-label="Markup snapshot"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveFromTray(cap.id)}
                        className="w-6 h-6 bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                        title="Remove snapshot from tray"
                        aria-label="Remove snapshot"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* CLINICAL ANNOTATION & MARKER STUDIO MODAL / OVERLAY             */}
      {/* ---------------------------------------------------------------- */}
      {editingImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
            
            {/* Modal Header */}
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                    Clinical Snapshot Annotation & Marker Studio
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Add lesion arrows, Paris polyp rings, biopsy stamps, or millimeter calipers
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingImage(null)}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
                  title="Close Studio"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Toolbar Row */}
            <div className="bg-slate-950/60 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between flex-wrap gap-3 text-xs">
              {/* Tool Selector */}
              <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTool('arrow')}
                  className={`p-2 sm:px-2.5 sm:py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                    activeTool === 'arrow' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Arrow Pointer to Lesion"
                  aria-label="Arrow tool"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="hidden sm:inline">Arrow</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('circle')}
                  className={`p-2 sm:px-2.5 sm:py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                    activeTool === 'circle' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Circle / Highlight Ring"
                  aria-label="Circle tool"
                >
                  <Circle className="w-4 h-4" />
                  <span className="hidden sm:inline">Circle</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('pen')}
                  className={`p-2 sm:px-2.5 sm:py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                    activeTool === 'pen' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Freehand Pen"
                  aria-label="Freehand tool"
                >
                  <Pencil className="w-4 h-4" />
                  <span className="hidden sm:inline">Pen</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('stamp')}
                  className={`p-2 sm:px-2.5 sm:py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                    activeTool === 'stamp' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Clinical Stamp Marker"
                  aria-label="Stamp tool"
                >
                  <Tag className="w-4 h-4" />
                  <span className="hidden sm:inline">Stamp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('caliper')}
                  className={`p-2 sm:px-2.5 sm:py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                    activeTool === 'caliper' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Measurement Caliper"
                  aria-label="Caliper tool"
                >
                  <Ruler className="w-4 h-4" />
                  <span className="hidden sm:inline">Caliper</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('text')}
                  className={`p-2 sm:px-2.5 sm:py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                    activeTool === 'text' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Text Note Callout"
                  aria-label="Text tool"
                >
                  <Type className="w-4 h-4" />
                  <span className="hidden sm:inline">Text</span>
                </button>
              </div>

              {/* Color Palette */}
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Color:</span>
                {CLINICAL_COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setActiveColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                      activeColor === c.hex ? 'border-white scale-125 shadow-lg' : 'border-transparent hover:scale-110 opacity-80 hover:opacity-100'
                    }`}
                    title={c.name}
                  />
                ))}
              </div>

              {/* Line Thickness */}
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400">Width:</span>
                {[2, 4, 6, 8].map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setLineWidth(w)}
                    className={`w-6 h-6 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                      lineWidth === w 
                        ? 'bg-indigo-600 text-white border-indigo-400' 
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>

              {/* Actions: Undo / Redo / Clear */}
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  id="annotator-undo-btn"
                  onClick={handleUndo}
                  disabled={history.length === 0 && annotations.length === 0}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed border border-slate-700/50 active:scale-95"
                  title="Undo last stroke (Ctrl+Z)"
                >
                  <Undo2 className="w-3.5 h-3.5 text-indigo-300" />
                  <span className="text-[10px] font-bold hidden sm:inline">Undo</span>
                </button>

                <button
                  type="button"
                  id="annotator-redo-btn"
                  onClick={handleRedo}
                  disabled={redoHistory.length === 0}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed border border-slate-700/50 active:scale-95"
                  title="Redo action (Ctrl+Y or Ctrl+Shift+Z)"
                >
                  <Redo2 className="w-3.5 h-3.5 text-indigo-300" />
                  <span className="text-[10px] font-bold hidden sm:inline">Redo</span>
                </button>

                <button
                  type="button"
                  id="annotator-clear-btn"
                  onClick={handleClearAll}
                  disabled={annotations.length === 0}
                  className="p-1.5 bg-slate-800 hover:bg-rose-900/60 hover:text-rose-300 disabled:opacity-30 text-slate-300 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-700/50"
                  title="Clear all drawings"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Contextual Sub-Bar for Tool-Specific Options */}
            {activeTool === 'stamp' && (
              <div className="bg-slate-950/90 px-4 py-2 border-b border-slate-800 flex items-center space-x-2 overflow-x-auto scrollbar-thin">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex-shrink-0">
                  Select Stamp:
                </span>
                {CLINICAL_STAMPS.map(stamp => (
                  <button
                    key={stamp.id}
                    type="button"
                    onClick={() => setSelectedStamp(stamp.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex-shrink-0 border cursor-pointer ${
                      selectedStamp === stamp.id
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md ring-1 ring-white/20'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {stamp.label}
                  </button>
                ))}
                <span className="text-[9px] text-slate-500 italic ml-2">Click on the image where you want to place the badge</span>
              </div>
            )}

            {activeTool === 'caliper' && (
              <div className="bg-slate-950/90 px-4 py-2 border-b border-slate-800 flex items-center space-x-2 text-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Estimated Size / Distance:</span>
                {['5 mm', '8 mm', '10 mm', '15 mm', '20 mm', '25 mm'].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCaliperDistance(d)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                      caliperDistance === d ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {d}
                  </button>
                ))}
                <input
                  type="text"
                  value={caliperDistance}
                  onChange={(e) => setCaliperDistance(e.target.value)}
                  placeholder="Custom size..."
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white outline-none w-24"
                />
                <span className="text-[9px] text-slate-500 italic">Click & drag line across the lesion</span>
              </div>
            )}

            {activeTool === 'text' && (
              <div className="bg-slate-950/90 px-4 py-2 border-b border-slate-800 flex items-center space-x-2 text-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Custom Text Callout:</span>
                <input
                  type="text"
                  value={customTextPrompt}
                  onChange={(e) => setCustomTextPrompt(e.target.value)}
                  placeholder="Type note (e.g. Active Oozing, LA Grade B)..."
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-xs text-white outline-none flex-1 max-w-md focus:border-indigo-500"
                />
                <span className="text-[9px] text-slate-500 italic">Click on image to drop note</span>
              </div>
            )}

            {/* Drawing Canvas Area */}
            <div className="flex-1 bg-black/95 flex items-center justify-center p-2 overflow-auto relative min-h-[340px]">
              <canvas
                ref={annotationCanvasRef}
                onMouseDown={handleStartDraw}
                onMouseMove={handleMoveDraw}
                onMouseUp={handleEndDraw}
                onTouchStart={handleStartDraw}
                onTouchMove={handleMoveDraw}
                onTouchEnd={handleEndDraw}
                className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-2xl cursor-crosshair border border-slate-800"
              />
            </div>

            {/* Footer Row */}
            <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase text-slate-400">Label Title:</span>
                <input
                  type="text"
                  value={editingImage.title}
                  onChange={(e) => setEditingImage({ ...editingImage, title: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-indigo-500 w-48 sm:w-64"
                  placeholder="Image title for report..."
                />
              </div>

              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingImage(null)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Cancel and close"
                >
                  <X className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">Cancel</span>
                </button>

                <button
                  type="button"
                  id="download-annotated-image-btn"
                  onClick={handleDownloadAnnotatedOnly}
                  className="p-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  title="Download annotated drawing to PC"
                  aria-label="Download to PC"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">PC</span>
                </button>

                <button
                  type="button"
                  id="save-annotated-to-tray-btn"
                  onClick={() => handleSaveAnnotatedImage(false)}
                  className="p-2 sm:px-3.5 sm:py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  title="Save annotated image to bottom tray without attaching to report"
                  aria-label="Save to Tray"
                >
                  <ImageIcon className="w-4 h-4 text-indigo-400" />
                  <span className="hidden sm:inline">Tray</span>
                </button>

                <button
                  type="button"
                  id="save-annotated-image-btn"
                  onClick={() => handleSaveAnnotatedImage(true)}
                  className="px-3.5 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer active:scale-95"
                  title="Attach to patient endoscopy report"
                  aria-label="Attach to Report"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Report</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
