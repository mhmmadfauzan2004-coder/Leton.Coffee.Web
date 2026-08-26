import React, { useState } from 'react';
import { useContent } from '../../context/ContentContext';
import { MenuItem, MenuCategory } from '../../types';
import { ImageUploadField } from './ImageUploadField';
import { formatRupiah } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/api';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Check,
  Search,
  CheckCircle,
  XCircle,
  MoveUp,
  MoveDown,
  Layers,
  UtensilsCrossed,
} from 'lucide-react';

export const MenuManager: React.FC = () => {
  const { data, saveData } = useContent();
  const { menuCategories, menuItems } = data;

  // Active tab: "items" | "categories"
  const [activeSubTab, setActiveSubTab] = useState<'items' | 'categories'>('items');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');

  // Menu item modal state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState<MenuItem>({
    id: '',
    name: '',
    categoryId: menuCategories[0]?.id || 'coffee',
    price: 20000,
    description: '',
    image: '',
    isAvailable: true,
    badge: '',
    order: 0,
  });

  // Category modal state
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<MenuCategory | null>(null);
  const [catForm, setCatForm] = useState<MenuCategory>({
    id: '',
    name: '',
    order: 0,
  });

  // Delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'item' | 'category';
    id: string;
    name: string;
  } | null>(null);

  // ----------------------------------------
  // Menu Item Actions
  // ----------------------------------------
  const handleOpenAddItem = () => {
    setEditingItem(null);
    setItemForm({
      id: `menu-${Date.now()}`,
      name: '',
      categoryId: menuCategories[0]?.id || 'coffee',
      price: 20000,
      description: '',
      image:
        'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=800&q=80',
      isAvailable: true,
      badge: '',
      order: menuItems.length + 1,
    });
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({ ...item });
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name.trim()) return;

    let updatedItems = [...menuItems];
    if (editingItem) {
      updatedItems = updatedItems.map((item) => (item.id === editingItem.id ? itemForm : item));
    } else {
      updatedItems.push(itemForm);
    }

    await saveData({
      ...data,
      menuItems: updatedItems,
    });
    setIsItemModalOpen(false);
  };

  const handleToggleAvailability = async (itemId: string) => {
    const updatedItems = menuItems.map((item) =>
      item.id === itemId ? { ...item, isAvailable: !item.isAvailable } : item
    );
    await saveData({
      ...data,
      menuItems: updatedItems,
    });
  };

  const handleMoveItem = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= menuItems.length) return;

    const updated = [...menuItems];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // update orders
    updated.forEach((it, idx) => {
      it.order = idx + 1;
    });

    await saveData({
      ...data,
      menuItems: updated,
    });
  };

  // ----------------------------------------
  // Category Actions
  // ----------------------------------------
  const handleOpenAddCat = () => {
    setEditingCat(null);
    setCatForm({
      id: `cat-${Date.now()}`,
      name: '',
      order: menuCategories.length + 1,
    });
    setIsCatModalOpen(true);
  };

  const handleOpenEditCat = (cat: MenuCategory) => {
    setEditingCat(cat);
    setCatForm({ ...cat });
    setIsCatModalOpen(true);
  };

  const handleSaveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.name.trim()) return;

    let updatedCats = [...menuCategories];
    if (editingCat) {
      updatedCats = updatedCats.map((cat) => (cat.id === editingCat.id ? catForm : cat));
    } else {
      const generatedId = catForm.id || catForm.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      updatedCats.push({ ...catForm, id: generatedId });
    }

    await saveData({
      ...data,
      menuCategories: updatedCats,
    });
    setIsCatModalOpen(false);
  };

  // ----------------------------------------
  // Delete Execution
  // ----------------------------------------
  const executeDelete = async () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === 'item') {
      const updatedItems = menuItems.filter((i) => i.id !== deleteConfirm.id);
      await saveData({
        ...data,
        menuItems: updatedItems,
      });
    } else if (deleteConfirm.type === 'category') {
      const updatedCats = menuCategories.filter((c) => c.id !== deleteConfirm.id);
      // fallback items to first remaining category
      const fallbackCat = updatedCats[0]?.id || 'general';
      const updatedItems = menuItems.map((item) =>
        item.categoryId === deleteConfirm.id ? { ...item, categoryId: fallbackCat } : item
      );
      await saveData({
        ...data,
        menuCategories: updatedCats,
        menuItems: updatedItems,
      });
    }
    setDeleteConfirm(null);
  };

  // Filter items
  const filteredMenuItems = menuItems.filter((item) => {
    const matchesCat = selectedCatFilter === 'all' || item.categoryId === selectedCatFilter;
    const matchesSearch =
      !searchFilter.trim() ||
      item.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.description.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="font-display font-black text-2xl text-white uppercase tracking-tight">
            MANAJEMEN MENU & KATEGORI
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tambah menu baru, atur harga, foto, ketersediaan, serta kelola kategori menu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('items')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-colors cursor-pointer ${
              activeSubTab === 'items'
                ? 'bg-[#00E5FF] text-black shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Daftar Menu ({menuItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('categories')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-colors cursor-pointer ${
              activeSubTab === 'categories'
                ? 'bg-[#00E5FF] text-black shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Kategori ({menuCategories.length})
          </button>
        </div>
      </div>

      {/* SUBTAB 1: MENU ITEMS */}
      {activeSubTab === 'items' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari nama menu..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-[#00E5FF]"
                />
              </div>

              <select
                value={selectedCatFilter}
                onChange={(e) => setSelectedCatFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-[#00E5FF]"
              >
                <option value="all">Semua Kategori</option>
                {menuCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleOpenAddItem}
              id="add-menu-item-btn"
              className="px-4 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#3cf0ff] text-slate-950 font-display font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-md shadow-[#00E5FF]/20 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Menu Baru</span>
            </button>
          </div>

          {/* Items Table / List */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            {filteredMenuItems.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">Tidak ada menu yang sesuai.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {filteredMenuItems.map((item, idx) => {
                  const catName =
                    menuCategories.find((c) => c.id === item.categoryId)?.name || 'Kategori';
                  return (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        {/* Thumbnail */}
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-slate-800 relative">
                          <img
                            src={resolveMediaUrl(item.image)}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-display font-bold text-sm sm:text-base text-white truncate">
                              {item.name}
                            </h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-cyan-400 uppercase">
                              {catName}
                            </span>
                            {item.badge && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#00E5FF]/20 text-[#00E5FF] uppercase">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                            {item.description}
                          </p>
                          <p className="font-mono font-bold text-xs text-[#00E5FF] mt-1">
                            {formatRupiah(item.price)}
                          </p>
                        </div>
                      </div>

                      {/* Item Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {/* Move Buttons */}
                        <div className="flex items-center gap-0.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                          <button
                            type="button"
                            onClick={() => handleMoveItem(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Pindah ke atas"
                          >
                            <MoveUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveItem(idx, 'down')}
                            disabled={idx === filteredMenuItems.length - 1}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Pindah ke bawah"
                          >
                            <MoveDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Availability Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(item.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                            item.isAvailable
                              ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900'
                              : 'bg-rose-950/80 border border-rose-500/40 text-rose-300 hover:bg-rose-900'
                          }`}
                        >
                          {item.isAvailable ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Tersedia</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-400" />
                              <span>Habis</span>
                            </>
                          )}
                        </button>

                        {/* Edit button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditItem(item)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                          title="Edit Menu"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirm({ type: 'item', id: item.id, name: item.name })
                          }
                          className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 cursor-pointer"
                          title="Hapus Menu"
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
        </div>
      )}

      {/* SUBTAB 2: CATEGORIES */}
      {activeSubTab === 'categories' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Kategori yang aktif akan ditampilkan pada tab filter di section Menu website publik.
            </p>
            <button
              type="button"
              onClick={handleOpenAddCat}
              className="px-4 py-2 rounded-xl bg-[#00E5FF] hover:bg-[#3cf0ff] text-slate-950 font-display font-bold text-xs tracking-wider uppercase flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Kategori</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {menuCategories.map((cat) => {
              const count = menuItems.filter((i) => i.categoryId === cat.id).length;
              return (
                <div
                  key={cat.id}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-mono tracking-widest text-[#00E5FF] uppercase">
                      KATEGORI
                    </span>
                    <h4 className="font-display font-bold text-base text-white uppercase mt-0.5">
                      {cat.name}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 font-mono">{count} Menu Terdaftar</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditCat(cat)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                      title="Edit Kategori"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirm({ type: 'category', id: cat.id, name: cat.name })
                      }
                      className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 cursor-pointer"
                      title="Hapus Kategori"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------- */}
      {/* MODAL: ADD / EDIT MENU ITEM                 */}
      {/* ------------------------------------------- */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-display font-black text-xl text-white uppercase tracking-tight">
                {editingItem ? 'EDIT MENU ITEM' : 'TAMBAH MENU ITEM BARU'}
              </h3>
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
                    Nama Menu
                  </label>
                  <input
                    type="text"
                    required
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    placeholder="Contoh: Leton Aren Signature"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
                    Kategori Menu
                  </label>
                  <select
                    value={itemForm.categoryId}
                    onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
                  >
                    {menuCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
                    Harga (IDR)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1000}
                    value={itemForm.price}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, price: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
                    Badge / Label Khusus (Opsional)
                  </label>
                  <input
                    type="text"
                    value={itemForm.badge || ''}
                    onChange={(e) => setItemForm({ ...itemForm, badge: e.target.value })}
                    placeholder="BESTSELLER / REFRESHING"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
                  Deskripsi Menu
                </label>
                <textarea
                  rows={3}
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  placeholder="Ceritakan komposisi atau cita rasa menu..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <ImageUploadField
                  label="Foto Menu"
                  value={itemForm.image}
                  onChange={(url) => setItemForm({ ...itemForm, image: url })}
                  aspectRatio="4:3"
                  description="Upload foto menu dengan rasio 4:3 atau 1:1."
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="menu-available-checkbox"
                  checked={itemForm.isAvailable}
                  onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })}
                  className="w-4 h-4 rounded text-cyan-400 bg-slate-950 border-slate-800 focus:ring-0"
                />
                <label
                  htmlFor="menu-available-checkbox"
                  className="text-xs text-slate-300 font-medium cursor-pointer"
                >
                  Status Menu: <span className="font-bold text-white">Tersedia untuk Dipesan</span>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#3cf0ff] text-slate-950 font-display font-bold text-xs tracking-wider uppercase flex items-center gap-2 cursor-pointer shadow-lg shadow-[#00E5FF]/20"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Menu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------- */}
      {/* MODAL: ADD / EDIT CATEGORY                  */}
      {/* ------------------------------------------- */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-display font-black text-xl text-white uppercase tracking-tight">
                {editingCat ? 'EDIT KATEGORI' : 'TAMBAH KATEGORI BARU'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCatModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCat} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-2">
                  Nama Kategori
                </label>
                <input
                  type="text"
                  required
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value.toUpperCase() })}
                  placeholder="Contoh: SIGNATURE SERIES"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-[#00E5FF]"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#3cf0ff] text-slate-950 font-display font-bold text-xs tracking-wider uppercase flex items-center gap-2 cursor-pointer shadow-lg shadow-[#00E5FF]/20"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Kategori</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------- */}
      {/* MODAL: DELETE CONFIRMATION                  */}
      {/* ------------------------------------------- */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-rose-500/40 p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="font-display font-bold text-lg text-white">Konfirmasi Hapus</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus {deleteConfirm.type === 'item' ? 'menu' : 'kategori'}{' '}
              <strong className="text-white font-semibold">"{deleteConfirm.name}"</strong>? Tindakan ini
              akan langsung tersimpan ke database.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-xs tracking-wider uppercase shadow-lg shadow-rose-900/30 cursor-pointer"
              >
                Hapus Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
