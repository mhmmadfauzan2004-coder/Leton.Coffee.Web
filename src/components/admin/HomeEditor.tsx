import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { SiteSettings } from '../../types';
import { ImageUploadField } from './ImageUploadField';
import { Save, Loader2, RotateCcw } from 'lucide-react';

export const HomeEditor: React.FC = () => {
  const { data, saveData } = useContent();
  const [form, setForm] = useState<SiteSettings>({ ...data.siteSettings });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data && data.siteSettings) {
      setForm({ ...data.siteSettings });
    }
  }, [data.siteSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveData({
        ...data,
        siteSettings: form,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetCurrent = () => {
    setForm({ ...data.siteSettings });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="font-display font-black text-2xl text-white uppercase tracking-tight">
            EDITOR HOME & HERO
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Ubah identitas visual, logo, background, dan teks headline hero section utama.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleResetCurrent}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono flex items-center gap-2 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Batal Ubah</span>
          </button>
          <button
            type="submit"
            disabled={isSaving}
            id="home-save-btn"
            className="px-6 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#3cf0ff] text-slate-950 font-display font-bold text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-[#00E5FF]/20 cursor-pointer disabled:opacity-50 transition-all"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Menyimpan...' : 'SIMPAN PERUBAHAN'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Brand Name */}
        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Nama Brand
          </label>
          <input
            type="text"
            value={form.brandName}
            onChange={(e) => setForm({ ...form, brandName: e.target.value })}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>

        {/* Tagline */}
        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Tagline Singkat
          </label>
          <input
            type="text"
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>
      </div>

      {/* Logo Image Upload */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
        <ImageUploadField
          label="Logo Brand Leton (Opsional - Kosongkan jika menggunakan teks)"
          value={form.logoUrl || ''}
          onChange={(url) => setForm({ ...form, logoUrl: url })}
          description="Rekomendasi format PNG transparan atau SVG dengan tinggi sekitar 80px - 120px."
        />
      </div>

      {/* Hero Background Image */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
        <ImageUploadField
          label="Foto Background Hero Section"
          value={form.heroBgImage}
          onChange={(url) => setForm({ ...form, heroBgImage: url })}
          description="Foto lanskap beresolusi tinggi yang menjadi background scene utama saat website pertama kali dibuka."
        />
      </div>

      {/* Hero Content Texts */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Hero Headline (Judul Besar)
          </label>
          <input
            type="text"
            value={form.heroTitle}
            onChange={(e) => setForm({ ...form, heroTitle: e.target.value })}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>

        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Hero Subtitle
          </label>
          <input
            type="text"
            value={form.heroSubtitle}
            onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>

        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Hero Deskripsi
          </label>
          <textarea
            rows={3}
            value={form.heroDescription}
            onChange={(e) => setForm({ ...form, heroDescription: e.target.value })}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>
      </div>

      {/* Hero CTAs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Teks Tombol CTA Menu
          </label>
          <input
            type="text"
            value={form.heroCtaMenuText}
            onChange={(e) => setForm({ ...form, heroCtaMenuText: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>

        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Teks Tombol CTA WhatsApp
          </label>
          <input
            type="text"
            value={form.heroCtaOrderText}
            onChange={(e) => setForm({ ...form, heroCtaOrderText: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
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
