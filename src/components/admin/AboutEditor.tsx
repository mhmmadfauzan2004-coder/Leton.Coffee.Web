import React, { useState } from 'react';
import { useContent } from '../../context/ContentContext';
import { AboutContent, AboutFact } from '../../types';
import { ImageUploadField } from './ImageUploadField';
import { Save, Loader2, RotateCcw, Plus, Trash2 } from 'lucide-react';

export const AboutEditor: React.FC = () => {
  const { data, saveData } = useContent();
  const [form, setForm] = useState<AboutContent>({ ...data.aboutContent });
  const [isSaving, setIsSaving] = useState(false);

  const [newStatLabel, setNewStatLabel] = useState('');
  const [newStatValue, setNewStatValue] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveData({
        ...data,
        aboutContent: form,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStat = () => {
    if (!newStatLabel.trim() || !newStatValue.trim()) return;
    const newFact: AboutFact = {
      id: `fact-${Date.now()}`,
      label: newStatLabel.trim(),
      value: newStatValue.trim(),
    };
    setForm({
      ...form,
      facts: [...(form.facts || []), newFact],
    });
    setNewStatLabel('');
    setNewStatValue('');
  };

  const handleRemoveStat = (id: string) => {
    setForm({
      ...form,
      facts: form.facts.filter((f) => f.id !== id),
    });
  };

  const handleReset = () => {
    setForm({ ...data.aboutContent });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="font-display font-black text-2xl text-white uppercase tracking-tight">
            EDITOR PROFIL & ABOUT
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Ubah narasi brand story, foto showcase atmosfer, dan angka pencapaian/fakta Leton.
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

      {/* Headings */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Judul Besar About
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            placeholder="MORE THAN JUST COFFEE."
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
            placeholder="A CULTURE OF YOUTH..."
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
            placeholder="OUR STORY"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>
      </div>

      {/* Descriptions */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Paragraf Utama Brand Story
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>

        <div>
          <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
            Paragraf Pendukung / Komitmen
          </label>
          <textarea
            rows={3}
            value={form.secondaryDescription || ''}
            onChange={(e) => setForm({ ...form, secondaryDescription: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
          />
        </div>
      </div>

      {/* Image Uploads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <ImageUploadField
            label="Foto Utama Story (Barista / Brewing)"
            value={form.mainImage}
            onChange={(url) => setForm({ ...form, mainImage: url })}
            description="Foto berukuran besar di bagian kiri cerita."
          />
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <ImageUploadField
            label="Foto Sekunder (Komunitas / Detail Kopi)"
            value={form.secondaryImage || ''}
            onChange={(url) => setForm({ ...form, secondaryImage: url })}
            description="Foto floating di sudut bawah foto utama."
          />
        </div>
      </div>

      {/* Dynamic Facts / Statistics */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase">
          Fakta & Statistik Brand (Tampil di Kotak Statistik)
        </label>

        {/* Add new stat inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6">
            <input
              type="text"
              placeholder="Label (Contoh: Total Cangkir Terjual)"
              value={newStatLabel}
              onChange={(e) => setNewStatLabel(e.target.value)}
              className="w-full px-4 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-[#00E5FF]"
            />
          </div>
          <div className="sm:col-span-4">
            <input
              type="text"
              placeholder="Nilai (Contoh: 1,200+ Cups / Day)"
              value={newStatValue}
              onChange={(e) => setNewStatValue(e.target.value)}
              className="w-full px-4 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-[#00E5FF]"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={handleAddStat}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-[#00E5FF] text-slate-200 hover:text-slate-950 text-xs font-bold font-mono transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah</span>
            </button>
          </div>
        </div>

        {/* List of active stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {form.facts?.map((fact) => (
            <div
              key={fact.id}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
            >
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  {fact.label}
                </span>
                <span className="font-display font-bold text-base text-white">{fact.value}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveStat(fact.id)}
                className="p-2 text-slate-500 hover:text-rose-400 cursor-pointer"
                title="Hapus Stat"
              >
                <Trash2 className="w-4 h-4" />
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
