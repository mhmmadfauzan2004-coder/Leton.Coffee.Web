import React from 'react';
import { useContent } from '../../context/ContentContext';
import { resolveMediaUrl } from '../../utils/api';
import { motion } from 'motion/react';

export const PageSkeletonLoader: React.FC = () => {
  const { data } = useContent();
  const brandName = data?.siteSettings?.brandName || 'LETON COFFEE';
  const tagline = data?.siteSettings?.tagline || 'EVERYDAY SPECIALTY COFFEE & YOUTH CULTURE';
  const logoUrl = data?.siteSettings?.logoUrl ? resolveMediaUrl(data.siteSettings.logoUrl) : '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        filter: 'blur(8px)',
        scale: 1.02,
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#040711] text-slate-100 overflow-hidden select-none px-4"
    >
      {/* 0.0–0.4s: CINEMATIC STUDIO BACKGROUND & LIGHTING (Deep Navy, Electric Blue & Warm Amber Core) */}
      {/* Deep Navy/Black Ambient Base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_45%,_rgba(37,99,235,0.14),_rgba(4,7,17,0.85)_60%,_#040711_100%)] pointer-events-none" />

      {/* Dynamic Central Spotlight Pulse */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[500px] sm:h-[500px] bg-[radial-gradient(circle,_rgba(0,229,255,0.12)_0%,_rgba(245,158,11,0.08)_40%,_transparent_70%)] rounded-full blur-3xl pointer-events-none animate-seq-light" />

      {/* Atmospheric Micro Ambient Particles */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-[22%] left-[20%] w-1.5 h-1.5 rounded-full bg-[#00E5FF]/60 blur-[0.5px]" />
        <div className="absolute top-[38%] right-[18%] w-2 h-2 rounded-full bg-amber-400/40 blur-[0.8px]" />
        <div className="absolute bottom-[30%] left-[24%] w-1.5 h-1.5 rounded-full bg-blue-400/50 blur-[0.5px]" />
        <div className="absolute bottom-[35%] right-[26%] w-1 h-1 rounded-full bg-[#00E5FF]/50 blur-[0.5px]" />
      </div>

      {/* 2.5D CINEMATIC PRODUCT COMMERCIAL STAGE */}
      <div className="relative flex flex-col items-center justify-center w-full max-w-sm sm:max-w-md py-4">
        
        {/* 0.4–0.8s: FLOATING COFFEE BEANS WITH MULTI-LAYER DEPTH & PARALLAX */}
        {/* Bean 1 (Foreground Left, Sharp Detail) */}
        <div className="absolute left-[6%] sm:left-[12%] top-[22%] z-30 pointer-events-none animate-seq-bean-1">
          <svg className="w-8 h-10 sm:w-9 sm:h-11 filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]" viewBox="0 0 32 40" fill="none">
            <ellipse cx="16" cy="20" rx="14" ry="18" fill="url(#beanGrad1)" />
            <path d="M16 4 C13 14, 19 26, 16 36" stroke="#100703" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M17 5 C14.5 15, 20 27, 17 35" stroke="#92400E" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
            <ellipse cx="11" cy="14" rx="4" ry="7" fill="white" opacity="0.16" transform="rotate(-15 11 14)" />
            <defs>
              <linearGradient id="beanGrad1" x1="4" y1="4" x2="28" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#5D331B" />
                <stop offset="0.5" stopColor="#371B0D" />
                <stop offset="1" stopColor="#170904" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Bean 2 (Background Right, Depth Blur) */}
        <div className="absolute right-[8%] sm:right-[15%] top-[16%] z-10 pointer-events-none filter blur-[1px] animate-seq-bean-2">
          <svg className="w-7 h-9 sm:w-8 sm:h-10 opacity-80 filter drop-shadow-[0_6px_12px_rgba(0,0,0,0.8)]" viewBox="0 0 32 40" fill="none">
            <ellipse cx="16" cy="20" rx="13" ry="17" fill="url(#beanGrad2)" />
            <path d="M16 5 C19 15, 13 25, 16 35" stroke="#0F0603" strokeWidth="2.2" strokeLinecap="round" />
            <defs>
              <linearGradient id="beanGrad2" x1="6" y1="4" x2="26" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4A2613" />
                <stop offset="1" stopColor="#150804" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Bean 3 (Foreground Right Bottom, Warm Edge Light) */}
        <div className="absolute right-[6%] sm:right-[14%] bottom-[30%] z-30 pointer-events-none animate-seq-bean-3">
          <svg className="w-7 h-9 sm:w-8 sm:h-10 filter drop-shadow-[0_12px_22px_rgba(0,0,0,0.95)]" viewBox="0 0 32 40" fill="none">
            <ellipse cx="16" cy="20" rx="14" ry="18" fill="url(#beanGrad3)" />
            <path d="M16 4 C13.5 14, 18.5 26, 16 36" stroke="#120703" strokeWidth="2.4" strokeLinecap="round" />
            <ellipse cx="11" cy="15" rx="3.5" ry="6" fill="white" opacity="0.18" transform="rotate(-20 11 15)" />
            <defs>
              <linearGradient id="beanGrad3" x1="4" y1="4" x2="28" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6C3B1E" />
                <stop offset="0.6" stopColor="#3E1F0F" />
                <stop offset="1" stopColor="#170904" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* REALISTIC STEAM CURLING UP */}
        <div className="absolute top-[6%] inset-x-0 flex items-center justify-center gap-3 z-30 pointer-events-none">
          <svg className="w-4 h-16 text-cyan-100/40 filter blur-[0.4px] animate-seq-steam-1" viewBox="0 0 16 64" fill="none">
            <path d="M8 60 C3 44, 13 28, 7 12 C5 6, 9 0, 8 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <svg className="w-4 h-16 text-amber-100/35 filter blur-[0.4px] animate-seq-steam-2" viewBox="0 0 16 64" fill="none">
            <path d="M8 58 C13 42, 4 28, 9 14 C11 7, 7 1, 8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* 0.8–1.4s: CUP & SEPARATE LID 2.5D COMPONENT */}
        <div className="relative z-20 flex flex-col items-center">
          
          {/* 1.4–1.8s: ESPRESSO POUR STREAM */}
          <div className="absolute -top-16 inset-x-0 flex flex-col items-center pointer-events-none z-10">
            <div className="w-2 h-16 bg-gradient-to-b from-amber-400 via-amber-700 to-[#2A1307] rounded-full shadow-[0_0_14px_rgba(245,158,11,0.85)] animate-seq-pour" />
            <div className="w-8 h-2.5 bg-amber-500/90 rounded-full blur-[2px] animate-seq-splash" />
          </div>

          {/* 1.4–1.8s: SEPARATE CUP LID (Moves independently and docks onto cup) */}
          <div className="relative z-30 animate-seq-lid">
            {/* Top Cap with Spout */}
            <div className="w-32 sm:w-36 h-7 rounded-full bg-gradient-to-b from-[#1C2433] via-[#0E1524] to-[#080D18] border-t border-cyan-400/40 border-x border-slate-700/50 shadow-[0_8px_16px_rgba(0,0,0,0.8)] flex items-center justify-between px-4">
              <div className="w-4.5 h-1.5 rounded-full bg-black/90 border border-cyan-500/20 shadow-inner" />
              <div className="w-2 h-2 rounded-full bg-black/80" />
            </div>
            {/* Lid Base Collar */}
            <div className="w-34 sm:w-38 -mt-1 h-3 rounded-full bg-gradient-to-r from-[#0C121E] via-[#1A2336] to-[#0A0F1A] border-b border-black/80 shadow-md mx-auto" />
          </div>

          {/* 0.8–1.4s: HERO CUP BODY (Takeaway Specialty Cup with Brand Identity) */}
          <div className="relative -mt-1.5 w-28 sm:w-34 h-40 sm:h-48 rounded-b-[24px] bg-gradient-to-r from-[#0A101D] via-[#151F33] to-[#080D18] border-x border-b border-cyan-500/25 shadow-[0_25px_45px_rgba(0,0,0,0.9)] flex flex-col items-center justify-center p-3 overflow-hidden animate-seq-cup">
            
            {/* Photorealistic Studio Reflections on Matte Paper Surface */}
            <div className="absolute inset-y-0 left-3 w-4 bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent pointer-events-none transform -skew-x-3" />
            <div className="absolute inset-y-0 right-4 w-3 bg-gradient-to-r from-transparent via-amber-400/15 to-transparent pointer-events-none" />

            {/* Cup Upper Accent Line */}
            <div className="absolute top-2 inset-x-3 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

            {/* Centered Leton Coffee Brand Emblem */}
            <div className="relative z-10 flex flex-col items-center justify-center my-auto">
              {logoUrl ? (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#070C18]/80 border border-cyan-500/30 p-2 shadow-2xl flex items-center justify-center">
                  <img
                    src={logoUrl}
                    alt={brandName}
                    className="max-h-full max-w-full object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#1E293B] to-[#0B1120] border border-cyan-400/40 shadow-2xl flex items-center justify-center">
                  <span className="font-display font-black text-[#00E5FF] text-2xl tracking-wider">
                    {brandName.charAt(0).toUpperCase() || 'L'}
                  </span>
                </div>
              )}

              {/* Embossed Brand Wordmark */}
              <div className="mt-2.5 text-center">
                <span className="font-display font-black text-[10px] sm:text-[11px] tracking-[0.28em] text-slate-100 uppercase block leading-none">
                  {brandName}
                </span>
                <span className="text-[7px] sm:text-[7.5px] tracking-[0.22em] text-[#00E5FF] uppercase font-bold mt-1 block">
                  SPECIALTY COFFEE
                </span>
              </div>
            </div>

            {/* Cup Lower Accent Line */}
            <div className="absolute bottom-3 inset-x-5 h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          </div>

          {/* Dynamic Ground Contact Shadow */}
          <div className="w-28 sm:w-32 h-5 rounded-full bg-black/95 filter blur-lg -mt-2 animate-seq-shadow" />
        </div>

        {/* 2.2–2.5s: BRAND REVEAL TYPOGRAPHY */}
        <div className="mt-5 sm:mt-6 flex flex-col items-center text-center px-4 animate-seq-brand">
          {/* Brand Title */}
          <h1 className="font-display font-extrabold text-base sm:text-lg tracking-[0.35em] text-white uppercase drop-shadow-[0_0_16px_rgba(0,229,255,0.4)]">
            {brandName}
          </h1>

          {/* Official Website Tagline */}
          {tagline && (
            <p className="mt-1.5 text-[9.5px] sm:text-[11px] text-cyan-200/70 font-sans tracking-[0.22em] uppercase font-medium max-w-[290px] sm:max-w-xs leading-relaxed">
              {tagline}
            </p>
          )}

          {/* Electric Blue / Cyan Divider */}
          <div className="w-12 h-[1.5px] bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent mt-3 shadow-[0_0_8px_#00E5FF]" />
        </div>

      </div>
    </motion.div>
  );
};
