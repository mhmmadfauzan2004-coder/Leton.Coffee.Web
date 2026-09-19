import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { MobileService } from '../../types';
import { ImageUploadField } from './ImageUploadField';
import { GalleryManager } from './GalleryManager';
import { resolveMediaUrl } from '../../utils/api';
import { Save, Loader2, RotateCcw, Plus, Trash2, MapPin, Truck, Sliders, Sun, Moon, Sparkles } from 'lucide-react';

export const LetGoEditor: React.FC = () => {
  const { data, saveData, showToast } = useContent();
  const [form, setForm] = useState<MobileService>({ ...data.mobileService });
  const [newLocation, setNewLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data && data.mobileService) {
      const activeBg = data.mobileService.bgImage || data.mobileService.truckImage || '';
      setForm({
        ...data.mobileService,
        bgImage: activeBg,
        truckImage: activeBg,
        bgOverlay: typeof data.mobileService.bgOverlay === 'number' ? data.mobileService.bgOverlay : 45,
        locations:
          Array.isArray(data.mobileService.locations) && data.mobileService.locations.length > 0
            ? data.mobileService.locations
            : ['Parkiran MPP', 'Ecopark'],
      });
    }
  }, [data.mobileService]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const activeBg = form.bgImage || form.truckImage || '';
      const success = await saveData({
        ...data,
        mobileService: {
          ...form,
          bgImage: activeBg,
          truckImage: activeBg,
          bgOverlay: typeof form.bgOverlay === 'number' ? form.bgOverlay : 45,
        },
      });
      if (success) {
        showToast("Perubahan konten LET'GO berhasil disimpan!", 'success');
      }
    } catch (err: any) {
      showToast('Gagal menyimpan perubahan LET\'GO: ' + (err?.message || ''), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBgImageChange = async (url: string) => {
    const updatedForm = {
      ...form,
      bgImage: url,
      truckImage: url,
    };
    setForm(updatedForm);
    try {
      const success = await saveData({
        ...data,
        mobileService: {
          ...data.mobileService,
          ...updatedForm,
          bgImage: url,
          truckImage: url,
          bgOverlay: typeof updatedForm.bgOverlay === 'number' ? updatedForm.bgOverlay : 45,
        },
      });
      if (success) {
        showToast("Foto LET'GO berhasil diunggah & disimpan!", 'success');
      }
    } catch (err: any) {
      showToast('Gagal menyimpan foto LET\'GO: ' + (err?.message || ''), 'error');
    }
  };

  const handleGalleryImagesChange = async (updatedImages: string[]) => {
    const updatedForm = {
      ...form,
      letGoGalleryImages: updatedImages,
    };
    setForm(updatedForm);
    try {
      const success = await saveData({
        ...data,
        mobileService: {
          ...data.mobileService,
          ...updatedForm,
        },
      });
      if (success) {
        showToast("Slide foto LET'GO berhasil diperbarui & disimpan!", 'success');
      }
    } catch (err: any) {
      showToast('Gagal menyimpan slide foto: ' + (err?.message || ''), 'error');
    }
  };

  const handleAddLocation = () => {
    if (!newLocation.trim()) return;
    setForm({
      ...form,
      locations: [...(form.locations || []), newLocation.trim()],
    });
    setNewLocation('');
  };

  const handleRemoveLocation = (index: number) => {
    const updated = [...(form.locations || [])];
    updated.splice(index, 1);
    setForm({ ...form, locations: updated });
  };

  const handleReset = () => {
    setForm({
      ...data.mobileService,
      bgOverlay: typeof data.mobileService.bgOverlay === 'number' ? data.mobileService.bgOverlay : 45,
      locations:
        Array.isArray(data.mobileService.locations) && data.mobileService.locations.length > 0
          ? data.mobileService.locations
          : ['Parkiran MPP', 'Ecopark'],
    });
  };

  const currentOverlay = typeof form.bgOverlay === 'number' ? form.bgOverlay : 45;
  const resolvedBgImage = resolveMediaUrl(form.bgImage || form.truckImage);

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="font-display font-black text-2xl text-white uppercase tracking-tight flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-[#00E5FF]" />
            <span>EDITOR HALAMAN LET'GO</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Kelola informasi layanan mobile coffee booth Leton Coffee & titik lokasi operasional (Parkiran MPP & Ecopark).
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

      {/* Bagian: Konsep Utama LET'GO */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
              Judul Section
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              placeholder="LET'GO"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
              Subtitle
            </label>
            <input
              type="text"
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              required
              placeholder="COFFEE ON THE MOVE"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
              Badge Label
            </label>
            <input
              type="text"
              value={form.badge || ''}
              onChange={(e) => setForm({ ...form, badge: e.target.value })}
              placeholder="MOBILE COFFEE EXPERIENCE"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Deskripsi Konsep LET'GO
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            placeholder="Leton Coffee hadir lebih dekat dengan kamu melalui konsep mobile coffee booth..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>

        {/* Mobile Locations (Parkiran MPP, Ecopark, dll) */}
        <div className="space-y-3 pt-2">
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase">
            Daftar Titik Lokasi Mobile Operasional
          </label>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Tambah nama lokasi (contoh: Parkiran MPP / Ecopark)..."
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLocation();
                }
              }}
              className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-[#00E5FF]"
            />
            <button
              type="button"
              onClick={handleAddLocation}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-[#00E5FF] text-slate-200 hover:text-slate-950 text-xs font-bold font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Lokasi</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {form.locations?.map((loc, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
              >
                <MapPin className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span className="font-mono font-semibold">{loc}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveLocation(idx)}
                  className="text-slate-500 hover:text-rose-400 cursor-pointer ml-1"
                  title="Hapus lokasi"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Galeri Slide Foto LET'GO (Carousel) */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md">
        <GalleryManager
          label="SLIDE FOTO HALAMAN LET'GO (CAROUSEL)"
          images={form.letGoGalleryImages || []}
          filePrefix="letgo_gallery"
          onChange={handleGalleryImagesChange}
          description="Foto-foto dokumentasi Let'Go / mobile coffee Leton Coffee. Foto tampil dalam format horizontal image carousel / slider di halaman LET'GO."
        />
      </div>

      {/* Foto Latar Belakang & Pengatur Cahaya Background */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md space-y-6">
        <ImageUploadField
          label="FOTO LATAR BELAKANG HALAMAN LET'GO"
          value={form.bgImage || form.truckImage || ''}
          filePrefix="letgo_bg"
          onChange={handleBgImageChange}
          aspectRatio="16:9"
          description="Foto full-screen suasana outdoor / mobile coffee booth untuk background wallpaper halaman LET'GO (Rasio 16:9)."
        />

        {/* Pengatur Cahaya / Kegelapan Overlay Background */}
        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#00E5FF]" />
                <label className="block text-xs font-mono font-bold tracking-wider text-white uppercase">
                  PENGATUR CAHAYA BACKGROUND HALAMAN LET'GO
                </label>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Atur tingkat kegelapan overlay di atas foto background agar foto tetap tampak jernih dan teks LET'GO mudah dibaca.
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

          {/* Live Visual Preview */}
          {resolvedBgImage && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Preview Tampilan Live Background (LET'GO):
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
                    04 — {form.badge || 'MOBILE COFFEE EXPERIENCE'}
                  </span>
                  <h4 className="font-display font-black text-lg sm:text-xl text-white tracking-tight uppercase drop-shadow-md">
                    {form.title || "LET'GO"}
                  </h4>
                  <p className="text-xs text-slate-200 font-sans line-clamp-2 drop-shadow">
                    {form.description || 'Layanan coffee booth mobile dari Leton Coffee on the move.'}
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
