import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { MobileService } from '../../types';
import { GalleryManager } from './GalleryManager';
import { Save, Loader2, RotateCcw, Store, Sparkles } from 'lucide-react';

export const OpenBoothEditor: React.FC = () => {
  const { data, saveData } = useContent();
  const [form, setForm] = useState<MobileService>({ ...data.mobileService });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data && data.mobileService) {
      setForm({
        ...data.mobileService,
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

  const handleReset = () => {
    setForm({
      ...data.mobileService,
    });
  };

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
            Kelola teks deskripsi konsep Leton Open Booth dan galeri kartu foto horizontal (swipeable cards).
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
