import React, { useState, useMemo } from 'react';
import { useContent } from '../../context/ContentContext';
import { formatRupiah, createWhatsAppLink } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';
import { UtensilsCrossed, MessageCircle, Sparkles, AlertCircle, ShoppingBag } from 'lucide-react';
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
      className="relative min-h-screen w-full bg-[#070b12] py-28 sm:py-36 border-t border-slate-800/60"
    >
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#2563EB]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#2563EB]/15 border border-[#2563EB]/40 text-[#60A5FA] text-xs font-mono tracking-widest uppercase mb-4 shadow-md"
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>05 — CRAFTED MENU & SPECIALTY BEVERAGES</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="font-display font-black text-4xl sm:text-6xl text-white tracking-tight uppercase"
          >
            THE FLAVOR ARCHIVE
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-3 text-slate-300 text-base sm:text-lg max-w-xl mx-auto"
          >
            Dari racikan espresso khas Dumai hingga mocktail segar buah tropis. Sekarang dapat dipesan secara online.
          </motion.p>

          {onOpenOrder && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="mt-6"
            >
              <button
                onClick={() => onOpenOrder()}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#00E5FF] hover:from-[#1d4ed8] hover:to-[#38bdf8] text-white font-display font-black text-xs sm:text-sm tracking-wider uppercase shadow-xl shadow-[#2563EB]/30 hover:shadow-cyan-500/40 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <ShoppingBag className="w-4 h-4 text-white" />
                <span>MULAI ORDER ONLINE (DINE IN / TAKE AWAY)</span>
                <span className="text-base leading-none">→</span>
              </button>
            </motion.div>
          )}
        </div>

        {/* Dynamic Category Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-12">
          {/* Categories Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-display font-bold tracking-wider uppercase whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#2563EB] text-white shadow-md shadow-[#2563EB]/30'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
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
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-display font-bold tracking-wider uppercase whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-md shadow-[#2563EB]/30'
                      : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <div className="w-full sm:w-64 shrink-0">
            <input
              type="text"
              placeholder="Cari menu favorit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-[#2563EB] transition-colors"
            />
          </div>
        </div>

        {/* Menu Grid */}
        {filteredItems.length === 0 ? (
          <div className="py-20 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
            <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">Tidak ada menu yang sesuai dengan filter.</p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 text-xs font-bold text-[#60A5FA] hover:underline"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
            {filteredItems.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: (idx % 4) * 0.08 }}
                className="group flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1 cursor-default"
              >
                <div className="flex-1 flex flex-col">
                  {/* Image container - Matched to Barista Photo Card dimensions, aspect ratio & border-radius */}
                  <div className="relative aspect-[3/4] w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-900 border border-slate-800/80 group-hover:border-[#2563EB]/60 transition-all duration-300 shadow-xl group-hover:shadow-2xl group-hover:shadow-[#2563EB]/10 shrink-0">
                    <img
                      src={resolveMediaUrl(item.image)}
                      alt={item.name}
                      className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 pointer-events-none" />

                    {/* Badge */}
                    {item.badge && (
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-[#2563EB] text-white text-[10px] font-black font-mono tracking-wider uppercase shadow-md shadow-[#2563EB]/30">
                        {item.badge}
                      </div>
                    )}

                    {/* Availability Tag */}
                    {!item.isAvailable && (
                      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center">
                        <span className="px-3 py-1.5 rounded-lg bg-rose-950/95 border border-rose-500/60 text-rose-200 font-mono text-xs font-bold uppercase tracking-wider shadow-lg">
                          HABIS / SOLD OUT
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Text Content Directly Over Background - Frameless & High Contrast */}
                  <div className="pt-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display font-bold text-lg text-white group-hover:text-[#60A5FA] transition-colors leading-snug">
                          {item.name}
                        </h3>
                        <span className="font-mono font-bold text-sm sm:text-base text-[#60A5FA] whitespace-nowrap">
                          {formatRupiah(item.price)}
                        </span>
                      </div>

                      <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-2 font-normal">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Action - Clean Frameless Button */}
                <div className="pt-3 flex items-center gap-2">
                  {onOpenOrder ? (
                    <>
                      <button
                        onClick={() => item.isAvailable && onOpenOrder(item)}
                        disabled={!item.isAvailable}
                        id={`order-online-btn-${item.id}`}
                        className={`flex-1 py-2.5 px-3 rounded-xl font-display font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          item.isAvailable
                            ? 'bg-[#2563EB] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563EB]/25 hover:shadow-lg hover:shadow-[#2563EB]/40 active:scale-[0.98]'
                            : 'bg-slate-800/60 text-slate-500 border border-slate-700/40 cursor-not-allowed'
                        }`}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>{item.isAvailable ? 'PESAN ONLINE' : 'TIDAK TERSEDIA'}</span>
                      </button>

                      {item.isAvailable && (
                        <button
                          onClick={() => handleOrderWhatsApp(item.name)}
                          title="Pesan via WhatsApp"
                          className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                        >
                          <MessageCircle className="w-4 h-4 text-emerald-400" />
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => handleOrderWhatsApp(item.name)}
                      disabled={!item.isAvailable}
                      id={`order-wa-btn-${item.id}`}
                      className={`w-full py-2.5 px-4 rounded-xl font-display font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        item.isAvailable
                          ? 'bg-[#2563EB] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563EB]/25 hover:shadow-lg hover:shadow-[#2563EB]/40 active:scale-[0.98]'
                          : 'bg-slate-800/60 text-slate-500 border border-slate-700/40 cursor-not-allowed'
                      }`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{item.isAvailable ? 'ORDER VIA WHATSAPP' : 'MENU TIDAK TERSEDIA'}</span>
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
