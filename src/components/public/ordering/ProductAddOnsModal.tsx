import React, { useState, useEffect, useMemo } from 'react';
import { MenuItem, AddOnOption } from '../../../types';
import {
  TOPPING_OPTIONS,
  SYRUP_OPTIONS,
  DEFAULT_TOPPING,
  DEFAULT_SYRUP,
  calculateItemUnitPrice,
} from '../../../data/addOnsData';
import { formatRupiah } from '../../../utils/formatters';
import { resolveMediaUrl } from '../../../utils/api';
import { X, Plus, Minus, Check, Coffee, Sparkles, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProductAddOnsModalProps {
  product: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    product: MenuItem,
    topping: AddOnOption,
    syrup: AddOnOption,
    quantity: number,
    note?: string
  ) => void;
  initialTopping?: AddOnOption;
  initialSyrup?: AddOnOption;
  initialQuantity?: number;
  initialNote?: string;
}

export const ProductAddOnsModal: React.FC<ProductAddOnsModalProps> = ({
  product,
  isOpen,
  onClose,
  onConfirm,
  initialTopping,
  initialSyrup,
  initialQuantity = 1,
  initialNote = '',
}) => {
  const [selectedTopping, setSelectedTopping] = useState<AddOnOption>(DEFAULT_TOPPING);
  const [selectedSyrup, setSelectedSyrup] = useState<AddOnOption>(DEFAULT_SYRUP);
  const [quantity, setQuantity] = useState<number>(1);
  const [note, setNote] = useState<string>('');

  // Reset or load initial values whenever product opens
  useEffect(() => {
    if (isOpen && product) {
      setSelectedTopping(initialTopping || DEFAULT_TOPPING);
      setSelectedSyrup(initialSyrup || DEFAULT_SYRUP);
      setQuantity(initialQuantity > 0 ? initialQuantity : 1);
      setNote(initialNote || '');
    }
  }, [isOpen, product, initialTopping, initialSyrup, initialQuantity, initialNote]);

  const unitPrice = useMemo(() => {
    if (!product) return 0;
    return calculateItemUnitPrice(product.price, selectedTopping, selectedSyrup);
  }, [product, selectedTopping, selectedSyrup]);

  const totalPrice = useMemo(() => {
    return unitPrice * quantity;
  }, [unitPrice, quantity]);

  if (!isOpen || !product) return null;

  const handleConfirm = () => {
    onConfirm(product, selectedTopping, selectedSyrup, quantity, note.trim() || undefined);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.96 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-lg bg-[#070b12] border border-slate-800 sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Header Product Preview */}
          <div className="relative p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/90 flex items-start justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3.5 min-w-0">
              {product.image && (
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0 shadow-md">
                  <img
                    src={resolveMediaUrl(product.image)}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] text-[10px] font-mono font-bold uppercase tracking-wider mb-1">
                  <Coffee className="w-3 h-3 text-[#00E5FF]" />
                  <span>KUSTOMISASI MENU</span>
                </div>
                <h3 className="font-display font-black text-base sm:text-lg text-white truncate leading-snug">
                  {product.name}
                </h3>
                <span className="font-mono font-bold text-sm text-[#00E5FF] block">
                  {formatRupiah(product.price)}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              id="close-addon-modal-btn"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* TOPPING SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-display font-black text-xs sm:text-sm text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-3.5 rounded-full bg-[#00E5FF]" />
                    <span>ADD ONS — TOPPING</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Pilih 1 jenis topping untuk memperkaya tekstur minuman Anda (Default: No Topping).
                  </p>
                </div>
                <span className="text-[10px] font-mono text-[#00E5FF] bg-[#00E5FF]/10 px-2 py-0.5 rounded-md border border-[#00E5FF]/20">
                  PILIH 1
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TOPPING_OPTIONS.map((opt) => {
                  const isSelected = selectedTopping.name === opt.name;
                  return (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => setSelectedTopping(opt)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-[#00E5FF]/10 border-[#00E5FF] ring-1 ring-[#00E5FF]/50 shadow-md shadow-[#00E5FF]/15 text-white'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? 'border-[#00E5FF] bg-[#00E5FF]'
                              : 'border-slate-600 bg-slate-950'
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                        </div>
                        <span className="text-xs font-medium truncate">{opt.name}</span>
                      </div>

                      <span
                        className={`text-xs font-mono font-bold whitespace-nowrap ${
                          opt.price === 0
                            ? 'text-slate-400'
                            : isSelected
                            ? 'text-[#00E5FF]'
                            : 'text-slate-300'
                        }`}
                      >
                        {opt.price === 0 ? 'Rp0' : `+${formatRupiah(opt.price)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SYRUP SECTION */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-display font-black text-xs sm:text-sm text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-3.5 rounded-full bg-[#38BDF8]" />
                    <span>ADD ONS — SYRUP</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Tambahkan varian syrup aroma spesial (Default: No Syrup).
                  </p>
                </div>
                <span className="text-[10px] font-mono text-[#38BDF8] bg-[#38BDF8]/10 px-2 py-0.5 rounded-md border border-[#38BDF8]/20">
                  PILIH 1
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SYRUP_OPTIONS.map((opt) => {
                  const isSelected = selectedSyrup.name === opt.name;
                  return (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => setSelectedSyrup(opt)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-[#38BDF8]/10 border-[#38BDF8] ring-1 ring-[#38BDF8]/50 shadow-md shadow-[#38BDF8]/15 text-white'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? 'border-[#38BDF8] bg-[#38BDF8]'
                              : 'border-slate-600 bg-slate-950'
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                        </div>
                        <span className="text-xs font-medium truncate">{opt.name}</span>
                      </div>

                      <span
                        className={`text-xs font-mono font-bold whitespace-nowrap ${
                          opt.price === 0
                            ? 'text-slate-400'
                            : isSelected
                            ? 'text-[#38BDF8]'
                            : 'text-slate-300'
                        }`}
                      >
                        {opt.price === 0 ? 'Rp0' : `+${formatRupiah(opt.price)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SPECIAL NOTE SECTION */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2 text-xs font-display font-bold text-slate-300 uppercase tracking-wider">
                <MessageSquare className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>CATATAN KHUSUS (OPSIONAL)</span>
              </div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: Less ice, pisah gula, cup terpisah..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00E5FF] transition-colors"
                maxLength={120}
              />
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/95 shrink-0 space-y-3">
            {/* Price breakdown summary */}
            <div className="flex items-center justify-between text-xs text-slate-300">
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-400">Rincian per item:</span>
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-slate-300">
                  <span>{formatRupiah(product.price)}</span>
                  {selectedTopping.price > 0 && (
                    <span className="text-[#00E5FF]">+{formatRupiah(selectedTopping.price)}</span>
                  )}
                  {selectedSyrup.price > 0 && (
                    <span className="text-[#38BDF8]">+{formatRupiah(selectedSyrup.price)}</span>
                  )}
                  <span className="text-slate-500">=</span>
                  <span className="text-white font-bold">{formatRupiah(unitPrice)}</span>
                </div>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Kurangi jumlah"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-mono font-bold text-xs text-white px-2">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-7 h-7 rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Tambah jumlah"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Confirm Add to Cart CTA */}
            <button
              type="button"
              onClick={handleConfirm}
              id="confirm-add-ons-btn"
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#00E5FF] via-[#38BDF8] to-[#2563EB] hover:from-[#3cf0ff] hover:to-[#1d4ed8] text-slate-950 font-display font-black text-xs sm:text-sm tracking-wider uppercase flex items-center justify-between shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 active:scale-[0.99] transition-all cursor-pointer"
            >
              <span>TAMBAH KE PESANAN</span>
              <span className="font-mono font-black text-sm sm:text-base">
                {formatRupiah(totalPrice)}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
