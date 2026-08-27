import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { MobileService } from '../../types';
import { ImageUploadField } from './ImageUploadField';
import { GalleryManager } from './GalleryManager';
import { Save, Loader2, RotateCcw, Plus, Trash2 } from 'lucide-react';

export const LetGoEditor: React.FC = () => {
  const { data, saveData } = useContent();
  const [form, setForm] = useState<MobileService>({ ...data.mobileService });
  const [newFeature, setNewFeature] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data && data.mobileService) {
      setForm({ ...data.mobileService });
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

  const handleAddFeature = () => {
    if (!newFeature.trim()) return;
    setForm({
      ...form,
      features: [...(form.features || []), newFeature.trim()],
    });
    setNewFeature('');
  };

  const handleRemoveFeature = (index: number) => {
    const updated = [...(form.features || [])];
    updated.splice(index, 1);
    setForm({ ...form, features: updated });
  };

  const handleReset = () => {
    setForm({ ...data.mobileService });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="font-display font-black text-2xl text-white uppercase tracking-tight">
            EDITOR LET'GO / COFFEE TRUCK
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Kelola informasi layanan mobile coffee bar, foto coffee truck, paket event, dan pesan WhatsApp.
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

      {/* Basic Title & Subtitle */}
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
            placeholder="LETON COFFEE ON THE MOVE"
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
          Deskripsi Utama Let'GO
        </label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
          className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
        />
      </div>

      {/* Service Info & Event Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Informasi Layanan & Barista
          </label>
          <textarea
            rows={2}
            value={form.serviceInfo}
            onChange={(e) => setForm({ ...form, serviceInfo: e.target.value })}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>

        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Informasi Event & Kolaborasi
          </label>
          <textarea
            rows={2}
            value={form.eventInfo}
            onChange={(e) => setForm({ ...form, eventInfo: e.target.value })}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>
      </div>

      {/* Area & CTA Text */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Area Jangkauan Layanan
          </label>
          <input
            type="text"
            value={form.serviceArea}
            onChange={(e) => setForm({ ...form, serviceArea: e.target.value })}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>

        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Teks Tombol CTA Booking
          </label>
          <input
            type="text"
            value={form.ctaText}
            onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
            required
            placeholder="BOOK FOR EVENT"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>
      </div>

      {/* Central WhatsApp Notice for Let'GO */}
      <div className="p-4 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/30 flex items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-bold text-[#60A5FA] uppercase tracking-wider block">
            Nomor WhatsApp Booking Terpusat
          </span>
          <p className="text-xs text-slate-300 mt-0.5">
            Tombol booking armada LET'GO terhubung langsung ke Nomor WhatsApp Pusat: <span className="font-mono text-white font-bold">{data.contactSettings.whatsapp}</span> (dikelola di menu Pengaturan / Kontak).
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-md bg-[#2563EB]/20 text-[#60A5FA] text-[10px] font-mono font-bold tracking-wider uppercase shrink-0">
          1 NOMOR PUSAT
        </span>
      </div>

      {/* Image Uploads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md">
          <ImageUploadField
            label="FOTO LATAR BELAKANG CHAPTER (LET'GO)"
            value={form.bgImage}
            onChange={(url) => setForm({ ...form, bgImage: url })}
            aspectRatio="16:9"
            description="Foto full-screen suasana outdoor event untuk background utama halaman LET'GO (Rasio 16:9)."
          />
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md">
          <ImageUploadField
            label="FOTO COFFEE TRUCK / SHOWCASE UTAMA"
            value={form.truckImage}
            onChange={(url) => setForm({ ...form, truckImage: url })}
            aspectRatio="4:3"
            description="Foto showcase kartu armada mobile / booth event Let'GO (Rasio 4:3)."
          />
        </div>
      </div>

      {/* Let'GO Swipe Gallery Manager */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md">
        <GalleryManager
          label="GALERI FOTO SWIPE (ARMADA & EVENT LET'GO)"
          images={form.galleryImages || []}
          onChange={(updated) => setForm({ ...form, galleryImages: updated })}
          description="Foto dokumentasi event, festival, booth outdoor, dan armada mobil Let'GO yang tampil dalam format horizontal swipe gallery di halaman LET'GO."
        />
      </div>

      {/* Feature Bullet Points */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase">
          Fitur & Keunggulan Let'GO
        </label>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Tambah poin keunggulan..."
            value={newFeature}
            onChange={(e) => setNewFeature(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddFeature();
              }
            }}
            className="flex-1 px-4 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-[#00E5FF]"
          />
          <button
            type="button"
            onClick={handleAddFeature}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-[#00E5FF] text-slate-200 hover:text-slate-950 text-xs font-bold font-mono transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {form.features?.map((feat, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300"
            >
              <span>{feat}</span>
              <button
                type="button"
                onClick={() => handleRemoveFeature(idx)}
                className="text-slate-500 hover:text-rose-400 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
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
