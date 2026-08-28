import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { MobileService } from '../../types';
import { ImageUploadField } from './ImageUploadField';
import { GalleryManager } from './GalleryManager';
import { resolveMediaUrl } from '../../utils/api';
import { Save, Loader2, RotateCcw, Store, Sliders, Sun, Moon } from 'lucide-react';

export const OpenBoothEditor: React.FC = () => {
  const { data, saveData } = useContent();
  const [form, setForm] = useState<MobileService>({ ...data.mobileService });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data && data.mobileService) {
      setForm({
        ...data.mobileService,
        openBoothBgOverlay:
          typeof data.mobileService.openBoothBgOverlay === 'number'
            ? data.mobileService.openBoothBgOverlay
            : 45,
      });
    }
  }, [data.mobileService]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveData({
        ...data,
        mobileService: {
          ...form,
          openBoothBgOverlay:
            typeof form.openBoothBgOverlay === 'number' ? form.openBoothBgOverlay : 45,
        },
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setForm({
      ...data.mobileService,
      openBoothBgOverlay:
        typeof data.mobileService.openBoothBgOverlay === 'number'
          ? data.mobileService.openBoothBgOverlay
          : 45,
    });
  };

  const currentOverlay =
    typeof form.openBoothBgOverlay === 'number' ? form.openBoothBgOverlay : 45;
  const resolvedBgImage = resolveMediaUrl(
    form.openBoothBgImage || form.bgImage || form.truckImage
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="font-display font-black text-2xl text-white uppercase tracking-tight flex items-center gap-2.5">
            <Store className="w-6 h-6 text-[#00E5FF]" />
            <span>EDITOR HALAMAN LETON OPEN BOOTH</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Kelola teks deskripsi konsep Leton Open Booth, foto background, pengatur cahaya overlay, dan galeri kartu foto.
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

      {/* Teks Konsep Open Booth */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
              Judul Open Booth
            </label>
            <input
              type="text"
              value={form.openBoothTitle || 'LETON OPEN BOOTH'}
              onChange={(e) => setForm({ ...form, openBoothTitle: e.target.value })}
              placeholder="LETON OPEN BOOTH"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
              Tagline / Subtitle Badge
            </label>
            <input
              type="text"
              value={form.openBoothSubtitle || 'POP-UP & PUBLIC SPACE'}
              onChange={(e) => setForm({ ...form, openBoothSubtitle: e.target.value })}
              placeholder="POP-UP & PUBLIC SPACE"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Penjelasan Konsep Open Booth
          </label>
          <textarea
            rows={3}
            value={
              form.openBoothDescription ||
              'Leton Open Booth adalah coffee booth mobile dari Leton Coffee yang hadir di area publik dan lokasi tertentu untuk melayani customer secara langsung.'
            }
            onChange={(e) => setForm({ ...form, openBoothDescription: e.target.value })}
            placeholder="Leton Open Booth adalah coffee booth mobile dari Leton Coffee yang hadir di area publik..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>
      </div>

      {/* Galeri Kartu Foto Leton Open Booth */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md">
        <GalleryManager
          label="CARD FOTO LETON OPEN BOOTH (HORIZONTAL SWIPE GALLERY)"
          images={form.galleryImages || []}
          onChange={(updated) => setForm({ ...form, galleryImages: updated })}
          description="Foto-foto dokumentasi Leton Open Booth di area publik (Parkiran MPP & Ecopark). Foto tampil dalam format swipeable cards horizontal di halaman Leton Open Booth."
        />
      </div>

      {/* Foto Latar Belakang & Pengatur Cahaya Background Open Booth */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md space-y-6">
        <ImageUploadField
          label="FOTO LATAR BELAKANG HALAMAN LETON OPEN BOOTH"
          value={form.openBoothBgImage || ''}
          onChange={(url) => setForm({ ...form, openBoothBgImage: url })}
          aspectRatio="16:9"
          description="Ganti foto full-screen background wallpaper khusus untuk halaman LETON OPEN BOOTH (Rasio 16:9)."
        />

        {/* Pengatur Cahaya / Kegelapan Overlay Background */}
        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#00E5FF]" />
                <label className="block text-xs font-mono font-bold tracking-wider text-white uppercase">
                  PENGATUR CAHAYA BACKGROUND HALAMAN LETON OPEN BOOTH
                </label>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Atur tingkat kegelapan overlay di atas foto background agar foto tetap tampak jernih dan teks LETON OPEN BOOTH mudah dibaca.
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
              onChange={(e) =>
                setForm({ ...form, openBoothBgOverlay: parseInt(e.target.value, 10) })
              }
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
                  onClick={() => setForm({ ...form, openBoothBgOverlay: preset.val })}
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

          {/* Live Visual Preview */}
          {resolvedBgImage && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Preview Tampilan Live Background (LETON OPEN BOOTH):
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

                {/* Foreground Sample Text */}
                <div className="relative z-10 space-y-1 max-w-md">
                  <span className="inline-block px-3 py-0.5 rounded-full bg-[#FDFBF7]/90 text-[#2563EB] text-[10px] font-mono font-bold uppercase tracking-wider mb-1">
                    05 — {form.openBoothSubtitle || 'POP-UP & PUBLIC SPACE'}
                  </span>
                  <h4 className="font-display font-black text-lg sm:text-xl text-white tracking-tight uppercase drop-shadow-md">
                    {form.openBoothTitle || 'LETON OPEN BOOTH'}
                  </h4>
                  <p className="text-xs text-slate-200 font-sans line-clamp-2 drop-shadow">
                    {form.openBoothDescription || 'Coffee booth mobile dari Leton Coffee yang hadir di area publik.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Save Button */}
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

