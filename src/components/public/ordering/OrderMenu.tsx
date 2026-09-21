import React, { useState, useMemo } from 'react';
import { OrderOutlet, CartItem, MenuItem, AddOnOption } from '../../../types';
import { useContent } from '../../../context/ContentContext';
import { formatRupiah } from '../../../utils/formatters';
import { resolveMediaUrl } from '../../../utils/api';
import { calculateItemUnitPrice } from '../../../data/addOnsData';
import { ProductAddOnsModal } from './ProductAddOnsModal';
import {
  isMenuItemAvailableForOutlet,
  subscribeToOutletStockRealtime,
} from '../../../utils/supabaseStock';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Store,
  ChevronRight,
  Sparkles,
  Coffee,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OrderMenuProps {
  outlet: OrderOutlet;
  cart: CartItem[];
  onAddToCart: (
    product: MenuItem,
    size?: AddOnOption,
    topping?: AddOnOption,
    syrup?: AddOnOption,
    quantity?: number,
    note?: string
  ) => void;
  onUpdateCartQuantity: (cartItemId: string, delta: number) => void;
  onOpenCart: () => void;
  onChangeOutlet: () => void;
  preSelectedProduct?: MenuItem | null;
  onClearPreSelectedProduct?: () => void;
}

export const OrderMenu: React.FC<OrderMenuProps> = ({
  outlet,
  cart,
  onAddToCart,
  onUpdateCartQuantity,
  onOpenCart,
  onChangeOutlet,
  preSelectedProduct,
  onClearPreSelectedProduct,
}) => {
  const { data, refreshData } = useContent();
  const { menuCategories, menuItems } = data;

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customizingProduct, setCustomizingProduct] = useState<MenuItem | null>(null);

  // Subscribe to live stock broadcast updates
  React.useEffect(() => {
    const unsub = subscribeToOutletStockRealtime((payload) => {
      if (!payload.outletId || payload.outletId === outlet?.id) {
        refreshData();
      }
    });
    return () => unsub();
  }, [outlet?.id, refreshData]);

  // Auto-open modal if a preSelectedProduct was passed
  React.useEffect(() => {
    if (preSelectedProduct) {
      setCustomizingProduct(preSelectedProduct);
      if (onClearPreSelectedProduct) {
        onClearPreSelectedProduct();
      }
    }
  }, [preSelectedProduct, onClearPreSelectedProduct]);

  // Standard category grouping
  const categoriesList = useMemo(() => {
    return [...(menuCategories || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [menuCategories]);

  // Filtered menu
  const filteredItems = useMemo(() => {
    return (menuItems || [])
      .filter((item) => {
        const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory;
        const matchesSearch =
          !searchQuery.trim() ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [menuItems, selectedCategory, searchQuery]);

  // Cart summary
  const totalCartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  const totalCartAmount = useMemo(() => {
    return cart.reduce(
      (acc, item) =>
        acc + calculateItemUnitPrice(item.product.price, item.size, item.topping, item.syrup, item.customOptions) * item.quantity,
      0
    );
  }, [cart]);

  const getProductQuantityInCart = (productId: string): number => {
    return cart
      .filter((it) => it.product.id === productId)
      .reduce((sum, it) => sum + it.quantity, 0);
  };

  const handleOpenAddOns = (item: MenuItem) => {
    setCustomizingProduct(item);
  };

  const handleConfirmAddOns = (
    product: MenuItem,
    size: AddOnOption,
    topping: AddOnOption,
    syrup: AddOnOption,
    quantity: number,
    note?: string
  ) => {
    onAddToCart(product, size, topping, syrup, quantity, note);
  };

  return (
    <div className="w-full pb-32">
      {/* Top Banner: Active Outlet Switcher */}
      <div className="bg-white/95 border-b border-[#e4efff] sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#eef4ff] text-[#006389] flex items-center justify-center shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-display font-black text-xs sm:text-sm text-[#041d32] truncate">
                  Outlet {outlet.name}
                </h3>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-[#eef4ff] text-[#006389] text-[10px] font-bold">
                  Fast Pick-up
                </span>
              </div>
              <span className="text-[11px] text-[#3e484f] truncate block">
                Buka s/d 23.00 • {outlet.address || 'Dumai'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onChangeOutlet}
              className="text-xs font-bold text-[#006389] hover:underline px-2.5 py-1 rounded-lg hover:bg-[#eef4ff] transition-colors cursor-pointer"
            >
              Ganti Outlet
            </button>

            {totalCartCount > 0 && (
              <button
                onClick={onOpenCart}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#006389] hover:bg-[#004c6b] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{totalCartCount} item</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-4 sm:pt-6">
        {/* Search and Category Filters */}
        <div className="space-y-3.5 mb-6">
          {/* Search Bar */}
          <div className="relative w-full max-w-lg mx-auto sm:mx-0">
            <Search className="w-4 h-4 text-[#3e484f] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kopi, mocktail, cemilan favorit..."
              className="w-full h-11 pl-10 pr-4 rounded-full bg-[#eef4ff] border border-[#e4efff] focus:border-[#006389] focus:bg-white text-[#041d32] placeholder-[#3e484f]/60 text-xs sm:text-sm focus:outline-none transition-all shadow-xs"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none py-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#006389] text-white shadow-sm'
                  : 'bg-white text-[#041d32] border border-[#e4efff] hover:border-[#bec8d1] shadow-2xs'
              }`}
            >
              Semua ({menuItems.length})
            </button>

            {categoriesList.map((cat) => {
              const count = menuItems.filter((m) => m.categoryId === cat.id).length;
              const isActive = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#006389] text-white shadow-sm'
                      : 'bg-white text-[#041d32] border border-[#e4efff] hover:border-[#bec8d1] shadow-2xs'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Section Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-base sm:text-lg text-[#041d32] tracking-tight">
            Katalog Pilihan
          </h3>
          <span className="text-xs font-bold text-[#006389] bg-[#eef4ff] px-2.5 py-0.5 rounded-full">
            {filteredItems.length} Menu
          </span>
        </div>

        {/* Menu Items Grid - Compact 2-column on mobile, responsive */}
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-white border border-[#e4efff] shadow-xs">
            <Coffee className="w-10 h-10 text-[#3e484f]/40 mx-auto mb-2.5" />
            <p className="font-bold text-[#041d32] text-sm">Menu Tidak Ditemukan</p>
            <p className="text-[#3e484f] text-xs mt-1">
              Coba gunakan kata kunci pencarian lain atau pilih kategori yang berbeda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
            {filteredItems.map((item) => {
              const qtyInCart = getProductQuantityInCart(item.id);
              const isAvailable = isMenuItemAvailableForOutlet(item, outlet?.id);

              return (
                <div
                  key={item.id}
                  className={`rounded-xl p-2.5 bg-white border transition-all flex flex-col justify-between overflow-hidden group relative ${
                    qtyInCart > 0
                      ? 'border-[#006389] shadow-[0_4px_16px_rgba(0,99,137,0.12)] ring-1 ring-[#006389]/20'
                      : 'border-[#e4efff] shadow-[0_2px_8px_rgba(0,99,137,0.04)] hover:shadow-[0_4px_16px_rgba(0,99,137,0.08)] hover:border-[#bec8d1]'
                  }`}
                >
                  {/* Card Main Click Area: opens Add-ons modal */}
                  <div
                    onClick={() => isAvailable && handleOpenAddOns(item)}
                    className="cursor-pointer"
                  >
                    {/* Media Thumbnail */}
                    <div className="relative aspect-square w-full bg-[#eef4ff] rounded-lg overflow-hidden mb-2">
                      <img
                        src={resolveMediaUrl(item.image)}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />

                      {/* Badge */}
                      {item.badge && (
                        <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-xs text-[#006389] text-[9px] font-bold uppercase tracking-wider shadow-xs">
                          {item.badge}
                        </div>
                      )}

                      {/* Stock Out Overlay */}
                      {!isAvailable && (
                        <div className="absolute inset-0 bg-[#041d32]/75 backdrop-blur-2xs flex items-center justify-center p-2 text-center">
                          <span className="px-2 py-1 rounded bg-rose-900/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                            HABIS
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="mb-2">
                      <span className="text-[10px] text-[#3e484f]/70 uppercase tracking-wider block font-bold truncate">
                        {categoriesList.find(c => c.id === item.categoryId)?.name || 'Leton Special'}
                      </span>
                      <h4 className="font-bold text-xs sm:text-sm text-[#041d32] group-hover:text-[#006389] transition-colors line-clamp-1 leading-snug mt-0.5">
                        {item.name}
                      </h4>
                      {item.description && (
                        <p className="text-[11px] text-[#3e484f]/80 line-clamp-1 mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Price & Add Action Row */}
                  <div className="pt-1 border-t border-[#eef4ff] flex items-center justify-between gap-1.5">
                    <span className="font-black text-xs sm:text-sm text-[#006389] whitespace-nowrap">
                      {formatRupiah(item.price)}
                    </span>

                    {!isAvailable ? (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                        Habis
                      </span>
                    ) : qtyInCart > 0 ? (
                      <div className="flex items-center gap-1">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#eef4ff] text-[#006389] text-[10px] font-bold">
                          <Check className="w-2.5 h-2.5" />
                          <span>{qtyInCart}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenAddOns(item)}
                          className="w-7 h-7 rounded-lg bg-[#006389] text-white flex items-center justify-center shadow-xs active:scale-90 transition-transform cursor-pointer"
                          title="Tambah lagi / Kustomisasi"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenAddOns(item)}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#006389] hover:bg-[#004c6b] text-white flex items-center justify-center shadow-xs active:scale-90 transition-transform cursor-pointer"
                        title="Tambah ke Pesanan"
                      >
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky Bottom Floating Cart Bar - Stitch Style */}
      <AnimatePresence>
        {totalCartCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-4 sm:bottom-6 inset-x-0 px-4 z-40 max-w-lg mx-auto"
          >
            <div className="bg-[#006389] text-white rounded-xl px-4 py-3 shadow-[0_10px_25px_rgba(0,99,137,0.35)] flex items-center justify-between gap-3 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 rounded-lg bg-[#004c6b] flex items-center justify-center text-white shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                  <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-[#ffddb8] text-[#2a1700] text-[10px] font-black">
                    {totalCartCount}
                  </span>
                </div>
                <div>
                  <span className="font-extrabold text-sm text-white block leading-tight">
                    {totalCartCount} Item • {formatRupiah(totalCartAmount)}
                  </span>
                  <span className="text-[10px] text-white/80 block mt-0.5">
                    {outlet.name} • Siap Pesan
                  </span>
                </div>
              </div>

              <button
                onClick={onOpenCart}
                id="view-cart-bottom-bar-btn"
                className="px-3.5 py-1.5 rounded-lg bg-white text-[#006389] font-bold text-xs tracking-wide uppercase transition-all shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer hover:bg-[#eef4ff]"
              >
                <span>Lihat Keranjang</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Add-Ons Customization Modal */}
      <ProductAddOnsModal
        product={customizingProduct}
        outletId={outlet?.id}
        isOpen={!!customizingProduct}
        onClose={() => setCustomizingProduct(null)}
        onConfirm={handleConfirmAddOns}
      />
    </div>
  );
};
