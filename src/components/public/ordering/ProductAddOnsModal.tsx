import React, { useState, useEffect, useMemo } from 'react';
import { MenuItem, AddOnOption, CustomizationOption, ProductSizeOption, SelectedCustomOption } from '../../../types';
import { useContent } from '../../../context/ContentContext';
import {
  DEFAULT_SIZES,
  DEFAULT_MASTER_TOPPINGS,
  DEFAULT_MASTER_SYRUPS,
  DEFAULT_SIZE,
  DEFAULT_TOPPING,
  DEFAULT_SYRUP,
  calculateItemUnitPrice,
} from '../../../data/addOnsData';
import { formatRupiah } from '../../../utils/formatters';
import { resolveMediaUrl } from '../../../utils/api';
import { X, Plus, Minus, Coffee, Sparkles, MessageSquare, Layers, Droplets, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isMenuItemAvailableForOutlet } from '../../../utils/supabaseStock';

interface ProductAddOnsModalProps {
  product: MenuItem | null;
  outletId?: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    product: MenuItem,
    size: AddOnOption,
    topping: AddOnOption,
    syrup: AddOnOption,
    quantity: number,
    note?: string,
    customOptions?: SelectedCustomOption[]
  ) => void;
  initialSize?: AddOnOption;
  initialTopping?: AddOnOption;
  initialSyrup?: AddOnOption;
  initialCustomOptions?: SelectedCustomOption[];
  initialQuantity?: number;
  initialNote?: string;
}

