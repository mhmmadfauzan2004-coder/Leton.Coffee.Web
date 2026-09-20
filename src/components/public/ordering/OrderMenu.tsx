import React, { useState, useMemo } from 'react';
import { OrderOutlet, CartItem, MenuItem, AddOnOption } from '../../../types';
import { useContent } from '../../../context/ContentContext';
import { formatRupiah } from '../../../utils/formatters';
import { resolveMediaUrl } from '../../../utils/api';
import { calculateItemUnitPrice } from '../../../data/addOnsData';
import { ProductAddOnsModal } from './ProductAddOnsModal';
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
  const { data } = useContent();
  const { menuCategories, menuItems } = data;

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customizingProduct, setCustomizingProduct] = useState<MenuItem | null>(null);

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
      <div className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/40 flex items-center justify-center text-[#00E5FF] shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Memesan dari outlet:
              </span>
              <h3 className="font-display font-black text-sm text-white truncate">
                {outlet.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onChangeOutlet}
              className="text-xs font-mono text-[#00E5FF] hover:underline px-2 py-1 rounded border border-[#00E5FF]/30 hover:bg-[#00E5FF]/10 transition-colors cursor-pointer"
            >
              Ganti Outlet
            </button>

            {totalCartCount > 0 && (
              <button
                onClick={onOpenCart}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-display font-bold uppercase tracking-wider shadow-md shadow-[#2563EB]/20 transition-all cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{totalCartCount} item</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-6">
        {/* Search and Category Filters */}
        <div className="space-y-4 mb-8">
          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kopi, mocktail, artisan tea..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-[#00E5FF] transition-all"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs font-display font-bold tracking-wider uppercase whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#2563EB] text-white shadow-md shadow-[#2563EB]/30'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
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
                  className={`px-4 py-2 rounded-xl text-xs font-display font-bold tracking-wider uppercase whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-md shadow-[#2563EB]/30'
                      : 'bg-slate-900/80 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Menu Items Grid */}
        {filteredItems.length === 0 ? (
          <div className="py-20 text-center rounded-3xl bg-slate-900/40 border border-slate-800">
            <Coffee className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="font-display font-bold text-white text-base">Menu Tidak Ditemukan</p>
            <p className="text-slate-400 text-xs mt-1">
              Coba gunakan kata kunci pencarian lain atau pilih kategori yang berbeda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
            {filteredItems.map((item) => {
              const qtyInCart = getProductQuantityInCart(item.id);
              const isAvailable = item.isAvailable !== false;

              return (
                <div
                  key={item.id}
                  className={`rounded-3xl bg-slate-900/80 border transition-all flex flex-col justify-between overflow-hidden group ${
                    qtyInCart > 0
                      ? 'border-[#00E5FF]/60 shadow-lg shadow-[#00E5FF]/10 ring-1 ring-[#00E5FF]/30'
                      : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Card Main Click Area: opens Add-ons modal */}
                  <div
                    onClick={() => isAvailable && handleOpenAddOns(item)}
                    className="cursor-pointer"
                  >
                    {/* Media Thumbnail */}
                    <div className="relative aspect-4/3 w-full bg-slate-950 overflow-hidden">
                      <img
                        src={resolveMediaUrl(item.image)}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

                      {/* Badge */}
                      {item.badge && (
                        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-[#2563EB] text-white text-[9px] font-black font-mono tracking-wider uppercase shadow-md">
                          {item.badge}
                        </div>
                      )}

                      {/* Stock Out Overlay */}
                      {!isAvailable && (
                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3">
                          <span className="px-3 py-1.5 rounded-lg bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-mono font-bold uppercase tracking-wider text-center shadow-lg">
                            STOK HABIS / SOLD OUT
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display font-bold text-base text-white group-hover:text-[#60A5FA] transition-colors leading-snug">
                            {item.name}
                          </h4>
                          <span className="font-mono font-bold text-sm text-[#00E5FF] whitespace-nowrap">
                            {formatRupiah(item.price)}
                          </span>
                        </div>

                        <p className="mt-1.5 text-xs text-slate-300 leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Add to Cart / Add-Ons Action */}
                  <div className="p-4 pt-0">
                    {!isAvailable ? (
                      <button
                        disabled
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-800/60 text-slate-500 text-xs font-bold font-display uppercase tracking-wider cursor-not-allowed border border-slate-700/40"
                      >
                        TIDAK TERSEDIA
                      </button>
                    ) : qtyInCart > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-3 py-2 bg-slate-950 rounded-xl border border-[#00E5FF]/40 text-xs">
                          <span className="font-mono font-bold text-[#00E5FF] flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" />
                            <span>{qtyInCart} di keranjang</span>
                          </span>
                          <button
                            type="button"
                            onClick={onOpenCart}
                            className="text-slate-300 hover:text-white text-[11px] font-mono underline cursor-pointer"
                          >
                            Lihat Keranjang
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenAddOns(item)}
                          className="w-full py-2 px-3 rounded-xl bg-[#2563EB]/20 hover:bg-[#2563EB]/30 border border-[#00E5FF]/50 text-[#00E5FF] font-display font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ TAMBAH / KUSTOMISASI</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenAddOns(item)}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#00E5FF] hover:from-[#1d4ed8] hover:to-[#38bdf8] text-white font-display font-black text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-md shadow-[#2563EB]/25 hover:shadow-cyan-500/40 active:scale-[0.98] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>TAMBAH KE PESANAN</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky Bottom Floating Cart Bar */}
      <AnimatePresence>
        {totalCartCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-4 left-4 right-4 z-40 max-w-2xl mx-auto"
          >
            <div className="bg-slate-950/95 border-2 border-[#00E5FF]/70 rounded-2xl p-3 sm:p-4 shadow-2xl shadow-black/80 backdrop-blur-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#00E5FF] to-blue-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/25 shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-mono font-black flex items-center justify-center border-2 border-slate-950">
                    {totalCartCount}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">
                    TOTAL {totalCartCount} ITEM
                  </span>
                  <span className="font-mono font-black text-base sm:text-lg text-white">
                    {formatRupiah(totalCartAmount)}
                  </span>
                </div>
              </div>

              <button
                onClick={onOpenCart}
                id="view-cart-bottom-bar-btn"
                className="px-5 py-3 rounded-xl bg-[#00E5FF] hover:bg-[#38bdf8] text-slate-950 font-display font-black text-xs sm:text-sm tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <span>LIHAT KERANJANG</span>
                <span className="text-base leading-none">→</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Add-Ons Customization Modal */}
      <ProductAddOnsModal
        product={customizingProduct}
        isOpen={!!customizingProduct}
        onClose={() => setCustomizingProduct(null)}
        onConfirm={handleConfirmAddOns}
      />
    </div>
  );
};
