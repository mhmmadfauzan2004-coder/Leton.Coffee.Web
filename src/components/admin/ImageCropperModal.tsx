import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Crop as CropIcon,
  Maximize2,
  Sparkles,
  Move,
  ArrowRight,
  Minimize2,
  RefreshCcw,
} from 'lucide-react';

interface ImageCropperModalProps {
  imageSrc: string;
  fileName?: string;
  defaultAspectRatio?: string; // '1:1' | '16:9' | '4:3' | '3:4' | 'free'
  onCropComplete: (croppedFile: File, croppedDataUrl: string) => void;
  onSkipCrop: () => void;
  onCancel: () => void;
}

type AspectRatioOption = 'free' | '1:1' | '16:9' | '4:3' | '3:4';

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  imageSrc,
  fileName = 'cropped-image.jpg',
  defaultAspectRatio = 'free',
  onCropComplete,
  onSkipCrop,
  onCancel,
}) => {
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>(() => {
    if (defaultAspectRatio === '1:1') return '1:1';
    if (defaultAspectRatio === '16:9') return '16:9';
    if (defaultAspectRatio === '4:3') return '4:3';
    if (defaultAspectRatio === '3:4') return '3:4';
    return 'free';
  });

  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pinchDist, setPinchDist] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [baseDisplaySize, setBaseDisplaySize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 320, height: 320 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Measure container dimensions on mount & resize
  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: Math.max(280, rect.width),
          height: Math.max(240, rect.height),
        });
      }
    };

    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  // Load image dimensions and calculate initial display fit
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      const nw = img.naturalWidth || 800;
      const nh = img.naturalHeight || 600;
      setNaturalSize({ width: nw, height: nh });
      setImageLoaded(true);
      setPosition({ x: 0, y: 0 });
      setScale(1);
      setRotation(0);
    };
  }, [imageSrc]);

  // Compute crop box dimensions based on container and chosen aspect ratio
  const getCropBoxDimensions = useCallback(() => {
    const containerWidth = Math.max(260, containerSize.width - (containerSize.width < 480 ? 28 : 48));
    const containerHeight = Math.max(200, containerSize.height - (containerSize.height < 480 ? 28 : 48));

    let targetRatio = 1;
    if (aspectRatio === '16:9') targetRatio = 16 / 9;
    else if (aspectRatio === '4:3') targetRatio = 4 / 3;
    else if (aspectRatio === '3:4') targetRatio = 3 / 4;
    else if (aspectRatio === '1:1') targetRatio = 1;
    else {
      // Free aspect: follow image ratio
      if (naturalSize.width > 0 && naturalSize.height > 0) {
        targetRatio = naturalSize.width / naturalSize.height;
      } else {
        targetRatio = 16 / 9;
      }
    }

    let boxWidth = containerWidth;
    let boxHeight = boxWidth / targetRatio;

    if (boxHeight > containerHeight) {
      boxHeight = containerHeight;
      boxWidth = boxHeight * targetRatio;
    }

    boxWidth = Math.max(140, Math.min(boxWidth, containerWidth));
    boxHeight = Math.max(100, Math.min(boxHeight, containerHeight));

    return { width: Math.round(boxWidth), height: Math.round(boxHeight), ratio: targetRatio };
  }, [aspectRatio, naturalSize, containerSize]);

  // Compute base image rendered dimensions so 100% of image fits inside crop box initially
  useEffect(() => {
    if (!naturalSize.width || !naturalSize.height) return;
    const cropBox = getCropBoxDimensions();

    const imgRatio = naturalSize.width / naturalSize.height;
    const boxRatio = cropBox.width / cropBox.height;

    let baseW = cropBox.width;
    let baseH = cropBox.height;

    // Fill crop box completely by default (cover mode at scale 1)
    if (imgRatio > boxRatio) {
      // Wider image: match height, expand width
      baseH = cropBox.height;
      baseW = baseH * imgRatio;
    } else {
      // Taller image: match width, expand height
      baseW = cropBox.width;
      baseH = baseW / imgRatio;
    }

    setBaseDisplaySize({ width: Math.round(baseW), height: Math.round(baseH) });
  }, [naturalSize, getCropBoxDimensions]);

  // Fit to screen helper: fit entire image (contain) vs fill crop box (cover)
  const handleFitMode = (mode: 'contain' | 'cover') => {
    if (!naturalSize.width || !naturalSize.height) return;
    const cropBox = getCropBoxDimensions();
    const imgRatio = naturalSize.width / naturalSize.height;
    const boxRatio = cropBox.width / cropBox.height;

    setPosition({ x: 0, y: 0 });
    setRotation(0);

    if (mode === 'contain') {
      if (imgRatio > boxRatio) {
        setScale(cropBox.width / (baseDisplaySize.width || cropBox.width));
      } else {
        setScale(cropBox.height / (baseDisplaySize.height || cropBox.height));
      }
    } else {
      setScale(1);
    }
  };

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Handlers with 2-finger pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setPinchDist(null);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setPinchDist(dist);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    } else if (e.touches.length === 2 && pinchDist !== null) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = (currentDist - pinchDist) / 200;
      setScale((prev) => Math.max(0.4, Math.min(3.5, prev + delta)));
      setPinchDist(currentDist);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setPinchDist(null);
  };

  // Perform crisp high-res crop on HTML5 Canvas
  const handleCropAndSave = async () => {
    if (!naturalSize.width || !naturalSize.height) return;
    setIsProcessing(true);

    try {
      const cropBox = getCropBoxDimensions();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      // Output resolution: high quality up to 1600px width
      const maxDimension = 1600;
      let outWidth = cropBox.width;
      let outHeight = cropBox.height;

      const scaleMultiplier = Math.min(maxDimension / outWidth, maxDimension / outHeight, 2.5);
      outWidth = Math.round(outWidth * scaleMultiplier);
      outHeight = Math.round(outHeight * scaleMultiplier);

      canvas.width = outWidth;
      canvas.height = outHeight;

      // Dark background fill
      ctx.fillStyle = '#050B14';
      ctx.fillRect(0, 0, outWidth, outHeight);

      ctx.save();
      // Center canvas origin
      ctx.translate(outWidth / 2, outHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // Current on-screen base image dimensions scaled by zoom
      const currentW = (baseDisplaySize.width || cropBox.width) * scale;
      const currentH = (baseDisplaySize.height || cropBox.height) * scale;

      // Map on-screen offsets to output canvas resolution
      const ratio = outWidth / cropBox.width;
      const drawWidth = currentW * ratio;
      const drawHeight = currentH * ratio;
      const drawX = position.x * ratio - drawWidth / 2;
      const drawY = position.y * ratio - drawHeight / 2;

      const sourceImage = new Image();
      sourceImage.crossOrigin = 'anonymous';
      sourceImage.src = imageSrc;

      await new Promise((resolve) => {
        if (sourceImage.complete) resolve(true);
        else sourceImage.onload = () => resolve(true);
      });

      ctx.drawImage(sourceImage, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();

      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const cleanName = fileName.replace(/\.[^/.]+$/, '') + '-cropped.jpg';
            const croppedFile = new File([blob], cleanName, { type: 'image/jpeg' });
            onCropComplete(croppedFile, dataUrl);
          } else {
            onSkipCrop();
          }
          setIsProcessing(false);
        },
        'image/jpeg',
        0.88
      );
    } catch (err) {
      console.error('Cropping error:', err);
      setIsProcessing(false);
      onSkipCrop();
    }
  };

  const cropBox = getCropBoxDimensions();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/90 backdrop-blur-md animate-fade-in touch-none">
      <div className="relative w-full max-w-2xl sm:max-w-3xl rounded-2xl sm:rounded-3xl bg-slate-950 border border-cyan-500/40 shadow-2xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-500/20 text-[#00E5FF] border border-cyan-500/30 shrink-0">
              <CropIcon className="w-4 h-4 sm:w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="font-display font-black text-white text-sm sm:text-base tracking-tight uppercase truncate">
                POTONG & SESUAIKAN FOTO
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                Geser, perbesar, putar, atau pilih rasio sesuai kebutuhan tampilan website.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aspect Ratio Presets Bar */}
        <div className="px-3 py-2 sm:px-6 sm:py-2.5 bg-slate-900/50 border-b border-slate-800/80 flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none shrink-0">
          <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-400 uppercase mr-1 flex items-center gap-1 shrink-0">
            <Maximize2 className="w-3 h-3 text-[#00E5FF]" /> Rasio:
          </span>

          {(
            [
              { key: 'free', label: 'Bebas / Asli' },
              { key: '1:1', label: '1:1 Persegi' },
              { key: '16:9', label: '16:9 Landscape' },
              { key: '4:3', label: '4:3 Standard' },
              { key: '3:4', label: '3:4 Portrait' },
            ] as { key: AspectRatioOption; label: string }[]
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setAspectRatio(item.key);
                setPosition({ x: 0, y: 0 });
                setScale(1);
              }}
              className={`px-2.5 py-1 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl text-[11px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
                aspectRatio === item.key
                  ? 'bg-[#00E5FF] text-black shadow-md shadow-[#00E5FF]/20'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Interactive Cropper Canvas Workspace */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative flex-1 min-h-[260px] h-[36vh] sm:h-[42vh] max-h-[460px] bg-[#050B14] overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
        >
          {/* Background Grid Pattern */}
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#00E5FF_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          {/* Draggable Image Element with Base Fit Dimensions */}
          {imageLoaded && baseDisplaySize.width > 0 ? (
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop Target"
              crossOrigin="anonymous"
              draggable={false}
              style={{
                width: `${baseDisplaySize.width}px`,
                height: `${baseDisplaySize.height}px`,
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.08s ease-out',
                maxWidth: 'none',
                maxHeight: 'none',
                userSelect: 'none',
                touchAction: 'none',
              }}
              className="pointer-events-none select-none max-w-none shadow-2xl object-cover"
            />
          ) : (
            <div className="text-cyan-400 flex items-center gap-2 font-mono text-xs">
              <Sparkles className="w-4 h-4 animate-spin" /> Menyiapkan area foto...
            </div>
          )}

          {/* Crop Mask Overlay with Cutout */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Dark Mask Around Crop Box */}
            <div
              style={{
                width: `${cropBox.width}px`,
                height: `${cropBox.height}px`,
                boxShadow: '0 0 0 9999px rgba(3, 7, 18, 0.82)',
              }}
              className="relative border-2 border-[#00E5FF] rounded-lg transition-all duration-150"
            >
              {/* Rule of Thirds Grid Lines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                <div className="border-r border-b border-cyan-300/40" />
                <div className="border-r border-b border-cyan-300/40" />
                <div className="border-b border-cyan-300/40" />
                <div className="border-r border-b border-cyan-300/40" />
                <div className="border-r border-b border-cyan-300/40" />
                <div className="border-b border-cyan-300/40" />
                <div className="border-r border-cyan-300/40" />
                <div className="border-r border-cyan-300/40" />
                <div />
              </div>

              {/* Corner Indicators */}
              <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-white" />
              <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-white" />
              <div className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-white" />
              <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-white" />

              {/* Center Drag Badge on Hover/Tap */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <span className="px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-xs border border-cyan-500/40 text-[10px] font-mono text-cyan-300 flex items-center gap-1.5">
                  <Move className="w-3 h-3" /> Geser & Posisikan
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Adjustments Toolbar (Zoom Slider + Rotate + Quick Fit) */}
        <div className="px-3 py-2.5 sm:px-6 sm:py-3 bg-slate-900/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Zoom Control */}
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-1 max-w-sm">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.4, Number((s - 0.15).toFixed(2))))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer shrink-0"
              title="Perkecil"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <input
              type="range"
              min="0.4"
              max="3"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full accent-[#00E5FF] h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />

            <button
              type="button"
              onClick={() => setScale((s) => Math.min(3, Number((s + 0.15).toFixed(2))))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer shrink-0"
              title="Perbesar"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <span className="text-[10px] sm:text-[11px] font-mono text-cyan-400 w-11 text-right shrink-0">
              {Math.round(scale * 100)}%
            </span>
          </div>

          {/* Quick Fit & Rotate Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-between sm:justify-end overflow-x-auto">
            <button
              type="button"
              onClick={() => handleFitMode('contain')}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              title="Tampilkan foto penuh"
            >
              <Minimize2 className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Muat Penuh</span>
            </button>

            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            >
              <RotateCw className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Putar 90°</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPosition({ x: 0, y: 0 });
                setScale(1);
                setRotation(0);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[11px] font-mono cursor-pointer transition-colors shrink-0 flex items-center gap-1"
            >
              <RefreshCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="px-3 py-3 sm:px-6 sm:py-4 bg-slate-950 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onSkipCrop}
            className="w-full sm:w-auto px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-[11px] sm:text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <span>Gunakan Foto Asli</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 sm:flex-none px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] sm:text-xs font-mono cursor-pointer transition-colors"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleCropAndSave}
              disabled={isProcessing}
              className="flex-1 sm:flex-none px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#3bf0ff] text-slate-950 font-display font-black text-[11px] sm:text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-[#00E5FF]/20 cursor-pointer disabled:opacity-50 transition-all"
            >
              {isProcessing ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Memotong...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Potong & Simpan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