export const ProductAddOnsModal: React.FC<ProductAddOnsModalProps> = ({
  product,
  outletId,
  isOpen,
  onClose,
  onConfirm,
  initialSize,
  initialTopping,
  initialSyrup,
  initialCustomOptions,
  initialQuantity = 1,
  initialNote = '',
}) => {
  const { data } = useContent();

  const isAvailableInOutlet = isMenuItemAvailableForOutlet(product, outletId);

  // Dynamic Master Toppings from Context/DB
  const masterToppings: CustomizationOption[] = useMemo(() => {
    if (Array.isArray(data.masterToppings) && data.masterToppings.length > 0) {
      return data.masterToppings.filter((t) => t.isActive);
    }
    return DEFAULT_MASTER_TOPPINGS.filter((t) => t.isActive);
  }, [data.masterToppings]);

  // Dynamic Master Syrups from Context/DB
  const masterSyrups: CustomizationOption[] = useMemo(() => {
    if (Array.isArray(data.masterSyrups) && data.masterSyrups.length > 0) {
      return data.masterSyrups.filter((s) => s.isActive);
    }
    return DEFAULT_MASTER_SYRUPS.filter((s) => s.isActive);
  }, [data.masterSyrups]);

  // Sizes available for this specific product
  const availableSizes: ProductSizeOption[] = useMemo(() => {
    if (!product) return DEFAULT_SIZES;
    if (Array.isArray(product.sizes) && product.sizes.length > 0) {
      return product.sizes;
    }
    return DEFAULT_SIZES;
  }, [product]);

  // Toppings available for this specific product
  const availableToppings: AddOnOption[] = useMemo(() => {
    if (!product || product.hasTopping === false) return [];
    let list = masterToppings;
    if (Array.isArray(product.availableToppingIds) && product.availableToppingIds.length > 0) {
      list = masterToppings.filter(
        (t) => t.id === 'top-no-topping' || product.availableToppingIds?.includes(t.id)
      );
    }
    return list.map((t) => ({ id: t.id, name: t.name, price: t.price }));
  }, [product, masterToppings]);

  // Syrups available for this specific product
  const availableSyrups: AddOnOption[] = useMemo(() => {
    if (!product || product.hasSyrup === false) return [];
    let list = masterSyrups;
    if (Array.isArray(product.availableSyrupIds) && product.availableSyrupIds.length > 0) {
      list = masterSyrups.filter(
        (s) => s.id === 'syr-no-syrup' || product.availableSyrupIds?.includes(s.id)
      );
    }
    return list.map((s) => ({ id: s.id, name: s.name, price: s.price }));
  }, [product, masterSyrups]);

  // Dynamic Customization Groups enabled for this specific product
  const activeCustomGroups = useMemo(() => {
    if (!product || !Array.isArray(data.customizationGroups)) return [];
    return data.customizationGroups
      .filter((group) => {
        // Must have options
        if (!group.options || group.options.length === 0) return false;
        // Only show if explicitly enabled for this product in product.customizations
        if (!Array.isArray(product.customizations)) return false;
        const setting = product.customizations.find((c) => c.groupId === group.id);
        return setting ? setting.enabled === true : false;
      })
      .map((group) => {
        // Filter: only show ACTIVE options, and sort them by order
        const activeOpts = (group.options || [])
          .filter((o) => o.isActive !== false)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        return {
          ...group,
          options: activeOpts,
        };
      })
      .filter((group) => group.options.length > 0) // Only show groups that have at least one active option
      .sort((a, b) => (a.order || 0) - (b.order || 0)); // Sort customization groups by order
  }, [product, data.customizationGroups]);

  const hasSizeOption = product?.hasSize !== false && availableSizes.length > 0;
  const hasToppingOption = product?.hasTopping !== false && availableToppings.length > 0;
  const hasSyrupOption = product?.hasSyrup !== false && availableSyrups.length > 0;

  // Selected state
  const [selectedSize, setSelectedSize] = useState<AddOnOption>(DEFAULT_SIZE);
  const [selectedTopping, setSelectedTopping] = useState<AddOnOption>(DEFAULT_TOPPING);
  const [selectedSyrup, setSelectedSyrup] = useState<AddOnOption>(DEFAULT_SYRUP);
  const [selectedCustoms, setSelectedCustoms] = useState<Record<string, SelectedCustomOption>>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [note, setNote] = useState<string>('');

  // Reset or load initial values whenever product opens
  useEffect(() => {
    if (isOpen && product) {
      // 1. Size
      if (initialSize) {
        setSelectedSize(initialSize);
      } else if (availableSizes.length > 0) {
        setSelectedSize({ name: availableSizes[0].name, price: availableSizes[0].price });
      } else {
        setSelectedSize(DEFAULT_SIZE);
      }

      // 2. Topping
      if (initialTopping) {
        setSelectedTopping(initialTopping);
      } else {
        const noTop = availableToppings.find((t) => (t?.name || '').toLowerCase().includes('no topping'));
        setSelectedTopping(noTop || availableToppings[0] || DEFAULT_TOPPING);
      }

      // 3. Syrup
      if (initialSyrup) {
        setSelectedSyrup(initialSyrup);
      } else {
        const noSyr = availableSyrups.find((s) => (s?.name || '').toLowerCase().includes('no syrup'));
        setSelectedSyrup(noSyr || availableSyrups[0] || DEFAULT_SYRUP);
      }

      // 4. Dynamic Customizations
      const initialCustomsMap: Record<string, SelectedCustomOption> = {};
      activeCustomGroups.forEach((group) => {
        const foundInitial = initialCustomOptions?.find((c) => c.groupId === group.id);
        if (foundInitial) {
          initialCustomsMap[group.id] = foundInitial;
        } else if (group.options && group.options.length > 0) {
          const defaultOpt = group.options.find((o) => o.price === 0) || group.options[0];
          initialCustomsMap[group.id] = {
            groupId: group.id,
            groupName: group.name,
            optionId: defaultOpt.id,
            optionName: defaultOpt.name,
            price: defaultOpt.price,
          };
        }
      });
      setSelectedCustoms(initialCustomsMap);

      setQuantity(initialQuantity > 0 ? initialQuantity : 1);
      setNote(initialNote || '');
    }
  }, [
    isOpen,
    product,
    initialSize,
    initialTopping,
    initialSyrup,
    initialCustomOptions,
    initialQuantity,
    initialNote,
    availableSizes,
    availableToppings,
    availableSyrups,
    activeCustomGroups,
  ]);

  const unitPrice = useMemo(() => {
    if (!product) return 0;
    const s = hasSizeOption ? selectedSize : { name: 'Regular', price: 0 };
    const t = hasToppingOption ? selectedTopping : { name: 'No Topping', price: 0 };
    const sy = hasSyrupOption ? selectedSyrup : { name: 'No Syrup', price: 0 };
    const customs = Object.values(selectedCustoms);
    return calculateItemUnitPrice(product.price, s, t, sy, customs);
  }, [
    product,
    hasSizeOption,
    selectedSize,
    hasToppingOption,
    selectedTopping,
    hasSyrupOption,
    selectedSyrup,
    selectedCustoms,
  ]);

  const totalPrice = useMemo(() => {
    return unitPrice * quantity;
  }, [unitPrice, quantity]);

  if (!isOpen || !product) return null;

  const handleConfirm = () => {
    const finalSize = hasSizeOption ? selectedSize : { name: 'Regular', price: 0 };
    const finalTopping = hasToppingOption ? selectedTopping : { name: 'No Topping', price: 0 };
    const finalSyrup = hasSyrupOption ? selectedSyrup : { name: 'No Syrup', price: 0 };
    
    // Validate each customization option selection against actual active groups & active options
    const finalCustoms = Object.values(selectedCustoms)
      .filter((custom) => {
        const matchingGroup = activeCustomGroups.find((g) => g.id === custom.groupId);
        if (!matchingGroup) return false;
        const matchingOption = matchingGroup.options.find((o) => o.id === custom.optionId);
        return matchingOption ? true : false;
      })
      .map((custom) => {
        const matchingGroup = activeCustomGroups.find((g) => g.id === custom.groupId)!;
        const matchingOption = matchingGroup.options.find((o) => o.id === custom.optionId)!;
        return {
          ...custom,
          optionName: matchingOption.name,
          price: matchingOption.price,
        };
      });

    onConfirm(
      product,
      finalSize,
      finalTopping,
      finalSyrup,
      quantity,
      note.trim() || undefined,
      finalCustoms
    );
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
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-bold text-xs text-slate-400">Harga Dasar:</span>
                  <span className="font-mono font-bold text-sm text-[#00E5FF]">
                    {formatRupiah(product.price)}
                  </span>
                </div>
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
            {/* A. SIZE CUP SECTION */}
            {hasSizeOption && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-display font-black text-xs sm:text-sm text-white uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#00E5FF]" />
                      <span>A. SIZE CUP</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Pilih ukuran cup yang diinginkan (Wajib pilih 1).
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[#00E5FF] bg-[#00E5FF]/10 px-2 py-0.5 rounded-md border border-[#00E5FF]/20">
                    WAJIB
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {availableSizes.map((sizeOpt) => {
                    const isSelected = selectedSize.name === sizeOpt.name;
                    return (
                      <button
                        key={sizeOpt.name}
                        type="button"
                        onClick={() => setSelectedSize({ name: sizeOpt.name, price: sizeOpt.price })}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-[#00E5FF]/10 border-[#00E5FF] ring-1 ring-[#00E5FF]/50 shadow-md shadow-[#00E5FF]/15 text-white'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                              isSelected ? 'border-[#00E5FF] bg-[#00E5FF]' : 'border-slate-600 bg-slate-950'
                            }`}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                          </div>
                          <span className="text-xs font-bold truncate">{sizeOpt.name}</span>
                        </div>

                        <span
                          className={`text-xs font-mono font-bold whitespace-nowrap ${
                            sizeOpt.price === 0
                              ? 'text-slate-400'
                              : isSelected
                              ? 'text-[#00E5FF]'
                              : 'text-slate-300'
                          }`}
                        >
                          {sizeOpt.price === 0 ? '+Rp0' : `+${formatRupiah(sizeOpt.price)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* B. TOPPING / ADD-ONS SECTION */}
            {hasToppingOption && (
              <div className={`space-y-3 ${hasSizeOption ? 'pt-2 border-t border-slate-800/80' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-display font-black text-xs sm:text-sm text-white uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#38BDF8]" />
                      <span>B. TOPPING / ADD-ONS</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Pilih 1 jenis topping untuk memperkaya tekstur minuman (Default: No Topping).
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[#38BDF8] bg-[#38BDF8]/10 px-2 py-0.5 rounded-md border border-[#38BDF8]/20">
                    PILIH 1
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {availableToppings.map((opt) => {
                    const isSelected = selectedTopping.name === opt.name;
                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => setSelectedTopping(opt)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-[#38BDF8]/10 border-[#38BDF8] ring-1 ring-[#38BDF8]/50 shadow-md shadow-[#38BDF8]/15 text-white'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                              isSelected ? 'border-[#38BDF8] bg-[#38BDF8]' : 'border-slate-600 bg-slate-950'
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
                          {opt.price === 0 ? '+Rp0' : `+${formatRupiah(opt.price)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* C. SYRUP / ADD-ONS SECTION */}
            {hasSyrupOption && (
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-display font-black text-xs sm:text-sm text-white uppercase tracking-wider flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-[#818CF8]" />
                      <span>C. SYRUP / ADD-ONS</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Tambahkan aroma rasa sirup spesial (Default: No Syrup).
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[#818CF8] bg-[#818CF8]/10 px-2 py-0.5 rounded-md border border-[#818CF8]/20">
                    PILIH 1
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {availableSyrups.map((opt) => {
                    const isSelected = selectedSyrup.name === opt.name;
                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => setSelectedSyrup(opt)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-[#818CF8]/10 border-[#818CF8] ring-1 ring-[#818CF8]/50 shadow-md shadow-[#818CF8]/15 text-white'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                              isSelected ? 'border-[#818CF8] bg-[#818CF8]' : 'border-slate-600 bg-slate-950'
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
                              ? 'text-[#818CF8]'
                              : 'text-slate-300'
                          }`}
                        >
                          {opt.price === 0 ? '+Rp0' : `+${formatRupiah(opt.price)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DYNAMIC CUSTOMIZATION GROUPS SECTIONS */}
            {activeCustomGroups
              .filter((group) => {
                const groupName = (group?.name || '').toLowerCase();
                if (groupName.includes('toping donat')) {
                  return product.use_topping_donut === true;
                }
                if (groupName.includes('toping maincourse')) {
                  return product.use_topping_maincourse === true;
                }
                return true;
              })
              .map((group, groupIdx) => {
                const selectedOpt = selectedCustoms[group.id];
                const sectionLetter = String.fromCharCode(68 + groupIdx); // D, E, F...

                return (
                  <div key={group.id} className="space-y-3 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-display font-black text-xs sm:text-sm text-white uppercase tracking-wider flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#00E5FF]" />
                          <span>{sectionLetter}. {group.name.toUpperCase()}</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Pilih {group.name} sesuai selera.
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-[#00E5FF] bg-[#00E5FF]/10 px-2 py-0.5 rounded-md border border-[#00E5FF]/20">
                        PILIH 1
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {group.options.map((opt) => {
                        const isSelected = selectedOpt?.optionId === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustoms((prev) => ({
                                ...prev,
                                [group.id]: {
                                  groupId: group.id,
                                  groupName: group.name,
                                  optionId: opt.id,
                                  optionName: opt.name,
                                  price: opt.price,
                                },
                              }));
                            }}
                            className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-[#00E5FF]/10 border-[#00E5FF] ring-1 ring-[#00E5FF]/50 shadow-md shadow-[#00E5FF]/15 text-white'
                                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                                  isSelected ? 'border-[#00E5FF] bg-[#00E5FF]' : 'border-slate-600 bg-slate-950'
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
                              {opt.price === 0 ? '+Rp0' : `+${formatRupiah(opt.price)}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

            {/* SPECIAL NOTE SECTION */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2 text-xs font-display font-bold text-slate-300 uppercase tracking-wider">
                <MessageSquare className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>CATATAN PESANAN (OPSIONAL)</span>
              </div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: Less ice, gula sedikit, pisah cup..."
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
                  {hasSizeOption && selectedSize.price > 0 && (
                    <span className="text-[#00E5FF]">+{formatRupiah(selectedSize.price)}</span>
                  )}
                  {hasToppingOption && selectedTopping.price > 0 && (
                    <span className="text-[#38BDF8]">+{formatRupiah(selectedTopping.price)}</span>
                  )}
                  {hasSyrupOption && selectedSyrup.price > 0 && (
                    <span className="text-[#818CF8]">+{formatRupiah(selectedSyrup.price)}</span>
                  )}
                  {Object.values(selectedCustoms)
                    .filter((c) => c.price > 0)
                    .map((c) => (
                      <span key={c.groupId} className="text-[#00E5FF]">
                        +{formatRupiah(c.price)}
                      </span>
                    ))}
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

            {/* Stock status warning if unavailable */}
            {!isAvailableInOutlet && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 flex items-center gap-2 text-rose-300 text-xs font-mono">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Menu ini sedang HABIS di cabang yang dipilih.</span>
              </div>
            )}

            {/* Confirm Add to Cart CTA */}
            <button
              type="button"
              disabled={!isAvailableInOutlet}
              onClick={handleConfirm}
              id="confirm-add-ons-btn"
              className={`w-full py-3.5 px-5 rounded-2xl font-display font-black text-xs sm:text-sm tracking-wider uppercase flex items-center justify-between transition-all ${
                isAvailableInOutlet
                  ? 'bg-gradient-to-r from-[#00E5FF] via-[#38BDF8] to-[#2563EB] hover:from-[#3cf0ff] hover:to-[#1d4ed8] text-slate-950 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 active:scale-[0.99] cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <span>{isAvailableInOutlet ? 'TAMBAH KE PESANAN' : 'HABIS DI CABANG INI'}</span>
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
