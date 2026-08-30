import React, { useState, useRef, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { optimizeImageFile } from '../../utils/storage';
import { StoryImageSlider } from '../public/StoryImageSlider';
import { ImageCropperModal } from './ImageCropperModal';
import {
  Images,
  Upload,
  Link as LinkIcon,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Plus,
  Loader2,
  Check,
  Eye,
  Layers,
  Sparkles,
  Info,
  AlertCircle,
  RotateCcw,
  Database,
  Code2,
  Copy,
  CheckCheck,
} from 'lucide-react';

export const StorySliderManager: React.FC = () => {
  const { data, updateData, saveData, uploadImage, showToast } = useContent();
  const { aboutContent } = data;

  // Initialize list from data.aboutContent.sliderImages (fallback to mainImage)
  const initialList =
    Array.isArray(aboutContent.sliderImages) && aboutContent.sliderImages.length > 0
      ? aboutContent.sliderImages
      : [aboutContent.mainImage || 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80'];

  const [images, setImages] = useState<string[]>(initialList);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeMode, setActiveMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Keep local images state in sync if data changes externally
  useEffect(() => {
    if (Array.isArray(aboutContent.sliderImages) && aboutContent.sliderImages.length > 0) {
      setImages(aboutContent.sliderImages);
    }
  }, [aboutContent.sliderImages]);

  // Cropper states
  const [cropperSource, setCropperSource] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Helper function to save slider images directly to Supabase & Context
   */
  const persistSliderImages = async (newList: string[], notify = false): Promise<boolean> => {
    setIsSaving(true);
    try {
      const validImages = newList.filter((img) => typeof img === 'string' && img.trim().length > 0);
      const fallbackMain = validImages[0] || aboutContent.mainImage || 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80';

      const updatedAbout = {
        ...aboutContent,
        sliderImages: validImages.length > 0 ? validImages : [fallbackMain],
        mainImage: fallbackMain, // Keep mainImage synced to slide #1
      };

      console.log('[CMS Slider] Saving slider sequence to Supabase / Local storage:', updatedAbout.sliderImages);

      let success = false;
      if (typeof updateData === 'function') {
        success = await updateData({
          aboutContent: updatedAbout,
        });
      } else if (typeof saveData === 'function') {
        success = await saveData({
          ...data,
          aboutContent: updatedAbout,
        });
      }

      if (notify) {
        if (success) {
          showToast('Urutan Foto Slider Story berhasil disimpan ke database!', 'success');
        } else {
          showToast('Perubahan disimpan di browser local cache.', 'info');
        }
      }
      return success;
    } catch (err: any) {
      console.error('[CMS Slider Error Details]:', {
        error: err,
        message: err?.message,
        stack: err?.stack,
      });
      showToast('Peringatan: Gagal sinkron ke Supabase (' + (err?.message || 'Error') + '), data tetap aman di memori browser.', 'info');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Add new image URL
  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      showToast('Masukkan URL foto yang valid.', 'error');
      return;
    }
    const newUrl = urlInput.trim();
    const updated = [...images, newUrl];
    setImages(updated);
    setUrlInput('');
    await persistSliderImages(updated, true);
  };

  // Upload file handler
  const processAndUploadFile = async (fileToUpload: File, fallbackDataUrl?: string) => {
    setIsUploading(true);
    try {
      // 1. Direct upload to Supabase Storage
      let uploadedUrl: string | null = null;
      if (typeof uploadImage === 'function') {
        uploadedUrl = await uploadImage(fileToUpload);
      }

      if (uploadedUrl) {
        const updated = [...images, uploadedUrl];
        setImages(updated);
        await persistSliderImages(updated, true);
        showToast('Foto berhasil diunggah ke Supabase Storage & ditambahkan ke slider!', 'success');
      } else {
        // Fallback: local optimized high-quality base64
        const fallbackData = fallbackDataUrl || (await optimizeImageFile(fileToUpload, 1200, 0.8));
        if (fallbackData) {
          const updated = [...images, fallbackData];
          setImages(updated);
          await persistSliderImages(updated, true);
          showToast('Foto berhasil dimuat dan disimpan!', 'info');
        }
      }
    } catch (err: any) {
      console.error('[CMS Upload Error]:', err);
      showToast('Gagal memproses foto: ' + (err?.message || 'Terjadi kesalahan'), 'error');
    } finally {
      setIsUploading(false);
      setCropperSource(null);
      setOriginalFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Hanya file gambar (JPEG, PNG, WEBP) yang didukung.', 'error');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      showToast('Ukuran foto terlalu besar (maksimal 15MB).', 'error');
      return;
    }

    setOriginalFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCropperSource(objectUrl);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!originalFile) return;
    const croppedFile = new File([croppedBlob], originalFile.name, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    await processAndUploadFile(croppedFile);
  };

  const handleSkipCrop = async () => {
    if (!originalFile) return;
    await processAndUploadFile(originalFile);
  };

  // Reorder functions (Up / Down) with instant state change and auto-sync
  const moveUp = async (index: number) => {
    if (index <= 0) return;
    const updated = [...images];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    
    setImages(updated);
    await persistSliderImages(updated, false);
    showToast(`Posisi slide #${index + 1} berhasil dinaikkan ke #${index}`, 'info');
  };

  const moveDown = async (index: number) => {
    if (index >= images.length - 1) return;
    const updated = [...images];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;

    setImages(updated);
    await persistSliderImages(updated, false);
    showToast(`Posisi slide #${index + 1} berhasil diturunkan ke #${index + 2}`, 'info');
  };

  // Remove function with auto-sync
  const removeImage = async (index: number) => {
    if (images.length === 1) {
      if (!confirm('Ini adalah satu-satunya foto pada Story. Yakin ingin menghapusnya?')) {
        return;
      }
    }
    const updated = images.filter((_, idx) => idx !== index);
    setImages(updated);
    await persistSliderImages(updated, false);
    showToast('Foto berhasil dihapus dari slider!', 'info');
  };

  // Reset to default
  const handleResetToDefault = async () => {
    if (confirm('Kembalikan foto slider ke pengaturan awal?')) {
      const defaultImg = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80';
      const defaultList = [defaultImg];
      setImages(defaultList);
      await persistSliderImages(defaultList, true);
      showToast('Daftar foto dikembalikan ke default.', 'info');
    }
  };

  // Manual save trigger
  const handleSaveAll = async () => {
    await persistSliderImages(images, true);
  };

  const sqlSnippet = `-- 1. Buat Tabel leton_content (jika belum ada di Supabase)
CREATE TABLE IF NOT EXISTS public.leton_content (
  id TEXT PRIMARY KEY DEFAULT 'default',
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Aktifkan Row Level Security (RLS)
ALTER TABLE public.leton_content ENABLE ROW LEVEL SECURITY;

-- 3. Kebijakan Akses Baca Publik
CREATE POLICY "Public Read Access"
ON public.leton_content
FOR SELECT
TO anon, authenticated
USING (true);

-- 4. Kebijakan Akses Tulis (INSERT, UPDATE, DELETE)
CREATE POLICY "Admin Full Access"
ON public.leton_content
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 5. Aktifkan Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.leton_content;`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlSnippet);
    setCopiedSql(true);
    showToast('Script SQL berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00E5FF] to-blue-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/20">
              <Images className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="font-display font-black text-2xl text-white tracking-tight uppercase">
                Kelola Foto Slider Story
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                OUR STORY / MORE THAN JUST COFFEE CAROUSEL
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowSqlGuide(!showSqlGuide)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Lihat skema SQL Supabase & RLS"
          >
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>{showSqlGuide ? 'Tutup Info SQL' : 'Skema SQL Supabase'}</span>
          </button>

          <button
            onClick={() => setShowLivePreview(!showLivePreview)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>{showLivePreview ? 'Sembunyikan Preview' : 'Tampilkan Live Preview'}</span>
          </button>

          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-display font-black text-xs tracking-wider uppercase shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-slate-950" />
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* SQL Migration & RLS Helper Drawer (Optional toggle) */}
      {showSqlGuide && (
        <div className="p-5 rounded-2xl bg-slate-950 border border-blue-900/60 shadow-2xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-400">
              <Code2 className="w-4 h-4" />
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                Skema Database & Kebijakan RLS Supabase
              </h3>
            </div>
            <button
              onClick={copySqlToClipboard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-[11px] font-semibold text-blue-300 hover:text-white transition-all cursor-pointer"
            >
              {copiedSql ? (
                <>
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin SQL</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Jika Supabase memunculkan pesan error RLS atau tabel belum tersedia, jalankan skrip berikut di <strong>Supabase Dashboard &gt; SQL Editor</strong>:
          </p>
          <pre className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto select-all leading-relaxed">
            {sqlSnippet}
          </pre>
        </div>
      )}

      {/* Info Status Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0c1427] to-[#070b12] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/40 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-[#60A5FA]" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">
              Status Slider: {images.length > 1 ? (
                <span className="text-[#00E5FF]">Carousel Aktif ({images.length} Foto) — Auto-play 3.5s & Swipe</span>
              ) : (
                <span className="text-amber-400">1 Foto Statis — Slider tidak aktif di web publik</span>
              )}
            </p>
            <p className="text-[11px] text-slate-400">
              Foto #1 otomatis menjadi gambar cover utama. Urutan slide dapat diatur dengan tombol panah naik/turun dan otomatis disinkronkan.
            </p>
          </div>
        </div>

        <button
          onClick={handleResetToDefault}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer w-fit"
        >
          <RotateCcw className="w-3 h-3 text-slate-400" />
          <span>Reset Default</span>
        </button>
      </div>

      {/* Live Preview Box (Optional Toggle) */}
      {showLivePreview && (
        <div className="p-6 rounded-3xl bg-slate-950/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00E5FF]" />
              <h2 className="font-display font-black text-xs uppercase tracking-wider text-slate-300">
                Live Interactive Preview (Frontend Simulation)
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-500 uppercase">
              Coba Swipe / Klik Panah / Titik Indikator
            </span>
          </div>

          <div className="max-w-md mx-auto relative rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl bg-[#070b12]">
            <StoryImageSlider
              images={images.length > 0 ? images : [aboutContent.mainImage]}
              alt="Preview Slider Story"
              className="w-full h-64 sm:h-72"
            />
          </div>
        </div>
      )}

      {/* Upload New Image Card */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/90 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Plus className="w-4 h-4 text-[#00E5FF]" />
            <h2 className="font-display font-bold text-sm tracking-wider uppercase text-white">
              Tambah Foto ke Slider
            </h2>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveMode('upload')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeMode === 'upload'
                  ? 'bg-[#2563EB] text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3 h-3" />
              <span>Upload File</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('url')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeMode === 'url'
                  ? 'bg-[#2563EB] text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LinkIcon className="w-3 h-3" />
              <span>Tempel URL</span>
            </button>
          </div>
        </div>

        {activeMode === 'upload' ? (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-slate-700/80 hover:border-[#00E5FF]/60 bg-slate-950/50 hover:bg-slate-950 transition-all group cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-[#00E5FF] animate-spin" />
                  <p className="text-xs font-bold text-slate-300">
                    Mengunggah foto ke Supabase Storage...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 group-hover:bg-[#2563EB]/20 border border-slate-800 group-hover:border-[#2563EB] flex items-center justify-center transition-all">
                    <Upload className="w-5 h-5 text-slate-400 group-hover:text-[#00E5FF]" />
                  </div>
                  <p className="text-sm font-bold text-slate-200 group-hover:text-white mt-1">
                    Klik untuk Memilih Foto Baru
                  </p>
                  <p className="text-xs text-slate-500">
                    Mendukung JPG, PNG, WEBP hingga 15MB. Otomatis terunggah ke Supabase Storage.
                  </p>
                </div>
              )}
            </button>
          </div>
        ) : (
          <form onSubmit={handleAddUrl} className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://... (Masukkan URL foto langsung)"
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-[#00E5FF]"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs cursor-pointer shadow-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah</span>
            </button>
          </form>
        )}
      </div>

      {/* Slider Photos List & Reordering */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-black text-sm tracking-wider uppercase text-slate-200">
            Daftar Foto Slider ({images.length})
          </h2>
          <span className="text-xs text-slate-500">
            Urutan dari atas ke bawah = Urutan slide 1, 2, 3...
          </span>
        </div>

        {images.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
            <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Belum ada foto slider yang ditambahkan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {images.map((imgUrl, index) => {
              const isFirst = index === 0;
              const isLast = index === images.length - 1;

              return (
                <div
                  key={`${imgUrl}-${index}`}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-slate-700 transition-all shadow-md group"
                >
                  {/* Slide Index Badge */}
                  <div className="flex flex-col items-center justify-center shrink-0 w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 font-mono font-black text-xs text-slate-300">
                    #{index + 1}
                  </div>

                  {/* Thumbnail */}
                  <div className="w-20 h-16 sm:w-28 sm:h-20 rounded-xl overflow-hidden border border-slate-700/80 shrink-0 bg-slate-950 relative">
                    <img
                      src={resolveMediaUrl(imgUrl)}
                      alt={`Slide #${index + 1}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {isFirst && (
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-[#2563EB] text-[9px] font-bold text-white uppercase tracking-wider">
                        Cover
                      </span>
                    )}
                  </div>

                  {/* Details / URL */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {isFirst ? 'Foto Cover Utama (Slide #1)' : `Slide Carousel #${index + 1}`}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5" title={imgUrl}>
                      {imgUrl}
                    </p>
                  </div>

                  {/* Action Buttons: Move Up / Down & Delete */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={isFirst}
                      title="Pindah ke Atas"
                      className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={isLast}
                      title="Pindah ke Bawah"
                      className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      title="Hapus Foto"
                      className="p-2 rounded-lg bg-rose-950/30 hover:bg-rose-900/60 border border-rose-800/40 text-rose-400 hover:text-rose-200 transition-colors cursor-pointer ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Save Action Floating / Sticky Footer */}
      <div className="pt-4 flex justify-end">
        <button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#00E5FF] to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-display font-black text-sm tracking-wider uppercase shadow-xl shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              <span>Menyimpan ke Supabase...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4 text-slate-950" />
              <span>Simpan Perubahan Slider</span>
            </>
          )}
        </button>
      </div>

      {/* Cropper Modal for cropping before upload if desired */}
      {cropperSource && (
        <ImageCropperModal
          isOpen={true}
          imageSrc={cropperSource}
          aspectRatio="4:3"
          onClose={() => {
            setCropperSource(null);
            setOriginalFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
          onCropComplete={handleCropComplete}
          onSkipCrop={handleSkipCrop}
        />
      )}
    </div>
  );
};
