import React, { useState, useEffect } from 'react';
import { useContent } from '../../context/ContentContext';
import { BaristaItem, BaristasSectionContent } from '../../types';
import { ImageUploadField } from './ImageUploadField';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Coffee,
  Instagram,
  MoveUp,
  MoveDown,
  Sparkles,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

export const BaristaManager: React.FC = () => {
  const { data, saveData } = useContent();
  const [isSaving, setIsSaving] = useState(false);

  // Section Header Form State
  const [headerForm, setHeaderForm] = useState<BaristasSectionContent>(() => {
    return (
      data.baristasContent || {
        title: 'MEET OUR BARISTAS',
        subtitle: 'THE CRAFTSMEN, ROASTERS & CREATIVE BREWERS',
        badge: '06 — THE ARTISAN TEAM',
        description:
          'Di balik setiap tegukan kopi Leton, ada dedikasi, keahlian teknik seduh, dan senyuman hangat dari tim barista kami yang siap menemani hari dan obrolanmu.',
      }
    );
  });

  // Baristas list state
  const [baristasList, setBaristasList] = useState<BaristaItem[]>(() => {
    return [...(data.baristas || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  });

  useEffect(() => {
    if (data.baristasContent) {
      setHeaderForm(data.baristasContent);
    }
    if (data.baristas) {
      setBaristasList([...data.baristas].sort((a, b) => (a.order || 0) - (b.order || 0)));
    }
  }, [data.baristasContent, data.baristas]);

  // Modal State for Add / Edit Barista
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [baristaForm, setBaristaForm] = useState<BaristaItem>({
    id: '',
    name: '',
    role: '',
    favoriteCoffee: '',
    description: '',
    image: '',
    instagram: '',
    order: 0,
  });

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<BaristaItem | null>(null);

  // Save full barista section changes
  const handleSaveAll = async (updatedList = baristasList, updatedHeader = headerForm) => {
    setIsSaving(true);
    try {
      await saveData({
        ...data,
        baristasContent: updatedHeader,
        baristas: updatedList,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingId(null);
    setBaristaForm({
      id: `barista-${Date.now()}`,
      name: '',
      role: 'Barista',
      favoriteCoffee: 'Leton Aren Signature',
      description: '',
      image: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=800&q=80',
      instagram: 'https://instagram.com',
      order: baristasList.length + 1,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: BaristaItem) => {
    setEditingId(item.id);
    setBaristaForm({ ...item });
    setIsModalOpen(true);
  };

  // Submit Barista Form (Add / Edit)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baristaForm.name.trim()) return;

    let updated: BaristaItem[];
    if (editingId) {
      updated = baristasList.map((b) => (b.id === editingId ? { ...baristaForm } : b));
    } else {
      updated = [...baristasList, { ...baristaForm, id: baristaForm.id || `barista-${Date.now()}` }];
    }

    updated.sort((a, b) => (a.order || 0) - (b.order || 0));
    setBaristasList(updated);
    setIsModalOpen(false);
    await handleSaveAll(updated, headerForm);
  };

  // Delete Barista
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const updated = baristasList.filter((b) => b.id !== deleteTarget.id);
    setBaristasList(updated);
    setDeleteTarget(null);
    await handleSaveAll(updated, headerForm);
  };

  // Reorder Item (Up/Down)
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === baristasList.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const itemsCopy = [...baristasList];
    const [moved] = itemsCopy.splice(index, 1);
    itemsCopy.splice(newIndex, 0, moved);

    // Re-assign order numbers
    const updated = itemsCopy.map((item, idx) => ({ ...item, order: idx + 1 }));
    setBaristasList(updated);
    await handleSaveAll(updated, headerForm);
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[#00E5FF] text-[11px] font-mono font-bold tracking-widest uppercase mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>BARISTA TEAM MANAGEMENT</span>
          </div>
          <h2 className="font-display font-black text-2xl text-white tracking-tight uppercase">
            KELOLA TIM BARISTA
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Tambah, edit foto, profil, jabatan, dan kopi favorit tim barista Leton Coffee.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAddModal}
            id="btn-add-barista"
            className="px-4 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#3bf0ff] text-slate-950 font-display font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-[#00E5FF]/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Barista</span>
          </button>
        </div>
      </div>

      {/* Section Header Settings Card */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>PENGATURAN TEKS HEADER HALAMAN BARISTA</span>
          </h3>
          <button
            onClick={() => handleSaveAll(baristasList, headerForm)}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Header'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
              Badge / Urutan
            </label>
            <input
              type="text"
              value={headerForm.badge}
              onChange={(e) => setHeaderForm({ ...headerForm, badge: e.target.value })}
              placeholder="06 — THE ARTISAN TEAM"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-[#00E5FF] outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
              Judul Utama (Title)
            </label>
            <input
              type="text"
              value={headerForm.title}
              onChange={(e) => setHeaderForm({ ...headerForm, title: e.target.value })}
              placeholder="MEET OUR BARISTAS"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-[#00E5FF] outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
              Subtitle
            </label>
            <input
              type="text"
              value={headerForm.subtitle}
              onChange={(e) => setHeaderForm({ ...headerForm, subtitle: e.target.value })}
              placeholder="THE CRAFTSMEN, ROASTERS & CREATIVE BREWERS"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-[#00E5FF] outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
            Deskripsi Pengantar
          </label>
          <textarea
            rows={2}
            value={headerForm.description}
            onChange={(e) => setHeaderForm({ ...headerForm, description: e.target.value })}
            placeholder="Deskripsi singkat seksi barista..."
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-[#00E5FF] outline-none"
          />
        </div>
      </div>

      {/* Baristas Grid Display */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-black text-lg text-white uppercase tracking-tight">
            DAFTAR BARISTA ({baristasList.length})
          </h3>
          <span className="text-xs font-mono text-cyan-400">
            Perubahan langsung tersimpan & sinkron
          </span>
        </div>

        {baristasList.length === 0 ? (
          <div className="text-center py-16 p-8 rounded-3xl bg-slate-900/40 border border-slate-800 text-slate-400">
            <Users className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <p className="font-display font-bold text-base text-white uppercase">
              Belum ada profil barista
            </p>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Klik tombol di bawah untuk menambahkan barista pertama.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-xl bg-[#00E5FF] text-slate-950 font-bold text-xs uppercase"
            >
              Tambah Barista Sekarang
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {baristasList.map((barista, index) => (
              <div
                key={barista.id}
                className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 overflow-hidden flex flex-col justify-between group transition-all"
              >
                <div>
                  {/* Photo Preview */}
                  <div className="h-56 w-full relative bg-slate-950 overflow-hidden">
                    {barista.image ? (
                      <img
                        src={barista.image}
                        alt={barista.name}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                        <Users className="w-10 h-10 mb-1" />
                        <span className="text-[11px] font-mono">Tidak ada foto</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                    {/* Order Pill */}
                    <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/80 backdrop-blur-md border border-slate-700 text-cyan-400 font-mono text-[10px] font-bold">
                      #{index + 1}
                    </div>

                    {/* Role Pill */}
                    <div className="absolute bottom-3 left-3 right-3">
                      <span className="px-2.5 py-1 rounded-full bg-cyan-950/90 border border-cyan-500/40 text-[#00E5FF] font-mono text-[10px] font-bold uppercase tracking-wider shadow">
                        {barista.role}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-2">
                    <h4 className="font-display font-black text-white text-base uppercase leading-tight truncate">
                      {barista.name}
                    </h4>

                    {barista.favoriteCoffee && (
                      <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-mono truncate">
                        <Coffee className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                        <span className="truncate">Fav: {barista.favoriteCoffee}</span>
                      </div>
                    )}

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      "{barista.description}"
                    </p>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between gap-1">
                  {/* Reorder Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveOrder(index, 'up')}
                      disabled={index === 0}
                      title="Pindah ke Atas"
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveOrder(index, 'down')}
                      disabled={index === baristasList.length - 1}
                      title="Pindah ke Bawah"
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Edit & Delete */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(barista)}
                      className="p-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-[#00E5FF] text-slate-300 hover:text-slate-950 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setDeleteTarget(barista)}
                      className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Hapus Barista"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL: ADD / EDIT BARISTA                           */}
      {/* ---------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-[#00E5FF]">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-white uppercase">
                    {editingId ? 'EDIT PROFIL BARISTA' : 'TAMBAH BARISTA BARU'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Lengkapi informasi foto, nama, posisi, dan racikan kopi favorit
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Image Upload */}
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-1.5">
                  Foto Barista
                </label>
                <ImageUploadField
                  value={baristaForm.image}
                  onChange={(url) => setBaristaForm({ ...baristaForm, image: url })}
                  label="Upload / Masukkan URL Foto Barista"
                  placeholder="https://images.unsplash.com/... atau upload dari HP/Laptop"
                />
              </div>

              {/* Name & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-1.5">
                    Nama Lengkap / Panggilan *
                  </label>
                  <input
                    type="text"
                    required
                    value={baristaForm.name}
                    onChange={(e) => setBaristaForm({ ...baristaForm, name: e.target.value })}
                    placeholder="Contoh: Farhan Aan Pratama"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-[#00E5FF] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-1.5">
                    Jabatan / Posisi *
                  </label>
                  <input
                    type="text"
                    required
                    value={baristaForm.role}
                    onChange={(e) => setBaristaForm({ ...baristaForm, role: e.target.value })}
                    placeholder="Contoh: Head Barista, Manual Brew Specialist"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-[#00E5FF] outline-none"
                  />
                </div>
              </div>

              {/* Favorite Coffee & Instagram */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-1.5">
                    Kopi Favorit Barista
                  </label>
                  <div className="relative">
                    <Coffee className="w-4 h-4 text-cyan-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={baristaForm.favoriteCoffee}
                      onChange={(e) =>
                        setBaristaForm({ ...baristaForm, favoriteCoffee: e.target.value })
                      }
                      placeholder="Contoh: Leton Aren Signature"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-[#00E5FF] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-1.5">
                    Link Instagram (Opsional)
                  </label>
                  <div className="relative">
                    <Instagram className="w-4 h-4 text-pink-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={baristaForm.instagram || ''}
                      onChange={(e) =>
                        setBaristaForm({ ...baristaForm, instagram: e.target.value })
                      }
                      placeholder="https://instagram.com/username"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-[#00E5FF] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Short Bio / Description */}
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-1.5">
                  Deskripsi Singkat / Quote Barista
                </label>
                <textarea
                  rows={3}
                  required
                  value={baristaForm.description}
                  onChange={(e) =>
                    setBaristaForm({ ...baristaForm, description: e.target.value })
                  }
                  placeholder="Ceritakan pengalaman, fokus seduhan, atau pesan singkat dari barista ini..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-[#00E5FF] outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#3cf0ff] text-slate-950 font-display font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#00E5FF]/20 flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingId ? 'Simpan Perubahan' : 'Tambahkan Barista'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: DELETE CONFIRMATION                           */}
      {/* ---------------------------------------------------- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-display font-bold text-lg text-white uppercase">
              Hapus Profil Barista?
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus profil{' '}
              <strong className="text-white font-bold">{deleteTarget.name}</strong> ({deleteTarget.role})? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
