import React, { useState, useMemo } from 'react';
import { useContent } from '../../context/ContentContext';
import { formatRupiah, createWhatsAppLink } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';
import { UtensilsCrossed, MessageCircle, AlertCircle, ShoppingBag, Search } from 'lucide-react';
import { MenuItem } from '../../types';

interface MenuSectionProps {
  onOpenOrder?: (item?: MenuItem) => void;
}

export const MenuSection: React.FC<MenuSectionProps> = ({ onOpenOrder }) => {
  const { data } = useContent();
  const { menuCategories, menuItems, contactSettings } = data;
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sorted categories
  const sortedCategories = useMemo(() => {
    return [...menuCategories].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [menuCategories]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems
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

  const handleOrderWhatsApp = (menuName: string) => {
    const message = `Halo Leton Coffee, saya ingin memesan ${menuName}.`;
    const url = createWhatsAppLink(contactSettings.whatsapp, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section
      id="menu"
      className="relative w-full bg-[#F8FBFF] py-20 sm:py-28 border-t border-[#E0F2FE]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E0F2FE] text-[#0284C7] text-xs font-mono tracking-wider uppercase mb-3 font-bold shadow-sm">
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>05 — CRAFTED MENU &amp; SPECIALTY BEVERAGES</span>
          </div>

          <h2 className="font-display font-black text-3xl sm:text-5xl text-[#172033] tracking-tight uppercase">
            THE FLAVOR ARCHIVE
          </h2>

          <p className="mt-3 text-[#64748B] text-sm sm:text-base max-w-xl mx-auto">
            Dari racikan espresso khas Dumai hingga mocktail segar buah tropis. Sekarang dapat dipesan langsung secara online.
          </p>

          {onOpenOrder && (
            <div className="mt-6">
              <button
                onClick={() => onOpenOrder()}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs sm:text-sm tracking-wide uppercase shadow-[0_4px_14px_rgba(2,132,199,0.25)] transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                <ShoppingBag className="w-4 h-4 text-white" />
                <span>MULAI ORDER ONLINE (DINE IN / TAKE AWAY)</span>
                <span className="text-base leading-none">→</span>
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Category Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10">
          {/* Categories Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold uppercase whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#0284C7] text-white shadow-sm'
                  : 'bg-white text-[#64748B] hover:text-[#172033] border border-[#E0F2FE] hover:bg-[#F0F7FF]'
              }`}
            >
              SEMUA ({menuItems.length})
            </button>

            {sortedCategories.map((cat) => {
              const count = menuItems.filter((m) => m.categoryId === cat.id).length;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold uppercase whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0284C7] text-white shadow-sm'
                      : 'bg-white text-[#64748B] hover:text-[#172033] border border-[#E0F2FE] hover:bg-[#F0F7FF]'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <div className="w-full sm:w-72 shrink-0 relative">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari menu favorit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-[#E0F2FE] text-[#172033] placeholder-[#94A3B8] text-xs focus:outline-none focus:border-[#38BDF8] transition-colors shadow-sm"
            />
          </div>
        </div>

        {/* Menu Grid */}
        {filteredItems.length === 0 ? (
          <div className="py-20 text-center rounded-2xl bg-white border border-[#E0F2FE] shadow-sm">
            <AlertCircle className="w-10 h-10 text-[#64748B] mx-auto mb-3" />
            <p className="text-[#172033] font-semibold">Tidak ada menu yang sesuai dengan filter.</p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="mt-3 px-4 py-1.5 text-xs font-bold text-[#0284C7] hover:underline cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: (idx % 4) * 0.05 }}
                className="bg-white rounded-2xl border border-[#E0F2FE] p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-all group"
              >
                <div>
                  {/* Image container */}
                  <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-[#F0F7FF] border border-[#E0F2FE] mb-3">
                    <img
                      src={resolveMediaUrl(item.image)}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />

                    {/* Badge */}
                    {item.badge && (
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-[#0284C7] text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                        {item.badge}
                      </div>
                    )}

                    {/* Availability Tag */}
                    {!item.isAvailable && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                        <span className="px-3 py-1 rounded-lg bg-rose-600 text-white font-mono text-xs font-bold uppercase tracking-wider">
                          HABIS / SOLD OUT
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title & Price */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-bold text-base text-[#172033] leading-snug">
                      {item.name}
                    </h3>
                  </div>

                  <div className="mt-1">
                    <span className="font-mono font-extrabold text-base text-[#0284C7]">
                      {formatRupiah(item.price)}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-[#64748B] leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>

                {/* Footer Action Button */}
                <div className="pt-4 mt-2 border-t border-[#E0F2FE] flex items-center gap-2">
                  {onOpenOrder ? (
                    <>
                      <button
                        onClick={() => item.isAvailable && onOpenOrder(item)}
                        disabled={!item.isAvailable}
                        id={`order-online-btn-${item.id}`}
                        className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          item.isAvailable
                            ? 'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-sm active:scale-[0.98]'
                            : 'bg-[#F1F5F9] text-[#94A3B8] border border-[#E0F2FE] cursor-not-allowed'
                        }`}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>{item.isAvailable ? 'PESAN' : 'HABIS'}</span>
                      </button>

                      {item.isAvailable && (
                        <button
                          onClick={() => handleOrderWhatsApp(item.name)}
                          title="Pesan via WhatsApp"
                          className="p-2 rounded-xl bg-white hover:bg-[#F0F7FF] border border-[#E0F2FE] text-[#0284C7] transition-colors cursor-pointer shrink-0"
                        >
                          <MessageCircle className="w-4 h-4 text-emerald-600" />
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => handleOrderWhatsApp(item.name)}
                      disabled={!item.isAvailable}
                      id={`order-wa-btn-${item.id}`}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        item.isAvailable
                          ? 'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-sm'
                          : 'bg-[#F1F5F9] text-[#94A3B8] border border-[#E0F2FE] cursor-not-allowed'
                      }`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{item.isAvailable ? 'ORDER WA' : 'HABIS'}</span>
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
