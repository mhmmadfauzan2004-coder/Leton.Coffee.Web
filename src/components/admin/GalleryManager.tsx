import React, { useState, useRef } from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { optimizeImageFile } from '../../utils/storage';
import { ImageCropperModal } from './ImageCropperModal';
import {
  Upload,
  Link as LinkIcon,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  Check,
  RotateCcw,
} from 'lucide-react';

interface GalleryManagerProps {
  label: string;
  images: string[];
  onChange: (updatedImages: string[]) => void;
  description?: string;
  maxImages?: number;
}

export const GalleryManager: React.FC<GalleryManagerProps> = ({
  label,
  images = [],
  onChange,
  description = 'Kelola daftar foto gallery horizontal. Anda dapat mengunggah foto baru, mengatur urutan posisi, atau menghapus foto.',
  maxImages = 12,
}) => {
  const { uploadImage, showToast } = useContent();
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // Cropper states
  const [cropperSource, setCropperSource] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [cropForReplaceIndex, setCropForReplaceIndex] = useState<number | null>(null);

  const processAndUploadFile = async (fileToUpload: File, fallbackDataUrl?: string, targetIndex?: number | null) => {
    setIsUploading(true);
    try {
      let finalUrl = '';
      // 1. Direct upload to server storage / Supabase
      const serverUrl = await uploadImage(fileToUpload);
      if (serverUrl) {
        finalUrl = serverUrl;
      } else {
        // Fallback: compress to high-quality Base64
        const fallbackData = fallbackDataUrl || (await optimizeImageFile(fileToUpload, 1200, 0.75));
        if (fallbackData) {
          finalUrl = fallbackData;
        }
      }

      if (finalUrl) {
        if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < images.length) {
          // Replace existing photo at index
          const next = [...images];
          next[targetIndex] = finalUrl;
          onChange(next);
          showToast(`Foto posisi ${targetIndex + 1} berhasil diganti!`, 'success');
        } else {
          // Add as new photo to gallery
          onChange([...images, finalUrl]);
          showToast('Foto baru berhasil ditambahkan ke galeri!', 'success');
        }
      }
    } catch (err) {
      console.error('Gallery file upload error:', err);
      showToast('Gagal memproses foto galeri.', 'error');
    } finally {
      setIsUploading(false);
      setCropperSource(null);
      setOriginalFile(null);
      setCropForReplaceIndex(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
    }
  };

  const handleAddNewFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (images.length >= maxImages) {
      showToast(`Maksimal ${maxImages} foto per galeri.`, 'warning');
      return;
    }

    setCropForReplaceIndex(null);
    setOriginalFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result && typeof reader.result === 'string') {
        setCropperSource(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReplaceFile = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCropForReplaceIndex(index);
    setOriginalFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result && typeof reader.result === 'string') {
        setCropperSource(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedFile: File, croppedDataUrl: string) => {
    processAndUploadFile(croppedFile, croppedDataUrl, cropForReplaceIndex);
  };

  const handleSkipCrop = () => {
    if (originalFile) {
      processAndUploadFile(originalFile, undefined, cropForReplaceIndex);
    } else {
      setCropperSource(null);
    }
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    if (images.length >= maxImages) {
      showToast(`Maksimal ${maxImages} foto per galeri.`, 'warning');
      return;
    }
    onChange([...images, urlInput.trim()]);
    setUrlInput('');
    showToast('Foto URL berhasil ditambahkan ke galeri!', 'success');
  };

  const handleRemove = (index: number) => {
    const next = images.filter((_, i) => i !== index);
    onChange(next);
    showToast('Foto berhasil dihapus dari galeri.', 'info');
  };

  const handleMoveLeft = (index: number) => {
    if (index <= 0) return;
    const next = [...images];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    onChange(next);
  };

  const handleMoveRight = (index: number) => {
    if (index >= images.length - 1) return;
    const next = [...images];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {/* Cropper Modal */}
      {cropperSource && (
        <ImageCropperModal
          imageSrc={cropperSource}
          fileName={originalFile?.name || 'gallery-image.jpg'}
          defaultAspectRatio="16:9"
          onCropComplete={handleCropComplete}
          onSkipCrop={handleSkipCrop}
          onCancel={() => {
            setCropperSource(null);
            setOriginalFile(null);
            setCropForReplaceIndex(null);
          }}
        />
      )}

      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00E5FF]" />
            <label className="text-xs font-mono font-bold tracking-wider text-white uppercase">
              {label}
            </label>
          </div>
          {description && (
            <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[10px] font-mono text-slate-400">
            {images.length} / {maxImages} Foto
          </span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${
                mode === 'upload'
                  ? 'bg-[#00E5FF] text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3 h-3" />
              <span>Upload File</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('url')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${
                mode === 'url'
                  ? 'bg-[#00E5FF] text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LinkIcon className="w-3 h-3" />
              <span>Link URL</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add New Photo Input Area */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
        {mode === 'upload' ? (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAddNewFile}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              disabled={isUploading || images.length >= maxImages}
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 border-2 border-dashed border-slate-800 hover:border-[#00E5FF]/60 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <div className="flex items-center gap-2 text-xs font-mono text-[#00E5FF]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengunggah & memproses foto...</span>
                </div>
              ) : (
                <>
                  <div className="p-2 rounded-lg bg-[#00E5FF]/10 text-[#00E5FF]">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-200">
                    + Tambah Foto Baru ke Galeri
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Klik untuk memilih file foto (JPG, PNG, WebP)
                  </span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://images.unsplash.com/... atau URL foto lainnya"
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-[#00E5FF]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddUrl();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddUrl}
              disabled={!urlInput.trim() || images.length >= maxImages}
              className="px-5 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#3cf0ff] text-slate-950 font-display font-bold text-xs uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-[#00E5FF]/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah</span>
            </button>
          </div>
        )}
      </div>

      {/* Hidden File Input for Replacing Individual Images */}
      <input
        type="file"
        ref={replaceFileInputRef}
        onChange={(e) => {
          if (replaceIndex !== null) {
            handleReplaceFile(e, replaceIndex);
          }
        }}
        accept="image/*"
        className="hidden"
      />

      {/* Gallery Grid of Existing Photos */}
      {images.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 pt-1">
          {images.map((imgUrl, idx) => {
            const resolved = resolveMediaUrl(imgUrl);
            const isFirst = idx === 0;
            const isLast = idx === images.length - 1;

            return (
              <div
                key={idx}
                className="group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-2.5 space-y-2"
              >
                {/* Photo Thumbnail */}
                <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-slate-900 border border-slate-800/80">
                  <img
                    src={resolved}
                    alt={`Galeri foto ${idx + 1}`}
                    className="w-full h-full object-cover object-center"
                    loading="lazy"
                  />

                  {/* Position Badge 01, 02, etc */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-mono font-bold text-[#00E5FF] border border-white/10">
                    #{String(idx + 1).padStart(2, '0')}
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    title="Hapus foto ini"
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-black/80 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors cursor-pointer border border-white/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Control Action Buttons (Move Left/Right, Replace) */}
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveLeft(idx)}
                      title="Pindah ke kiri (urutan sebelumnya)"
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-900 cursor-pointer text-xs"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveRight(idx)}
                      title="Pindah ke kanan (urutan selanjutnya)"
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-900 cursor-pointer text-xs"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setReplaceIndex(idx);
                      replaceFileInputRef.current?.click();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-[#00E5FF]/20 text-slate-300 hover:text-[#00E5FF] text-[10px] font-mono border border-slate-800 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Ganti Foto</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 rounded-xl bg-slate-950 border border-slate-800 text-center">
          <ImageIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs font-mono text-slate-400">
            Belum ada foto galeri untuk section ini.
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Gunakan tombol di atas untuk menambahkan foto pertama.
          </p>
        </div>
      )}
    </div>
  );
};
