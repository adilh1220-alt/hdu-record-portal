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
  FileDown
} from 'lucide-react';

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
  patientName = ''
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

  // Local history of session snapshots to allow drawing on them
  const [sessionCaptures, setSessionCaptures] = useState<{ id: string; base64: string; title: string; timestamp: Date }[]>([]);

  // Annotator Modal State
  const [editingImage, setEditingImage] = useState<{ base64: string; title: string } | null>(null);
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

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
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
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError("Camera permission denied. Please allow browser camera access.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError("No video capture device or camera detected.");
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError("Capture device is in use by another application (e.g. Image Tag or OBS).");
      } else {
        setCameraError(`Camera error: ${err.message || String(err)}`);
      }
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

  // Grab Current Raw Frame from Video
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

    ctx.drawImage(video, 0, 0, width, height);
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

  // Capture Frame handler
  const captureFrame = (openMarkup: boolean = false) => {
    if (!isStreaming) return;
    if (maxImagesReached && !openMarkup) {
      alert("Maximum 4 clinical images already attached to this report. Remove an image to attach more.");
      return;
    }

    const base64 = getRawFrameBase64();
    if (!base64) return;

    // Visual flash
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 200);

    const titleToUse = quickLabel.trim() || `Endoscope Capture ${currentImageCount + 1}`;
    
    // Auto-save to PC Downloads if enabled
    if (autoDownloadToPC) {
      triggerLocalFileDownload(base64, getSnapshotFilename(titleToUse));
    }

    // Add to local session captures list
    const newCapture = {
      id: `cap_${Date.now()}`,
      base64,
      title: titleToUse,
      timestamp: new Date()
    };
    setSessionCaptures(prev => [newCapture, ...prev].slice(0, 10));

    if (openMarkup || autoAnnotate) {
      // Open annotation mode directly
      openAnnotator(base64, titleToUse);
    } else {
      setCapturedFeedback(autoDownloadToPC ? `Captured & Saved to PC: ${titleToUse}` : `Captured: ${titleToUse}`);
      setTimeout(() => setCapturedFeedback(null), 2500);
      onCapture(base64, titleToUse);
    }
  };

  // Open Annotation Studio for an Image
  const openAnnotator = (base64: string, title: string) => {
    setEditingImage({ base64, title });
    setAnnotations([]);
    setHistory([]);
    setRedoHistory([]);
    setActiveTool('arrow');
  };

  // Keyboard shortcut listener (Spacebar or F2 to capture when streaming)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in annotator or typing in inputs
      if (editingImage) return;

      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if ((e.code === 'Space' || e.key === 'F2') && isStreaming) {
        e.preventDefault();
        captureFrame(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, maxImagesReached, quickLabel, currentImageCount, isMirrored, editingImage, autoAnnotate]);

  useEffect(() => {
    refreshDevices();
    return () => {
      stopCamera();
    };
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
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

  const handleSaveAnnotatedImage = () => {
    const canvas = annotationCanvasRef.current;
    if (!canvas || !editingImage) return;

    const finalBase64 = canvas.toDataURL('image/jpeg', 0.94);

    if (autoDownloadToPC) {
      triggerLocalFileDownload(finalBase64, getSnapshotFilename(editingImage.title || 'Marked_Snapshot'));
    }

    if (maxImagesReached) {
      alert("Maximum 4 clinical images already attached. Please remove an image from the report first.");
      return;
    }

    onCapture(finalBase64, editingImage.title || 'Marked Endoscopy Image');

    setCapturedFeedback(autoDownloadToPC ? `Saved to PC & Attached: ${editingImage.title}` : `Attached Annotated: ${editingImage.title}`);
    setTimeout(() => setCapturedFeedback(null), 2500);

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
      className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl text-white flex flex-col transition-all relative"
    >
      {/* Header Bar */}
      <div className="bg-slate-950/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
          <span className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-indigo-400" />
            Live Endoscopy Feed
          </span>
          {isStreaming && (
            <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
              60 FPS HD LIVE
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5">
          {devices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={handleDeviceChange}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer max-w-[140px] truncate"
              title="Select Video Capture Source"
            >
              {devices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Camera Source ${i + 1}`}
                </option>
              ))}
            </select>
          )}

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

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Live Feed"}
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

      {/* Video Stream Stage */}
      <div className="relative bg-black flex items-center justify-center min-h-[220px] max-h-[380px] overflow-hidden aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-contain ${isMirrored ? 'scale-x-[-1]' : ''} ${!isStreaming ? 'hidden' : ''}`}
        />

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

        {/* Offline / Connect Prompt */}
        {!isStreaming && (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-3 z-10">
            <button
              type="button"
              id="camera-center-launch-btn"
              onClick={() => startCamera(selectedDeviceId)}
              className="w-16 h-16 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/50 hover:border-indigo-400 text-indigo-400 hover:text-indigo-300 flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-indigo-950/50 group active:scale-95"
              title="Click to Open Live Camera Feed"
              aria-label="Click to Open Live Camera Feed"
            >
              <Camera className="w-8 h-8 group-hover:scale-110 text-indigo-400 transition-transform duration-200" />
            </button>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-200">Endoscope Video Stream Offline</p>
              <p className="text-[11px] text-slate-400 max-w-sm mt-1">
                Connect your Olympus / Pentax HDMI capture card or webcam and click the camera icon to start live feed.
              </p>
            </div>

            {cameraError && (
              <div className="bg-rose-950/60 border border-rose-500/40 text-rose-300 px-3 py-2 rounded-xl text-[10px] font-bold max-w-sm flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{cameraError}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Snapshot Control Bar (Visible when streaming) */}
      {isStreaming && (
        <div className="bg-slate-950 p-3 border-t border-slate-800 flex flex-col space-y-2.5">
          {/* Quick Anatomical Label selector */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 flex-shrink-0">
              <Layers className="w-3 h-3 text-indigo-400" />
              Quick Tag:
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
                className="text-[8px] text-rose-400 hover:text-rose-300 font-bold px-1.5 py-0.5 rounded cursor-pointer"
              >
                Clear Tag
              </button>
            )}
          </div>

          {/* Capture Trigger Buttons */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center space-x-3 text-[10px] font-bold text-slate-400">
              <label className="flex items-center space-x-1.5 cursor-pointer select-none text-[10px] text-slate-300 hover:text-white" title="Automatically launch drawing/marker studio after capturing">
                <input 
                  type="checkbox" 
                  checked={autoAnnotate} 
                  onChange={(e) => setAutoAnnotate(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Auto-Open Markup</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer select-none text-[10px] text-emerald-300 hover:text-emerald-200" title="Automatically download snapshot to your PC's Downloads folder without relying on cloud storage">
                <input 
                  type="checkbox" 
                  checked={autoDownloadToPC} 
                  onChange={(e) => toggleAutoDownload(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-emerald-400" />
                  Auto-Save to PC
                </span>
              </label>
            </div>

            <div className="flex items-center space-x-2.5">
              {/* Direct Download Snapshot to PC Button */}
              <button
                type="button"
                id="download-live-snapshot-btn"
                onClick={downloadCurrentLiveFrame}
                className="p-2.5 sm:px-3.5 sm:py-2.5 bg-slate-800/95 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 rounded-xl transition-all border border-emerald-500/40 hover:border-emerald-400/70 shadow-md shadow-emerald-950/40 cursor-pointer active:scale-95 flex items-center justify-center group"
                title="Download live snapshot to PC (Downloads folder)"
                aria-label="Save snapshot to PC"
              >
                <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>

              {/* Capture & Markup Button */}
              <button
                type="button"
                id="capture-annotate-snapshot-btn"
                onClick={() => captureFrame(true)}
                className="p-2.5 sm:px-3.5 sm:py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-md shadow-indigo-900/50 cursor-pointer active:scale-95 border border-indigo-400/40 hover:border-indigo-300 flex items-center justify-center group"
                title="Snap & Draw / Add Marker Annotations"
                aria-label="Capture and markup"
              >
                <Edit3 className="w-5 h-5 text-indigo-100 group-hover:scale-110 transition-transform" />
              </button>

              {/* Direct Quick Capture Button */}
              <button
                type="button"
                id="capture-live-snapshot-btn"
                onClick={() => captureFrame(false)}
                disabled={maxImagesReached}
                className={`p-2.5 sm:px-4 sm:py-2.5 rounded-xl transition-all shadow-lg flex items-center justify-center cursor-pointer active:scale-95 group relative ${
                  maxImagesReached
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white border border-red-400/50 shadow-red-600/40 ring-2 ring-red-500/20 hover:ring-red-400/40'
                }`}
                title={maxImagesReached ? 'Maximum 4 images already captured' : 'Instant Grab Snapshot (Spacebar / F2)'}
                aria-label="Instant Grab Snapshot"
              >
                <Camera className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Recent Snapshots Carousel with Markup Launcher */}
      {sessionCaptures.length > 0 && (
        <div className="bg-slate-950/90 px-3 py-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center space-x-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                Session Snapshots ({sessionCaptures.length})
              </span>
              <span className="text-[8px] text-slate-500 font-bold hidden sm:inline">Click icons to draw or download to PC</span>
            </div>

            <button
              type="button"
              onClick={downloadAllSessionCaptures}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
              title="Download all session snapshots to PC"
            >
              <FolderDown className="w-3 h-3 text-emerald-400" />
              Download All ({sessionCaptures.length})
            </button>
          </div>
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
            {sessionCaptures.map((cap) => (
              <div 
                key={cap.id} 
                className="relative group rounded-lg overflow-hidden border border-slate-700 bg-slate-900 flex-shrink-0 w-20 h-14"
              >
                <img src={cap.base64} alt={cap.title} className="w-full h-full object-cover" />
                
                {/* Hover overlay with Annotate / Download / Re-attach options */}
                <div className="absolute inset-0 bg-slate-950/85 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1">
                  <button
                    type="button"
                    onClick={() => downloadSnapshot(cap.base64, cap.title)}
                    className="p-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded text-[8px] font-bold shadow transition-all border border-emerald-500/40 cursor-pointer"
                    title="Download snapshot to PC"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openAnnotator(cap.base64, cap.title)}
                    className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[8px] font-bold shadow transition-all cursor-pointer"
                    title="Draw markers on this image"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onCapture(cap.base64, cap.title)}
                    disabled={maxImagesReached}
                    className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[8px] font-bold shadow transition-all disabled:opacity-50 cursor-pointer"
                    title="Attach directly to report"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
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
                  className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                    activeTool === 'arrow' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Arrow Pointer to Lesion"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Arrow</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('circle')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                    activeTool === 'circle' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Circle / Lesion Highlight Ring"
                >
                  <Circle className="w-3.5 h-3.5" />
                  <span>Circle</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('pen')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                    activeTool === 'pen' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Freehand Pen"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Freehand</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('stamp')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                    activeTool === 'stamp' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Clinical Stamp Marker"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Stamp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('caliper')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                    activeTool === 'caliper' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Measurement Caliper"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>Caliper</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('text')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                    activeTool === 'text' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Text Note Callout"
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>Text</span>
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

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingImage(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  id="download-annotated-image-btn"
                  onClick={handleDownloadAnnotatedOnly}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
                  title="Download annotated drawing directly to PC storage"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download to PC</span>
                </button>

                <button
                  type="button"
                  id="save-annotated-image-btn"
                  onClick={handleSaveAnnotatedImage}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Attach to Report</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
