import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { MobileService } from '../../types';
import { ImageUploadField } from './ImageUploadField';
import { GalleryManager } from './GalleryManager';
import { Save, Loader2, RotateCcw, Plus, Trash2, MapPin, Store, Truck, Sparkles } from 'lucide-react';

export const LetGoEditor: React.FC = () => {
  const { data, saveData } = useContent();
  const [form, setForm] = useState<MobileService>({ ...data.mobileService });
  const [newLocation, setNewLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data && data.mobileService) {
      setForm({
        ...data.mobileService,
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
      await saveData({
        ...data,
        mobileService: form,
      });
    } finally {
      setIsSaving(false);
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
      locations:
        Array.isArray(data.mobileService.locations) && data.mobileService.locations.length > 0
          ? data.mobileService.locations
          : ['Parkiran MPP', 'Ecopark'],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="font-display font-black text-2xl text-white uppercase tracking-tight flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-[#00E5FF]" />
            <span>EDITOR LET'GO & LETON OPEN BOOTH</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Kelola informasi mobile coffee booth Leton Coffee, titik lokasi operasional (Parkiran MPP & Ecopark), serta galeri kartu foto Leton Open Booth.
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

      {/* Bagian 1: Konsep Utama LET'GO */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5 shadow-md">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Truck className="w-4 h-4 text-[#00E5FF]" />
          <h3 className="text-xs font-mono font-bold tracking-wider text-white uppercase">
            BAGIAN 1: KONSEP UTAMA LET'GO (MOBILE COFFEE)
          </h3>
        </div>

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
              placeholder="MOBILE COFFEE BOOTH"
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

      {/* Bagian 2: Sub-Section LETON OPEN BOOTH */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5 shadow-md">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Store className="w-4 h-4 text-[#00E5FF]" />
          <h3 className="text-xs font-mono font-bold tracking-wider text-white uppercase">
            BAGIAN 2: SUB-SECTION LETON OPEN BOOTH
          </h3>
        </div>

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
              Tagline / Subtitle Open Booth
            </label>
            <input
              type="text"
              value={form.openBoothSubtitle || 'HADIR DI AREA PUBLIK'}
              onChange={(e) => setForm({ ...form, openBoothSubtitle: e.target.value })}
              placeholder="HADIR DI AREA PUBLIK"
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

      {/* Bagian 3: Galeri Kartu Foto Leton Open Booth */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md">
        <GalleryManager
          label="CARD FOTO LETON OPEN BOOTH (HORIZONTAL SWIPE GALLERY)"
          images={form.galleryImages || []}
          onChange={(updated) => setForm({ ...form, galleryImages: updated })}
          description="Foto-foto dokumentasi suasana dan penyajian kopi Leton Open Booth di area publik (Parkiran MPP, Ecopark). Foto tampil dalam format deretan kartu horizontal yang dapat digeser (swipe) oleh pengunjung di website utama."
        />
      </div>

      {/* Bagian 4: Foto Latar Belakang */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md">
        <ImageUploadField
          label="FOTO LATAR BELAKANG HALAMAN LET'GO"
          value={form.bgImage}
          onChange={(url) => setForm({ ...form, bgImage: url })}
          aspectRatio="16:9"
          description="Foto full-screen suasana outdoor / mobile coffee booth untuk background wallpaper halaman LET'GO (Rasio 16:9)."
        />
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
