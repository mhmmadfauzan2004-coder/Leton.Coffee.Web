import React from 'react';
import { useContent } from '../../context/ContentContext';
import { createWhatsAppLink } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';
import { MessageCircle, ArrowDown, Sparkles, ShoppingBag, Coffee, ArrowRight } from 'lucide-react';

interface HeroSectionProps {
  onOpenOrder?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenOrder }) => {
  const { data } = useContent();
  const { siteSettings, contactSettings } = data;

  const orderWALink = createWhatsAppLink(
    contactSettings.whatsapp,
    `Halo ${siteSettings.brandName}, saya ingin pesan kopi & menu spesialti.`
  );

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
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#070b12]"
    >
      {/* Background Image with slow zoom */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <motion.div
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 3, ease: 'easeOut' }}
          className="w-full h-full"
        >
          <img
            src={resolveMediaUrl(siteSettings.heroBgImage)}
            alt={siteSettings.brandName}
            className="w-full h-full object-cover object-center filter brightness-60 contrast-110"
            referrerPolicy="no-referrer"
          />
        </motion.div>
        {/* Dark Navy / Cyan Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b12] via-[#070b12]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070b12]/80 via-transparent to-[#070b12]/70" />
        <div className="absolute inset-0 bg-radial from-transparent via-[#070b12]/30 to-[#070b12]/90" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 sm:py-36 text-center flex flex-col items-center">
        {/* Section Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#2563EB]/20 border border-[#2563EB]/40 text-[#60A5FA] text-xs font-mono tracking-widest uppercase mb-6 backdrop-blur-md shadow-lg shadow-[#2563EB]/10"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#60A5FA] animate-pulse" />
          <span>01 — {siteSettings.tagline || 'EVERYDAY SPECIALTY COFFEE'}</span>
        </motion.div>

        {/* Brand Name / Title */}
        <motion.h1
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="font-display font-black text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight text-white uppercase max-w-5xl leading-[1.05]"
        >
          {siteSettings.heroTitle}
        </motion.h1>

        {/* Subtitle / Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-6 text-base sm:text-lg md:text-xl text-slate-200 max-w-2xl font-normal leading-relaxed text-balance"
        >
          {siteSettings.heroDescription}
        </motion.p>

        {/* Redesigned Premium Specialty Coffee CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          className="mt-10 flex flex-col items-center justify-center w-full sm:w-auto"
        >
          <div className="relative group inline-flex items-center justify-center w-full sm:w-auto">
            {/* Ambient Electric Blue Aura Glow */}
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#00E5FF]/50 via-[#38BDF8]/60 to-[#2563EB]/50 blur-xl opacity-75 group-hover:opacity-100 group-hover:blur-2xl transition-all duration-500 pointer-events-none" />

            {/* Main Interactive CTA Button */}
            <button
              onClick={onOpenOrder}
              id="hero-order-online-cta"
              className="relative w-full sm:w-auto flex items-center justify-center gap-3.5 px-8 sm:px-10 py-4 sm:py-4.5 rounded-full bg-gradient-to-r from-[#00E5FF] via-[#38BDF8] to-[#00E5FF] hover:from-[#3cf0ff] hover:to-[#38bdf8] text-slate-950 font-display font-black text-sm sm:text-base tracking-[0.16em] uppercase shadow-[0_0_25px_rgba(0,229,255,0.45)] hover:shadow-[0_0_40px_rgba(0,229,255,0.7)] transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 cursor-pointer overflow-hidden border border-white/30"
            >
              {/* Coffee culture emblem circle */}
              <span className="w-8 h-8 rounded-full bg-slate-950 flex items-center justify-center text-[#00E5FF] shrink-0 shadow-inner group-hover:rotate-12 transition-transform duration-300">
                <Coffee className="w-4 h-4" />
              </span>

              {/* Precise high-contrast typography */}
              <span className="leading-none text-slate-950">ORDER ONLINE</span>

              {/* Directional arrow badge */}
              <span className="w-7 h-7 rounded-full bg-slate-950/10 flex items-center justify-center text-slate-950 shrink-0 group-hover:translate-x-1 transition-transform duration-300">
                <ArrowRight className="w-4 h-4" />
              </span>
            </button>
          </div>

          {/* Specialty Micro-Indicator */}
          <div className="mt-3.5 flex items-center justify-center gap-2 text-[11px] font-mono tracking-wider text-slate-300/80">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
            <span className="text-[#00E5FF] font-bold">Dumai Chapter 5 & 6</span>
            <span className="text-slate-500">•</span>
            <span>Dine In & Take Away</span>
          </div>
        </motion.div>
      </div>

      {/* Bottom Scene Indicator */}
      <div className="absolute bottom-8 left-0 right-0 z-10 flex flex-col items-center pointer-events-none opacity-80">
        <span className="text-[11px] font-mono tracking-widest text-slate-400 uppercase mb-2">
          SCROLL TO EXPLORE CHAPTERS
        </span>
        <ArrowDown className="w-4 h-4 text-[#60A5FA] animate-bounce" />
      </div>
    </section>
  );
};
