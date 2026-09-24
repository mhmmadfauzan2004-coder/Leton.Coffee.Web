import React, { useMemo } from 'react';
import { useContent } from '../../context/ContentContext';
import { PromoBannerCarousel } from './PromoBannerCarousel';
import { motion } from 'motion/react';
import { ShoppingBag, BookOpen, Star, MapPin, Sparkles } from 'lucide-react';

interface HeroSectionProps {
  onOpenOrder?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenOrder }) => {
  const { data } = useContent();
  const { siteSettings } = data;

  // Active and sorted promo banners
  const activeBanners = useMemo(() => {
    const rawList = Array.isArray(data.promoBanners) ? data.promoBanners : [];
    const activeOnly = rawList
      .filter((b) => b.isActive !== false && typeof b.imageUrl === 'string' && b.imageUrl.trim().length > 0)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    if (activeOnly.length > 0) {
      return activeOnly;
    }

    // High quality default fallback promo banner
    return [
      {
        id: 'default-hero-banner',
        imageUrl: siteSettings.heroBgImage || '/assets/leton-coffee-beans.jpg',
        title: 'Leton Coffee Dumai',
        subtitle: "Dumai's First Specialty Roaster & Cafe",
        sortOrder: 1,
        isActive: true,
      },
    ];
  }, [data.promoBanners, siteSettings.heroBgImage]);

  const scrollToMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const menuEl = document.getElementById('menu');
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      id="home"
      className="relative w-full overflow-hidden pt-16 sm:pt-20 pb-12 sm:pb-16 bg-[#F8FBFF]"
    >
      {/* 1. Multi Promo Banner Carousel — FULL WIDTH (Edge-to-Edge, No text overlay on photo) */}
      <div className="w-full relative z-10">
        <PromoBannerCarousel
          banners={activeBanners}
          autoSlideInterval={4500}
          aspectRatioClass="aspect-[16/8] sm:aspect-[16/7] md:aspect-[21/9] lg:aspect-[24/9]"
          className="w-full rounded-none shadow-sm"
          onBannerClick={() => {
            if (onOpenOrder) onOpenOrder();
          }}
        />
      </div>

      {/* Ambient Luminous Background Accents */}
      <div className="absolute top-1/2 -left-20 w-96 h-96 rounded-full bg-[#E0F2FE]/40 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-24 w-[30rem] h-[30rem] rounded-full bg-[#BAE6FD]/25 blur-3xl pointer-events-none" />

      {/* 2. Below Carousel: Text Hero, Dual CTA Buttons & Info Cards */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 mt-6 sm:mt-10 space-y-6 sm:space-y-8">
        {/* TEXT HERO (Heading & Deskripsi Rata Kiri) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-start text-left gap-2.5 sm:gap-3.5"
        >
          <h1 className="font-display font-black text-2xl sm:text-4xl lg:text-5xl text-[#172033] tracking-tight leading-[1.15]">
            {siteSettings.heroTitle || 'Bridging Your Desire of Coffee'}
          </h1>
          <p className="text-sm sm:text-base text-[#64748B] max-w-2xl leading-relaxed">
            {siteSettings.heroDescription ||
              'Ruang temu semua kalangan dengan sajian kopi spesialti berkarakter, atmosfer dinamis, dan semangat komunitas kreatif tanpa batas.'}
          </p>
        </motion.div>

        {/* 3. URUTAN TOMBOL: [ ORDER ONLINE SEKARANG ] & [ LIHAT DAFTAR MENU ] */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center justify-start gap-3 sm:gap-4 w-full pt-1"
        >
          {onOpenOrder && (
            <button
              onClick={onOpenOrder}
              id="hero-order-online-cta"
              className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-extrabold text-sm tracking-wide uppercase shadow-[0_4px_16px_rgba(2,132,199,0.25)] hover:shadow-none transition-all group cursor-pointer active:scale-[0.98]"
            >
              <ShoppingBag className="w-5 h-5 transition-transform group-hover:scale-110" />
              <span>ORDER ONLINE SEKARANG</span>
            </button>
          )}

          <a
            href="#menu"
            onClick={scrollToMenu}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-[#172033] hover:text-[#0284C7] font-bold text-sm border border-[#E0F2FE] shadow-xs hover:bg-[#F0F7FF] transition-all text-center cursor-pointer active:scale-[0.98]"
          >
            <BookOpen className="w-5 h-5 text-[#0284C7]" />
            <span>Lihat Daftar Menu</span>
          </a>
        </motion.div>

        {/* 4. INFO CARDS / TRUST BADGES */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-3 gap-2.5 sm:gap-4 w-full pt-4 border-t border-[#E0F2FE]/70"
        >
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-[#E0F2FE] shadow-xs flex flex-col items-center text-center transition-all hover:border-[#BAE6FD]">
            <span className="text-sm sm:text-lg text-[#0284C7] font-black tracking-tight flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#0284C7] hidden sm:inline" />
              100%
            </span>
            <span className="text-[10px] sm:text-xs text-[#64748B] mt-0.5 font-medium leading-tight">
              Arabica &amp; Robusta
            </span>
          </div>

          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-[#E0F2FE] shadow-xs flex flex-col items-center text-center transition-all hover:border-[#BAE6FD]">
            <span className="text-sm sm:text-lg text-[#0284C7] font-black tracking-tight flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#0284C7] hidden sm:inline" />
              2 Outlet
            </span>
            <span className="text-[10px] sm:text-xs text-[#64748B] mt-0.5 font-medium leading-tight">
              Sudirman &amp; Kelakap 7
            </span>
          </div>

          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-[#E0F2FE] shadow-xs flex flex-col items-center text-center transition-all hover:border-[#BAE6FD]">
            <span className="text-sm sm:text-lg text-[#0284C7] font-black tracking-tight flex items-center gap-1">
              4.9 <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 fill-amber-500 inline" />
            </span>
            <span className="text-[10px] sm:text-xs text-[#64748B] mt-0.5 font-medium leading-tight">
              5.000+ Ulasan
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
