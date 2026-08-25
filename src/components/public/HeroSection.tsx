import React from 'react';
import { useContent } from '../../context/ContentContext';
import { createWhatsAppLink } from '../../utils/formatters';
import { motion } from 'motion/react';
import { MessageCircle, ArrowDown, Sparkles } from 'lucide-react';

export const HeroSection: React.FC = () => {
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
            src={siteSettings.heroBgImage}
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
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-mono tracking-widest uppercase mb-6 backdrop-blur-md"
        >
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
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
          className="mt-6 text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl font-normal leading-relaxed text-balance"
        >
          {siteSettings.heroDescription}
        </motion.p>

        {/* Action CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
        >
          <a
            href="#menu"
            onClick={scrollToMenu}
            id="hero-explore-menu-cta"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white text-slate-950 font-display font-bold text-sm tracking-wider uppercase hover:bg-[#00E5FF] transition-all duration-200 transform hover:-translate-y-0.5 shadow-xl hover:shadow-[#00E5FF]/30 active:translate-y-0 text-center"
          >
            {siteSettings.heroCtaMenuText || 'EXPLORE MENU'}
          </a>

          <a
            href={orderWALink}
            target="_blank"
            rel="noopener noreferrer"
            id="hero-order-wa-cta"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#00E5FF] text-slate-950 font-display font-bold text-sm tracking-wider uppercase hover:bg-[#3bf0ff] transition-all duration-200 transform hover:-translate-y-0.5 shadow-xl shadow-[#00E5FF]/20 hover:shadow-[#00E5FF]/40 active:translate-y-0 flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{siteSettings.heroCtaOrderText || 'ORDER VIA WHATSAPP'}</span>
          </a>
        </motion.div>
      </div>

      {/* Bottom Scene Indicator */}
      <div className="absolute bottom-8 left-0 right-0 z-10 flex flex-col items-center pointer-events-none opacity-80">
        <span className="text-[11px] font-mono tracking-widest text-slate-400 uppercase mb-2">
          SCROLL TO EXPLORE CHAPTERS
        </span>
        <ArrowDown className="w-4 h-4 text-[#00E5FF] animate-bounce" />
      </div>
    </section>
  );
};
