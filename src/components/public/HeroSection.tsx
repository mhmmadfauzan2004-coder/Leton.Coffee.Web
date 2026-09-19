import React from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';
import { ShoppingBag, BookOpen, Coffee, Star } from 'lucide-react';

interface HeroSectionProps {
  onOpenOrder?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenOrder }) => {
  const { data } = useContent();
  const { siteSettings } = data;

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
      className="relative w-full overflow-hidden pt-28 sm:pt-36 pb-16 lg:pb-28 bg-[#F8FBFF]"
    >
      {/* Ambient Luminous Shapes */}
      <div className="absolute -top-24 -left-20 w-96 h-96 rounded-full bg-[#E0F2FE]/50 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-24 w-[30rem] h-[30rem] rounded-full bg-[#BAE6FD]/30 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Hero Text Column (7 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 flex flex-col items-start gap-4 sm:gap-5"
          >
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E0F2FE] text-[#0284C7] shadow-sm">
              <Coffee className="w-4 h-4 text-[#0284C7]" />
              <span className="text-xs uppercase tracking-wider font-bold">
                {siteSettings.tagline || "Dumai's First Specialty Roaster & Cafe"}
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="font-display font-black text-3xl sm:text-5xl lg:text-6xl text-[#172033] tracking-tight leading-[1.12]">
              {siteSettings.heroTitle || 'Segelas Kopi Istimewa di Pesisir Dumai.'}
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-[#64748B] max-w-2xl leading-relaxed">
              {siteSettings.heroDescription ||
                'Biji kopi artisan pilihan Nusantara disangrai dan diracik presisi oleh barista bersertifikat untuk menemani setiap cerita Anda di Kota Minyak. Nikmati kesegaran racikan pesisir modern.'}
            </p>

            {/* Dual CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2 w-full sm:w-auto">
              {onOpenOrder && (
                <button
                  onClick={onOpenOrder}
                  id="hero-order-online-cta"
                  className="inline-flex items-center justify-center gap-2.5 px-6 sm:px-7 py-3.5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-sm shadow-[0_4px_14px_rgba(2,132,199,0.25)] hover:shadow-none transition-all group cursor-pointer"
                >
                  <ShoppingBag className="w-5 h-5 transition-transform group-hover:scale-110" />
                  <span>ORDER ONLINE SEKARANG</span>
                </button>
              )}

              <a
                href="#menu"
                onClick={scrollToMenu}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-[#172033] font-bold text-sm border border-[#E0F2FE] shadow-sm hover:bg-[#F0F7FF] transition-all"
              >
                <BookOpen className="w-5 h-5 text-[#0284C7]" />
                <span>Lihat Daftar Menu</span>
              </a>
            </div>

            {/* Trust Badges Bar */}
            <div className="pt-4 grid grid-cols-3 gap-3 sm:gap-5 w-full max-w-xl">
              <div className="p-3 sm:p-3.5 rounded-xl bg-white border border-[#E0F2FE] shadow-sm flex flex-col">
                <span className="text-base sm:text-xl text-[#0284C7] font-extrabold">100%</span>
                <span className="text-xs text-[#64748B] mt-0.5 leading-snug">Arabica &amp; Fine Robusta</span>
              </div>
              <div className="p-3 sm:p-3.5 rounded-xl bg-white border border-[#E0F2FE] shadow-sm flex flex-col">
                <span className="text-base sm:text-xl text-[#0284C7] font-extrabold">2 Outlet</span>
                <span className="text-xs text-[#64748B] mt-0.5 leading-snug">Sudirman &amp; Kelakap 7</span>
              </div>
              <div className="p-3 sm:p-3.5 rounded-xl bg-white border border-[#E0F2FE] shadow-sm flex flex-col">
                <span className="text-base sm:text-xl text-[#0284C7] font-extrabold flex items-center gap-1">
                  4.9 <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 fill-amber-500 inline" />
                </span>
                <span className="text-xs text-[#64748B] mt-0.5 leading-snug">5.000+ Ulasan Google</span>
              </div>
            </div>
          </motion.div>

          {/* Hero Visual Presentation (5 cols) - Clean Pure Photo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="lg:col-span-5 relative"
          >
            <div className="relative mx-auto w-full max-w-lg">
              <div className="relative w-full aspect-[4/5] sm:aspect-[4/5] lg:aspect-[4/5] max-h-[460px] rounded-3xl overflow-hidden shadow-2xl bg-slate-100">
                <img
                  src={resolveMediaUrl(siteSettings.heroBgImage)}
                  alt={siteSettings.brandName || "Leton Coffee"}
                  className="w-full h-full object-cover object-center"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
