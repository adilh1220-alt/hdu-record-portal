import React, { useState, useRef, useEffect } from 'react';

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageTitle: string;
  onCropSave: (croppedBase64: string) => void;
}

const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imageTitle,
  onCropSave
}) => {
  const [zoom, setZoom] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);

  const dragStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Load image
  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    setImageLoading(true);
    setImageError(null);

    const img = new Image();
    if (!imageUrl.startsWith('data:')) {
      img.crossOrigin = 'Anonymous';
    }
    img.onload = () => {
      imageRef.current = img;
      setImageLoading(false);
      // Reset state for new image
      setZoom(1.0);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      // Small timeout to ensure DOM/canvas is ready to draw
      setTimeout(() => {
        draw();
      }, 50);
    };
    img.onerror = (err) => {
      console.error("Error loading image for cropper:", err);
      setImageError("Failed to load image. The file format may be unsupported or corrupted.");
      setImageLoading(false);
    };
    img.src = imageUrl;
  }, [isOpen, imageUrl]);

  // Redraw when parameters change
  useEffect(() => {
    draw();
  }, [zoom, rotation, pan, showGrid, isOpen]);

  const draw = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#1e293b'; // Slate 800 background
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Save state
    ctx.save();

    // Determine initial fitting scale
    // We want the image to fully cover the 4:3 viewport
    // Taking rotation into account
    const isRotated90 = rotation === 90 || rotation === 270;
    const srcWidth = isRotated90 ? img.height : img.width;
    const srcHeight = isRotated90 ? img.width : img.height;

    const scaleX = canvasWidth / srcWidth;
    const scaleY = canvasHeight / srcHeight;
    const baseScale = Math.max(scaleX, scaleY);

    const finalScale = baseScale * zoom;

    // Move center to canvas center + pan offset
    ctx.translate(canvasWidth / 2 + pan.x, canvasHeight / 2 + pan.y);

    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);

    // Apply scale
    ctx.scale(finalScale, finalScale);

    // Draw image centered at the translated coordinate
    ctx.drawImage(
      img,
      -img.width / 2,
      -img.height / 2,
      img.width,
      img.height
    );

    ctx.restore();

    // Draw crop boundaries guide (subtle inner border)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(2, 2, canvasWidth - 4, canvasHeight - 4);

    // Draw Endoscopy Rule of Thirds grid overlay if checked
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(canvasWidth / 3, 0);
      ctx.lineTo(canvasWidth / 3, canvasHeight);
      ctx.moveTo((canvasWidth * 2) / 3, 0);
      ctx.lineTo((canvasWidth * 2) / 3, canvasHeight);
      
      // Horizontal lines
      ctx.moveTo(0, canvasHeight / 3);
      ctx.lineTo(canvasWidth, canvasHeight / 3);
      ctx.moveTo(0, (canvasHeight * 2) / 3);
      ctx.lineTo(canvasWidth, (canvasHeight * 2) / 3);
      ctx.stroke();

      // Draw active capture circle/reticle in center to assist alignment
      ctx.beginPath();
      ctx.arc(canvasWidth / 2, canvasHeight / 2, 8, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.stroke();
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStart.current.x,
      y: touch.clientY - dragStart.current.y
    });
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Generate output at high quality 800x600 (perfect 4:3 aspect ratio)
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = 800;
    outputCanvas.height = 600;
    const outputCtx = outputCanvas.getContext('2d');
    const img = imageRef.current;

    if (outputCtx && img) {
      outputCtx.fillStyle = '#ffffff';
      outputCtx.fillRect(0, 0, 800, 600);

      outputCtx.save();

      // Map scale ratios from editor view to output scale
      const viewScaleX = 800 / canvas.width;
      const viewScaleY = 600 / canvas.height;

      // Fit scale calculation for output resolution
      const isRotated90 = rotation === 90 || rotation === 270;
      const srcWidth = isRotated90 ? img.height : img.width;
      const srcHeight = isRotated90 ? img.width : img.height;

      const baseScale = Math.max(800 / srcWidth, 600 / srcHeight);
      const finalScale = baseScale * zoom;

      // Center + pan offset scaled up
      outputCtx.translate(400 + pan.x * viewScaleX, 300 + pan.y * viewScaleY);
      outputCtx.rotate((rotation * Math.PI) / 180);
      outputCtx.scale(finalScale, finalScale);

      outputCtx.drawImage(
        img,
        -img.width / 2,
        -img.height / 2,
        img.width,
        img.height
      );

      outputCtx.restore();

      const croppedDataUrl = outputCanvas.toDataURL('image/jpeg', 0.85);
      onCropSave(croppedDataUrl);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 transform transition-all animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Crop Clinical Image
            </h3>
            <p className="text-[10px] font-semibold text-slate-400 truncate max-w-xs mt-0.5">
              {imageTitle || 'clinical_photo.jpg'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 flex flex-col items-center">
          
          {/* Crop Canvas Wrapper */}
          <div className="relative bg-slate-900 p-1.5 rounded-2xl shadow-inner border border-slate-700/50 w-[412px] h-[312px] flex items-center justify-center overflow-hidden">
            {imageLoading && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center space-y-2 z-10 text-white">
                <svg className="animate-spin h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Loading image...</p>
              </div>
            )}

            {imageError && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center p-4 text-center space-y-2 z-10 text-white">
                <svg className="h-8 w-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Error</p>
                <p className="text-[9px] text-slate-300 max-w-xs">{imageError}</p>
              </div>
            )}

            <canvas
              ref={canvasRef}
              width={400}
              height={300}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUpOrLeave}
              className="rounded-xl cursor-move touch-none block"
              title="Drag image to reposition"
            />
            
            {/* Aspect Ratio Constraint Tag */}
            <div className="absolute top-4 left-4 bg-slate-950/75 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase shadow">
              4:3 Aspect Grid
            </div>

            {/* Instruction tooltip */}
            <div className="absolute bottom-4 right-4 bg-slate-950/70 backdrop-blur-sm text-slate-200 px-2 py-0.5 rounded text-[8px] font-semibold">
              ↔ Drag to Reposition
            </div>
          </div>

          {/* Controls Panel */}
          <div className="w-full mt-6 space-y-4">
            
            {/* Zoom Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Image Zoom</span>
                <span className="text-[10px] font-bold text-indigo-600">{Math.round(zoom * 100)}%</span>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setZoom(z => Math.max(1.0, z - 0.1))}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Zoom Out"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                </button>
                <input
                  type="range"
                  min="1.0"
                  max="4.0"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <button 
                  onClick={() => setZoom(z => Math.min(4.0, z + 0.1))}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Zoom In"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Utility buttons */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleRotate}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                title="Rotate 90 degrees clockwise"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
                </svg>
                <span>Rotate 90°</span>
              </button>

              {/* Grid Toggle */}
              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  showGrid ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                title="Toggle grid lines"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>Grid Guides</span>
              </button>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 cursor-pointer"
          >
            Apply & Crop
          </button>
        </div>

      </div>
    </div>
  );
};

export default ImageCropperModal;
