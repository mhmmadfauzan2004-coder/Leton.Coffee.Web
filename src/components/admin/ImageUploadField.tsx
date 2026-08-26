import React, { useState, useRef } from 'react';
import { useContent } from '../../context/ContentContext';
import { optimizeImageFile } from '../../utils/storage';
import { resolveMediaUrl } from '../../utils/api';
import { Upload, Link as LinkIcon, Image as ImageIcon, X, Loader2, Check, Sparkles } from 'lucide-react';

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  description?: string;
  aspectRatio?: string;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label,
  value,
  onChange,
  description,
}) => {
  const { uploadImage, showToast } = useContent();
  const [isUploading, setIsUploading] = useState(false);
  const [tempPreview, setTempPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState(value || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Fast temporary preview
    const localBlobUrl = URL.createObjectURL(file);
    setTempPreview(localBlobUrl);
    setIsUploading(true);

    try {
      // Direct upload to server storage
      const serverUrl = await uploadImage(file);
      if (serverUrl) {
        onChange(serverUrl);
        setUrlInput(serverUrl);
        setTempPreview(null);
      } else {
        // Fallback: If network/auth fails, try compressed data
        const fallbackData = await optimizeImageFile(file, 1200, 0.75);
        if (fallbackData) {
          onChange(fallbackData);
          setUrlInput(fallbackData);
        }
      }
    } catch (err) {
      console.error('File upload error:', err);
      showToast('Gagal mengunggah foto ke server. Silakan coba lagi.', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyUrl = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setTempPreview(null);
    }
  };

  const handleRemove = () => {
    onChange('');
    setUrlInput('');
    setTempPreview(null);
  };

  const displayImage = tempPreview || value;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label className="text-xs font-mono tracking-wider text-slate-200 uppercase font-bold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
          <span>{label}</span>
        </label>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${
              mode === 'upload' ? 'bg-[#00E5FF] text-black font-bold shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-3 h-3" />
            <span>Upload Foto</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${
              mode === 'url' ? 'bg-[#00E5FF] text-black font-bold shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LinkIcon className="w-3 h-3" />
            <span>Input URL Gambar</span>
          </button>
        </div>
      </div>

      {description && <p className="text-[11px] text-slate-400 leading-tight">{description}</p>}

      {/* Image Preview & Upload Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start pt-1">
        {/* Preview Box */}
        <div className="relative w-full sm:w-56 h-36 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0 group">
          {displayImage ? (
            <>
              <img
                src={resolveMediaUrl(displayImage)}
                alt="Preview Background"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <span className="text-[9px] font-mono text-cyan-300 truncate max-w-full">
                  {displayImage.startsWith('data:') ? 'Local Image' : displayImage}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemove}
                title="Hapus gambar"
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/80 text-rose-400 hover:text-rose-300 hover:bg-black transition-colors cursor-pointer border border-rose-900/40"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-600 p-4 text-center">
              <ImageIcon className="w-8 h-8 text-slate-700" />
              <span className="text-[10px] font-mono text-slate-500 uppercase">Belum ada foto latar</span>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-[#00E5FF]">
              <Loader2 className="w-7 h-7 animate-spin" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Memproses Foto...</span>
            </div>
          )}
        </div>

        {/* Input Box */}
        <div className="flex-1 w-full flex flex-col justify-center gap-3">
          {mode === 'upload' ? (
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id={`file-input-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full py-4 px-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-dashed border-cyan-500/50 hover:border-cyan-400 text-slate-200 hover:text-[#00E5FF] flex items-center justify-center gap-2.5 text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer group shadow-sm"
              >
                <Upload className="w-4 h-4 text-[#00E5FF] group-hover:scale-110 transition-transform" />
                <span>Pilih Foto dari Perangkat / Kamera</span>
              </button>
              <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                <span>Mendukung format JPG, PNG, WEBP</span>
                <span className="font-mono text-cyan-400/80">Otomatis Convert Base64 / Cloud Storage</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="https://images.unsplash.com/... atau data:image/..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-4 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#3bf0ff] text-slate-950 text-xs font-bold font-mono transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Terapkan URL</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 px-1">
                Masukkan URL gambar langsung atau format Data URI Image.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
