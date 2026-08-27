import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { BranchItem } from '../../types';
import { ImageUploadField } from './ImageUploadField';
import { GalleryManager } from './GalleryManager';
import { resolveMediaUrl } from '../../utils/api';
import { Save, Loader2, RotateCcw, Sliders, Sun, Moon, Sparkles } from 'lucide-react';

interface ChapterEditorProps {
  branchId: string;
  title: string;
}

export const ChapterEditor: React.FC<ChapterEditorProps> = ({ branchId, title }) => {
  const { data, saveData } = useContent();
  const currentBranch = data.branches.find((b) => b.id === branchId);

  const [form, setForm] = useState<BranchItem>(
    currentBranch || {
      id: branchId,
      chapterNumber: '02',
      chapterName: 'CHAPTER',
      branchName: 'CABANG',
      badge: '',
      tagline: '',
      description: '',
      address: '',
      openingHours: '',
      mapsUrl: '',
      bgImage: '',
      buttonText: 'PETUNJUK ARAH',
      bgOverlay: 45,
    }
  );

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const branch = data.branches.find((b) => b.id === branchId);
    if (branch) {
      setForm({
        ...branch,
        bgOverlay: typeof branch.bgOverlay === 'number' ? branch.bgOverlay : 45,
      });
    }
  }, [branchId, data.branches]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updatedBranches = data.branches.map((b) =>
        b.id === branchId
          ? { ...form, bgOverlay: typeof form.bgOverlay === 'number' ? form.bgOverlay : 45 }
          : b
      );
      await saveData({
        ...data,
        branches: updatedBranches,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (currentBranch) {
      setForm({
        ...currentBranch,
        bgOverlay: typeof currentBranch.bgOverlay === 'number' ? currentBranch.bgOverlay : 45,
      });
    }
  };

  const currentOverlay = typeof form.bgOverlay === 'number' ? form.bgOverlay : 45;
  const resolvedBgImage = resolveMediaUrl(form.bgImage);

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="font-display font-black text-2xl text-white uppercase tracking-tight">
            EDITOR {title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Ubah informasi lokasi, foto background, jam buka, dan tautan maps cabang.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono flex items-center gap-2 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Batal Ubah</span>
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#3cf0ff] text-slate-950 font-display font-bold text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-[#00E5FF]/20 cursor-pointer disabled:opacity-50 transition-all"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Menyimpan...' : 'SIMPAN PERUBAHAN'}</span>
          </button>
        </div>
      </div>

      {/* Main Chapter Identity */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Nama Chapter
          </label>
          <input
            type="text"
            value={form.chapterName}
            onChange={(e) => setForm({ ...form, chapterName: e.target.value })}
            required
            placeholder="CHAPTER 5"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>

        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Nama Lokasi / Cabang
          </label>
          <input
            type="text"
            value={form.branchName}
            onChange={(e) => setForm({ ...form, branchName: e.target.value })}
            required
            placeholder="DUMAI SUDIRMAN"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>

        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Badge / Label Singkat
          </label>
          <input
            type="text"
            value={form.badge || ''}
            onChange={(e) => setForm({ ...form, badge: e.target.value })}
            placeholder="THE URBAN HUB"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>
      </div>

      {/* Tagline & Description */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Tagline Cabang
          </label>
          <input
            type="text"
            value={form.tagline || ''}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>

        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Profil / Deskripsi Suasana Cabang
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>
      </div>

      {/* Background Image Upload */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md space-y-6">
        <ImageUploadField
          label={`FOTO LATAR BELAKANG CHAPTER (${form.branchName || form.chapterName})`}
          value={form.bgImage}
          onChange={(url) => setForm({ ...form, bgImage: url })}
          aspectRatio="16:9"
          description="Foto full-screen 16:9 resolusi tinggi yang akan dijadikan latar belakang utama halaman chapter ini."
        />

        {/* Overlay / Pencahayaan Foto Slider Control */}
        <div className="pt-6 border-t border-slate-800/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#00E5FF]" />
                <label className="text-xs font-mono font-bold tracking-wider text-white uppercase">
                  Overlay / Pencahayaan Foto
                </label>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Atur tingkat kegelapan overlay di atas foto background agar foto tetap tampak jernih dan teks cabang mudah dibaca.
              </p>
            </div>

            {/* Current Value Display Badge */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono text-slate-400">Tingkat Overlay:</span>
              <span className="px-3 py-1 rounded-lg bg-[#00E5FF]/10 border border-[#00E5FF]/40 text-[#00E5FF] font-mono font-bold text-sm">
                {currentOverlay}%
              </span>
            </div>
          </div>

          {/* Slider Bar */}
          <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>0% (Terang / Tanpa Overlay)</span>
              </span>
              <span className="text-[#00E5FF] font-bold">45% (Default)</span>
              <span className="flex items-center gap-1">
                <span>100% (Sangat Gelap)</span>
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={currentOverlay}
              onChange={(e) => setForm({ ...form, bgOverlay: parseInt(e.target.value, 10) })}
              className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/40"
            />

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mr-1">
                Preset Cepat:
              </span>
              {[
                { label: '0% (Asli)', val: 0 },
                { label: '35% (Terang)', val: 35 },
                { label: '45% (Default)', val: 45 },
                { label: '60% (Kontras Teks)', val: 60 },
                { label: '75% (Sangat Gelap)', val: 75 },
              ].map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => setForm({ ...form, bgOverlay: preset.val })}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-medium transition-all cursor-pointer ${
                    currentOverlay === preset.val
                      ? 'bg-[#00E5FF] text-slate-950 font-bold shadow-sm shadow-[#00E5FF]/30'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Visual Preview of Overlay */}
          {resolvedBgImage && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Preview Tampilan Live Background ({form.chapterName}):
              </span>
              <div className="relative h-44 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center text-center p-4">
                {/* Background Image */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-all duration-300"
                  style={{ backgroundImage: `url("${resolvedBgImage}")` }}
                />

                {/* Dark Overlay Layer based on slider */}
                <div
                  className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-200"
                  style={{ opacity: currentOverlay / 100 }}
                />

                {/* Foreground Sample Text (stays on top unaffected) */}
                <div className="relative z-10 space-y-1 max-w-md">
                  <span className="inline-block px-3 py-0.5 rounded-full bg-[#FDFBF7]/90 text-[#2563EB] text-[10px] font-mono font-bold uppercase tracking-wider mb-1">
                    {form.chapterNumber} — {form.chapterName}
                  </span>
                  <h4 className="font-display font-black text-lg sm:text-xl text-white tracking-tight uppercase drop-shadow-md">
                    {form.branchName || 'NAMA CABANG'}
                  </h4>
                  <p className="text-xs text-slate-200 font-sans line-clamp-2 drop-shadow">
                    {form.description || 'Deskripsi suasana cabang dan informasi ruangan.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chapter Swipe Gallery Manager */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md">
        <GalleryManager
          label={`GALERI FOTO SWIPE (${form.chapterName} — ${form.branchName || 'CABANG'})`}
          images={form.galleryImages || []}
          onChange={(updated) => setForm({ ...form, galleryImages: updated })}
          description="Foto-foto yang diunggah di sini otomatis tampil dalam format swipe gallery horizontal interaktif di halaman cabang ini."
        />
      </div>

      {/* Location, Hours, Maps URL & Central WhatsApp Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Alamat Lengkap
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>

        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Jam Operasional
          </label>
          <input
            type="text"
            value={form.openingHours}
            onChange={(e) => setForm({ ...form, openingHours: e.target.value })}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Link Google Maps Cabang
          </label>
          <input
            type="url"
            value={form.mapsUrl}
            onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })}
            placeholder="https://maps.google.com/..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>
      </div>

      {/* Central WhatsApp Notice */}
      <div className="p-4 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/30 flex items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-bold text-[#60A5FA] uppercase tracking-wider block">
            Koneksi Kontak WhatsApp Terpusat
          </span>
          <p className="text-xs text-slate-300 mt-0.5">
            Tombol chat cabang ini otomatis terhubung ke Nomor WhatsApp Pusat Leton Coffee: <span className="font-mono text-white font-bold">{data.contactSettings.whatsapp}</span>.
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-md bg-[#2563EB]/20 text-[#60A5FA] text-[10px] font-mono font-bold tracking-wider uppercase shrink-0">
          1 NOMOR PUSAT
        </span>
      </div>

      <div className="pt-4 flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="px-8 py-3 rounded-xl bg-[#00E5FF] hover:bg-[#3cf0ff] text-slate-950 font-display font-bold text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-[#00E5FF]/20 cursor-pointer disabled:opacity-50 transition-all"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{isSaving ? 'Menyimpan...' : 'SIMPAN PERUBAHAN'}</span>
        </button>
      </div>
    </form>
  );
};
