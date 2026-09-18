import React, { useState } from 'react';
import { CartItem, OrderOutlet } from '../../../types';
import { formatRupiah } from '../../../utils/formatters';
import { resolveMediaUrl } from '../../../utils/api';
import { generateCartItemId, calculateItemUnitPrice } from '../../../data/addOnsData';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  FileText,
  Store,
  Layers,
  Sparkles,
  Droplets,
} from 'lucide-react';
import { motion } from 'motion/react';

interface OrderCartDrawerProps {
  outlet: OrderOutlet;
  cart: CartItem[];
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onUpdateNote: (cartItemId: string, note: string) => void;
  generalNote: string;
  onUpdateGeneralNote: (note: string) => void;
  onClose: () => void;
  onContinue: () => void;
}

export const OrderCartDrawer: React.FC<OrderCartDrawerProps> = ({
  outlet,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateNote,
  generalNote,
  onUpdateGeneralNote,
  onClose,
  onContinue,
}) => {
  const [editingNoteForId, setEditingNoteForId] = useState<string | null>(null);

  const getItemId = (item: CartItem): string => {
    return (
      item.id ||
      generateCartItemId(item.product.id, item.size?.name, item.topping?.name, item.syrup?.name)
    );
  };

  const getItemUnitPrice = (item: CartItem): number => {
    return calculateItemUnitPrice(item.product.price, item.size, item.topping, item.syrup);
  };

  const subtotal = cart.reduce(
    (acc, item) => acc + getItemUnitPrice(item) * item.quantity,
    0
  );
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/80 backdrop-blur-sm animate-fadeIn">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-lg bg-[#070b12] border-l border-slate-800 h-full flex flex-col justify-between shadow-2xl"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB]/20 border border-[#2563EB]/40 flex items-center justify-center text-[#00E5FF]">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-black text-lg text-white uppercase tracking-wider leading-none">
                KERANJANG PESANAN
              </h2>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400 font-mono">
                <Store className="w-3 h-3 text-[#00E5FF]" />
                <span className="truncate max-w-[200px]">{outlet.shortName || outlet.name}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Tutup Keranjang"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-4">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <p className="font-display font-bold text-white text-base">Keranjang Anda Masih Kosong</p>
              <p className="text-slate-400 text-xs mt-1 max-w-xs">
                Pilih menu kopi atau minuman favorit Anda untuk memulai pesanan.
              </p>
              <button
                onClick={onClose}
                className="mt-6 px-5 py-2.5 rounded-xl bg-[#2563EB] text-white text-xs font-display font-bold tracking-wider uppercase hover:bg-[#1d4ed8] transition-colors"
              >
                PILIH MENU
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {cart.map((item) => {
                  const itemId = getItemId(item);
                  const unitPrice = getItemUnitPrice(item);
                  const itemSubtotal = unitPrice * item.quantity;
                  const isEditingNote = editingNoteForId === itemId;
                  const hasSize = item.size && item.size.name;
                  const hasTopping = item.topping && item.topping.name !== 'No Topping';
                  const hasSyrup = item.syrup && item.syrup.name !== 'No Syrup';

                  return (
                    <div
                      key={itemId}
                      className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800/90 space-y-3 shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        {/* Thumbnail */}
                        {item.product.image && (
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-slate-800">
                            <img
                              src={resolveMediaUrl(item.product.image)}
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}

                        {/* Name & Price Breakdown */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-display font-bold text-sm text-white truncate">
                            {item.product.name}
                          </h4>
                          <span className="font-mono text-xs text-slate-400 block mt-0.5">
                            Harga Dasar: {formatRupiah(item.product.price)}
                          </span>

                          {/* Customization Details */}
                          <div className="mt-1 space-y-0.5 text-[11px] font-mono">
                            {hasSize && (
                              <div className="text-[#00E5FF] flex items-center gap-1">
                                <Layers className="w-3 h-3 text-[#00E5FF]" />
                                <span className="text-slate-400">Size:</span>
                                <span className="font-bold">{item.size!.name}</span>
                                {item.size!.price > 0 && <span>(+{formatRupiah(item.size!.price)})</span>}
                              </div>
                            )}

                            {hasTopping && (
                              <div className="text-[#38BDF8] flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-[#38BDF8]" />
                                <span className="text-slate-400">Topping:</span>
                                <span className="font-bold">{item.topping!.name}</span>
                                <span>(+{formatRupiah(item.topping!.price)})</span>
                              </div>
                            )}

                            {hasSyrup && (
                              <div className="text-[#818CF8] flex items-center gap-1">
                                <Droplets className="w-3 h-3 text-[#818CF8]" />
                                <span className="text-slate-400">Syrup:</span>
                                <span className="font-bold">{item.syrup!.name}</span>
                                <span>(+{formatRupiah(item.syrup!.price)})</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-1.5 flex items-center gap-2 font-mono">
                            <span className="text-[11px] text-slate-400">Harga/item: {formatRupiah(unitPrice)}</span>
                            <span className="text-slate-600">•</span>
                            <span className="font-bold text-xs text-[#00E5FF]">
                              Total: {formatRupiah(itemSubtotal)}
                            </span>
                          </div>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1 shrink-0">
                          <button
                            onClick={() => onUpdateQuantity(itemId, -1)}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-colors cursor-pointer"
                            aria-label="Kurangi"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono font-bold text-xs text-white px-2">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(itemId, 1)}
                            className="w-7 h-7 rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white flex items-center justify-center transition-colors cursor-pointer"
                            aria-label="Tambah"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => onRemoveItem(itemId)}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800/60 rounded-xl transition-colors shrink-0 cursor-pointer"
                          title="Hapus menu"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Item Note Section */}
                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                        {isEditingNote ? (
                          <div className="w-full flex items-center gap-2">
                            <input
                              type="text"
                              value={item.note || ''}
                              onChange={(e) => onUpdateNote(itemId, e.target.value)}
                              placeholder="Contoh: Less ice, gula dipisah..."
                              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-[#00E5FF]"
                              autoFocus
                            />
                            <button
                              onClick={() => setEditingNoteForId(null)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#2563EB] text-white text-[11px] font-bold cursor-pointer"
                            >
                              Simpan
                            </button>
                          </div>
                        ) : (
                          <div className="w-full flex items-center justify-between">
                            <span className="text-slate-400 italic truncate max-w-[280px]">
                              {item.note ? `Catatan: "${item.note}"` : 'Belum ada catatan khusus'}
                            </span>
                            <button
                              onClick={() => setEditingNoteForId(itemId)}
                              className="text-[#00E5FF] hover:underline font-mono text-[11px] shrink-0 cursor-pointer"
                            >
                              {item.note ? 'Ubah Catatan' : '+ Tambah Catatan'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* General Order Notes */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono uppercase text-slate-400">
                  <FileText className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <span>Catatan Tambahan untuk Barista</span>
                </div>
                <textarea
                  rows={2}
                  value={generalNote}
                  onChange={(e) => onUpdateGeneralNote(e.target.value)}
                  placeholder="Misal: Siapkan sedotan, dibuat sekarang..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-[#2563EB] resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer Summary & Continue CTA */}
        {cart.length > 0 && (
          <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950 space-y-4">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal ({totalItems} item)</span>
                <span className="font-mono text-slate-200">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Biaya Layanan</span>
                <span className="font-mono text-emerald-400 font-bold">GRATIS</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                <span className="font-display font-bold text-sm text-white uppercase tracking-wider">
                  TOTAL PESANAN
                </span>
                <span className="font-mono font-black text-xl text-[#00E5FF]">
                  {formatRupiah(subtotal)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={onClose}
                className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-display font-bold text-xs tracking-wider uppercase transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>TAMBAH MENU</span>
              </button>

              <button
                onClick={onContinue}
                id="cart-continue-checkout-btn"
                className="py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-display font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-[#2563EB]/30 hover:shadow-[#2563EB]/50 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>CONTINUE</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
