import React, { useState, useMemo } from 'react';
import { useContent } from '../../context/ContentContext';
import { MenuItem } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/api';
import {
  isMenuItemAvailableForOutlet,
  updateMenuItemOutletStock,
  bulkSetOutletStock,
  normalizeOutletStockId,
} from '../../utils/supabaseStock';
import {
  Boxes,
  CheckCircle2,
  XCircle,
  Search,
  Store,
  RefreshCw,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

export const StockManager: React.FC = () => {
  const { data, updateData, auth } = useContent();
  const { menuItems, menuCategories } = data;

  const isOutletAdmin = auth.role === 'outlet_admin';
  const assignedOutletId = normalizeOutletStockId(auth.outletId || 'sudirman');

  // Active outlet scope for stock management
  const [selectedOutletScope, setSelectedOutletScope] = useState<string>(
    isOutletAdmin ? assignedOutletId : 'sudirman'
  );

  const activeOutletId = isOutletAdmin ? assignedOutletId : selectedOutletScope;
  const activeOutletName =
    activeOutletId === 'sudirman'
      ? 'Leton Sudirman — Chapter 5'
      : 'Leton Kelakap 7 / Ratusima — Chapter 6';

  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCat = selectedCat === 'all' || item.categoryId === selectedCat;
      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menuItems, selectedCat, searchQuery]);

  const handleToggleStock = async (itemId: string, currentAvailable: boolean) => {
    setIsSaving(true);
    setSavingItemId(itemId);
    try {
      const newStatus = !currentAvailable;
      const res = await updateMenuItemOutletStock(
        itemId,
        activeOutletId,
        newStatus,
        data
      );
      if (res.success && res.updatedData) {
        await updateData(res.updatedData);
      }
    } finally {
      setIsSaving(false);
      setSavingItemId(null);
    }
  };

  const handleBulkSet = async (available: boolean) => {
    setIsSaving(true);
    try {
      const res = await bulkSetOutletStock(
        activeOutletId,
        available,
        selectedCat,
        data
      );
      if (res.success && res.updatedData) {
        await updateData(res.updatedData);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const availableCount = menuItems.filter((m) =>
    isMenuItemAvailableForOutlet(m, activeOutletId)
  ).length;
  const unavailableCount = menuItems.length - availableCount;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-mono uppercase tracking-widest mb-2">
            <Boxes className="w-3.5 h-3.5" />
            <span>KONTROL STOK PER OUTLET</span>
          </div>
          <h2 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
            STATUS KETERSEDIAAN MENU (STOCK)
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Pengaturan stok bersifat <strong>terpisah per cabang</strong>. Perubahan pada cabang ini tidak akan mempengaruhi cabang lain.
          </p>
        </div>

        {/* Quick bulk actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleBulkSet(true)}
            disabled={isSaving}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Set Semua Tersedia ({activeOutletId === 'sudirman' ? 'Sudirman' : 'Kelakap 7'})</span>
          </button>
          <button
            onClick={() => handleBulkSet(false)}
            disabled={isSaving}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-rose-400 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Set Semua Habis ({activeOutletId === 'sudirman' ? 'Sudirman' : 'Kelakap 7'})</span>
          </button>
        </div>
      </div>

      {/* Outlet Selector (For Super Admin) or Fixed Outlet Badge (For Branch Admin) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00E5FF]/15 border border-[#00E5FF]/30 flex items-center justify-center text-[#00E5FF]">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-400">
              {isOutletAdmin ? 'OUTLET RESMI ANDA (TERKUNCI)' : 'PILIH CABANG TARGET PENGATURAN STOK'}
            </div>
            <div className="font-display font-bold text-base text-white mt-0.5 flex items-center gap-2">
              <span>{activeOutletName}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-[#00E5FF] border border-[#00E5FF]/40">
                ID: {activeOutletId}
              </span>
            </div>
          </div>
        </div>

        {/* Super Admin Switcher Buttons */}
        {!isOutletAdmin && (
          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setSelectedOutletScope('sudirman')}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                activeOutletId === 'sudirman'
                  ? 'bg-[#00E5FF] text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📍 Sudirman (Ch. 5)
            </button>
            <button
              onClick={() => setSelectedOutletScope('kelakap_7')}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                activeOutletId === 'kelakap_7'
                  ? 'bg-[#00E5FF] text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📍 Kelakap 7 (Ch. 6)
            </button>
          </div>
        )}
      </div>

      {/* Stats Summary for Active Outlet */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <span className="text-[10px] font-mono uppercase text-slate-400">TOTAL MENU</span>
          <div className="font-mono font-black text-2xl text-white mt-1">
            {menuItems.length}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30">
          <span className="text-[10px] font-mono uppercase text-emerald-400">
            TERSEDIA DI {activeOutletId.toUpperCase()}
          </span>
          <div className="font-mono font-black text-2xl text-emerald-400 mt-1">
            {availableCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-rose-500/30">
          <span className="text-[10px] font-mono uppercase text-rose-400">
            HABIS DI {activeOutletId.toUpperCase()}
          </span>
          <div className="font-mono font-black text-2xl text-rose-400 mt-1">
            {unavailableCount}
          </div>
        </div>
      </div>

      {/* Filter and search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCat('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-display font-bold uppercase whitespace-nowrap transition-colors ${
              selectedCat === 'all'
                ? 'bg-[#00E5FF] text-slate-950 font-black'
                : 'bg-slate-900 text-slate-300 border border-slate-800'
            }`}
          >
            Semua ({menuItems.length})
          </button>
          {menuCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-display font-bold uppercase whitespace-nowrap transition-colors ${
                selectedCat === cat.id
                  ? 'bg-[#00E5FF] text-slate-950 font-black'
                  : 'bg-slate-900 text-slate-300 border border-slate-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-[#00E5FF]"
          />
        </div>
      </div>

      {/* Stock Cards Table / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const isAvailableInActiveOutlet = isMenuItemAvailableForOutlet(
            item,
            activeOutletId
          );
          const isCurrentlySavingThis = savingItemId === item.id;

          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                isAvailableInActiveOutlet
                  ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950/90 border-rose-500/40 opacity-80'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-slate-800 relative">
                  <img
                    src={resolveMediaUrl(item.image)}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {!isAvailableInActiveOutlet && (
                    <div className="absolute inset-0 bg-rose-950/80 flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-rose-400" />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h4 className="font-display font-bold text-sm text-white truncate">
                    {item.name}
                  </h4>
                  <span className="font-mono text-xs text-[#00E5FF] block">
                    {formatRupiah(item.price)}
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase ${
                        isAvailableInActiveOutlet ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isAvailableInActiveOutlet ? '● TERSEDIA' : '✕ HABIS (SOLD OUT)'}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      ({activeOutletId === 'sudirman' ? 'Sudirman' : 'Kelakap 7'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Toggle Button */}
              <button
                disabled={isSaving}
                onClick={() => handleToggleStock(item.id, isAvailableInActiveOutlet)}
                className={`px-3 py-2 rounded-xl text-xs font-mono font-bold uppercase transition-all shrink-0 cursor-pointer ${
                  isAvailableInActiveOutlet
                    ? 'bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300'
                    : 'bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300'
                }`}
              >
                {isCurrentlySavingThis ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : isAvailableInActiveOutlet ? (
                  'Set Habis'
                ) : (
                  'Aktifkan'
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
